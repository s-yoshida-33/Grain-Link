#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use chrono::Local;
use std::io::Cursor;
use zip::ZipArchive;
use tauri::Emitter;
use tauri::{Manager, RunEvent, WindowEvent};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::collections::HashMap;
use sysinfo::System;

// ── Statics for tray / watchdog ──────────────────────────────────

static FORCE_QUIT: AtomicBool = AtomicBool::new(false);
static LAST_PING: OnceLock<AtomicI64> = OnceLock::new();
static WATCHDOG_PAUSED: AtomicBool = AtomicBool::new(false);
static WATCHDOG_COUNTER_RESET: AtomicBool = AtomicBool::new(false);

const MAX_WATCHDOG_RESTARTS: i32 = 5;

// ── App state (Slack alert dedup) ────────────────────────────────

#[derive(Default)]
struct AppState {
    last_alert_state: Mutex<HashMap<String, String>>,
}

#[derive(Serialize, Deserialize)]
struct FetchResponse {
    status: u16,
    body: String,
}

#[derive(Serialize, Deserialize)]
struct DownloadResponse {
    success: bool,
    message: String,
}

#[derive(Serialize, Deserialize)]
struct LogResponse {
    success: bool,
    message: String,
}

/// Get the log directory path - unified under com.tti.grain-link
fn get_log_dir() -> Result<std::path::PathBuf, String> {
    let app_local_data_dir = dirs::data_local_dir()
        .ok_or("Failed to get local data directory")?
        .join("com.tti.grain-link")
        .join("logs");
    
    fs::create_dir_all(&app_local_data_dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;

    Ok(app_local_data_dir)
}

/// Get today's log file path
fn get_log_file_path() -> Result<std::path::PathBuf, String> {
    let log_dir = get_log_dir()?;
    let today = Local::now().format("%Y-%m-%d").to_string();
    Ok(log_dir.join(format!("grain-link-{}.log", today)))
}

// ── System info (CPU, memory, GPU, OS) ───────────────────────────

struct StaticHardwareInfo {
    cpu_name: String,
    cpu_cores: usize,
    memory_total_mb: u64,
    gpu_name: String,
    os_name: String,
    os_version: String,
}

static HARDWARE_CACHE: OnceLock<StaticHardwareInfo> = OnceLock::new();
static SYS_INSTANCE: OnceLock<Mutex<System>> = OnceLock::new();

fn get_hardware_info() -> &'static StaticHardwareInfo {
    HARDWARE_CACHE.get_or_init(|| {
        let mut sys = System::new_all();
        sys.refresh_cpu_all();
        sys.refresh_memory();

        let info = StaticHardwareInfo {
            cpu_name: sys.cpus().first()
                .map(|c| c.brand().to_string())
                .unwrap_or_else(|| "Unknown".to_string()),
            cpu_cores: sys.cpus().len(),
            memory_total_mb: sys.total_memory() / (1024 * 1024),
            gpu_name: get_gpu_name(),
            os_name: System::name().unwrap_or_else(|| "Unknown".to_string()),
            os_version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        };

        SYS_INSTANCE.get_or_init(|| Mutex::new(sys));
        info
    })
}

fn get_gpu_name() -> String {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let result = Command::new("wmic")
                .args(["path", "win32_VideoController", "get", "name"])
                .output();
            let _ = tx.send(result);
        });
        match rx.recv_timeout(std::time::Duration::from_secs(10)) {
            Ok(Ok(out)) if out.status.success() => {
                let text = String::from_utf8_lossy(&out.stdout);
                let name = text.lines()
                    .skip(1)
                    .find(|l| !l.trim().is_empty())
                    .map(|l| l.trim().to_string())
                    .unwrap_or_default();
                if !name.is_empty() {
                    return name;
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                eprintln!("[SYSTEM_INFO] wmic timed out after 10s");
            }
            _ => {}
        }
    }
    "Unknown".to_string()
}

