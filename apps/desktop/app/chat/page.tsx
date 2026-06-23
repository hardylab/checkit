'use client';
import { Shell } from '../components/Shell';
import Link from 'next/link';

export default function ChatPage() {
  return (
    <Shell repo="chat">
      <div className="placeholder">
        <div className="placeholder-card">
          <h2>Chat — AI 规则助手</h2>
          <p>下一阶段:<br />用自然语言描述需求,自动生成 checkit 规则代码。</p>
          <div>
            <span className="pill pill-accent">V2</span>
            <span className="pill">生成规则</span>
            <span className="pill">诊断报告</span>
            <span className="pill">历史对话</span>
          </div>
          <p style={{ marginTop: 24 }}>
            <Link className="btn btn-primary" href="/">回到主控台</Link>
          </p>
        </div>
      </div>
    </Shell>
  );
}