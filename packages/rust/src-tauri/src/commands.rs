//! Tauri Commands - Rust 后端 API

use crate::AppState;
use checkit::{EngineBuilder, Rule, RuleCategory, Severity};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 检查结果
#[derive(Debug, Serialize, Deserialize)]
pub struct CheckResult {
    pub file: String,
    pub issues: Vec<RuleIssue>,
}

/// 规则问题
#[derive(Debug, Serialize, Deserialize)]
pub struct RuleIssue {
    pub rule_id: String,
    pub file: String,
    pub line: Option<usize>,
    pub message: String,
    pub severity: String,
    pub fix: Option<String>,
}

/// 规则统计
#[derive(Debug, Serialize, Deserialize)]
pub struct RuleStats {
    pub total: usize,
    pub by_category: std::collections::HashMap<String, usize>,
    pub by_severity: std::collections::HashMap<String, usize>,
}

/// 检查代码
#[tauri::command]
pub async fn check_code(
    state: tauri::State<'_, AppState>,
    path: String,
    content: String,
) -> Result<CheckResult, String> {
    let engine_guard = state.engine.read().await;
    
    if let Some(engine) = engine_guard.as_ref() {
        let issues = engine.check_file(&path, &content).await;
        
        let rule_issues = issues
            .into_iter()
            .map(|issue| RuleIssue {
                rule_id: issue.rule_id,
                file: issue.file,
                line: issue.line,
                message: issue.message,
                severity: format!("{:?}", issue.severity),
                fix: issue.fix,
            })
            .collect();
        
        Ok(CheckResult {
            file: path,
            issues: rule_issues,
        })
    } else {
        Err("Engine not initialized".to_string())
    }
}

/// 加载规则
#[tauri::command]
pub async fn load_rules(
    state: tauri::State<'_, AppState>,
    rules_path: String,
) -> Result<usize, String> {
    let mut engine_guard = state.engine.write().await;
    let mut rules_guard = state.rules.write().await;
    
    let engine = EngineBuilder::new()
        .with_rules_path(PathBuf::from(&rules_path))
        .with_parallel(true)
        .build_async()
        .await
        .map_err(|e| e.to_string())?;
    
    let rules = engine.rules.read().await.clone();
    *rules_guard = rules.clone();
    *engine_guard = Some(engine);
    
    Ok(rules_guard.len())
}

/// 添加规则
#[tauri::command]
pub async fn add_rule(
    state: tauri::State<'_, AppState>,
    rule: Rule,
) -> Result<(), String> {
    let engine_guard = state.engine.read().await;
    
    if let Some(engine) = engine_guard.as_ref() {
        engine.add_rule(rule).await;
        Ok(())
    } else {
        Err("Engine not initialized".to_string())
    }
}

/// 获取所有规则
#[tauri::command]
pub async fn get_rules(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Rule>, String> {
    let rules = state.rules.read().await;
    Ok(rules.clone())
}

/// 获取统计信息
#[tauri::command]
pub async fn get_stats(
    state: tauri::State<'_, AppState>,
) -> Result<RuleStats, String> {
    let rules = state.rules.read().await;
    
    let mut by_category = std::collections::HashMap::new();
    let mut by_severity = std::collections::HashMap::new();
    
    for rule in rules.iter() {
        let category = format!("{:?}", rule.category);
        let severity = format!("{:?}", rule.severity);
        
        *by_category.entry(category).or_insert(0) += 1;
        *by_severity.entry(severity).or_insert(0) += 1;
    }
    
    Ok(RuleStats {
        total: rules.len(),
        by_category,
        by_severity,
    })
}

/// 初始化配置
#[tauri::command]
pub async fn init_config(
    _state: tauri::State<'_, AppState>,
    path: String,
) -> Result<String, String> {
    use std::fs;
    
    let config_path = PathBuf::from(&path).join(".ai-compliance.yaml");
    
    let config = r#"# CheckIt AI Compliance Configuration
project:
  name: my-project
  description: My awesome project

beliefs:
  - 我们相信敏捷，不相信瀑布
  - 我们相信数据驱动，不相信直觉决策

paradigms:
  - from: '@checkit/normal'
"#;
    
    fs::write(&config_path, config)
        .map_err(|e| e.to_string())?;
    
    Ok(config_path.to_string_lossy().to_string())
}

/// 生成内置规则
#[tauri::command]
pub async fn generate_built_in_rules() -> Result<Vec<Rule>, String> {
    let generator = checkit::rules::RuleGenerator::new();
    Ok(generator.generate_built_in())
}
