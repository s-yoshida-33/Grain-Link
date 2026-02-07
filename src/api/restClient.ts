import { normalizeShops } from '../utils/shopData';
import type { Shop } from '../types/shop';
import { loadSettings } from '../utils/settings';

// REST APIからショップ一覧を取得
export const fetchShopsFromApi = async (): Promise<Shop[]> => {
  try {
    const settings = await loadSettings();
    // settings.apiEndpoint は "http://localhost:8090/api/events"
    // REST APIは "http://localhost:8090/api/shops" を想定
    
    // apiEndpointからベースURLを抽出 (例: /api/events を除去)
    const baseUrl = settings.apiEndpoint.replace(/\/api\/events$/, '');
    const apiUrl = `${baseUrl}/api/shops`;

    console.log(`Fetching shops from: ${apiUrl}`);

    const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return normalizeShops(data);
  } catch (error) {
    console.error('Failed to fetch shops from API:', error);
    return [];
  }
};
