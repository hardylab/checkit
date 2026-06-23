// electron/preload.cjs — exposed to the renderer via contextBridge.
// Only safe, validated surfaces. No direct fs / spawn access.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('checkit', {
  /** Spawn the bundled CLI; returns parsed JSON issues or error info. */
  scan: (opts) => ipcRenderer.invoke('checkit:scan', opts),

  /** Native folder picker (returns absolute path or null). */
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),

  /** Native JSON file picker (returns { name, data } or { error } or null). */
  pickJson: () => ipcRenderer.invoke('dialog:pickJson'),

  /** Reveal a file path in the OS file manager. */
  reveal: (p) => ipcRenderer.invoke('shell:reveal', p),

  /** Surface info for debugging. */
  env: {
    isDev: !process.env.NODE_ENV || process.env.NODE_ENV !== 'production',
    platform: process.platform,
  },
});