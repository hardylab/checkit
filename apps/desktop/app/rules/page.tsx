'use client';
import { Shell } from '../components/Shell';
import Link from 'next/link';

export default function RulesMarketPage() {
  return (
    <Shell repo="rules-market">
      <div className="placeholder">
        <div className="placeholder-card">
          <h2>规则市场</h2>
          <p>下一阶段:<br />浏览、安装、编写 checkit 规则包,与 npm registry 集成。</p>
          <div>
            <span className="pill pill-accent">V2</span>
            <span className="pill">official rules</span>
            <span className="pill">community rules</span>
          </div>
          <p style={{ marginTop: 24 }}>
            <Link className="btn btn-primary" href="/">回到主控台</Link>
          </p>
        </div>
      </div>
    </Shell>
  );
}