#[derive(Serialize)]
struct SystemInfoResponse {
    cpu_name: String,
    cpu_cores: usize,
    cpu_usage: f32,
    memory_total_mb: u64,
    memory_used_mb: u64,
    memory_usage_percent: f64,
    gpu_name: String,
    os_name: String,
    os_version: String,
}

#[tauri::command]
fn get_system_info() -> SystemInfoResponse {
    let hw = get_hardware_info();

    let (cpu_usage, memory_used_mb, memory_usage_percent) = {
        let sys_lock = SYS_INSTANCE.get_or_init(|| {
            Mutex::new(System::new_all())
        });
        if let Ok(mut sys) = sys_lock.lock() {
            sys.refresh_cpu_usage();
            sys.refresh_memory();
            let cpu = sys.global_cpu_usage();
            let mem_used = sys.used_memory() / (1024 * 1024);
            let mem_pct = if sys.total_memory() > 0 {
                (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0
            } else {
                0.0
            };
            (cpu, mem_used, mem_pct)
        } else {
            (0.0, 0, 0.0)
        }
    };

    SystemInfoResponse {
        cpu_name: hw.cpu_name.clone(),
        cpu_cores: hw.cpu_cores,
        cpu_usage,
        memory_total_mb: hw.memory_total_mb,
        memory_used_mb,
        memory_usage_percent,
        gpu_name: hw.gpu_name.clone(),
        os_name: hw.os_name.clone(),
        os_version: hw.os_version.clone(),
    }
}

// ── Slack alert notification ─────────────────────────────────────

fn get_mall_id_from_settings() -> String {
    let settings_path = match dirs::data_local_dir() {
        Some(d) => d.join("com.tti.grain-link").join("settings.json"),
        None => return "unknown".to_string(),
    };
    match fs::read_to_string(&settings_path) {
        Ok(content) => {
            serde_json::from_str::<serde_json::Value>(&content)
                .ok()
                .and_then(|v| v.get("mallId").and_then(|m| m.as_str().map(String::from)))
                .unwrap_or_else(|| "unknown".to_string())
        }
        Err(_) => "unknown".to_string(),
    }
}

fn send_slack_notification(level: &str, tag: &str, message: &str, is_recovery: bool, context_str: &str) {
    let webhook_url = match std::env::var("SLACK_WEBHOOK_URL") {
        Ok(url) if !url.is_empty() => url,
        _ => return,
    };

    let title = if is_recovery {
        format!("RECOVERY: {}", tag)
    } else {
        format!("ALERT: {}", tag)
    };

    let app_version = env!("CARGO_PKG_VERSION");
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    let mall_id = get_mall_id_from_settings();

    let ctx_line = if context_str.is_empty() {
        String::new()
    } else {
        format!("\n*Context*: {}", context_str)
    };

    let payload = serde_json::json!({
        "text": format!(
            "*{title}*\n*Level*: {level}\n*Scope*: {tag}\n*App*: Grain Link\n*Version*: {app_version}\n*Mall*: {mall_id}\n*Host*: {hostname}\n*Message*: {message}{ctx_line}"
        )
    });

    std::thread::spawn(move || {
        let client = reqwest::blocking::Client::new();
        let _ = client.post(&webhook_url).json(&payload).send();
    });
}

// ── Logging command with Slack alert integration ─────────────────

const ALERT_SCOPES: &[&str] = &[
    "LOCAL_VIDEO",
    "VIDEO_VALIDATION",
    "DATA_SYNC",
    "CONFIG",
    "RENDERER_ERROR",
    "UPDATER",
    "MEDIA_UPDATE",
    "MEDIA_SYNC",
    "MEDIA_DOWNLOAD",
    "BOOT",
];

#[tauri::command]
fn write_log(
    level: String,
    tag: String,
    message: String,
    context: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<LogResponse, String> {
    let upper_level = level.to_uppercase();
    let context_str = context.unwrap_or_default();

    // State-transition based alert: ok→alert sends ALERT, alert→ok sends RECOVERY
    if ALERT_SCOPES.contains(&tag.as_str()) {
        let is_error = matches!(upper_level.as_str(), "WARN" | "ERROR" | "FATAL");

        if let Ok(mut map) = state.last_alert_state.lock() {
            let current = map.get(&tag).cloned().unwrap_or_else(|| "ok".to_string());

            if is_error && current == "ok" {
                map.insert(tag.clone(), "alert".to_string());
                send_slack_notification(&upper_level, &tag, &message, false, &context_str);
            } else if upper_level == "INFO" && current == "alert" {
                map.insert(tag.clone(), "ok".to_string());
                send_slack_notification(&upper_level, &tag, &message, true, &context_str);
            } else if is_error {
                map.insert(tag.clone(), "alert".to_string());
            }
        }
    }

    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
    let log_entry = if context_str.is_empty() {
        format!("[{}] [{}] [{}] {}\n", timestamp, upper_level, tag, message)
    } else {
        format!("[{}] [{}] [{}] {} | {}\n", timestamp, upper_level, tag, message, context_str)
    };

    let log_file_path = get_log_file_path()?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file_path)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    file.write_all(log_entry.as_bytes())
        .map_err(|e| format!("Failed to write log: {}", e))?;

    Ok(LogResponse {
        success: true,
        message: format!("Logged to {}", log_file_path.display()),
    })
}

#[tauri::command]
fn fetch_shops_proxy(url: String) -> Result<FetchResponse, String> {
    let client = reqwest::blocking::Client::new();
    let response = client
        .get(&url)
        .header("Cache-Control", "no-cache")
        .header("Pragma", "no-cache")
        .send()
        .map_err(|e| format!("HTTP error: {}", e))?;

    let status = response.status().as_u16();
    let body = response
        .text()
        .map_err(|e| format!("Body read error: {}", e))?;

    Ok(FetchResponse { status, body })
}

#[tauri::command]
fn read_image_file(file_path: String) -> Result<Vec<u8>, String> {
    fs::read(&file_path)
        .map_err(|e| format!("Failed to read image file: {}", e))
}

#[tauri::command]
fn read_video_file(file_path: String) -> Result<Vec<u8>, String> {
    fs::read(&file_path)
        .map_err(|e| format!("Failed to read video file: {}", e))
}

#[tauri::command]
fn download_media(
    url: String,
    file_name: String,
    media_type: String,
) -> Result<DownloadResponse, String> {
    // Execute download (non-blocking)
    let rt = tokio::runtime::Runtime::new()
        .map_err(|e| format!("Runtime error: {}", e))?;

    rt.block_on(async {
        download_media_async(url, file_name, media_type).await
    })
}

async fn download_media_async(
    url: String,
    file_name: String,
    media_type: String,
) -> Result<DownloadResponse, String> {
    // Get application local data directory - unified under com.tti.grain-link
    let app_local_data_dir = dirs::data_local_dir()
        .ok_or("Failed to get local data directory")?
        .join("com.tti.grain-link");

    // Separate directories based on media type
    let subdir = match media_type.as_str() {
        "image" => "images",
        "video" => "videos",
        _ => "media",
    };

    // Construct file path (under com.tti.grain-link)
    let media_dir = app_local_data_dir.join(subdir);
    fs::create_dir_all(&media_dir)
        .map_err(|e| format!("Failed to create media directory: {}", e))?;

    let file_path = media_dir.join(&file_name);

    // Download from URL
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Bad HTTP status: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    // Save to file
    let mut file = fs::File::create(&file_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;

    file.write_all(&bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(DownloadResponse {
        success: true,
        message: format!("Downloaded {} to {}", file_name, file_path.display()),
    })
}

// --- ZIP Sync with progress events ---

#[derive(Clone, Serialize)]
struct MediaProgress {
    phase: String,       // "download" or "extract"
    downloaded: u64,     // bytes downloaded
    total: u64,          // total bytes (0 if unknown)
    extracted: u32,      // files extracted so far
    total_files: u32,    // total files in archive
}

#[tauri::command]
async fn sync_media_from_zip(app: tauri::AppHandle, url: String) -> Result<DownloadResponse, String> {
    // Target directory: AppData/Local/com.tti.grain-link/videos/
    let extract_dir = dirs::data_local_dir()
        .ok_or("Failed to get local data directory")?
        .join("com.tti.grain-link")
        .join("videos");

    // Clean up existing videos directory to ensure stale files are removed on differential updates
    if extract_dir.exists() {
        fs::remove_dir_all(&extract_dir)
            .map_err(|e| format!("Failed to clean videos directory: {}", e))?;
    }

    fs::create_dir_all(&extract_dir)
        .map_err(|e| format!("Failed to create videos directory: {}", e))?;

    // 1. Download ZIP with chunked progress
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;
    let response = client.get(&url).send().await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Bad HTTP status: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut buffer = Vec::with_capacity(if total_size > 0 { total_size as usize } else { 10 * 1024 * 1024 });

    let mut response = response;
    while let Some(chunk) = response.chunk().await.map_err(|e| format!("Download error: {}", e))? {
        downloaded += chunk.len() as u64;
        buffer.extend_from_slice(&chunk);
        let _ = app.emit("media-progress", MediaProgress {
            phase: "download".to_string(),
            downloaded,
            total: total_size,
            extracted: 0,
            total_files: 0,
        });
    }

    // 2. Extract ZIP in memory
    let reader = Cursor::new(buffer);
    let mut archive = ZipArchive::new(reader)
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let total_files = archive.len() as u32;

    // 3. Extract files into videos directory
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read file in zip: {}", e))?;

        // Prevent path traversal attacks
        let outpath = match file.enclosed_name() {
            Some(path) => extract_dir.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create dir: {}", e))?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p)
                        .map_err(|e| format!("Failed to create parent dir: {}", e))?;
                }
            }
            let mut outfile = fs::File::create(&outpath)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to write extracted file: {}", e))?;
        }

        let _ = app.emit("media-progress", MediaProgress {
            phase: "extract".to_string(),
            downloaded,
            total: total_size,
            extracted: (i + 1) as u32,
            total_files,
        });
    }

    Ok(DownloadResponse {
        success: true,
        message: "Media synchronization completed".to_string(),
    })
}

