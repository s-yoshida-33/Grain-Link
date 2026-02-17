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
