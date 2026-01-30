// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// The main entry point for the Tauri application.
/// Delegates execution to the library crate to allow for mobile support.
fn main() {
    weather_app_lib::run();
}
