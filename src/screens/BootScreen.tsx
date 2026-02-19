import React, { useEffect, useState, useCallback } from 'react';
import { UpdateDialog, MediaDownloadDialog } from '../components/UpdateDialog';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import { useMediaDownload } from '../hooks/useMediaDownload';
import { useAppSettings } from '../hooks/useAppSettings';
import { logInfo, logError } from '../logs/logging';
import { fetch } from '@tauri-apps/plugin-http';

interface BootScreenProps {
  onBootComplete: () => void;
}

type BootStage = 'update' | 'media' | 'countdown' | 'complete';

export const BootScreen: React.FC<BootScreenProps> = ({ onBootComplete }) => {
  const { updateStatus, installUpdate } = useAutoUpdate();
  const { downloadStatus, syncMediaFromZip } = useMediaDownload();
  const { settings } = useAppSettings();

  const [currentStage, setCurrentStage] = useState<BootStage>('update');
  const [countdownSeconds, setCountdownSeconds] = useState(90);
  const [mediaStarted, setMediaStarted] = useState(false);

  // --- Stage 1: Update ---
  // UpdateDialog が進捗をすべて表示。完了/エラー/最新版で自動的に次のステージへ。
  useEffect(() => {
    if (currentStage !== 'update') return;

    let timer: ReturnType<typeof setTimeout>;

    if (updateStatus.status === 'ready') {
      logInfo('BOOT', 'Update ready, restarting in 5s...');
      timer = setTimeout(() => {
        logInfo('BOOT', 'Executing auto-restart for update...');
        installUpdate();
      }, 5000);
    } else if (updateStatus.status === 'error') {
      logInfo('BOOT', 'Update error, skipping in 5s...');
      timer = setTimeout(() => {
        logInfo('BOOT', 'Auto-skipping update due to error');
        setCurrentStage('media');
      }, 5000);
    } else if (updateStatus.status === 'uptodate') {
      logInfo('BOOT', 'App is up to date, proceeding...');
      timer = setTimeout(() => setCurrentStage('media'), 1000);
    }

    return () => { if (timer) clearTimeout(timer); };
  }, [updateStatus.status, currentStage, installUpdate]);

  // --- Stage 2: Media check & download ---
  // MediaDownloadDialog が進捗を表示。
  const startMediaCheck = useCallback(async () => {
    try {
      logInfo('BOOT', 'Checking for media updates from latest.json...');
      const latestJsonUrl = "https://github.com/s-yoshida-33/Grain-Link/releases/latest/download/latest.json";
      const response = await fetch(latestJsonUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch latest.json: ${response.status}`);
      }

      const manifest = await response.json();
      const mediaZipUrl = manifest.media?.url;

      if (mediaZipUrl) {
        logInfo('BOOT', `Found media update: ${mediaZipUrl}`);
        await syncMediaFromZip(mediaZipUrl);
        // downloadStatus の変化で次のステージへ遷移
        return;
      }

      logInfo('BOOT', 'No media update info found in latest.json');
    } catch (error) {
      logError('BOOT', 'Failed to check media updates', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    // メディアなし or エラー → カウントダウンへ
    setCurrentStage('countdown');
  }, [syncMediaFromZip]);

  useEffect(() => {
    if (currentStage === 'media' && settings && !mediaStarted) {
      setMediaStarted(true);
      startMediaCheck();
    }
  }, [currentStage, settings, mediaStarted, startMediaCheck]);

  // メディアダウンロード完了/エラー → カウントダウンへ
  useEffect(() => {
    if (currentStage !== 'media' || !mediaStarted) return;
    if (downloadStatus.status === 'completed' || downloadStatus.status === 'error') {
      logInfo('BOOT', 'Media sync stage finished');
      setTimeout(() => setCurrentStage('countdown'), 1000);
    }
  }, [downloadStatus.status, currentStage, mediaStarted]);

  // --- Stage 3: Countdown ---
  useEffect(() => {
    if (currentStage !== 'countdown') return;
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCurrentStage('complete');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentStage]);

  // --- Stage 4: Complete ---
  useEffect(() => {
    if (currentStage === 'complete') {
      setTimeout(() => onBootComplete(), 500);
    }
  }, [currentStage, onBootComplete]);

  // --- Handlers ---
  const handleSkipUpdate = () => setCurrentStage('media');
  const handleSkipMedia = () => setCurrentStage('countdown');
  const handleSkipCountdown = () => setCurrentStage('complete');

  const getMediaDialogStatus = () => {
    if (downloadStatus.status === 'extracting') return 'downloading';
    return downloadStatus.status;
  };

  // --- Render ---

  // Phase 1: アップデートダイアログのみ表示
  if (currentStage === 'update') {
    return (
      <UpdateDialog
        isOpen={true}
        status={updateStatus.status === 'idle' ? 'checking' : updateStatus.status}
        progress={updateStatus.progress}
        message={updateStatus.message}
        onInstall={installUpdate}
        onDismiss={handleSkipUpdate}
      />
    );
  }

  // Phase 2: メディアダウンロードダイアログのみ表示
  if (currentStage === 'media' && mediaStarted && downloadStatus.status !== 'idle') {
    return (
      <MediaDownloadDialog
        isOpen={true}
        status={getMediaDialogStatus()}
        progress={downloadStatus.progress}
        message={downloadStatus.message}
        currentFile={downloadStatus.currentFile}
        totalFiles={downloadStatus.totalFiles}
        downloadedFiles={downloadStatus.downloadedFiles}
        onDismiss={handleSkipMedia}
      />
    );
  }

  // Phase 3: カウントダウン画面 (media のチェック中もフォールバック)
  return (
    <div className="fixed inset-0 bg-linear-to-b from-gray-900 to-black flex items-center justify-center z-50">
      <div className="w-full h-full flex flex-col items-center justify-center gap-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Grain Link</h1>
          {currentStage === 'media' && (
            <p className="text-gray-400">メディアを確認中...</p>
          )}
        </div>

        {currentStage === 'countdown' && (
          <div className="w-96">
            <div className="text-center py-6 bg-gray-800 rounded">
              <div className="text-5xl font-bold text-white mb-2">{countdownSeconds}</div>
              <p className="text-gray-400 text-sm">Seconds remaining</p>
              <button
                onClick={handleSkipCountdown}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Start Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
