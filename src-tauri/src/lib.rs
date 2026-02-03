use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime, PhysicalPosition, Position,
};

#[tauri::command]
fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}

#[tauri::command]
fn get_default_scripts_path() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.join("scripts").to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}

fn create_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    let menu = Menu::new(app)?;
    let toggle = MenuItem::new(app, "Show/Hide", true, None::<&str>)?;
    let quit = MenuItem::new(app, "Quit", true, None::<&str>)?;
    menu.append(&toggle)?;
    menu.append(&quit)?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .icon_as_template(true)
        .tooltip("Scripts Runner")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| {
            if event.id() == quit.id() {
                app.exit(0);
                return;
            }
            if event.id() == toggle.id() {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        // Position window below tray icon
                        if let Ok(Some(rect)) = tray.rect() {
                            let pos_x = match rect.position {
                                Position::Physical(p) => p.x,
                                Position::Logical(l) => l.x as i32,
                            };
                            let pos_y = match rect.position {
                                Position::Physical(p) => p.y,
                                Position::Logical(l) => l.y as i32,
                            };
                            let size_h = match rect.size {
                                tauri::Size::Physical(s) => s.height as i32,
                                tauri::Size::Logical(s) => s.height as i32,
                            };

                            let x = pos_x - 140;
                            let y = pos_y + size_h + 5;
                            let _ = window.set_position(Position::Physical(
                                PhysicalPosition { x, y },
                            ));
                        }
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Hide from Dock on macOS
            #[cfg(target_os = "macos")]
            app.handle().set_activation_policy(tauri::ActivationPolicy::Accessory)?;

            create_tray(app.handle())?;

            // Hide window when it loses focus
            let handle = app.handle().clone();
            if let Some(window) = handle.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        let _ = window_clone.hide();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_home_dir, get_default_scripts_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
