use reqwest::multipart::{Form, Part};
use serde::Serialize;
use std::{
    env,
    error::Error,
    fmt, io,
    path::{Path, PathBuf},
};
use tauri::{
    image::Image,
    menu::{Menu, MenuEvent, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use url::Url;

const DEFAULT_BACKEND_URL: &str = "http://localhost:3000";
const BACKEND_URL_ENV: &str = "TROVE_BACKEND_URL";
const INGEST_TOKEN_ENV: &str = "TROVE_INGEST_TOKEN";
const PROJECT_ID_ENV: &str = "TROVE_PROJECT_ID";
const MAX_FILE_BYTES: u64 = 32 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
struct JsonIngestPayload {
    #[serde(rename = "type")]
    kind: &'static str,
    text: String,
    #[serde(rename = "projectId")]
    project_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct FileIngestPayload {
    path: PathBuf,
    file_name: String,
    mime_type: &'static str,
    project_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum PreparedIngest {
    Json(JsonIngestPayload),
    File(FileIngestPayload),
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct IngestConfig {
    backend_url: String,
    ingest_token: String,
    project_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum ConfigError {
    MissingEnv(&'static str),
    InvalidBackendUrl(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum PrepareDropError {
    DirectoryUnsupported(PathBuf),
    MissingFileName(PathBuf),
}

impl IngestConfig {
    fn from_env() -> Result<Self, ConfigError> {
        Self::from_reader(|key| env::var(key).ok())
    }

    fn from_reader<F>(mut read: F) -> Result<Self, ConfigError>
    where
        F: FnMut(&str) -> Option<String>,
    {
        let backend_url = normalize_backend_url(
            read(BACKEND_URL_ENV)
                .filter(|value| !value.trim().is_empty())
                .as_deref()
                .unwrap_or(DEFAULT_BACKEND_URL),
        )?;
        let ingest_token = required_env(&mut read, INGEST_TOKEN_ENV)?;
        let project_id = required_env(&mut read, PROJECT_ID_ENV)?;

        Ok(Self {
            backend_url,
            ingest_token,
            project_id,
        })
    }

    fn ingest_url(&self) -> String {
        format!("{}/api/ingest", self.backend_url)
    }
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingEnv(name) => write!(f, "missing required env var {name}"),
            Self::InvalidBackendUrl(url) => {
                write!(f, "invalid backend URL in {BACKEND_URL_ENV}: {url}")
            }
        }
    }
}

impl Error for ConfigError {}

impl fmt::Display for PrepareDropError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::DirectoryUnsupported(path) => {
                write!(
                    f,
                    "directories are not supported for ingest: {}",
                    path.display()
                )
            }
            Self::MissingFileName(path) => {
                write!(f, "could not determine file name for {}", path.display())
            }
        }
    }
}

impl Error for PrepareDropError {}

fn required_env<F>(read: &mut F, name: &'static str) -> Result<String, ConfigError>
where
    F: FnMut(&str) -> Option<String>,
{
    let value = read(name).unwrap_or_default();
    let trimmed = value.trim();

    if trimmed.is_empty() {
        return Err(ConfigError::MissingEnv(name));
    }

    Ok(trimmed.to_string())
}

fn normalize_backend_url(value: &str) -> Result<String, ConfigError> {
    let normalized = value.trim().trim_end_matches('/').to_string();
    match Url::parse(&normalized) {
        Ok(url) if matches!(url.scheme(), "http" | "https") => Ok(normalized),
        _ => Err(ConfigError::InvalidBackendUrl(value.trim().to_string())),
    }
}

fn is_http_url(value: &str) -> bool {
    Url::parse(value)
        .map(|url| matches!(url.scheme(), "http" | "https"))
        .unwrap_or(false)
}

fn prepare_drop(input: &str, project_id: &str) -> Result<PreparedIngest, PrepareDropError> {
    if is_http_url(input) {
        return Ok(PreparedIngest::Json(JsonIngestPayload {
            kind: "url",
            text: input.to_string(),
            project_id: project_id.to_string(),
        }));
    }

    let path = PathBuf::from(input);
    if path.exists() {
        if path.is_dir() {
            return Err(PrepareDropError::DirectoryUnsupported(path));
        }

        let file_name = path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .ok_or_else(|| PrepareDropError::MissingFileName(path.clone()))?;

        return Ok(PreparedIngest::File(FileIngestPayload {
            mime_type: content_type_for_path(&path),
            path,
            file_name,
            project_id: project_id.to_string(),
        }));
    }

    Ok(PreparedIngest::Json(JsonIngestPayload {
        kind: "text",
        text: input.to_string(),
        project_id: project_id.to_string(),
    }))
}

fn content_type_for_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("pdf") => "application/pdf",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("docx") => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        Some("xlsx") => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        Some("txt") => "text/plain",
        Some("md") | Some("markdown") => "text/markdown",
        Some("csv") => "text/csv",
        Some("tsv") => "text/tab-separated-values",
        Some("json") => "application/json",
        Some("html") => "text/html",
        Some("xml") => "application/xml",
        Some("log") => "text/plain",
        Some("yaml") | Some("yml") => "application/yaml",
        _ => "application/octet-stream",
    }
}

async fn send_ingest(
    client: &reqwest::Client,
    config: &IngestConfig,
    payload: PreparedIngest,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    match payload {
        PreparedIngest::Json(body) => {
            let response = client
                .post(config.ingest_url())
                .bearer_auth(&config.ingest_token)
                .json(&body)
                .send()
                .await?;
            require_success(response).await?;
        }
        PreparedIngest::File(file) => {
            ensure_ingest_file_size(&file.path).await?;
            let bytes = tokio::fs::read(&file.path).await?;
            let part = Part::bytes(bytes)
                .file_name(file.file_name)
                .mime_str(file.mime_type)?;
            let form = Form::new()
                .text("projectId", file.project_id)
                .part("file", part);

            let response = client
                .post(config.ingest_url())
                .bearer_auth(&config.ingest_token)
                .multipart(form)
                .send()
                .await?;
            require_success(response).await?;
        }
    }

    Ok(())
}

async fn ensure_ingest_file_size(path: &Path) -> io::Result<()> {
    let size = tokio::fs::metadata(path).await?.len();
    if size > MAX_FILE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!(
                "file too large (max {}MB): {}",
                MAX_FILE_BYTES / 1024 / 1024,
                path.display()
            ),
        ));
    }

    Ok(())
}

