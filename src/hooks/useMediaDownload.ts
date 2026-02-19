import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logError, logInfo } from '../logs/logging';

export interface MediaDownloadStatus {
  // Added 'extracting' status, mapped to 'downloading' in UI
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
  type: 'image' | 'video'; // Media type
}

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

      // Download media sequentially
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

          // Execute download via Tauri command
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
          // Continue even on error
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

  // New function: Sync media via ZIP archive
  const syncMediaFromZip = useCallback(async (zipUrl: string) => {
    try {
      setDownloadStatus({
        status: 'downloading',
        progress: 50, // Indeterminate progress for ZIP
        message: 'Downloading and extracting latest media...',
      });

      logInfo('MEDIA_SYNC', `Starting ZIP sync from: ${zipUrl}`);

      // Call the new Rust command
      await invoke('sync_media_from_zip', { url: zipUrl });

      setDownloadStatus({
        status: 'completed',
        progress: 100,
        message: 'Media synchronization completed',
      });

      logInfo('MEDIA_SYNC', 'Media sync completed successfully');
    } catch (error) {
      logError('MEDIA_SYNC', 'Failed to sync media from ZIP', {
        error: error instanceof Error ? error.message : String(error),
      });
      setDownloadStatus({
        status: 'error',
        progress: 0,
        message: 'Failed to update media',
      });
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
    syncMediaFromZip, // Export the new function
    resetDownloadStatus,
    isDownloading: downloadStatus.status === 'downloading' || downloadStatus.status === 'extracting',
    isCompleted: downloadStatus.status === 'completed',
    isError: downloadStatus.status === 'error',
  };
};