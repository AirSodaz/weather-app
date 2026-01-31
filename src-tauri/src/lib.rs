/// Runs the Tauri application.
/// Initializes the Tauri builder, registers plugins, and starts the application loop.
///
/// This function is also used as the mobile entry point.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_shell::init());

    #[cfg(not(mobile))]
    {
        builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