async fn require_success(response: reqwest::Response) -> Result<(), Box<dyn Error + Send + Sync>> {
    let status = response.status();
    if status.is_success() {
        return Ok(());
    }

    let body = response.text().await.unwrap_or_default();
    let detail = body.trim();
    let message = if detail.is_empty() {
        format!("ingest returned HTTP {status}")
    } else {
        format!("ingest returned HTTP {status}: {detail}")
    };
    Err(io::Error::new(io::ErrorKind::Other, message).into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let hotkey = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);

    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &hotkey && event.state() == ShortcutState::Pressed {
                        toggle_main_window(app);
                    }
                })
                .build(),
        )
        .setup(move |app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            build_tray(app.handle())?;
            app.global_shortcut().register(hotkey)?;

            if let Some(window) = app.get_webview_window("main") {
                let handle = app.handle().clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Some(w) = handle.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                });
            }

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let WindowEvent::DragDrop(drop) = event {
                if let tauri::DragDropEvent::Drop { paths, .. } = drop {
                    for path in paths.clone() {
                        tauri::async_runtime::spawn(async move {
                            handle_drop_path(path.to_string_lossy().into_owned()).await;
                        });
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Trove", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    let icon = tray_icon_image();

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event: MenuEvent| match event.id.as_ref() {
            "open" => toggle_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        });

    if let Some(img) = icon {
        builder = builder.icon(img).icon_as_template(true);
    }

    builder.build(app)?;
    Ok(())
}

fn tray_icon_image() -> Option<Image<'static>> {
    let bytes = include_bytes!("../icons/tray-icon.png");
    Image::from_bytes(bytes).ok()
}

fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let visible = window.is_visible().unwrap_or(false);
        if visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.center();
        }
    }
}

