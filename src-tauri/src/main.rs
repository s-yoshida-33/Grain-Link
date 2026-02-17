#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::thread;

#[derive(Serialize, Deserialize)]
struct FetchResponse {
    status: u16,
    body: String,
}

// グローバルビデオディレクトリ (Arc<Mutex>で複数スレッドから安全にアクセス)
lazy_static::lazy_static! {
    static ref VIDEO_DIR: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
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
fn set_video_dir(dir: String) -> Result<(), String> {
    let mut video_dir = VIDEO_DIR.lock().map_err(|e| format!("Lock error: {}", e))?;
    *video_dir = dir;
    Ok(())
}

fn start_video_server() {
    thread::spawn(|| {
        let server = tiny_http::Server::http("127.0.0.1:9001")
            .expect("Failed to start video server");

        for request in server.incoming_requests() {
            let method = request.method().to_string();
            let uri = request.url().to_string();

            if method == "GET" && uri.starts_with("/videos/") {
                let filename = uri.strip_prefix("/videos/").unwrap_or("");
                
                // グローバルビデオディレクトリから読み込む
                let video_dir = VIDEO_DIR.lock().unwrap_or_else(|e| e.into_inner());
                let file_path = Path::new(&*video_dir).join(filename);

                eprintln!("[VIDEO_SERVER] Request: {} -> Path: {:?}", filename, file_path);

                match fs::read(&file_path) {
                    Ok(data) => {
                        let mime_type = if filename.ends_with(".mp4") {
                            "video/mp4"
                        } else if filename.ends_with(".webm") {
                            "video/webm"
                        } else {
                            "application/octet-stream"
                        };

                        let response = tiny_http::Response::from_data(data)
                            .with_header(
                                tiny_http::Header::from_bytes(&b"Content-Type"[..], mime_type.as_bytes())
                                    .unwrap(),
                            )
                            .with_header(
                                tiny_http::Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..])
                                    .unwrap(),
                            );

                        let _ = request.respond(response);
                        eprintln!("[VIDEO_SERVER] Served: {}", filename);
                    }
                    Err(e) => {
                        eprintln!("[VIDEO_SERVER] Not found: {:?} - {}", file_path, e);
                        let response = tiny_http::Response::from_string("Not Found")
                            .with_status_code(404);
                        let _ = request.respond(response);
                    }
                }
            }
        }
    });
}

fn main() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            fetch_shops_proxy,
            read_image_file,
            read_video_file,
            set_video_dir
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // ビデオサーバーを起動
    start_video_server();

    app.run(|_app_handle, _event| {});
}
