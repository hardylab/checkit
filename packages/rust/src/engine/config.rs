//! 规则引擎配置

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 引擎配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    /// 规则仓库路径
    pub rules_path: Option<PathBuf>,
    
    /// 是否启用并行处理
    #[serde(default = "default_parallel")]
    pub parallel: bool,
    
    /// 并行工作线程数
    #[serde(default = "default_threads")]
    pub threads: usize,
    
    /// 是否启用缓存
    #[serde(default = "default_true")]
    pub cache_enabled: bool,
    
    /// 缓存大小（MB）
    #[serde(default = "default_cache_size")]
    pub cache_size_mb: usize,
}

fn default_parallel() -> bool {
    true
}

fn default_threads() -> usize {
    num_cpus::get()
}

fn default_true() -> bool {
    true
}

fn default_cache_size() -> usize {
    256
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            rules_path: None,
            parallel: true,
            threads: num_cpus::get(),
            cache_enabled: true,
            cache_size_mb: 256,
        }
    }
}
