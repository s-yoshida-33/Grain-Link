const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // ローカルメディア再生用
    },
  });

  const rendererUrl = isDev
    ? 'http://localhost:5173/'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(rendererUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ショップAPI連携などの将来的なIPCハンドラ用
ipcMain.handle('get-app-version', () => app.getVersion());
