const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_PATH = app.getPath('userData');
const CONFIG_FILE = path.join(DATA_PATH, 'daycal-config.json');

// ─── Config helpers ──────────────────────────────────────────
function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); } catch { return {}; }
}
function writeConfig(data) {
  try {
    const cur = readConfig();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...cur, ...data }, null, 2));
  } catch {}
}

// ─── Module windows ─────────────────────────────────────────
// Each widget is its own BrowserWindow: transparent, frameless, always-on-top
const MOD_NAMES = ['clock', 'calendar', 'todo', 'memo', 'alarm', 'ai'];
const modWindows = {};  // name -> BrowserWindow

const MOD_DEFAULTS = {
  clock:    { x: 40,  y: 40,  w: 340, h: 100 },
  calendar: { x: 40,  y: 160, w: 260, h: 270 },
  todo:     { x: 320, y: 160, w: 280, h: 300 },
  memo:     { x: 40,  y: 450, w: 380, h: 200 },
  alarm:    { x: 40,  y: 668, w: 380, h: 200 },
  ai:       { x: 420, y: 40,  w: 340, h: 480 },
};

function createModWindow(name) {
  const cfg = readConfig();
  const saved = cfg.windows?.[name] || {};
  const def = MOD_DEFAULTS[name];
  const disp = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    x: saved.x ?? def.x,
    y: saved.y ?? def.y,
    width:  saved.w ?? def.w,
    height: saved.h ?? def.h,
    minWidth: 160, minHeight: 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  if (name === 'ai') {
    win.loadFile('src/ai-widget.html');
  } else {
    win.loadFile('src/widget.html', { query: { mod: name } });
  }
  win.once('ready-to-show', () => {
    if (saved.visible !== false) win.show();
  });

  // Save position/size on move/resize
  const persist = () => {
    const [x, y] = win.getPosition();
    const [w, h] = win.getSize();
    const cfg2 = readConfig();
    if (!cfg2.windows) cfg2.windows = {};
    cfg2.windows[name] = { x, y, w, h, visible: win.isVisible() };
    writeConfig({ windows: cfg2.windows });
  };
  win.on('moved',   persist);
  win.on('resized', persist);

  modWindows[name] = win;
  return win;
}

// ─── Settings window ─────────────────────────────────────────
let settingsWin = null;
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus(); return;
  }
  settingsWin = new BrowserWindow({
    width: 500, height: 600,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  settingsWin.loadFile('src/settings.html');
  settingsWin.on('closed', () => { settingsWin = null; });
}

// ─── Tray ─────────────────────────────────────────────────────
let tray;
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'logo64.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('DayCal 桌面日历');

  function buildMenu() {
    const items = MOD_NAMES.map(name => {
      const win = modWindows[name];
      const labels = { clock:'时钟', calendar:'日历', todo:'待办', memo:'备忘录', alarm:'闹铃' };
      return {
        label: (win?.isVisible() ? '✓ ' : '   ') + labels[name],
        click: () => { if (win) { win.isVisible() ? win.hide() : win.show(); updatePersistVisible(name, win.isVisible()); buildMenu(); } }
      };
    });
    const menu = Menu.buildFromTemplate([
      { label: 'DayCal', enabled: false },
      { type: 'separator' },
      ...items,
      { type: 'separator' },
      { label: '⚙ 设置', click: openSettings },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]);
    tray.setContextMenu(menu);
  }
  buildMenu();
  tray.on('double-click', () => {
    MOD_NAMES.forEach(n => modWindows[n]?.show());
  });
}

function updatePersistVisible(name, visible) {
  const cfg = readConfig();
  if (!cfg.windows) cfg.windows = {};
  if (!cfg.windows[name]) cfg.windows[name] = {};
  cfg.windows[name].visible = visible;
  writeConfig({ windows: cfg.windows });
}

// ─── App lifecycle ────────────────────────────────────────────
// Set publisher metadata visible in Windows installer and task manager
app.setName('DayCal');

app.whenReady().then(() => {
  MOD_NAMES.forEach(createModWindow);
  createTray();

  // Auto-launch setup (via Electron's built-in)
  const cfg = readConfig();
  app.setLoginItemSettings({ openAtLogin: !!cfg.autoLaunch });
});

app.on('window-all-closed', () => {});  // keep running in tray

// ─── IPC ─────────────────────────────────────────────────────
ipcMain.handle('get-config', () => readConfig());
ipcMain.handle('set-config', (_, data) => { writeConfig(data); return true; });

ipcMain.handle('get-mod', (_, name) => {
  const win = modWindows[name];
  if (!win) return null;
  const [x, y] = win.getPosition();
  const [w, h] = win.getSize();
  return { x, y, w, h, visible: win.isVisible() };
});