// ── Watchdog ping from frontend ──────────────────────────────────

#[tauri::command]
fn webview_ping() -> Result<String, String> {
    let ts = chrono::Utc::now().timestamp();
    let ping = LAST_PING.get_or_init(|| AtomicI64::new(ts));
    ping.store(ts, Ordering::Relaxed);

    // First successful ping after (re)start → reset the restart counter
    if WATCHDOG_COUNTER_RESET.compare_exchange(false, true, Ordering::Relaxed, Ordering::Relaxed).is_ok() {
        if let Ok(counter_path) = get_watchdog_counter_path() {
            let _ = fs::write(&counter_path, "0");
        }
    }

    Ok("pong".to_string())
}

#[tauri::command]
fn quit_app() {
    FORCE_QUIT.store(true, Ordering::Relaxed);
    std::process::exit(0);
}

#[tauri::command]
fn pause_watchdog() -> Result<String, String> {
    WATCHDOG_PAUSED.store(true, Ordering::Relaxed);
    write_log_to_file("INFO", "WATCHDOG", "Watchdog paused (e.g. during app update)");
    Ok("paused".to_string())
}

#[tauri::command]
fn resume_watchdog() -> Result<String, String> {
    // Reset ping timestamp so the watchdog doesn't fire immediately
    let ts = chrono::Utc::now().timestamp();
    if let Some(ping) = LAST_PING.get() {
        ping.store(ts, Ordering::Relaxed);
    }
    WATCHDOG_PAUSED.store(false, Ordering::Relaxed);
    write_log_to_file("INFO", "WATCHDOG", "Watchdog resumed");
    Ok("resumed".to_string())
}

