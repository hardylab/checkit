//! 规则仓库

use crate::core::Rule;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs;

/// 规则仓库
pub struct RuleRepository {
    base_path: PathBuf,
    cache: HashMap<String, Rule>,
}

impl RuleRepository {
    /// 创建新仓库
    pub fn new(base_path: impl Into<PathBuf>) -> Self {
        Self {
            base_path: base_path.into(),
            cache: HashMap::new(),
        }
    }
    
    /// 保存规则
    pub fn save(&mut self, rule: &Rule) -> anyhow::Result<()> {
        let category_dir = self.base_path.join(format!("{:?}", rule.category).to_lowercase());
        fs::create_dir_all(&category_dir)?;
        
        let file_path = category_dir.join(format!("{}.yaml", rule.id.replace('/', "-")));
        let content = serde_yaml::to_string(rule)?;
        fs::write(file_path, content)?;
        
        self.cache.insert(rule.id.clone(), rule.clone());
        Ok(())
    }
    
    /// 加载规则
    pub fn load(&mut self, rule_id: &str) -> anyhow::Result<Option<Rule>> {
        // 先查缓存
        if let Some(rule) = self.cache.get(rule_id) {
            return Ok(Some(rule.clone()));
        }
        
        // 遍历类别目录查找
        let categories = ["naming", "structure", "type_safety", "security", "performance", "testing", "documentation", "best_practice"];
        
        for category in &categories {
            let file_path = self.base_path
                .join(category)
                .join(format!("{}.yaml", rule_id.replace('/', "-")));
            
            if file_path.exists() {
                let content = fs::read_to_string(file_path)?;
                let rule: Rule = serde_yaml::from_str(&content)?;
                self.cache.insert(rule_id.to_string(), rule.clone());
                return Ok(Some(rule));
            }
        }
        
        Ok(None)
    }
    
    /// 查询规则
    pub fn query(&mut self) -> anyhow::Result<Vec<Rule>> {
        let mut rules = Vec::new();
        
        let categories = ["naming", "structure", "type_safety", "security", "performance", "testing", "documentation", "best_practice"];
        
        for category in &categories {
            let category_dir = self.base_path.join(category);
            if !category_dir.exists() {
                continue;
            }
            
            for entry in fs::read_dir(category_dir)? {
                let entry = entry?;
                let path = entry.path();
                
                if path.extension().map_or(false, |ext| ext == "yaml" || ext == "yml") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(rule) = serde_yaml::from_str::<Rule>(&content) {
                            rules.push(rule);
                        }
                    }
                }
            }
        }
        
        Ok(rules)
    }
    
    /// 获取统计信息
    pub fn stats(&mut self) -> anyhow::Result<RuleStats> {
        let rules = self.query()?;
        
        let mut stats = RuleStats::default();
        stats.total = rules.len();
        
        for rule in rules {
            let category = format!("{:?}", rule.category);
            *stats.by_category.entry(category).or_insert(0) += 1;
            
            let severity = format!("{:?}", rule.severity);
            *stats.by_severity.entry(severity).or_insert(0) += 1;
        }
        
        Ok(stats)
    }
}

/// 规则统计
#[derive(Default)]
pub struct RuleStats {
    pub total: usize,
    pub by_category: HashMap<String, usize>,
    pub by_severity: HashMap<String, usize>,
}
