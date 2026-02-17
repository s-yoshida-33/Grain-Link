import React, { useEffect, useState } from 'react';
import type { MediaItem } from '../hooks/useMediaDownload';
import { UpdateDialog } from '../components/UpdateDialog';
import { MediaDownloadDialog } from '../components/UpdateDialog';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import { useMediaDownload } from '../hooks/useMediaDownload';
import { useAppSettings } from '../hooks/useAppSettings';
import { fetchMediaListFromApi } from '../api/restClient';
import { logInfo } from '../logs/logging';

interface BootScreenProps {
  onBootComplete: () => void;
}

type BootStage = 'init' | 'update-check' | 'update-wait' | 'media-check' | 'media-wait' | 'countdown' | 'complete';

export const BootScreen: React.FC<BootScreenProps> = ({ onBootComplete }) => {
  const { updateStatus, isUpdateReady } = useAutoUpdate();
  const { downloadStatus, downloadMediaList } = useMediaDownload();
  const { settings } = useAppSettings();

  const [currentStage, setCurrentStage] = useState<BootStage>('init');
  const [countdownSeconds, setCountdownSeconds] = useState(90);
  const [skipUpdate, setSkipUpdate] = useState(false);
  const [skipMedia, setSkipMedia] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showMediaDialog, setShowMediaDialog] = useState(false);

  // ステージ 1: アップデートチェック
  useEffect(() => {
    if (currentStage === 'init') {
      setCurrentStage('update-check');
      setShowUpdateDialog(true);
    }
  }, [currentStage]);

  // ステージ 2: アップデート待機
  useEffect(() => {
    if (currentStage === 'update-check' && (isUpdateReady || skipUpdate) && updateStatus.status === 'idle') {
      logInfo('BOOT', 'Update stage completed');
      setShowUpdateDialog(false);
      setCurrentStage('media-check');
    }
  }, [updateStatus.status, isUpdateReady, skipUpdate, currentStage]);

  // ステージ 3: メディアチェック
  useEffect(() => {
    if (currentStage === 'media-check' && settings) {
      (async () => {
        const { imageUrls, videoUrls } = await fetchMediaListFromApi(settings.mallId);
        const mediaList: MediaItem[] = [
          ...imageUrls.map((url, idx) => ({
            url,
            fileName: `image-${idx}.jpg`,
            type: 'image' as const,
          })),
          ...videoUrls.map((url, idx) => ({
            url,
            fileName: `video-${idx}.mp4`,
            type: 'video' as const,
          })),
        ];

        if (mediaList.length > 0) {
          setCurrentStage('media-wait');
          setShowMediaDialog(true);
          await downloadMediaList(mediaList);
        } else {
          logInfo('BOOT', 'No media to download');
          setCurrentStage('countdown');
        }
      })();
    }
  }, [currentStage, settings, downloadMediaList]);

  // ステージ 4: メディア待機
  useEffect(() => {
    if (
      currentStage === 'media-wait' &&
      (downloadStatus.status === 'completed' || downloadStatus.status === 'error' || skipMedia)
    ) {
      logInfo('BOOT', 'Media download stage completed');
      setShowMediaDialog(false);
      setCurrentStage('countdown');
    }
  }, [downloadStatus.status, skipMedia, currentStage]);

  // ステージ 5: カウントダウン
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

  // ステージ 6: 完了
  useEffect(() => {
    if (currentStage === 'complete') {
      setTimeout(() => {
        onBootComplete();
      }, 500);
    }
  }, [currentStage, onBootComplete]);

  // ハンドラ
  const handleSkipUpdate = () => {
    setSkipUpdate(true);
  };

  const handleSkipMedia = () => {
    setSkipMedia(true);
  };

  const handleSkipCountdown = () => {
    setCurrentStage('complete');
  };

  return (
    <div className="fixed inset-0 bg-linear-to-b from-gray-900 to-black flex items-center justify-center z-50">
      {/* メイン表示内容 */}
      <div className="w-full h-full flex flex-col items-center justify-center gap-8">
        {/* ロゴ・テキスト */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Grain Link</h1>
          <p className="text-gray-400">起動中...</p>
        </div>

        {/* ステージインジケータ */}
        <div className="w-96 space-y-4">
          {/* ステージ表示 */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-gray-800 rounded">
              <div className={`w-3 h-3 rounded-full ${currentStage === 'update-check' || currentStage === 'update-wait' ? 'bg-blue-500' : 'bg-gray-600'}`} />
              <span className="text-gray-300 text-sm">アップデート確認</span>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-800 rounded">
              <div className={`w-3 h-3 rounded-full ${currentStage === 'media-check' || currentStage === 'media-wait' ? 'bg-blue-500' : 'bg-gray-600'}`} />
              <span className="text-gray-300 text-sm">メディアチェック</span>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-800 rounded">
              <div className={`w-3 h-3 rounded-full ${currentStage === 'countdown' ? 'bg-blue-500' : 'bg-gray-600'}`} />
              <span className="text-gray-300 text-sm">起動準備</span>
            </div>
          </div>

          {/* カウントダウン表示 */}
          {currentStage === 'countdown' && (
            <div className="text-center py-6 bg-gray-800 rounded">
              <div className="text-5xl font-bold text-white mb-2">{countdownSeconds}</div>
              <p className="text-gray-400 text-sm">秒後に起動します</p>
              <button
                onClick={handleSkipCountdown}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                今すぐ開始
              </button>
            </div>
          )}

          {/* プログレスバー */}
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

      {/* ダイアログ */}
      <UpdateDialog
        isOpen={showUpdateDialog}
        status={updateStatus.status === 'idle' ? 'checking' : updateStatus.status}
        progress={updateStatus.progress}
        message={updateStatus.message}
        onDismiss={handleSkipUpdate}
      />

      <MediaDownloadDialog
        isOpen={showMediaDialog}
        status={downloadStatus.status}
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
