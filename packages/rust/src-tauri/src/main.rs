//! CheckIt Tauri 应用入口

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use checkit::{EngineBuilder, Rule};
use std::sync::Arc;
use tokio::sync::RwLock;

/// 应用状态
pub struct AppState {
    engine: Arc<RwLock<Option<checkit::Engine>>>,
    rules: Arc<RwLock<Vec<Rule>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            engine: Arc::new(RwLock::new(None)),
            rules: Arc::new(RwLock::new(Vec::new())),
        }
    }
}

fn main() {
    let state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::check_code,
            commands::load_rules,
            commands::add_rule,
            commands::get_rules,
            commands::get_stats,
            commands::init_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
