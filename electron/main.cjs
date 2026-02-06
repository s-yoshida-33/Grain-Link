const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');

// 設定ファイルの読み込み（開発環境用）
// 本番環境ではユーザー設定フォルダなどを参照するように拡張が必要
// CommonJSでJSONを読み込む際のエラー回避のため、fsを使用して読み込む
const loadSettings = () => {
  try {
    const settingsPath = path.join(__dirname, '..', 'src', 'config', 'default-settings.json');
    const settingsData = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(settingsData);
  } catch (error) {
    console.warn('Failed to load settings from file, using defaults.', error);
    return {};
  }
};

const defaultSettings = loadSettings();

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
      webSecurity: false, // file:// プロトコルで動画を再生するために無効化
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

    console.log(`[atom protocol] Request: ${url} -> File: ${absolutePath}`);

    // ファイルが存在するか確認
    if (!fs.existsSync(absolutePath)) {
      console.error(`[atom protocol] File not found: ${absolutePath}`);
      return new Response('File not found', { status: 404 });
    }
    
    // Windowsパスの正規化などが必要な場合があるが、file:/// URLスキームで返す
    // pathToFileURLを使うと安全
    const { pathToFileURL } = require('url');
    // return net.fetch(pathToFileURL(absolutePath).toString());
    
    // net.fetch だと Range リクエストなどがうまく処理されない場合があるため
    // file:// URL を直接返すだけにする（Chromiumがローカルファイルとして処理する）
    // あるいは、responseヘッダーを付与して返す
    
    // 最も確実な方法は、file:// プロトコルへのリダイレクトではなく、
    // fetchしてBlobとして返すのではなく、パスを解決すること。
    // Electron 30+ では net.fetch('file://...') が推奨だが、動画の場合はRangeヘッダーなどが重要。
    
    // ここではシンプルに file:// URL を fetch して返す形にするが、
    // 動画再生のためにバイパスオプションをつける
    return net.fetch(pathToFileURL(absolutePath).toString(), {
        bypassCustomProtocolHandlers: true,
    });
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

// 動画ファイルリスト取得（フルパスで返す）
ipcMain.handle('get-video-list', async () => {
  const videoDir = getVideoDirectory();
  try {
    if (!fs.existsSync(videoDir)) {
      console.warn(`Video directory not found: ${videoDir}`);
      return [];
    }
    const files = await fs.promises.readdir(videoDir);
    // .mp4 ファイルのみフィルタリングしてフルパスに変換
    return files
      .filter(file => file.toLowerCase().endsWith('.mp4'))
      .map(file => path.join(videoDir, file)); // フルパスを返す
  } catch (error) {
    console.error('Failed to read video directory:', error);
    return [];
  }
});