// ── Helpers ──────────────────────────────────────────────────────

fn get_watchdog_counter_path() -> Result<std::path::PathBuf, String> {
    let dir = dirs::data_local_dir()
        .ok_or("Failed to get local data directory")?
        .join("com.tti.grain-link");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create dir: {}", e))?;
    Ok(dir.join("watchdog_restart_count"))
}

fn write_log_to_file(level: &str, tag: &str, message: &str) {
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
    let entry = format!("[{}] [{}] [{}] {}\n", timestamp, level, tag, message);

    if let Ok(path) = get_log_file_path() {
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
            let _ = f.write_all(entry.as_bytes());
        }
    }
}

// ── Shop change notification (bypasses state machine, sends Slack directly) ──

#[derive(serde::Deserialize)]
struct ShopChangeItem {
    id: String,
    name: String,
}

#[tauri::command]
fn notify_shop_change(
    added: Vec<ShopChangeItem>,
    removed: Vec<ShopChangeItem>,
) -> Result<(), String> {
    if added.is_empty() && removed.is_empty() {
        return Ok(());
    }
    let mut parts: Vec<String> = Vec::new();
    if !added.is_empty() {
        let list = added.iter().map(|s| format!("{} ({})", s.name, s.id)).collect::<Vec<_>>().join(", ");
        parts.push(format!("追加: {}", list));
    }
    if !removed.is_empty() {
        let list = removed.iter().map(|s| format!("{} ({})", s.name, s.id)).collect::<Vec<_>>().join(", ");
        parts.push(format!("削除: {}", list));
    }
    let message = parts.join(" / ");
    let context = match (added.len(), removed.len()) {
        (a, 0) => format!("追加 {}件", a),
        (0, r) => format!("削除 {}件", r),
        (a, r) => format!("追加 {}件 / 削除 {}件", a, r),
    };
    send_slack_notification("WARN", "SHOPLIST", &message, false, &context);
    Ok(())
}

