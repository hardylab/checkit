// electron/main.cjs — Electron main process.
// Spawns the local @checkit/cli and exposes a controlled IPC surface
// to the renderer via the preload script.

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const isDev = !app.isPackaged;
const DEV_URL = 'http://localhost:3000';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#fafafa',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // need require() in preload
    },
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'out', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─────────────────────────────────────────────────────────────
// IPC: checkit CLI bridge
// ─────────────────────────────────────────────────────────────

/** Resolve the absolute path to the bundled checkit CLI binary. */
function cliBinary() {
  // In dev: node_modules/.pnpm/@checkit+cli/.../dist/cli.cjs (we use node + tsx-less cli.cjs)
  // In packaged: extraResources/checkit-cli/
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'checkit-cli', 'dist', 'cli.cjs');
  }
  // dev: walk up from apps/desktop to repo root, then packages/backend/dist
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  return path.join(repoRoot, 'packages', 'backend', 'dist', 'cli.cjs');
}

/** Spawn the checkit CLI and stream parsed JSON. */
ipcMain.handle('checkit:scan', async (event, { cwd, fix = false, aiFix = false } = {}) => {
  const bin = cliBinary();
  const args = [];
  if (cwd) args.push(cwd);
  if (fix) args.push('--fix');
  if (aiFix) args.push('--ai-fix');
  args.push('--reporter', 'json');

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd: cwd || process.cwd(),
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf-8'); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf-8'); });

    child.on('error', (err) => reject({ code: 'SPAWN_FAIL', message: err.message, bin }));
    child.on('close', (code) => {
      try {
        const issues = JSON.parse(stdout || '[]');
        resolve({ ok: true, exitCode: code, issues, stderr });
      } catch (e) {
        resolve({ ok: false, exitCode: code, raw: stdout, stderr, parseError: e.message });
      }
    });
  });
});

/** Open a native folder picker. Returns absolute path or null. */
ipcMain.handle('dialog:pickFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择项目目录',
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

/** Open a native JSON file picker. */
ipcMain.handle('dialog:pickJson', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择 checkit 报告',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const fs = require('node:fs/promises');
  const text = await fs.readFile(result.filePaths[0], 'utf-8');
  try {
    return { name: path.basename(result.filePaths[0]), data: JSON.parse(text) };
  } catch (e) {
    return { error: `解析失败: ${e.message}` };
  }
});

/** Reveal a path in OS file manager. */
ipcMain.handle('shell:reveal', (_e, p) => {
  shell.showItemInFolder(p);
});