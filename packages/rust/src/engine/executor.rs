//! 规则执行器

use crate::core::{Rule, RuleIssue, Fulfillment, FulfillmentStatus, LogLevel};
use std::path::Path;
use tokio::fs;

/// 规则执行器
pub struct RuleExecutor {
    parallel: bool,
}

impl RuleExecutor {
    pub fn new(parallel: bool) -> Self {
        Self { parallel }
    }
    
    /// 执行文件检查
    pub async fn execute(&self, file: &Path, rules: &[Rule]) -> Vec<RuleIssue> {
        match fs::read_to_string(file).await {
            Ok(content) => self.check_content(file.to_str().unwrap_or(""), &content, rules),
            Err(_) => Vec::new(),
        }
    }
    
    /// 检查内容
    fn check_content(&self, file: &str, content: &str, rules: &[Rule]) -> Vec<RuleIssue> {
        if self.parallel {
            self.check_parallel(file, content, rules)
        } else {
            self.check_sequential(file, content, rules)
        }
    }
    
    fn check_sequential(&self, file: &str, content: &str, rules: &[Rule]) -> Vec<RuleIssue> {
        rules
            .iter()
            .filter_map(|rule| self.match_rule(file, content, rule))
            .collect()
    }
    
    #[cfg(feature = "parallel")]
    fn check_parallel(&self, file: &str, content: &str, rules: &[Rule]) -> Vec<RuleIssue> {
        use rayon::prelude::*;
        
        rules
            .par_iter()
            .filter_map(|rule| self.match_rule(file, content, rule))
            .collect()
    }
    
    #[cfg(not(feature = "parallel"))]
    fn check_parallel(&self, file: &str, content: &str, rules: &[Rule]) -> Vec<RuleIssue> {
        self.check_sequential(file, content, rules)
    }
    
    fn match_rule(&self, file: &str, content: &str, rule: &Rule) -> Option<RuleIssue> {
        if let Some(pattern) = &rule.pattern {
            if let Ok(regex) = regex::Regex::new(pattern) {
                if let Some(m) = regex.find(content) {
                    let line = content[..m.start()].matches('\n').count() + 1;
                    
                    return Some(RuleIssue {
                        rule_id: rule.id.clone(),
                        file: file.to_string(),
                        line: Some(line),
                        message: rule.message.clone(),
                        severity: rule.severity.clone(),
                        fix: rule.fix.clone(),
                        auto_fix: rule.auto_fix,
                    });
                }
            }
        }
        None
    }
}