// ── System tray ──────────────────────────────────────────────────

fn setup_system_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "表示", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().unwrap())
        .tooltip(app.config().product_name.as_deref().unwrap_or("Grain Link"))
        .menu(&menu)
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    FORCE_QUIT.store(true, Ordering::Relaxed);
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

// ── Watchdog thread ──────────────────────────────────────────────

fn start_webview_watchdog(app_handle: tauri::AppHandle) {
    let ts = chrono::Utc::now().timestamp();
    LAST_PING.get_or_init(|| AtomicI64::new(ts));

    std::thread::spawn(move || {
        // Wait for frontend to boot up before monitoring
        std::thread::sleep(std::time::Duration::from_secs(30));

        write_log_to_file("INFO", "WATCHDOG", "Watchdog thread started");

        loop {
            std::thread::sleep(std::time::Duration::from_secs(15));

            if FORCE_QUIT.load(Ordering::Relaxed) {
                break;
            }
            if WATCHDOG_PAUSED.load(Ordering::Relaxed) {
                continue;
            }

            let now = chrono::Utc::now().timestamp();
            let last = LAST_PING.get().map(|p| p.load(Ordering::Relaxed)).unwrap_or(now);
            let elapsed = now - last;

            if elapsed > 60 {
                let msg = format!("No ping from WebView for {}s — attempting restart", elapsed);
                write_log_to_file("ERROR", "WATCHDOG", &msg);

                let counter_path = match get_watchdog_counter_path() {
                    Ok(p) => p,
                    Err(_) => {
                        send_slack_notification("FATAL", "WATCHDOG", &msg, false, "");
                        FORCE_QUIT.store(true, Ordering::Relaxed);
                        app_handle.restart();
                    }
                };

                let count: i32 = fs::read_to_string(&counter_path)
                    .ok()
                    .and_then(|s| s.trim().parse().ok())
                    .unwrap_or(0);

                if count >= MAX_WATCHDOG_RESTARTS {
                    let max_msg = format!(
                        "Max watchdog restarts ({}) reached — stopping restart loop",
                        MAX_WATCHDOG_RESTARTS
                    );
                    write_log_to_file("FATAL", "WATCHDOG", &max_msg);
                    send_slack_notification("FATAL", "WATCHDOG", &max_msg, false, "");
                    break;
                }

                let _ = fs::write(&counter_path, (count + 1).to_string());
                let restart_msg = format!("Restarting app (attempt {}/{})", count + 1, MAX_WATCHDOG_RESTARTS);
                write_log_to_file("WARN", "WATCHDOG", &restart_msg);
                send_slack_notification("FATAL", "WATCHDOG", &restart_msg, false, "");

                // FORCE_QUIT を立てることで on_window_event の prevent_close が
                // スキップされ、ウィンドウ破棄時の TAO パニックを防ぐ。
                FORCE_QUIT.store(true, Ordering::Relaxed);
                app_handle.restart();
            }
        }
    });
}

