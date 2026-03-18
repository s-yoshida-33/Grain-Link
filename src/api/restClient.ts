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

// S3 の version.json からメディアの最新バージョン情報を取得
export const fetchMediaVersionFromS3 = async (mallId: string): Promise<{ zip: string | null; updated_at: string | null }> => {
  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    const url = `https://dl.tti.ninja/grain-link/medias/videos/${mallId}/version.json?t=${Date.now()}`;

    const response = await tauriFetch(url, {
      headers: {
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch version.json: ${response.status}`);
    }

    const data = await response.json() as { zip: string; updated_at: string };
    logInfo('BOOT', `Media version fetched: ${data.zip}, updated_at: ${data.updated_at}`);
    return { zip: data.zip, updated_at: data.updated_at };
  } catch (error) {
    logError('BOOT', 'Failed to fetch media version from S3', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { zip: null, updated_at: null };
  }
};
