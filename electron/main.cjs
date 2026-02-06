const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');

// 設定ファイルの読み込み（開発環境用）
// 本番環境ではユーザー設定フォルダなどを参照するように拡張が必要
const defaultSettings = require('../src/config/default-settings.json');

const isDev = !app.isPackaged;
const MALL_ID = defaultSettings.mallId || 'sakaikitahanada';

let mainWindow = null;

// 動画ディレクトリのパス解決
function getVideoDirectory() {
  if (isDev) {
    // 開発環境: プロジェクトルート/tmp/{mallId}/assets/video
    return path.join(__dirname, '..', 'tmp', MALL_ID, 'assets', 'video');
  } else {
    // 本番環境: AppData/Grain-Link/video (またはユーザー定義パス)
    return path.join(app.getPath('userData'), 'video');
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 1920,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true, // atomプロトコルを使用するため有効化推奨だが、開発中はfalseの方がトラブルが少ない場合も。一旦trueでatomを試す。
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
  // atom:// プロトコルの登録
  // 使用例: <video src="atom://media/001.mp4" />
  protocol.handle('atom', (request) => {
    const url = request.url.replace('atom://', '');
    const decodedPath = decodeURIComponent(url);
    
    // media/xxx.mp4 の形式を想定
    // media/ プレフィックスを取り除く
    const fileName = decodedPath.replace(/^media\//, '');
    
    const videoDir = getVideoDirectory();
    const absolutePath = path.join(videoDir, fileName);

    // console.log(`Serving video: ${absolutePath}`);
    
    // Windowsパスの正規化などが必要な場合があるが、file:/// URLスキームで返す
    // pathToFileURLを使うと安全
    const { pathToFileURL } = require('url');
    return net.fetch(pathToFileURL(absolutePath).toString());
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-app-version', () => app.getVersion());

// 動画ファイルリスト取得
ipcMain.handle('get-video-list', async () => {
  const videoDir = getVideoDirectory();
  try {
    if (!fs.existsSync(videoDir)) {
      console.warn(`Video directory not found: ${videoDir}`);
      return [];
    }
    const files = await fs.promises.readdir(videoDir);
    // .mp4 ファイルのみフィルタリング
    return files.filter(file => file.toLowerCase().endsWith('.mp4'));
  } catch (error) {
    console.error('Failed to read video directory:', error);
    return [];
  }
});