// ── Focus guard: EVENT_SYSTEM_FOREGROUND hook + periodic TOPMOST enforcement
// (Windows only)
//
// Three-layer protection against other windows appearing above Grain Link:
// 1. Event hook — catches windows that steal keyboard focus (immediate)
// 2. Timer     — periodic enforcement every 5 seconds:
//    2a. Demote foreign visible TOPMOST windows to NOTOPMOST (EnumWindows)
//    2b. Re-assert our own TOPMOST position
// ─────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
mod focus_guard {
    use std::sync::atomic::{AtomicIsize, AtomicBool, Ordering};

    type HWND = isize;
    type HWINEVENTHOOK = isize;
    type DWORD = u32;
    type UINT = u32;
    type LONG = i32;
    type BOOL = i32;
    type WPARAM = usize;
    type LPARAM = isize;
    #[allow(non_camel_case_types)]
    type UINT_PTR = usize;
    type WNDENUMPROC = unsafe extern "system" fn(HWND, LPARAM) -> BOOL;

    const EVENT_SYSTEM_FOREGROUND: DWORD = 0x0003;
    const WINEVENT_OUTOFCONTEXT: DWORD = 0x0000;
    const HWND_TOPMOST: HWND = -1;
    const HWND_NOTOPMOST: HWND = -2;
    const SWP_NOMOVE: UINT = 0x0002;
    const SWP_NOSIZE: UINT = 0x0001;
    const SWP_NOACTIVATE: UINT = 0x0010;
    const SWP_SHOWWINDOW: UINT = 0x0040;
    const WM_TIMER: UINT = 0x0113;
    const GWL_EXSTYLE: i32 = -20;
    const WS_EX_TOPMOST: LONG = 0x0008;
    const TOPMOST_TIMER_ID: UINT_PTR = 1;
    /// Enforce TOPMOST every 5 seconds: demote foreign TOPMOST windows and
    /// re-assert our own position.
    const TOPMOST_INTERVAL_MS: u32 = 5_000;

    #[repr(C)]
    #[allow(non_snake_case)]
    struct MSG {
        hwnd: HWND,
        message: UINT,
        wParam: WPARAM,
        lParam: LPARAM,
        time: DWORD,
        pt_x: LONG,
        pt_y: LONG,
    }

    type WINEVENTPROC = unsafe extern "system" fn(
        HWINEVENTHOOK, DWORD, HWND, LONG, LONG, DWORD, DWORD,
    );

