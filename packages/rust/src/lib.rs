/**
 * CheckIt Rust - 高性能规则引擎
 *
 * @packageDocumentation
 */

// 核心模块
pub mod core;
pub mod engine;
pub mod rules;

// CLI（仅在 binary 中可用）
// pub mod cli;

// 重新导出常用类型
pub use core::{Intent, Rule, Fulfillment};
pub use engine::{Engine, EngineBuilder};