ipcMain.on('win-move-by', (_, { name, dx, dy }) => {
  const win = modWindows[name];
  if (!win) return;
  const [x, y] = win.getPosition();
  win.setPosition(x + Math.round(dx), y + Math.round(dy));
});

ipcMain.on('win-hide', (_, name) => {
  modWindows[name]?.hide();
  updatePersistVisible(name, false);
});

ipcMain.on('win-show', (_, name) => {
  modWindows[name]?.show();
  updatePersistVisible(name, true);
});

ipcMain.on('win-pin', (_, { name, pinned }) => {
  modWindows[name]?.setAlwaysOnTop(pinned);
});

ipcMain.on('open-settings', () => openSettings());
ipcMain.on('close-settings', () => settingsWin?.close());

ipcMain.on('apply-settings', (_, settings) => {
  writeConfig(settings);
  // Broadcast to all mod windows so applyCFG() fires immediately
  MOD_NAMES.forEach(n => {
    const win = modWindows[n];
    if (win && !win.isDestroyed()) {
      win.webContents.send('settings-changed', settings);
    }
  });
  // Module visibility
  if (settings.modules) {
    MOD_NAMES.forEach(n => {
      const win = modWindows[n];
      if (!win || win.isDestroyed()) return;
      const shouldShow = settings.modules[n] !== false;
      if (shouldShow && !win.isVisible()) win.show();
      if (!shouldShow && win.isVisible()) win.hide();
      updatePersistVisible(n, shouldShow);
    });
  }
  // Always-on-top
  if (settings.alwaysOnTop !== undefined) {
    MOD_NAMES.forEach(n => {
      const win = modWindows[n];
      if (win && !win.isDestroyed()) win.setAlwaysOnTop(!!settings.alwaysOnTop);
    });
  }
  // Auto-launch
  if (settings.autoLaunch !== undefined) {
    app.setLoginItemSettings({ openAtLogin: !!settings.autoLaunch });
  }
});

ipcMain.on('resize-win', (_, { name, w, h }) => {
  const win = modWindows[name];
  if (!win) return;
  win.setSize(Math.round(w), Math.round(h));
});

// ─── Shared data store ───────────────────────────────────────
// All widget windows read/write through main process so data is consistent
const dataPath = path.join(DATA_PATH, 'daycal-data.json');

function readData() {
  try { return JSON.parse(fs.readFileSync(dataPath, 'utf-8')); }
  catch { return { todos: {}, memos: {}, alarms: [] }; }
}
function writeData(data) {
  try { fs.writeFileSync(dataPath, JSON.stringify(data, null, 2)); } catch {}
}

ipcMain.handle('data-get', () => readData());
ipcMain.handle('data-set', (_, data) => {
  writeData(data);
  // Broadcast to all widget windows so they re-render
  MOD_NAMES.forEach(n => {
    const win = modWindows[n];
    if (win && !win.isDestroyed()) win.webContents.send('data-changed', data);
  });
  return true;
});

// ─── Alarm audio broadcast ───────────────────────────────────
// Any window fires alarm → main relays to ALL windows to play audio
ipcMain.on('alarm-fire', (event, info) => {
  MOD_NAMES.forEach(n => {
    const win = modWindows[n];
    if (win && !win.isDestroyed()) win.webContents.send('alarm-fire-bcast', info);
  });
});

// Any window stops alarm → main relays to ALL windows to stop audio
ipcMain.on('alarm-stop', (event, id) => {
  MOD_NAMES.forEach(n => {
    const win = modWindows[n];
    if (win && !win.isDestroyed()) win.webContents.send('alarm-stop-bcast', id);
  });
});

// ─── API Key store (separate file, lightweight encryption) ───
const crypto = require('crypto');
const KEY_FILE = path.join(DATA_PATH, 'daycal-apikey.enc');
const ENC_SECRET = app.getPath('userData') + 'daycal_enc_v1';

function encryptKey(text) {
  const iv = crypto.randomBytes(16);
  const k  = crypto.createHash('sha256').update(ENC_SECRET).digest();
  const c2  = crypto.createCipheriv('aes-256-cbc', k, iv);
  return iv.toString('hex') + ':' + Buffer.concat([c2.update(text), c2.final()]).toString('hex');
}
function decryptKey(enc) {
  try {
    const [ivHex, dataHex] = enc.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const k  = crypto.createHash('sha256').update(ENC_SECRET).digest();
    const d  = crypto.createDecipheriv('aes-256-cbc', k, iv);
    return Buffer.concat([d.update(Buffer.from(dataHex,'hex')), d.final()]).toString();
  } catch { return ''; }
}

ipcMain.handle('get-apikey', () => {
  try { return decryptKey(fs.readFileSync(KEY_FILE, 'utf-8')); } catch { return ''; }
});
ipcMain.handle('set-apikey', (_, key) => {
  try { fs.writeFileSync(KEY_FILE, encryptKey(key)); return true; } catch { return false; }
});