    #[link(name = "user32")]
    extern "system" {
        fn SetWinEventHook(
            event_min: DWORD,
            event_max: DWORD,
            hmod_win_event_proc: isize,
            pfn_win_event_proc: WINEVENTPROC,
            id_process: DWORD,
            id_thread: DWORD,
            dw_flags: DWORD,
        ) -> HWINEVENTHOOK;
        fn GetForegroundWindow() -> HWND;
        fn SetForegroundWindow(hwnd: HWND) -> BOOL;
        fn SetWindowPos(
            hwnd: HWND,
            hwnd_insert_after: HWND,
            x: i32, y: i32, cx: i32, cy: i32,
            u_flags: UINT,
        ) -> BOOL;
        fn GetMessageW(
            msg: *mut MSG,
            hwnd: HWND,
            msg_filter_min: UINT,
            msg_filter_max: UINT,
        ) -> BOOL;
        fn DispatchMessageW(msg: *const MSG) -> isize;
        fn SetTimer(
            hwnd: HWND,
            id_event: UINT_PTR,
            elapse: UINT,
            lp_timer_func: LPARAM,
        ) -> UINT_PTR;
        fn EnumWindows(
            lp_enum_func: WNDENUMPROC,
            l_param: LPARAM,
        ) -> BOOL;
        fn GetWindowLongW(hwnd: HWND, n_index: i32) -> LONG;
        fn IsWindowVisible(hwnd: HWND) -> BOOL;
    }

    static OWN_HWND: AtomicIsize = AtomicIsize::new(0);
    static RESTORE_PENDING: AtomicBool = AtomicBool::new(false);

    /// Seconds to wait before restoring focus.
    /// Short-lived popups will have disappeared by this time,
    /// so we only act on persistent windows.
    const RESTORE_DELAY_SECS: u64 = 3;

    /// EnumWindows callback: demote any visible foreign TOPMOST window to
    /// NOTOPMOST so it drops below our window in the Z-order.
    /// lParam carries our own HWND to skip.
    unsafe extern "system" fn enum_demote_topmost(hwnd: HWND, l_param: LPARAM) -> BOOL {
        let own = l_param as HWND;
        if hwnd == own || IsWindowVisible(hwnd) == 0 {
            return 1;
        }
        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
        if (ex_style & WS_EX_TOPMOST) != 0 {
            SetWindowPos(
                hwnd, HWND_NOTOPMOST,
                0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            );
        }
        1
    }

    /// Layer 1: EVENT_SYSTEM_FOREGROUND callback.
    /// Fires when another process takes keyboard focus.
    unsafe extern "system" fn hook_proc(
        _hook: HWINEVENTHOOK,
        _event: DWORD,
        hwnd: HWND,
        _id_object: LONG,
        _id_child: LONG,
        _event_thread: DWORD,
        _event_time: DWORD,
    ) {
        let own = OWN_HWND.load(Ordering::Relaxed);
        if own == 0 || hwnd == own {
            return;
        }

        if RESTORE_PENDING.swap(true, Ordering::Relaxed) {
            return;
        }

        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(RESTORE_DELAY_SECS));

            unsafe {
                let fg = GetForegroundWindow();
                if fg != own {
                    SetWindowPos(
                        own, HWND_TOPMOST,
                        0, 0, 0, 0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW,
                    );
                    SetForegroundWindow(own);
                    super::write_log_to_file(
                        "INFO",
                        "FOCUS_GUARD",
                        "Restored foreground focus (another window stole focus)",
                    );
                }
            }

