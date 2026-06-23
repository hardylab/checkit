// Electron preload bridge — exposed via contextBridge in electron/preload.cjs.
// Imported as a regular ambient declaration; Next.js TypeScript picks it up
// because we list it in tsconfig.json "include".

export {};

declare global {
  interface Window {
    checkit?: {
      scan: (opts?: { cwd?: string; fix?: boolean; aiFix?: boolean }) => Promise<{
        ok: boolean;
        exitCode?: number;
        issues?: any[];
        stderr?: string;
        raw?: string;
        parseError?: string;
      }>;
      pickFolder: () => Promise<string | null>;
      pickJson: () => Promise<{ name: string; data: any } | { error: string } | null>;
      reveal: (p: string) => void;
      env: { isDev: boolean; platform: string };
    };
  }
}