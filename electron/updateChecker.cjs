// electron/updateChecker.cjs
// Auto-update logic using electron-updater (CommonJS)

const { dialog, app } = require('electron');
const { autoUpdater } = require('electron-updater');

let getPatchWindow = null;
let createMainWindow = null;

/**
 * Initialize autoUpdater event handlers.
 * This handles startup patch flow and sends progress updates to PatchWindow.
 */
function initAutoUpdater(opts) {
  getPatchWindow = opts.getPatchWindow;
  createMainWindow = opts.createMainWindow;
  const onNoUpdate = opts.onNoUpdate;

  // Skip code signature verification since we don't have a valid certificate yet
  // This allows auto-update to work with unsigned/self-signed builds
  autoUpdater.verifyUpdateCodeSignature = false;

  // Automatically download updates when available
  autoUpdater.autoDownload = true;
  // We call quitAndInstall manually
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    const win = getPatchWindow && getPatchWindow();
    if (!win) return;

    win.webContents.send('update-status', {
      state: 'checking',
      message: 'アップデートを確認中…',
    });
  });

  autoUpdater.on('update-available', (info) => {
    const win = getPatchWindow && getPatchWindow();
    if (!win) return;

    win.webContents.send('update-status', {
      state: 'available',
      message: `新しいバージョン ${info.version} をダウンロード中…`,
    });
  });

  autoUpdater.on('update-not-available', () => {
    if (onNoUpdate) {
      onNoUpdate();
      return;
    }

    const win = getPatchWindow && getPatchWindow();
    if (!win) return;

    win.webContents.send('update-status', {
      state: 'none',
      message: '最新バージョンです。',
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    const win = getPatchWindow && getPatchWindow();
    if (!win) return;

    win.webContents.send('update-progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      speed: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    const win = getPatchWindow && getPatchWindow();
    if (!win) return;

    win.webContents.send('update-status', {
      state: 'downloaded',
      message: 'ダウンロード完了。再起動します…',
    });

    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true);
    }, 1000);
  });

  autoUpdater.on('error', (err) => {
    // If custom handler is provided, delegate error handling (fallback to media check)
    // providing the error object so main process can decide
    if (onNoUpdate) {
      onNoUpdate(err);
      return;
    }

    const win = getPatchWindow && getPatchWindow();
    if (!win) return;

    win.webContents.send('update-status', {
      state: 'error',
      message: `エラー: ${err?.message ?? err}`,
    });
  });
}

/**
 * Check for updates.
 * - isManual = false → startup patch mode
 * - isManual = true → manual check with dialogs
 */
async function checkForUpdates(isManual = false) {
  const patchWindowExists = getPatchWindow && getPatchWindow();

  // Startup patch mode
  if (!isManual && patchWindowExists) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    
    // Set timeout to prevent freezing (30 seconds)
    let timeoutCleared = false;
    const timeout = setTimeout(() => {
      if (timeoutCleared) return;
      timeoutCleared = true;
      
      const win = getPatchWindow && getPatchWindow();
      if (win) {
        win.webContents.send('update-status', {
          state: 'error',
          message: 'タイムアウトしました。起動します…',
        });
      }
    }, 30000); // 30 seconds timeout
    
    // Clear timeout when update check completes
    const clearTimeoutOnComplete = () => {
      if (!timeoutCleared) {
        timeoutCleared = true;
        clearTimeout(timeout);
      }
    };
    
    // Use once to avoid duplicate handlers
    autoUpdater.once('error', clearTimeoutOnComplete);
    autoUpdater.once('update-not-available', clearTimeoutOnComplete);
    autoUpdater.once('update-available', clearTimeoutOnComplete);
    
    try {
      autoUpdater.checkForUpdates();
    } catch (e) {
      clearTimeoutOnComplete();
      const win = getPatchWindow && getPatchWindow();
      if (win) {
        win.webContents.send('update-status', {
          state: 'error',
          message: 'アップデート確認に失敗しました。',
        });
      }
    }
    return;
  }

  // Manual mode (dialog-based)
  try {
    autoUpdater.autoDownload = false;

    const checking = dialog.showMessageBox({
      type: 'info',
      title: 'アップデート確認',
      message: 'アップデートを確認しています…',
    });

    const result = await autoUpdater.checkForUpdates();

    if (!result || !result.updateInfo) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'アップデート確認',
        message: 'アップデート情報の取得に失敗しました。',
      });
      return;
    }

    const updateInfo = result.updateInfo;

    if (!updateInfo.version || updateInfo.version === app.getVersion()) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'アップデート確認',
        message: '最新バージョンを使用中です。',
      });
      return;
    }

    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'アップデート利用可能',
      message: `新しいバージョン ${updateInfo.version} が利用可能です。\n\nダウンロードしてインストールしますか？`,
      buttons: ['はい', 'いいえ'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response !== 0) return;

    await dialog.showMessageBox({
      type: 'info',
      title: 'アップデート',
      message: 'ダウンロードを開始します。バックグラウンドで実行されます。',
    });

    autoUpdater.autoDownload = true;

    autoUpdater.once('update-downloaded', async () => {
      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: '準備完了',
        message: 'アップデートの準備ができました。今すぐ再起動しますか？',
        buttons: ['再起動する', '後で'],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) autoUpdater.quitAndInstall();
    });

    autoUpdater.once('error', async (err) => {
      await dialog.showMessageBox({
        type: 'error',
        title: 'エラー',
        message: 'アップデート中にエラーが発生しました。',
        detail: String(err),
      });
    });

    await autoUpdater.downloadUpdate();
  } catch (err) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'エラー',
      message: 'アップデート確認に失敗しました。',
      detail: String(err),
    });
  }
}

module.exports = {
  initAutoUpdater,
  checkForUpdates,
};
