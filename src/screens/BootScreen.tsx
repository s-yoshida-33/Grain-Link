import React, { useEffect, useState } from 'react';
// Removed unused MediaItem import
import { UpdateDialog } from '../components/UpdateDialog';
import { MediaDownloadDialog } from '../components/UpdateDialog';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import { useMediaDownload } from '../hooks/useMediaDownload';
import { useAppSettings } from '../hooks/useAppSettings';
// fetchMediaListFromApi is no longer needed for media syncing
import { logInfo, logError } from '../logs/logging';
import { fetch } from '@tauri-apps/plugin-http'; // Use Tauri's fetch

interface BootScreenProps {
  onBootComplete: () => void;
}

type BootStage = 'init' | 'update-check' | 'update-wait' | 'media-check' | 'media-wait' | 'countdown' | 'complete';

export const BootScreen: React.FC<BootScreenProps> = ({ onBootComplete }) => {
  // 修正: isUpdateReady を削除（使用していないため）
  const { updateStatus, installUpdate } = useAutoUpdate();
  const { downloadStatus, syncMediaFromZip } = useMediaDownload();
  const { settings } = useAppSettings();

  const [currentStage, setCurrentStage] = useState<BootStage>('init');
  const [countdownSeconds, setCountdownSeconds] = useState(90);
  const [skipUpdate, setSkipUpdate] = useState(false);
  const [skipMedia, setSkipMedia] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showMediaDialog, setShowMediaDialog] = useState(false);

  // Stage 1: Init -> Update Check
  useEffect(() => {
    if (currentStage === 'init') {
      setCurrentStage('update-check');
      setShowUpdateDialog(true);
    }
  }, [currentStage]);

  // Stage 2: Update Wait & Auto-Transition Logic
  useEffect(() => {
    if (currentStage !== 'update-check') return;

    // 修正: NodeJS.Timeout ではなく ReturnType<typeof setTimeout> を使用
    let timer: ReturnType<typeof setTimeout>;

    // ケース1: アップデート準備完了 (成功)
    if (updateStatus.status === 'ready') {
      logInfo('BOOT', 'Update ready, scheduling restart in 5s...');
      timer = setTimeout(() => {
        logInfo('BOOT', 'Executing auto-restart for update...');
        installUpdate(); // アプリ再起動
      }, 5000);
    }
    // ケース2: エラー発生 (失敗)
    else if (updateStatus.status === 'error') {
      logInfo('BOOT', 'Update error, skipping in 5s...');
      timer = setTimeout(() => {
        logInfo('BOOT', 'Auto-skipping update due to error');
        setSkipUpdate(true);
      }, 5000);
    }
    // ケース3: 更新なし (最新版)
    else if (updateStatus.status === 'uptodate') {
      // 最新版の場合は即座に次へ進む
      logInfo('BOOT', 'App is up to date, proceeding...');
      // 念のため少し待ってから遷移させると画面のちらつきが防げます
      timer = setTimeout(() => {
        setSkipUpdate(true);
      }, 1000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [updateStatus.status, currentStage, installUpdate]);

  // Stage 2 Transition Trigger
  useEffect(() => {
    if (currentStage === 'update-check' && skipUpdate) {
      logInfo('BOOT', 'Update stage completed (Skipped or Finished)');
      setShowUpdateDialog(false);
      setCurrentStage('media-check');
    }
  }, [skipUpdate, currentStage]);

  // Stage 3: Media Check
  useEffect(() => {
    if (currentStage === 'media-check' && settings) {
      (async () => {
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
            setCurrentStage('media-wait');
            setShowMediaDialog(true);
            
            await syncMediaFromZip(mediaZipUrl);
          } else {
            logInfo('BOOT', 'No media update info found in latest.json');
            setCurrentStage('countdown');
          }

        } catch (error) {
          logError('BOOT', 'Failed to check media updates', {
            error: error instanceof Error ? error.message : String(error)
          });
          setCurrentStage('countdown');
        }
      })();
    }
  }, [currentStage, settings, syncMediaFromZip]);

  // Stage 4: Media Wait
  useEffect(() => {
    if (
      currentStage === 'media-wait' &&
      (downloadStatus.status === 'completed' || downloadStatus.status === 'error' || skipMedia)
    ) {
      logInfo('BOOT', 'Media sync stage finished');
      setTimeout(() => {
        setShowMediaDialog(false);
        setCurrentStage('countdown');
      }, 1000);
    }
  }, [downloadStatus.status, skipMedia, currentStage]);

  // Stage 5: Countdown
  useEffect(() => {
    if (currentStage === 'countdown') {
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
    }
  }, [currentStage]);

  // Stage 6: Complete
  useEffect(() => {
    if (currentStage === 'complete') {
      setTimeout(() => {
        onBootComplete();
      }, 500);
    }
  }, [currentStage, onBootComplete]);

  // Handlers
  const handleSkipUpdate = () => {
    setSkipUpdate(true);
  };

  const handleSkipMedia = () => {
    setSkipMedia(true);
  };

  const handleSkipCountdown = () => {
    setCurrentStage('complete');
  };

  const getDialogStatus = () => {
    if (downloadStatus.status === 'extracting') return 'downloading';
    return downloadStatus.status;
  };

  return (
    <div className="fixed inset-0 bg-linear-to-b from-gray-900 to-black flex items-center justify-center z-50">
      {/* Main Content */}
      <div className="w-full h-full flex flex-col items-center justify-center gap-8">
        {/* Logo/Text */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Grain Link</h1>
          <p className="text-gray-400">Starting up...</p>
        </div>

        {/* Stage Indicators */}
        <div className="w-96 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-gray-800 rounded">
              <div className={`w-3 h-3 rounded-full ${currentStage === 'update-check' || currentStage === 'update-wait' ? 'bg-blue-500' : 'bg-gray-600'}`} />
              <span className="text-gray-300 text-sm">Check Updates</span>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-800 rounded">
              <div className={`w-3 h-3 rounded-full ${currentStage === 'media-check' || currentStage === 'media-wait' ? 'bg-blue-500' : 'bg-gray-600'}`} />
              <span className="text-gray-300 text-sm">Check Media</span>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-800 rounded">
              <div className={`w-3 h-3 rounded-full ${currentStage === 'countdown' ? 'bg-blue-500' : 'bg-gray-600'}`} />
              <span className="text-gray-300 text-sm">Ready to Start</span>
            </div>
          </div>

          {/* Countdown Display */}
          {currentStage === 'countdown' && (
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
          )}

          {/* Progress Bar */}
          {(currentStage === 'update-check' || currentStage === 'media-wait') && (
            <div className="w-full bg-gray-700 rounded-full h-1">
              <div
                className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    currentStage === 'update-check' ? updateStatus.progress : downloadStatus.progress
                  }%`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <UpdateDialog
        isOpen={showUpdateDialog}
        // ここでの型エラーは UpdateDialog.tsx を修正すれば消えます
        status={updateStatus.status === 'idle' ? 'checking' : updateStatus.status}
        progress={updateStatus.progress}
        message={updateStatus.message}
        onDismiss={handleSkipUpdate}
      />

      <MediaDownloadDialog
        isOpen={showMediaDialog}
        status={getDialogStatus()}
        progress={downloadStatus.progress}
        message={downloadStatus.message}
        currentFile={downloadStatus.currentFile}
        totalFiles={downloadStatus.totalFiles}
        downloadedFiles={downloadStatus.downloadedFiles}
        onDismiss={handleSkipMedia}
      />
    </div>
  );
};