# メディアダウンロード機能

このドキュメントでは、拡張されたアップデート機能に含まれるメディアダウンロード機能について説明します。

## 概要

メディアダウンロード機能は、REST APIから画像とビデオを取得し、ローカルの `AppLocalData` ディレクトリに保存します。

## 実装概要

### フロントエンド（React + TypeScript）

#### `useMediaDownload` フック

メディアのダウンロード処理とステータス管理を行います。

**使用方法:**

```typescript
import { useMediaDownload, MediaItem } from '../hooks/useMediaDownload';

export const MyComponent = () => {
  const { downloadStatus, downloadMediaList, resetDownloadStatus, isDownloading } = useMediaDownload();

  const handleDownload = async () => {
    const mediaList: MediaItem[] = [
      { url: 'https://example.com/image1.jpg', fileName: 'image1.jpg', type: 'image' },
      { url: 'https://example.com/video1.mp4', fileName: 'video1.mp4', type: 'video' },
    ];

    await downloadMediaList(mediaList);
  };

  return (
    <div>
      <button onClick={handleDownload} disabled={isDownloading}>
        ダウンロード開始
      </button>
      <p>進捗: {downloadStatus.progress}%</p>
    </div>
  );
};
```

#### `MediaDownloadDialog` コンポーネント

ダウンロード進捗を表示するUXダイアログです。

**使用方法:**

```typescript
import { MediaDownloadDialog } from '../components/UpdateDialog';

export const MyApp = () => {
  const { downloadStatus } = useMediaDownload();

  return (
    <MediaDownloadDialog
      isOpen={downloadStatus.status !== 'idle'}
      status={downloadStatus.status}
      progress={downloadStatus.progress}
      message={downloadStatus.message}
      currentFile={downloadStatus.currentFile}
      totalFiles={downloadStatus.totalFiles}
      downloadedFiles={downloadStatus.downloadedFiles}
      onDismiss={() => resetDownloadStatus()}
    />
  );
};
```

### バックエンド（Tauri + Rust）

#### `download_media` コマンド

ファイルをダウンロードしてローカルに保存します。

**パラメータ:**
- `url: String` - ダウンロード対象のURL
- `file_name: String` - 保存するファイル名
- `media_type: String` - メディアタイプ (`"image"` または `"video"`)

**戻り値:**
```json
{
  "success": true,
  "message": "Downloaded image1.jpg to /path/to/images/image1.jpg"
}
```

**ファイル保存先:**
- 画像: `AppLocalData/images/{fileName}`
- ビデオ: `AppLocalData/videos/{fileName}`

### REST API エンドポイント

#### メディアリスト取得

```
GET /api/media/list?mallId={mallId}
```

**応答例:**
```json
{
  "imageUrls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "videoUrls": [
    "https://example.com/video1.mp4"
  ]
}
```

#### メディアダウンロード状態取得

```
GET /api/media/status?mallId={mallId}
```

**応答例:**
```json
{
  "imageDownloadedCount": 2,
  "imageTotal": 5,
  "videoDownloadedCount": 1,
  "videoTotal": 3
}
```

## 統合例

アップデート機能と一緒にメディアダウンロード機能を使用する例:

```typescript
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import { useMediaDownload, MediaItem } from '../hooks/useMediaDownload';
import { UpdateDialog, MediaDownloadDialog } from '../components/UpdateDialog';
import { useAppSettings } from '../hooks/useAppSettings';
import { fetchMediaListFromApi } from '../api/restClient';

export const GidoApp = () => {
  const { updateStatus, installUpdate, isUpdateReady } = useAutoUpdate();
  const { downloadStatus, downloadMediaList, resetDownloadStatus } = useMediaDownload();
  const { settings } = useAppSettings();

  // アップデート後にメディアをダウンロード
  const handlePostUpdateMediaDownload = async () => {
    if (!settings) return;

    // メディアリストを取得
    const { imageUrls, videoUrls } = await fetchMediaListFromApi(settings.mallId);

    // MediaItem配列に変換
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

    await downloadMediaList(mediaList);
  };

  return (
    <>
      <UpdateDialog
        isOpen={updateStatus.status !== 'idle'}
        status={updateStatus.status}
        progress={updateStatus.progress}
        message={updateStatus.message}
        onInstall={installUpdate}
      />

      <MediaDownloadDialog
        isOpen={downloadStatus.status !== 'idle'}
        status={downloadStatus.status}
        progress={downloadStatus.progress}
        message={downloadStatus.message}
        currentFile={downloadStatus.currentFile}
        totalFiles={downloadStatus.totalFiles}
        downloadedFiles={downloadStatus.downloadedFiles}
        onDismiss={resetDownloadStatus}
      />

      {/* アップデート後のメディアダウンロードボタン */}
      {isUpdateReady && (
        <button onClick={handlePostUpdateMediaDownload}>
          メディアをダウンロード
        </button>
      )}
    </>
  );
};
```

## エラーハンドリング

ダウンロード機能は以下のエラーを自動的にハンドリングします:

- ネットワーク接続エラー
- HTTPエラー（4xx, 5xx）
- ファイル保存エラー
- ディレクトリ作成エラー

エラーは `downloadStatus.status === 'error'` で検出でき、`downloadStatus.message` にエラー詳細が入ります。

## ログ出力

すべてのダウンロード操作は `MEDIA_DOWNLOAD` カテゴリでログされます:

```typescript
// ログの例
logInfo('MEDIA_DOWNLOAD', 'Downloaded media: image1.jpg');
logError('MEDIA_DOWNLOAD', 'Failed to download video1.mp4', { error: message });
```

## 今後の拡張可能性

- 一時停止/再開機能
- リトライロジック
- 帯域幅制限
- メディアの検証・整合性チェック（MD5ハッシュなど）
- キャッシュ機能
- バックグラウンドダウンロード
