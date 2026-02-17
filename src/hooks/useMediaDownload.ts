import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logError, logInfo } from '../logs/logging';

export interface MediaDownloadStatus {
  status: 'idle' | 'checking' | 'downloading' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  currentFile?: string;
  totalFiles?: number;
  downloadedFiles?: number;
}

export interface MediaItem {
  url: string;
  fileName: string;
  type: 'image' | 'video'; // メディアタイプ
}

export const useMediaDownload = () => {
  const [downloadStatus, setDownloadStatus] = useState<MediaDownloadStatus>({
    status: 'idle',
    progress: 0,
    message: '',
  });

  // メディアリストをダウンロード
  const downloadMediaList = useCallback(async (mediaList: MediaItem[]) => {
    if (!mediaList || mediaList.length === 0) {
      setDownloadStatus({
        status: 'idle',
        progress: 0,
        message: 'ダウンロードするメディアがありません',
      });
      return;
    }

    try {
      setDownloadStatus({
        status: 'checking',
        progress: 0,
        message: `${mediaList.length}個のメディアをダウンロード準備中...`,
        totalFiles: mediaList.length,
        downloadedFiles: 0,
      });

      logInfo('MEDIA_DOWNLOAD', 'Starting media download', {
        count: mediaList.length,
      });

      let downloadedCount = 0;

      // メディアを順序に従ってダウンロード
      for (const media of mediaList) {
        try {
          setDownloadStatus({
            status: 'downloading',
            progress: Math.round((downloadedCount / mediaList.length) * 100),
            message: `ダウンロード中: ${media.fileName}`,
            currentFile: media.fileName,
            totalFiles: mediaList.length,
            downloadedFiles: downloadedCount,
          });

          logInfo('MEDIA_DOWNLOAD', `Downloading media: ${media.fileName}`);

          // Tauri コマンドでダウンロード実行
          await invoke<{ success: boolean; message: string }>('download_media', {
            url: media.url,
            fileName: media.fileName,
            mediaType: media.type,
          });

          downloadedCount++;

          logInfo('MEDIA_DOWNLOAD', `Downloaded: ${media.fileName}`);
        } catch (error) {
          logError('MEDIA_DOWNLOAD', `Failed to download ${media.fileName}`, {
            error: error instanceof Error ? error.message : String(error),
          });
          // エラーでも続行
        }
      }

      setDownloadStatus({
        status: 'completed',
        progress: 100,
        message: `${downloadedCount}/${mediaList.length} 個のメディアをダウンロードしました`,
        totalFiles: mediaList.length,
        downloadedFiles: downloadedCount,
      });

      logInfo('MEDIA_DOWNLOAD', 'Media download completed', {
        downloaded: downloadedCount,
        total: mediaList.length,
      });
    } catch (error) {
      logError('MEDIA_DOWNLOAD', 'Failed to download media list', {
        error: error instanceof Error ? error.message : String(error),
      });

      setDownloadStatus({
        status: 'error',
        progress: 0,
        message: 'メディアのダウンロードに失敗しました',
      });
    }
  }, []);

  // 単一ファイルをダウンロード
  const downloadSingleMedia = useCallback(async (media: MediaItem) => {
    try {
      setDownloadStatus({
        status: 'downloading',
        progress: 0,
        message: `${media.fileName} をダウンロード中...`,
        currentFile: media.fileName,
      });

      logInfo('MEDIA_DOWNLOAD', 'Downloading single media', {
        fileName: media.fileName,
      });

      const result = await invoke<{ success: boolean; message: string }>(
        'download_media',
        {
          url: media.url,
          fileName: media.fileName,
          mediaType: media.type,
        }
      );

      setDownloadStatus({
        status: 'completed',
        progress: 100,
        message: result.message || `${media.fileName} をダウンロードしました`,
        currentFile: media.fileName,
      });

      logInfo('MEDIA_DOWNLOAD', 'Single media downloaded successfully');
    } catch (error) {
      logError('MEDIA_DOWNLOAD', 'Failed to download single media', {
        error: error instanceof Error ? error.message : String(error),
      });

      setDownloadStatus({
        status: 'error',
        progress: 0,
        message: `${media.fileName} のダウンロードに失敗しました`,
      });
    }
  }, []);

  // ダウンロード状態をリセット
  const resetDownloadStatus = useCallback(() => {
    setDownloadStatus({
      status: 'idle',
      progress: 0,
      message: '',
    });
  }, []);

  return {
    downloadStatus,
    downloadMediaList,
    downloadSingleMedia,
    resetDownloadStatus,
    isDownloading: downloadStatus.status === 'downloading',
    isCompleted: downloadStatus.status === 'completed',
    isError: downloadStatus.status === 'error',
  };
};