            RESTORE_PENDING.store(false, Ordering::Relaxed);
        });
    }

    /// Start the focus guard on a dedicated thread with its own message pump.
    ///
    /// Layer 1: `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` — immediate
    ///          response when another window steals keyboard focus.
    /// Layer 2: `SetTimer` — periodic TOPMOST enforcement that demotes
    ///          foreign TOPMOST windows (e.g. RustDesk overlays) and
    ///          re-asserts our own TOPMOST position.
    pub fn start(hwnd: isize) {
        OWN_HWND.store(hwnd, Ordering::Relaxed);

        std::thread::spawn(move || {
            unsafe {
                // Layer 1: foreground event hook
                let hook = SetWinEventHook(
                    EVENT_SYSTEM_FOREGROUND,
                    EVENT_SYSTEM_FOREGROUND,
                    0,
                    hook_proc,
                    0, 0,
                    WINEVENT_OUTOFCONTEXT,
                );

                if hook == 0 {
                    eprintln!("[FOCUS_GUARD] Failed to set foreground event hook");
                    super::write_log_to_file(
                        "ERROR",
                        "FOCUS_GUARD",
                        "Failed to set SetWinEventHook for EVENT_SYSTEM_FOREGROUND",
                    );
                    return;
                }

                // Layer 2: periodic TOPMOST enforcement timer
                SetTimer(0, TOPMOST_TIMER_ID, TOPMOST_INTERVAL_MS, 0);

                // Message pump — required for both the event hook and WM_TIMER
                let mut msg: MSG = std::mem::zeroed();
                while GetMessageW(&mut msg, 0, 0, 0) > 0 {
                    if msg.message == WM_TIMER && msg.wParam == TOPMOST_TIMER_ID {
                        EnumWindows(enum_demote_topmost, hwnd as LPARAM);
                        SetWindowPos(
                            hwnd, HWND_TOPMOST,
                            0, 0, 0, 0,
                            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                        );
                        continue;
                    }
                    DispatchMessageW(&msg);
                }
            }
        });
    }
}

// ── Panic hook ───────────────────────────────────────────────────

fn install_panic_hook() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown".to_string());

        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "unknown payload".to_string()
        };

        let message = format!("PANIC at {}: {}", location, payload);
        write_log_to_file("FATAL", "PANIC", &message);
        send_slack_notification("FATAL", "PANIC", &message, false, &location);
        default_hook(info);
    }));
}

// ── main ─────────────────────────────────────────────────────────

fn main() {
    install_panic_hook();

    let builder = tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            fetch_shops_proxy,
            read_image_file,
            read_video_file,
            download_media,
            sync_media_from_zip,
            write_log,
            get_system_info,
            webview_ping,
            quit_app,
            pause_watchdog,
            resume_watchdog,
            notify_shop_change
        ])
        .setup(|app| {
            setup_system_tray(app)?;
            start_webview_watchdog(app.handle().clone());

            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    match window.hwnd() {
                        Ok(hwnd) => {
                            focus_guard::start(hwnd.0 as isize);
                            write_log_to_file("INFO", "FOCUS_GUARD", "Foreground event hook started");
                        }
                        Err(e) => {
                            let msg = format!("Failed to get main window HWND: {}", e);
                            eprintln!("[FOCUS_GUARD] {}", msg);
                            write_log_to_file("ERROR", "FOCUS_GUARD", &msg);
                        }
                    }
                }
            }

            write_log_to_file("INFO", "SYS_INIT", "Application started with tray and watchdog");
            Ok(())
        })
        .on_window_event(|_window, event| {
            // Prevent window close — kiosk mode. Only tray "終了" or quit_app can exit.
            // FORCE_QUIT が立っている場合(watchdog restart / quit_app)は
            // prevent_close をスキップし、ウィンドウを正常に破棄させる。
            // これにより tao の "cannot move state from Destroyed" パニックを防ぐ。
            if let WindowEvent::CloseRequested { api, .. } = event {
                if !FORCE_QUIT.load(Ordering::Relaxed) {
                    api.prevent_close();
                }
            }
        });

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| {
        if let RunEvent::ExitRequested { api, .. } = &event {
            if !FORCE_QUIT.load(Ordering::Relaxed) {
                api.prevent_exit();
            }
        }
    });
}