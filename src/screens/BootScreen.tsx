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
  const { updateStatus, isUpdateReady } = useAutoUpdate();
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

  // Stage 2: Update Wait
  useEffect(() => {
    if (currentStage === 'update-check' && (isUpdateReady || skipUpdate) && (updateStatus.status === 'idle' || updateStatus.status === 'error')) {
      logInfo('BOOT', 'Update stage completed');
      setShowUpdateDialog(false);
      setCurrentStage('media-check');
    }
  }, [updateStatus.status, isUpdateReady, skipUpdate, currentStage]);

  // Stage 3: Media Check (Logic Changed)
  useEffect(() => {
    if (currentStage === 'media-check' && settings) {
      (async () => {
        try {
          logInfo('BOOT', 'Checking for media updates from latest.json...');
          
          // Fetch latest.json directly from GitHub Releases
          // This URL must match your repo's release structure
          const latestJsonUrl = "https://github.com/s-yoshida-33/Grain-Link/releases/latest/download/latest.json";
          const response = await fetch(latestJsonUrl);
          
          if (!response.ok) {
             throw new Error(`Failed to fetch latest.json: ${response.status}`);
          }
          
          const manifest = await response.json();
          // The 'media' field is added by manage-release.ps1
          const mediaZipUrl = manifest.media?.url;

          if (mediaZipUrl) {
            logInfo('BOOT', `Found media update: ${mediaZipUrl}`);
            setCurrentStage('media-wait');
            setShowMediaDialog(true);
            
            // Execute ZIP sync
            await syncMediaFromZip(mediaZipUrl);
          } else {
            logInfo('BOOT', 'No media update info found in latest.json');
            setCurrentStage('countdown');
          }

        } catch (error) {
          // Fix: Properly format the error object for logError (Error 2345)
          logError('BOOT', 'Failed to check media updates', {
            error: error instanceof Error ? error.message : String(error)
          });
          // Proceed to countdown even on error to ensure app starts
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
      // Wait a bit before closing dialog
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

  // Helper to map statuses for UI (Error 2322)
  // Maps 'extracting' to 'downloading' since MediaDownloadDialog might not support 'extracting'
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
          {/* Status List */}
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