async fn handle_drop_path(path: String) {
    let config = match IngestConfig::from_env() {
        Ok(config) => config,
        Err(err) => {
            eprintln!("trove ingest skipped: {err}");
            return;
        }
    };

    let payload = match prepare_drop(&path, &config.project_id) {
        Ok(payload) => payload,
        Err(err) => {
            eprintln!("trove ingest skipped for {path}: {err}");
            return;
        }
    };

    let client = reqwest::Client::new();
    if let Err(err) = send_ingest(&client, &config, payload).await {
        eprintln!("trove ingest failed for {path}: {err}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    #[test]
    fn config_uses_default_backend_and_trims_values() {
        let config = IngestConfig::from_reader(|key| match key {
            INGEST_TOKEN_ENV => Some("  secret-token  ".to_string()),
            PROJECT_ID_ENV => Some("  project-123  ".to_string()),
            _ => None,
        })
        .expect("config should resolve");

        assert_eq!(config.backend_url, DEFAULT_BACKEND_URL);
        assert_eq!(config.ingest_token, "secret-token");
        assert_eq!(config.project_id, "project-123");
        assert_eq!(config.ingest_url(), "http://localhost:3000/api/ingest");
    }

    #[test]
    fn config_rejects_invalid_backend_url() {
        let err = IngestConfig::from_reader(|key| match key {
            BACKEND_URL_ENV => Some("ftp://localhost:3000".to_string()),
            INGEST_TOKEN_ENV => Some("secret-token".to_string()),
            PROJECT_ID_ENV => Some("project-123".to_string()),
            _ => None,
        })
        .expect_err("config should reject non-http backend");

        assert_eq!(
            err,
            ConfigError::InvalidBackendUrl("ftp://localhost:3000".to_string())
        );
    }

    #[test]
    fn prepare_drop_uses_text_field_for_url_json() {
        let payload = prepare_drop("https://example.com/path", "project-123")
            .expect("url payload should prepare");

        match payload {
            PreparedIngest::Json(body) => {
                let value = serde_json::to_value(body).expect("payload should serialize");
                assert_json_payload(&value, "url", "https://example.com/path", "project-123");
                assert!(value.get("content").is_none());
            }
            PreparedIngest::File(_) => panic!("expected json payload"),
        }
    }

    #[test]
    fn prepare_drop_uses_multipart_for_existing_files() {
        let path = write_temp_file("capture.pdf", b"%PDF-1.7\n");
        let payload = prepare_drop(path.to_str().expect("utf-8 path"), "project-123")
            .expect("file payload should prepare");

        match payload {
            PreparedIngest::File(file) => {
                assert_eq!(file.path, path);
                assert!(file.file_name.ends_with("capture.pdf"));
                assert_eq!(file.mime_type, "application/pdf");
                assert_eq!(file.project_id, "project-123");
            }
            PreparedIngest::Json(_) => panic!("expected file payload"),
        }

        let _ = fs::remove_file(path);
    }

    #[test]
    fn prepare_drop_rejects_directories() {
        let dir = unique_temp_path("capture-dir");
        fs::create_dir_all(&dir).expect("temp dir should be created");

        let err = prepare_drop(dir.to_str().expect("utf-8 path"), "project-123")
            .expect_err("directories should be rejected");

        assert_eq!(err, PrepareDropError::DirectoryUnsupported(dir.clone()));
        let _ = fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn file_size_limit_accepts_exact_limit_and_rejects_one_byte_over() {
        let path = unique_temp_path("size-limit.bin");
        let file = fs::File::create(&path).expect("temp file should be created");

        file.set_len(MAX_FILE_BYTES)
            .expect("file should be sized to the limit");
        ensure_ingest_file_size(&path)
            .await
            .expect("exact limit should be accepted");

        file.set_len(MAX_FILE_BYTES + 1)
            .expect("file should be sized over the limit");
        let err = ensure_ingest_file_size(&path)
            .await
            .expect_err("one byte over the limit should be rejected");

        assert_eq!(err.kind(), io::ErrorKind::InvalidInput);
        assert!(err.to_string().contains("file too large (max 32MB)"));
        let _ = fs::remove_file(path);
    }

    #[tokio::test]
    async fn file_ingest_posts_bearer_authenticated_multipart_to_ingest_endpoint() {
        let path = write_temp_file("capture.txt", b"desktop upload body");
        let (backend_url, request) = spawn_http_server("200 OK", "").await;
        let config = test_config(backend_url);
        let payload = prepare_drop(path.to_str().expect("utf-8 path"), &config.project_id)
            .expect("file payload should prepare");

        send_ingest(&reqwest::Client::new(), &config, payload)
            .await
            .expect("upload should succeed");
        let request = request.await.expect("server task should finish");

        assert!(request.starts_with("POST /api/ingest HTTP/1.1\r\n"));
        assert!(request
            .to_ascii_lowercase()
            .contains("authorization: bearer secret-token\r\n"));
        assert!(request
            .to_ascii_lowercase()
            .contains("content-type: multipart/form-data; boundary="));
        assert!(request.contains("name=\"projectId\""));
        assert!(request.contains("project-123"));
        assert!(request.contains("name=\"file\"; filename=\""));
        assert!(request.contains("capture.txt\""));
        assert!(request.contains("desktop upload body"));
        let _ = fs::remove_file(path);
    }

    #[tokio::test]
    async fn ingest_error_includes_server_status_and_body() {
        let (backend_url, request) =
            spawn_http_server("422 Unprocessable Entity", "bad upload").await;
        let config = test_config(backend_url);
        let payload = PreparedIngest::Json(JsonIngestPayload {
            kind: "text",
            text: "hello".to_string(),
            project_id: config.project_id.clone(),
        });

        let err = send_ingest(&reqwest::Client::new(), &config, payload)
            .await
            .expect_err("server error should be returned");
        request.await.expect("server task should finish");

        assert_eq!(
            err.to_string(),
            "ingest returned HTTP 422 Unprocessable Entity: bad upload"
        );
    }

    fn assert_json_payload(value: &Value, kind: &str, text: &str, project_id: &str) {
        assert_eq!(value.get("type").and_then(Value::as_str), Some(kind));
        assert_eq!(value.get("text").and_then(Value::as_str), Some(text));
        assert_eq!(
            value.get("projectId").and_then(Value::as_str),
            Some(project_id)
        );
    }

    fn write_temp_file(name: &str, contents: &[u8]) -> PathBuf {
        let path = unique_temp_path(name);
        fs::write(&path, contents).expect("temp file should be written");
        path
    }

    fn unique_temp_path(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time should advance")
            .as_nanos();
        env::temp_dir().join(format!("trove-desktop-{nanos}-{name}"))
    }

    fn test_config(backend_url: String) -> IngestConfig {
        IngestConfig {
            backend_url,
            ingest_token: "secret-token".to_string(),
            project_id: "project-123".to_string(),
        }
    }

    async fn spawn_http_server(
        status: &'static str,
        response_body: &'static str,
    ) -> (String, tokio::task::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test server should bind");
        let address = listener
            .local_addr()
            .expect("server should have an address");
        let task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.expect("request should connect");
            let mut request = Vec::new();
            let mut content_length = None;
            let mut header_end = None;

            loop {
                let mut buffer = [0_u8; 8192];
                let read = socket.read(&mut buffer).await.expect("request should read");
                if read == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..read]);

                if header_end.is_none() {
                    header_end = request.windows(4).position(|window| window == b"\r\n\r\n");
                    if let Some(end) = header_end {
                        let headers = String::from_utf8_lossy(&request[..end]);
                        content_length = headers.lines().find_map(|line| {
                            let (name, value) = line.split_once(':')?;
                            name.eq_ignore_ascii_case("content-length")
                                .then(|| value.trim().parse::<usize>().ok())
                                .flatten()
                        });
                    }
                }

                if let (Some(end), Some(length)) = (header_end, content_length) {
                    if request.len() >= end + 4 + length {
                        break;
                    }
                }
            }

            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response_body}",
                response_body.len()
            );
            socket
                .write_all(response.as_bytes())
                .await
                .expect("response should write");
            String::from_utf8(request).expect("test request should be utf-8")
        });

        (format!("http://{address}"), task)
    }
}
