use serde::Serialize;
use tauri::{
    image::Image,
    menu::{Menu, MenuEvent, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const CAPTURE_URL: &str = "http://localhost:3000/api/capture";

#[derive(Serialize)]
struct CapturePayload<'a> {
    #[serde(rename = "type")]
    kind: &'a str,
    content: String,
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
        .on_window_event(|window, event| {
            if let WindowEvent::DragDrop(drop) = event {
                if let tauri::DragDropEvent::Drop { paths, .. } = drop {
                    let app = window.app_handle().clone();
                    for path in paths.clone() {
                        let app = app.clone();
                        tauri::async_runtime::spawn(async move {
                            handle_drop_path(app, path.to_string_lossy().into_owned()).await;
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

async fn handle_drop_path(app: AppHandle, path: String) {
    let (kind, content) = classify_drop(&path);
    let payload = CapturePayload { kind, content };

    let client = reqwest::Client::new();
    let result = client.post(CAPTURE_URL).json(&payload).send().await;

    if let Err(err) = result {
        eprintln!("trove capture failed: {err}");
    }

    let _ = app;
}

fn classify_drop(input: &str) -> (&'static str, String) {
    if url::Url::parse(input).is_ok() && (input.starts_with("http://") || input.starts_with("https://")) {
        return ("url", input.to_string());
    }

    match std::fs::read_to_string(input) {
        Ok(text) => ("text", text),
        Err(_) => ("text", input.to_string()),
    }
}
