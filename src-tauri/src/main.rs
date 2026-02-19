#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use chrono::Local;
use std::io::Cursor;
use zip::ZipArchive;

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

#[tauri::command]
fn write_log(
    level: String,
    tag: String,
    message: String,
    context: Option<String>,
) -> Result<LogResponse, String> {
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
    
    let context_str = context.unwrap_or_default();
    let log_entry = if context_str.is_empty() {
        format!("[{}] [{}] [{}] {}\n", timestamp, level, tag, message)
    } else {
        format!("[{}] [{}] [{}] {} | {}\n", timestamp, level, tag, message, context_str)
    };

    // Append to log file
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

// --- New Command: ZIP Sync ---

#[tauri::command]
fn sync_media_from_zip(url: String) -> Result<DownloadResponse, String> {
    let rt = tokio::runtime::Runtime::new()
        .map_err(|e| format!("Runtime error: {}", e))?;

    rt.block_on(async {
        download_and_extract_zip(url).await
    })
}

async fn download_and_extract_zip(url: String) -> Result<DownloadResponse, String> {
    // Target directory: AppData/Local/com.tti.grain-link/
    // The ZIP is expected to contain "images/" and "videos/" folders directly, or flat files.
    let app_local_data_dir = dirs::data_local_dir()
        .ok_or("Failed to get local data directory")?
        .join("com.tti.grain-link");

    // 1. Download ZIP
    let client = reqwest::Client::new();
    let response = client.get(&url).send().await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Bad HTTP status: {}", response.status()));
    }

    let bytes = response.bytes().await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    // 2. Extract ZIP in memory
    let reader = Cursor::new(bytes);
    let mut archive = ZipArchive::new(reader)
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;

    // 3. Extract files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read file in zip: {}", e))?;
        
        // Prevent path traversal attacks
        let outpath = match file.enclosed_name() {
            Some(path) => app_local_data_dir.join(path),
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
    }

    Ok(DownloadResponse {
        success: true,
        message: "Media synchronization completed".to_string(),
    })
}

fn main() {
    let builder = tauri::Builder::default()
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
            write_log
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {});
}