import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Checkit Codebase Doctor',
  description: 'Compile-time testing for TypeScript projects. AI-Fix built in.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="light">
      <body>{children}</body>
    </html>
  );
}