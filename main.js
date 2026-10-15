const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

if (!app.requestSingleInstanceLock()) app.quit();

let win, tray;
const dataFile = () => path.join(app.getPath('userData'), 'groups.json');
const exe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;

// Keep the window at the bottom of the z-order so it behaves like the desktop.
let sendBottom = () => {};
try {
  const koffi = require('koffi');
  const SetWindowPos = koffi.load('user32.dll').func(
    'bool __stdcall SetWindowPos(uintptr_t h, intptr_t after, int x, int y, int cx, int cy, uint32_t flags)'
  );
  sendBottom = () => {
    if (!win || win.isDestroyed()) return;
    const h = win.getNativeWindowHandle().readBigUInt64LE(0);
    SetWindowPos(h, 1, 0, 0, 0, 0, 0x13); // HWND_BOTTOM, NOSIZE | NOMOVE | NOACTIVATE
  };
} catch (e) {
  console.log('Bottom z-order not available:', e.message);
}

function createWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    x: wa.x, y: wa.y, width: wa.width, height: wa.height,
    frame: false, transparent: true, hasShadow: false, resizable: false,
    movable: false, minimizable: false, maximizable: false, skipTaskbar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    win.show();
    win.setIgnoreMouseEvents(true, { forward: true });
    sendBottom();
  });
  win.on('focus', () => setTimeout(sendBottom, 0));
  win.on('show', sendBottom);
}

function createTray() {
  const px = Buffer.alloc(16 * 16 * 4);
  for (let i = 0; i < 256; i++) px.set([0xb4, 0x9a, 0x2e, 0xff], i * 4); // BGRA
  tray = new Tray(nativeImage.createFromBitmap(px, { width: 16, height: 16 }));
  tray.setToolTip('DeskGroups');
  const build = () => Menu.buildFromTemplate([
    {
      label: 'Start with Windows', type: 'checkbox',
      checked: app.getLoginItemSettings({ path: exe }).openAtLogin,
      click: (m) => app.setLoginItemSettings({ openAtLogin: m.checked, path: exe })
    },
    { label: 'Reload', click: () => win.reload() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.on('click', () => tray.popUpContextMenu(build()));
  tray.setContextMenu(build());
}

ipcMain.handle('load', () => {
  try { return JSON.parse(fs.readFileSync(dataFile(), 'utf8')); } catch { return { tiles: [] }; }
});
ipcMain.on('save', (_e, d) => fs.writeFileSync(dataFile(), JSON.stringify(d, null, 2)));
ipcMain.handle('icon', async (_e, p) => {
  try { return (await app.getFileIcon(p, { size: 'large' })).toDataURL(); } catch { return null; }
});
ipcMain.on('open', (_e, type, value) => (type === 'url' ? shell.openExternal(value) : shell.openPath(value)));
ipcMain.on('ignore', (_e, on) => win.setIgnoreMouseEvents(on, on ? { forward: true } : undefined));
ipcMain.handle('pick', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
  return r.canceled ? [] : r.filePaths;
});

app.whenReady().then(() => { createWindow(); createTray(); });
app.on('second-instance', () => win && win.reload());
