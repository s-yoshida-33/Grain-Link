import React from 'react';

interface UpdateDialogProps {
  isOpen: boolean;
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
  progress: number;
  message: string;
  onInstall?: () => void;
  onDismiss?: () => void;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
  isOpen,
  status,
  progress,
  message,
  onInstall,
  onDismiss,
}) => {
  if (!isOpen || status === 'idle') {
    return null;
  }

  const isDownloading = status === 'downloading';
  const isReady = status === 'ready';
  const isError = status === 'error';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          {isReady ? 'アップデートが準備完了' : isError ? 'エラー' : 'アップデート'}
        </h2>

        <p className="text-gray-600 mb-6">{message}</p>

        {/* プログレスバー */}
        {isDownloading && (
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2 text-center">{progress}%</p>
          </div>
        )}

        {/* ボタン */}
        <div className="flex gap-3 justify-end">
          {!isDownloading && !isReady && !isError && (
            <button
              onClick={onDismiss}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition"
            >
              キャンセル
            </button>
          )}

          {isReady && (
            <>
              <button
                onClick={onDismiss}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition"
              >
                後で
              </button>
              <button
                onClick={onInstall}
                className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600 transition"
              >
                今すぐ再起動
              </button>
            </>
          )}

          {isError && (
            <button
              onClick={onDismiss}
              className="px-4 py-2 text-white bg-gray-700 rounded hover:bg-gray-800 transition"
            >
              閉じる
            </button>
          )}

          {isDownloading && (
            <button
              disabled
              className="px-4 py-2 text-gray-400 bg-gray-200 rounded cursor-not-allowed"
            >
              ダウンロード中...
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
