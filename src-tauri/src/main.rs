#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use chrono::Local;
use tauri::AppHandle;

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

/// Get the log directory path using Tauri's app local data directory
fn get_log_dir(app_handle: &AppHandle) -> Result<std::path::PathBuf, String> {
    let app_local_data_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to get app local data dir: {}", e))?;
    
    let log_dir = app_local_data_dir.join("logs");
    
    fs::create_dir_all(&log_dir)
        .map_err(|e| format!("Failed to create log directory: {}", e))?;

    Ok(log_dir)
}

/// Get today's log file path
fn get_log_file_path(app_handle: &AppHandle) -> Result<std::path::PathBuf, String> {
    let log_dir = get_log_dir(app_handle)?;
    let today = Local::now().format("%Y-%m-%d").to_string();
    Ok(log_dir.join(format!("grain-link-{}.log", today)))
}

#[tauri::command]
fn write_log(
    app_handle: AppHandle,
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

    // ログファイルに追記
    let log_file_path = get_log_file_path(&app_handle)?;
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
    app_handle: AppHandle,
    url: String,
    file_name: String,
    media_type: String,
) -> Result<DownloadResponse, String> {
    // ダウンロード実行（非ブロッキング）
    let rt = tokio::runtime::Runtime::new()
        .map_err(|e| format!("Runtime error: {}", e))?;

    rt.block_on(async {
        download_media_async(app_handle, url, file_name, media_type).await
    })
}

async fn download_media_async(
    app_handle: AppHandle,
    url: String,
    file_name: String,
    media_type: String,
) -> Result<DownloadResponse, String> {
    // Tauri のアプリケーションローカルデータディレクトリを取得
    let app_local_data_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to get app local data dir: {}", e))?;

    // メディアタイプに応じてディレクトリを分ける
    let subdir = match media_type.as_str() {
        "image" => "images",
        "video" => "videos",
        _ => "media",
    };

    // ファイルパスを構築（com.tti.grain-link 配下）
    let media_dir = app_local_data_dir.join(subdir);
    fs::create_dir_all(&media_dir)
        .map_err(|e| format!("Failed to create media directory: {}", e))?;

    let file_path = media_dir.join(&file_name);

    // URLからダウンロード
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

    // ファイルに保存
    let mut file = fs::File::create(&file_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;

    file.write_all(&bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(DownloadResponse {
        success: true,
        message: format!("Downloaded {} to {}", file_name, file_path.display()),
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
            write_log
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {});
}
