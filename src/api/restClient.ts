import { invoke } from '@tauri-apps/api/core';
import { normalizeShops } from '../utils/shopData';
import type { Shop } from '../types/shop';
import { loadSettings } from '../utils/settings';
import { logInfo, logError } from '../logs/logging';

// REST APIからショップ一覧を取得（Tauri経由でCORS回避）
export const fetchShopsFromApi = async (): Promise<Shop[]> => {
  try {
    const settings = await loadSettings();
    
    const baseUrl = settings.apiEndpoint.replace(/\/api\/events$/, '');
    const apiUrl = `${baseUrl}/api/shops`;

    logInfo('DATA_SYNC', `Fetching shops from: ${apiUrl}`, { url: apiUrl });

    const response = await invoke<{ status: number; body: string }>('fetch_shops_proxy', { url: apiUrl });

    if (response.status !== 200) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = JSON.parse(response.body);
    const shops = normalizeShops(data, settings.apiEndpoint);
    logInfo('DATA_SYNC', `REST API returned ${shops.length} shops`);
    
    // デバッグ: 最初の3つのショップの画像URLをログ出力
    if (shops.length > 0) {
      console.log('[DEBUG] First shop imageUrl:', shops[0].imageUrl);
      console.log('[DEBUG] First shop object:', JSON.stringify(shops[0], null, 2));
    }
    
    return shops;
  } catch (error) {
    logError('DATA_SYNC', 'Failed to fetch shops from API', {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
};

// REST APIからメディアリストを取得
export const fetchMediaListFromApi = async (mallId: string): Promise<{ imageUrls: string[]; videoUrls: string[] }> => {
  try {
    const settings = await loadSettings();
    
    const baseUrl = settings.apiEndpoint.replace(/\/api\/events$/, '');
    const apiUrl = `${baseUrl}/api/media/list?mallId=${mallId}`;

    logInfo('DATA_SYNC', `Fetching media list from: ${apiUrl}`, { url: apiUrl, mallId });

    const response = await invoke<{ status: number; body: string }>('fetch_shops_proxy', { url: apiUrl });

    if (response.status !== 200) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = JSON.parse(response.body);
    logInfo('DATA_SYNC', `Received media list`, {
      imageCount: data.imageUrls?.length || 0,
      videoCount: data.videoUrls?.length || 0,
    });

    return {
      imageUrls: data.imageUrls || [],
      videoUrls: data.videoUrls || [],
    };
  } catch (error) {
    logError('DATA_SYNC', 'Failed to fetch media list from API', {
      error: error instanceof Error ? error.message : String(error),
      mallId,
    });
    return { imageUrls: [], videoUrls: [] };
  }
};

// REST APIからメディアのダウンロード状態を取得
export const fetchMediaDownloadStatusFromApi = async (mallId: string): Promise<{
  imageDownloadedCount: number;
  imageTotal: number;
  videoDownloadedCount: number;
  videoTotal: number;
}> => {
  try {
    const settings = await loadSettings();
    
    const baseUrl = settings.apiEndpoint.replace(/\/api\/events$/, '');
    const apiUrl = `${baseUrl}/api/media/status?mallId=${mallId}`;

    logInfo('DATA_SYNC', `Fetching media download status from: ${apiUrl}`, { url: apiUrl, mallId });

    const response = await invoke<{ status: number; body: string }>('fetch_shops_proxy', { url: apiUrl });

    if (response.status !== 200) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = JSON.parse(response.body);
    return data;
  } catch (error) {
    logError('DATA_SYNC', 'Failed to fetch media download status from API', {
      error: error instanceof Error ? error.message : String(error),
      mallId,
    });
    return {
      imageDownloadedCount: 0,
      imageTotal: 0,
      videoDownloadedCount: 0,
      videoTotal: 0,
    };
  }
};

// GitHub Release Asset からメディアファイルのメタデータを取得
export const fetchMediaAssetMetadata = async (mallId: string): Promise<{ updated_at: string | null }> => {
  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    const owner = 's-yoshida-33';
    const repo = 'Grain-Link';
    const fileName = `${mallId}-media.zip`;
    
    const latestReleaseUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const response = await tauriFetch(latestReleaseUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch release: ${response.status}`);
    }
    
    const release = await response.json() as { assets: Array<{ name: string; updated_at: string }> };
    const asset = release.assets.find(a => a.name === fileName);
    
    if (!asset) {
      logInfo('BOOT', `Media asset not found: ${fileName}`);
      return { updated_at: null };
    }
    
    logInfo('BOOT', `Media asset found: ${fileName}, updated_at: ${asset.updated_at}`);
    return { updated_at: asset.updated_at };
  } catch (error) {
    logError('BOOT', 'Failed to fetch media asset metadata', {
      error: error instanceof Error ? error.message : String(error)
    });
    return { updated_at: null };
  }
};
