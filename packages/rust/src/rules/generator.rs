//! 规则生成器

use crate::core::{Rule, RuleCategory, Severity};

/// 规则生成器
pub struct RuleGenerator;

impl RuleGenerator {
    /// 创建新规则生成器
    pub fn new() -> Self {
        Self
    }
    
    /// 生成内置规则
    pub fn generate_built_in(&self) -> Vec<Rule> {
        vec![
            // TypeScript 规则
            Rule {
                id: "typescript/no-explicit-any".to_string(),
                description: "禁止使用 explicit any 类型".to_string(),
                category: RuleCategory::TypeSafety,
                severity: Severity::Warning,
                pattern: Some(":\\s*any\\b".to_string()),
                message: "不要使用 any 类型，使用 unknown 或具体类型".to_string(),
                fix: Some("将 any 替换为 unknown 或具体类型".to_string()),
                bad_example: Some("function foo(x: any) {}".to_string()),
                good_example: Some("function foo<T>(x: T) {}".to_string()),
                references: vec![],
                tags: vec!["typescript".to_string(), "type-safety".to_string()],
                auto_fix: false,
            },
            Rule {
                id: "typescript/no-non-null-assertion".to_string(),
                description: "禁止使用非空断言".to_string(),
                category: RuleCategory::TypeSafety,
                severity: Severity::Warning,
                pattern: Some("!\\.".to_string()),
                message: "不要使用非空断言 (!.)，使用可选链或空值检查".to_string(),
                fix: Some("使用 ?. 或 if (x != null) 检查".to_string()),
                bad_example: Some("const x = obj!.property!".to_string()),
                good_example: Some("const x = obj?.property".to_string()),
                references: vec![],
                tags: vec!["typescript".to_string(), "type-safety".to_string()],
                auto_fix: false,
            },
            
            // Security 规则
            Rule {
                id: "security/no-eval".to_string(),
                description: "禁止使用 eval".to_string(),
                category: RuleCategory::Security,
                severity: Severity::Error,
                pattern: Some("\\beval\\s*\\(".to_string()),
                message: "eval 有严重安全风险，使用其他方法替代".to_string(),
                fix: Some("使用 JSON.parse 或其他安全方法".to_string()),
                bad_example: None,
                good_example: None,
                references: vec![],
                tags: vec!["security".to_string(), "eval".to_string()],
                auto_fix: false,
            },
            Rule {
                id: "security/no-hardcoded-secrets".to_string(),
                description: "禁止硬编码密钥".to_string(),
                category: RuleCategory::Security,
                severity: Severity::Error,
                pattern: Some("(password|secret|api_key|token)\\s*[=:]\\s*['\"][^'\"]+['\"]".to_string()),
                message: "不要硬编码密钥，使用环境变量".to_string(),
                fix: Some("使用 process.env.SECRET_NAME".to_string()),
                bad_example: None,
                good_example: None,
                references: vec![],
                tags: vec!["security".to_string(), "secrets".to_string()],
                auto_fix: false,
            },
            
            // Best Practice 规则
            Rule {
                id: "best-practice/no-magic-numbers".to_string(),
                description: "避免魔法数字".to_string(),
                category: RuleCategory::BestPractice,
                severity: Severity::Info,
                pattern: Some("\\b(100|1000|365|24|60)\\b".to_string()),
                message: "使用命名常量代替魔法数字".to_string(),
                fix: Some("定义常量：const MAX_SIZE = 100".to_string()),
                bad_example: None,
                good_example: None,
                references: vec![],
                tags: vec!["best-practice".to_string(), "readability".to_string()],
                auto_fix: false,
            },
        ]
    }
}

impl Default for RuleGenerator {
    fn default() -> Self {
        Self::new()
    }
}
