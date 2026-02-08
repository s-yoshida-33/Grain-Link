const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { initAutoUpdater, checkForUpdates } = require('./updateChecker.cjs');
const { checkForMediaUpdates, downloadAndInstallMediaUpdate } = require('./mediaUpdater.cjs');

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
let patchWindow = null;

// 動画ディレクトリのパス解決
function getVideoDirectory() {
  if (isDev) {
    // 開発環境: プロジェクトルート/tmp/{mallId}/assets/videos
    return path.join(__dirname, '..', 'tmp', MALL_ID, 'assets', 'videos');
  } else {
    // 本番環境: AppData/Grain-Link/videos (またはユーザー定義パス)
    return path.join(app.getPath('userData'), 'videos');
  }
}

// レンダラーのベースURLを取得
function getRendererUrl(hash = '') {
  const baseUrl = isDev
    ? 'http://localhost:5173/'
    : `file://${path.join(__dirname, '../dist/index.html')}`;
  
  return hash ? `${baseUrl}#${hash}` : baseUrl;
}

function createPatchWindow() {
  if (patchWindow && !patchWindow.isDestroyed()) {
    patchWindow.focus();
    return;
  }

  patchWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  patchWindow.loadURL(getRendererUrl('patch'));

  patchWindow.on('closed', () => {
    patchWindow = null;
  });
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1080,
    height: 1920,
    fullscreen: true,       // フルスクリーン起動
    alwaysOnTop: true,      // 常に最前面
    autoHideMenuBar: true,  // メニューバーを隠す (Altで表示)
    kiosk: true,            // キオスクモード
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // file:// プロトコルで動画を再生するために無効化
    },
  });

  mainWindow.loadURL(getRendererUrl());

  if (isDev) {
    // 開発モードでも最初は閉じている方が実機に近いが、デバッグしにくければコメントアウト解除
    // mainWindow.webContents.openDevTools();
  }
  
  // F12でDevToolsトグル (開発環境、本番環境問わずメンテナンス用として残す場合)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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

  // 開発環境でも本番環境でも、まずはパッチウィンドウを表示してアップデートフローを通す
  createPatchWindow();

  // Initialize autoUpdater
  initAutoUpdater({
    getPatchWindow: () => patchWindow,
    createMainWindow,
    onNoUpdate: async (error) => {
      // App update not found or error.
      if (error) {
        console.error('App update error/not-found, checking media update...', error);
      } else {
        console.log('App is up to date, checking media update...');
      }

      // Check media update
      if (patchWindow && !patchWindow.isDestroyed()) {
        patchWindow.webContents.send('update-status', {
          state: 'checking',
          message: 'メディアの更新を確認中…',
        });
      }

      try {
        const updateInfo = await checkForMediaUpdates();

        if (updateInfo) {
          if (patchWindow && !patchWindow.isDestroyed()) {
            patchWindow.webContents.send('update-status', {
              state: 'available',
              message: 'メディアの更新をダウンロード中…',
            });
          }

          await downloadAndInstallMediaUpdate(updateInfo, (percent, transferred, total) => {
            if (patchWindow && !patchWindow.isDestroyed()) {
              patchWindow.webContents.send('update-progress', {
                percent,
                transferred,
                total,
                speed: 0, // Not calculated
              });
            }
          });

          if (patchWindow && !patchWindow.isDestroyed()) {
            patchWindow.webContents.send('update-status', {
              state: 'downloaded',
              message: 'メディア更新完了。',
            });
          }

          // Wait a bit then proceed to wait/launch
          setTimeout(() => {
            if (patchWindow && !patchWindow.isDestroyed()) {
              // Send 'none' to trigger wait timer
              patchWindow.webContents.send('update-status', {
                state: 'none',
                message: '起動準備完了。',
              });
            }
          }, 1500);
        } else {
          // No media update
          if (patchWindow && !patchWindow.isDestroyed()) {
            patchWindow.webContents.send('update-status', {
              state: 'none',
              message: '最新バージョンです。',
            });
          }
        }
      } catch (e) {
        console.error('Media update failed', e);
        if (patchWindow && !patchWindow.isDestroyed()) {
          // Treat as no update/error, allow proceed
          patchWindow.webContents.send('update-status', {
            state: 'error',
            message: 'メディア更新失敗。起動します…',
          });
        }
      }
    },
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createPatchWindow();
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

// パッチウィンドウからのイベントハンドラ
ipcMain.on('updater:check-for-updates-ready', () => {
  // レンダラーの準備ができたらアップデート確認開始
  // 開発環境では自動ダウンロードは動かないことが多い（未署名など）が、
  // ロジック確認のために呼び出す
  checkForUpdates(false);
});

ipcMain.on('startup-wait-completed', () => {
  console.log('Startup wait completed. Launching main window.');
  if (patchWindow) {
    patchWindow.close();
  }
  createMainWindow();
});
