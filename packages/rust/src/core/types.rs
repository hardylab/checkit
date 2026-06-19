//! 核心类型定义
//! 
//! 包含 Intent（意图）、Rule（规则）、Fulfillment（实现）等核心类型

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::collections::HashMap;

/// 意图 ID
pub type IntentId = String;

/// 规则 ID
pub type RuleId = String;

/// 实现 ID
pub type FulfillmentId = String;

/// 意图状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum IntentStatus {
    /// 等待实现
    Pending,
    /// 正在匹配
    Matching,
    /// 正在实现
    Fulfilling,
    /// 已实现
    Fulfilled,
    /// 部分实现
    Partial,
    /// 已过期
    Expired,
    /// 已取消
    Cancelled,
    /// 实现失败
    Failed,
}

/// 通道类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ChannelType {
    /// 同步（立即返回结果）
    Sync,
    /// 异步（后台处理）
    Async,
    /// 轮询（定期查询状态）
    Poll,
    /// Webhook（回调通知）
    Webhook,
    /// 消息队列
    Message,
    /// 人工处理
    Manual,
}

/// 意图优先级
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, PartialOrd)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    Normal,
    High,
    Critical,
}

impl Default for Priority {
    fn default() -> Self {
        Priority::Normal
    }
}

/// 意图定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Intent {
    /// 意图唯一 ID
    pub id: IntentId,
    
    /// 意图类型（如 'code-review', 'test-generation'）
    #[serde(rename = "type")]
    pub intent_type: String,
    
    /// 意图负载（JSON）
    pub payload: serde_json::Value,
    
    /// 意图状态
    pub status: IntentStatus,
    
    /// 优先级
    #[serde(default)]
    pub priority: Priority,
    
    /// 通道配置
    pub channel: ChannelConfig,
    
    /// 创建时间
    pub created_at: DateTime<Utc>,
    
    /// 过期时间（可选）
    pub expires_at: Option<DateTime<Utc>>,
    
    /// 元数据
    #[serde(default)]
    pub metadata: HashMap<String, serde_json::Value>,
    
    /// 关联的实现 ID 列表
    #[serde(default)]
    pub fulfillment_ids: Vec<FulfillmentId>,
}

impl Intent {
    /// 创建新意图
    pub fn new(intent_type: String, payload: serde_json::Value, channel: ChannelConfig) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            intent_type,
            payload,
            status: IntentStatus::Pending,
            priority: Priority::Normal,
            channel,
            created_at: Utc::now(),
            expires_at: None,
            metadata: HashMap::new(),
            fulfillment_ids: Vec::new(),
        }
    }
    
    /// 创建带优先级的意图
    pub fn with_priority(mut self, priority: Priority) -> Self {
        self.priority = priority;
        self
    }
}

/// 通道配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelConfig {
    /// 通道类型
    #[serde(rename = "type")]
    pub channel_type: ChannelType,
    
    /// 超时时间（毫秒）
    pub timeout: Option<u64>,
    
    /// 通道特定配置（JSON）
    #[serde(default, flatten)]
    pub config: HashMap<String, serde_json::Value>,
}

impl ChannelConfig {
    /// 创建同步通道
    pub fn sync() -> Self {
        Self {
            channel_type: ChannelType::Sync,
            timeout: Some(5000),
            config: HashMap::new(),
        }
    }
    
    /// 创建异步通道
    pub fn async_channel() -> Self {
        Self {
            channel_type: ChannelType::Async,
            timeout: Some(30 * 60 * 1000), // 30 分钟
            config: HashMap::new(),
        }
    }
    
    /// 创建人工处理通道
    pub fn manual() -> Self {
        Self {
            channel_type: ChannelType::Manual,
            timeout: Some(24 * 60 * 60 * 1000), // 24 小时
            config: HashMap::new(),
        }
    }
}

/// 规则严重级别
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, PartialOrd)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Info,
    Warning,
    Error,
}

/// 规则类别
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RuleCategory {
    Naming,
    Structure,
    TypeSafety,
    Security,
    Performance,
    Testing,
    Documentation,
    BestPractice,
}

