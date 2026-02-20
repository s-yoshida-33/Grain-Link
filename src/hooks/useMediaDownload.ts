import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { logError, logInfo } from '../logs/logging';

export interface MediaDownloadStatus {
  status: 'idle' | 'checking' | 'downloading' | 'extracting' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  currentFile?: string;
  totalFiles?: number;
  downloadedFiles?: number;
}

export interface MediaItem {
  url: string;
  fileName: string;
  type: 'image' | 'video';
}

interface MediaProgress {
  phase: string;
  downloaded: number;
  total: number;
  extracted: number;
  total_files: number;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatRemaining = (seconds: number): string => {
  if (seconds < 5) return '';
  const rounded = Math.ceil(seconds / 5) * 5;
  if (rounded < 60) return `残り約${rounded}秒`;
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return secs > 0 ? `残り約${mins}分${secs}秒` : `残り約${mins}分`;
};

export const useMediaDownload = () => {
  const [downloadStatus, setDownloadStatus] = useState<MediaDownloadStatus>({
    status: 'idle',
    progress: 0,
    message: '',
  });

  // Download media list (Legacy/Individual file mode)
  const downloadMediaList = useCallback(async (mediaList: MediaItem[]) => {
    if (!mediaList || mediaList.length === 0) {
      setDownloadStatus({
        status: 'idle',
        progress: 0,
        message: 'No media to download',
      });
      return;
    }

    try {
      setDownloadStatus({
        status: 'checking',
        progress: 0,
        message: `Preparing to download ${mediaList.length} files...`,
        totalFiles: mediaList.length,
        downloadedFiles: 0,
      });

      logInfo('MEDIA_DOWNLOAD', 'Starting media download', {
        count: mediaList.length,
      });

      let downloadedCount = 0;

      for (const media of mediaList) {
        try {
          setDownloadStatus({
            status: 'downloading',
            progress: Math.round((downloadedCount / mediaList.length) * 100),
            message: `Downloading: ${media.fileName}`,
            currentFile: media.fileName,
            totalFiles: mediaList.length,
            downloadedFiles: downloadedCount,
          });

          logInfo('MEDIA_DOWNLOAD', `Downloading media: ${media.fileName}`);

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
        }
      }

      setDownloadStatus({
        status: 'completed',
        progress: 100,
        message: `Downloaded ${downloadedCount}/${mediaList.length} files`,
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
        message: 'Failed to download media',
      });
    }
  }, []);

  // Download single file (Legacy)
  const downloadSingleMedia = useCallback(async (media: MediaItem) => {
    try {
      setDownloadStatus({
        status: 'downloading',
        progress: 0,
        message: `Downloading ${media.fileName}...`,
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
        message: result.message || `Downloaded ${media.fileName}`,
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
        message: `Failed to download ${media.fileName}`,
      });
    }
  }, []);

  // Sync media via ZIP archive with progress events from Rust
  const syncMediaFromZip = useCallback(async (zipUrl: string) => {
    let startTime = Date.now();

    // Listen for progress events from Rust backend
    const unlisten = await listen<MediaProgress>('media-progress', (event) => {
      const { phase, downloaded, total, extracted, total_files } = event.payload;

      if (phase === 'download') {
        // Download phase: 0-80% of progress bar
        const progress = total > 0
          ? Math.min(Math.round((downloaded / total) * 80), 80)
          : 0;

        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? downloaded / elapsed : 0;
        const remaining = speed > 0 && total > 0
          ? Math.ceil((total - downloaded) / speed)
          : 0;

        const sizeStr = total > 0
          ? `${formatBytes(downloaded)} / ${formatBytes(total)}`
          : formatBytes(downloaded);
        const remainingStr = formatRemaining(remaining);
        const message = remainingStr
          ? `メディアをダウンロード中... ${sizeStr} (${remainingStr})`
          : `メディアをダウンロード中... ${sizeStr}`;

        setDownloadStatus({
          status: 'downloading',
          progress,
          message,
        });
      } else if (phase === 'extract') {
        // Extract phase: 80-100% of progress bar
        const extractProgress = total_files > 0
          ? Math.round((extracted / total_files) * 100)
          : 0;
        const progress = 80 + Math.round(extractProgress * 0.2);

        setDownloadStatus({
          status: 'extracting',
          progress,
          message: `ファイルを展開中... ${extracted}/${total_files}`,
        });
      }
    });

    try {
      setDownloadStatus({
        status: 'downloading',
        progress: 0,
        message: 'メディアダウンロードを開始...',
      });

      startTime = Date.now();
      logInfo('MEDIA_SYNC', `Starting ZIP sync from: ${zipUrl}`);

      await invoke('sync_media_from_zip', { url: zipUrl });

      setDownloadStatus({
        status: 'completed',
        progress: 100,
        message: 'メディアの同期が完了しました',
      });

      logInfo('MEDIA_SYNC', 'Media sync completed successfully');
    } catch (error) {
      logError('MEDIA_SYNC', 'Failed to sync media from ZIP', {
        error: error instanceof Error ? error.message : String(error),
      });
      setDownloadStatus({
        status: 'error',
        progress: 0,
        message: 'メディアの更新に失敗しました',
      });
    } finally {
      unlisten();
    }
  }, []);

  // Reset download status
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
    syncMediaFromZip,
    resetDownloadStatus,
    isDownloading: downloadStatus.status === 'downloading' || downloadStatus.status === 'extracting',
    isCompleted: downloadStatus.status === 'completed',
    isError: downloadStatus.status === 'error',
  };
};
