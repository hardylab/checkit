//! 高性能规则引擎
//!
//! 特性：
//! - 并行规则执行
//! - 正则表达式缓存
//! - 增量检查

use crate::core::*;
use crate::engine::config::EngineConfig;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use regex::Regex;

/// 规则引擎
pub struct Engine {
    config: EngineConfig,
    rules: Arc<RwLock<Vec<Rule>>>,
    regex_cache: Arc<RwLock<HashMap<String, Regex>>>,
}

impl Engine {
    /// 创建新引擎
    pub fn new(config: EngineConfig) -> Self {
        Self {
            config,
            rules: Arc::new(RwLock::new(Vec::new())),
            regex_cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// 从配置创建引擎
    pub async fn from_config(config: EngineConfig) -> anyhow::Result<Self> {
        let engine = Self::new(config.clone());
        
        // 加载规则
        if let Some(rules_path) = &config.rules_path {
            engine.load_rules_from_dir(rules_path).await?;
        }
        
        Ok(engine)
    }
    
    /// 添加规则
    pub async fn add_rule(&self, rule: Rule) {
        let mut rules = self.rules.write().await;
        rules.push(rule);
    }
    
    /// 批量添加规则
    pub async fn add_rules(&self, rules: Vec<Rule>) {
        let mut all_rules = self.rules.write().await;
        all_rules.extend(rules);
    }
    
    /// 从目录加载规则
    pub async fn load_rules_from_dir(&self, path: &std::path::Path) -> anyhow::Result<()> {
        use std::fs;
        use walkdir::WalkDir;
        
        let mut rules = Vec::new();
        
        for entry in WalkDir::new(path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().map_or(false, |ext| ext == "yaml" || ext == "yml"))
        {
            let content = fs::read_to_string(entry.path())?;
            let rule: Rule = serde_yaml::from_str(&content)?;
            rules.push(rule);
        }
        
        self.add_rules(rules).await;
        Ok(())
    }
    
    /// 检查代码（单文件）
    pub async fn check_file(&self, file: &str, content: &str) -> Vec<RuleIssue> {
        let rules = self.rules.read().await;
        let mut issues = Vec::new();
        
        if self.config.parallel && rules.len() > 10 {
            // 并行检查
            issues = self.check_parallel(file, content, &rules).await;
        } else {
            // 串行检查
            for rule in rules.iter() {
                if let Some(issue) = self.check_rule(file, content, rule).await {
                    issues.push(issue);
                }
            }
        }
        
        issues
    }
    
    /// 并行检查（使用 Rayon）
    #[cfg(feature = "parallel")]
    async fn check_parallel(&self, file: &str, content: &str, rules: &[Rule]) -> Vec<RuleIssue> {
        use rayon::prelude::*;
        
        let issues: Vec<Option<RuleIssue>> = rules
            .par_iter()
            .map(|rule| {
                // 在并行上下文中不能使用 await，所以使用阻塞方式
                if let Some(pattern) = &rule.pattern {
                    if let Ok(regex) = Regex::new(pattern) {
                        if regex.is_match(content) {
                            return Some(RuleIssue {
                                rule_id: rule.id.clone(),
                                file: file.to_string(),
                                line: None,
                                message: rule.message.clone(),
                                severity: rule.severity.clone(),
                                fix: rule.fix.clone(),
                                auto_fix: rule.auto_fix,
                            });
                        }
                    }
                }
                None
            })
            .collect();
        
        issues.into_iter().flatten().collect()
    }
    
    #[cfg(not(feature = "parallel"))]
    async fn check_parallel(&self, file: &str, content: &str, rules: &[Rule]) -> Vec<RuleIssue> {
        // 如果没有启用 parallel 特性，回退到串行
        let mut issues = Vec::new();
        for rule in rules {
            if let Some(issue) = self.check_rule(file, content, rule).await {
                issues.push(issue);
            }
        }
        issues
    }
    
    /// 检查单个规则
    async fn check_rule(&self, file: &str, content: &str, rule: &Rule) -> Option<RuleIssue> {
        if let Some(pattern) = &rule.pattern {
            // 使用缓存的正则表达式
            let regex = self.get_or_create_regex(pattern).await?;
            
            if regex.is_match(content) {
                // 计算行号
                let line = self.find_line_number(content, &regex);
                
                return Some(RuleIssue {
                    rule_id: rule.id.clone(),
                    file: file.to_string(),
                    line,
                    message: rule.message.clone(),
                    severity: rule.severity.clone(),
                    fix: rule.fix.clone(),
                    auto_fix: rule.auto_fix,
                });
            }
        }
        None
    }
    
    /// 获取或创建缓存的正则表达式
    async fn get_or_create_regex(&self, pattern: &str) -> Option<Regex> {
        // 先尝试从缓存读取
        {
            let cache = self.regex_cache.read().await;
            if let Some(regex) = cache.get(pattern) {
                return Some(regex.clone());
            }
        }
        
        // 创建新的正则表达式
        if let Ok(regex) = Regex::new(pattern) {
            // 添加到缓存
            let mut cache = self.regex_cache.write().await;
            
            // 如果缓存太大，移除最旧的条目
            if cache.len() >= self.config.cache_size_mb * 1024 {
                if let Some(first_key) = cache.keys().next().cloned() {
                    cache.remove(&first_key);
                }
            }
            
            cache.insert(pattern.to_string(), regex.clone());
            return Some(regex);
        }
        
        None
    }
    
    /// 查找匹配的行号
    fn find_line_number(&self, content: &str, regex: &Regex) -> Option<usize> {
        regex.find(content).map(|m| {
            content[..m.start()].matches('\n').count() + 1
        })
    }
    
    /// 获取规则数量
    pub async fn rule_count(&self) -> usize {
        self.rules.read().await.len()
    }
}

/// 引擎构建器
pub struct EngineBuilder {
    config: EngineConfig,
}

impl EngineBuilder {
    pub fn new() -> Self {
        Self {
            config: EngineConfig::default(),
        }
    }
    
    pub fn with_rules_path(mut self, path: impl Into<std::path::PathBuf>) -> Self {
        self.config.rules_path = Some(path.into());
        self
    }
    
    pub fn with_parallel(mut self, parallel: bool) -> Self {
        self.config.parallel = parallel;
        self
    }
    
    pub fn with_threads(mut self, threads: usize) -> Self {
        self.config.threads = threads;
        self
    }
    
    pub fn build(self) -> Engine {
        Engine::new(self.config)
    }
    
    pub async fn build_async(self) -> anyhow::Result<Engine> {
        Engine::from_config(self.config).await
    }
}

impl Default for EngineBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_engine_creation() {
        let engine = EngineBuilder::new()
            .with_parallel(true)
            .with_threads(4)
            .build();
        
        assert_eq!(engine.rule_count().await, 0);
    }
    
    #[tokio::test]
    async fn test_rule_checking() {
        let engine = EngineBuilder::new().build();
        
        // 添加规则
        let rule = Rule {
            id: "test/no-any".to_string(),
            description: "禁止使用 any".to_string(),
            category: RuleCategory::TypeSafety,
            severity: Severity::Warning,
            pattern: Some(":\\s*any\\b".to_string()),
            message: "不要使用 any 类型".to_string(),
            fix: Some("使用 unknown 或具体类型".to_string()),
            bad_example: None,
            good_example: None,
            references: Vec::new(),
            tags: Vec::new(),
            auto_fix: false,
        };
        
        engine.add_rule(rule).await;
        
        // 检查代码
        let code = "function foo(x: any) {}";
        let issues = engine.check_file("test.ts", code).await;
        
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].rule_id, "test/no-any");
    }
}