/// 规则定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    /// 规则唯一 ID
    pub id: RuleId,
    
    /// 规则描述
    pub description: String,
    
    /// 规则类别
    pub category: RuleCategory,
    
    /// 严重级别
    pub severity: Severity,
    
    /// 匹配模式（正则表达式）
    pub pattern: Option<String>,
    
    /// 违规消息
    pub message: String,
    
    /// 修复建议
    pub fix: Option<String>,
    
    /// 反面示例
    pub bad_example: Option<String>,
    
    /// 正面示例
    pub good_example: Option<String>,
    
    /// 参考链接
    #[serde(default)]
    pub references: Vec<String>,
    
    /// 标签
    #[serde(default)]
    pub tags: Vec<String>,
    
    /// 是否可自动修复
    #[serde(default)]
    pub auto_fix: bool,
}

impl Rule {
    /// 检查代码是否匹配规则
    pub fn matches(&self, code: &str) -> bool {
        if let Some(pattern) = &self.pattern {
            if let Ok(regex) = regex::Regex::new(pattern) {
                return regex.is_match(code);
            }
        }
        false
    }
}

/// 规则检查结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleIssue {
    /// 规则 ID
    pub rule_id: RuleId,
    
    /// 文件路径
    pub file: String,
    
    /// 行号（可选）
    pub line: Option<usize>,
    
    /// 问题描述
    pub message: String,
    
    /// 严重级别
    pub severity: Severity,
    
    /// 修复建议
    pub fix: Option<String>,
    
    /// 是否可自动修复
    pub auto_fix: bool,
}

/// 实现定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fulfillment {
    /// 实现唯一 ID
    pub id: FulfillmentId,
    
    /// 关联的意图 ID
    pub intent_id: IntentId,
    
    /// 实现者 ID（处理器、服务、人工等）
    pub fulfiller_id: String,
    
    /// 实现状态
    pub status: FulfillmentStatus,
    
    /// 创建时间
    pub created_at: DateTime<Utc>,
    
    /// 开始处理时间
    pub started_at: Option<DateTime<Utc>>,
    
    /// 完成时间
    pub completed_at: Option<DateTime<Utc>>,
    
    /// 结果（JSON）
    pub result: Option<serde_json::Value>,
    
    /// 错误信息
    pub error: Option<String>,
    
    /// 进度（0-100）
    pub progress: Option<u8>,
    
    /// 日志
    #[serde(default)]
    pub logs: Vec<FulfillmentLog>,
}

/// 实现状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FulfillmentStatus {
    Accepted,
    Processing,
    Completed,
    Partial,
    Failed,
    Rejected,
}

/// 实现日志
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FulfillmentLog {
    /// 日志时间
    pub timestamp: DateTime<Utc>,
    
    /// 日志级别
    pub level: LogLevel,
    
    /// 日志消息
    pub message: String,
    
    /// 附加数据
    pub data: Option<serde_json::Value>,
}

/// 日志级别
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl Fulfillment {
    /// 创建新实现
    pub fn new(intent_id: IntentId, fulfiller_id: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            intent_id,
            fulfiller_id,
            status: FulfillmentStatus::Accepted,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            result: None,
            error: None,
            progress: None,
            logs: Vec::new(),
        }
    }
    
    /// 添加日志
    pub fn log(&mut self, level: LogLevel, message: String, data: Option<serde_json::Value>) {
        self.logs.push(FulfillmentLog {
            timestamp: Utc::now(),
            level,
            message,
            data,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_intent_creation() {
        let intent = Intent::new(
            "code-review".to_string(),
            serde_json::json!({"target": "./src"}),
            ChannelConfig::sync(),
        );
        
        assert_eq!(intent.intent_type, "code-review");
        assert_eq!(intent.status, IntentStatus::Pending);
        assert_eq!(intent.priority, Priority::Normal);
    }
    
    #[test]
    fn test_rule_matching() {
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
        
        assert!(rule.matches("function foo(x: any) {}"));
        assert!(!rule.matches("function foo<T>(x: T) {}"));
    }
}
