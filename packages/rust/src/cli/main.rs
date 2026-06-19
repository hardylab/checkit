//! CheckIt CLI - 高性能规则检查命令行工具

use clap::{Parser, Subcommand};
use std::path::PathBuf;
use checkit::{EngineBuilder, core::Severity};

#[derive(Parser)]
#[command(name = "checkit")]
#[command(about = "CheckIt - 最佳实践数字化引擎", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// 检查代码
    Check {
        /// 目标路径
        #[arg(default_value = ".")]
        path: PathBuf,
        
        /// 规则仓库路径
        #[arg(short, long)]
        rules: Option<PathBuf>,
        
        /// 启用并行处理
        #[arg(short, long, default_value = "true")]
        parallel: bool,
        
        /// 输出格式（text/json）
        #[arg(short, long, default_value = "text")]
        format: String,
    },
    
    /// 初始化配置
    Init {
        /// 输出路径
        #[arg(default_value = ".")]
        path: PathBuf,
    },
    
    /// 显示统计信息
    Stats {
        /// 规则仓库路径
        #[arg(short, long)]
        rules: Option<PathBuf>,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 初始化日志
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("checkit=info".parse().unwrap()),
        )
        .init();
    
    let cli = Cli::parse();
    
    match cli.command {
        Commands::Check { path, rules, parallel, format } => {
            cmd_check(path, rules, parallel, &format).await?;
        }
        Commands::Init { path } => {
            cmd_init(path).await?;
        }
        Commands::Stats { rules } => {
            cmd_stats(rules).await?;
        }
    }
    
    Ok(())
}

async fn cmd_check(
    path: PathBuf,
    rules: Option<PathBuf>,
    parallel: bool,
    format: &str,
) -> anyhow::Result<()> {
    // 创建引擎
    let mut builder = EngineBuilder::new()
        .with_parallel(parallel);
    
    if let Some(rules_path) = rules {
        builder = builder.with_rules_path(rules_path);
    }
    
    let engine = builder.build_async().await?;
    
    println!("CheckIt 规则检查");
    println!("目标：{}", path.display());
    println!("规则数：{}", engine.rule_count().await);
    println!("并行：{}", parallel);
    println!();
    
    // 检查文件
    use walkdir::WalkDir;
    let mut total_issues = 0;
    
    for entry in WalkDir::new(&path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().extension().map_or(false, |ext| {
                ext == "ts" || ext == "tsx" || ext == "js" || ext == "jsx"
            })
        })
    {
        let content = std::fs::read_to_string(entry.path())?;
        let issues = engine.check_file(
            entry.path().to_str().unwrap_or(""),
            &content,
        ).await;
        
        if !issues.is_empty() {
            total_issues += issues.len();
            
            for issue in issues {
                match format {
                    "json" => {
                        println!("{}", serde_json::to_string(&issue)?);
                    }
                    _ => {
                        let level = match issue.severity {
                            Severity::Error => "🔴",
                            Severity::Warning => "🟡",
                            Severity::Info => "🔵",
                        };
                        println!(
                            "{} [{:?}] {}:{} - {}",
                            level,
                            issue.severity,
                            issue.file,
                            issue.line.unwrap_or(0),
                            issue.message
                        );
                    }
                }
            }
        }
    }
    
    println!();
    println!("总计：{} 个问题", total_issues);
    
    if total_issues > 0 && format == "text" {
        std::process::exit(1);
    }
    
    Ok(())
}

async fn cmd_init(path: PathBuf) -> anyhow::Result<()> {
    use std::fs;
    
    let config_path = path.join(".ai-compliance.yaml");
    
    let config = r#"# CheckIt AI Compliance Configuration
# https://github.com/checkit/checkit

project:
  name: my-project
  description: My awesome project
  languages:
    - typescript

# 信仰声明
beliefs:
  - 我们相信敏捷，不相信瀑布
  - 我们相信数据驱动，不相信直觉决策
  - 我们相信防御性编程，不相信快速修复

# 启用的范式
paradigms:
  # 使用内置范式
  - from: '@checkit/normal'
  # 使用自定义范式
  - from: './paradigms/my-paradigm.ts'
  # 覆盖配置
  - from: '@checkit/strict'
    overrides:
      function-size-limit:
        issue: error
        options:
          maxLines: 100

# AI 集成配置
ai:
  pre_generate:
    - type: show_rules
      value: true
    - type: confirm_scope
      value: true
  post_generate:
    - type: auto_fix
      value: true
    - type: block_on_error
      value: false
"#;
    
    fs::write(&config_path, config)?;
    println!("已创建配置文件：{}", config_path.display());
    
    Ok(())
}

async fn cmd_stats(rules: Option<PathBuf>) -> anyhow::Result<()> {
    println!("CheckIt 规则统计");
    println!();
    
    if let Some(rules_path) = rules {
        use std::fs;
        use walkdir::WalkDir;
        
        let mut total = 0;
        let mut by_category = std::collections::HashMap::new();
        
        for entry in WalkDir::new(&rules_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().map_or(false, |ext| ext == "yaml" || ext == "yml"))
        {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                if let Ok(rule) = serde_yaml::from_str::<checkit::Rule>(&content) {
                    total += 1;
                    
                    let category = format!("{:?}", rule.category);
                    *by_category.entry(category).or_insert(0) += 1;
                }
            }
        }
        
        println!("总规则数：{}", total);
        println!();
        println!("按类别:");
        for (category, count) in by_category {
            println!("  {}: {}", category, count);
        }
    } else {
        println!("请指定规则仓库路径：--rules <path>");
    }
    
    Ok(())
}
