//! 规则匹配器

use crate::core::{Rule, RuleIssue};
use regex::Regex;

/// 规则匹配器
pub struct RuleMatcher {
    rules: Vec<Rule>,
}

impl RuleMatcher {
    pub fn new(rules: Vec<Rule>) -> Self {
        Self { rules }
    }
    
    /// 匹配代码
    pub fn match_code(&self, file: &str, content: &str) -> Vec<RuleIssue> {
        self.rules
            .iter()
            .filter_map(|rule| self.match_rule(file, content, rule))
            .collect()
    }
    
    fn match_rule(&self, file: &str, content: &str, rule: &Rule) -> Option<RuleIssue> {
        if let Some(pattern) = &rule.pattern {
            if let Ok(regex) = Regex::new(pattern) {
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
