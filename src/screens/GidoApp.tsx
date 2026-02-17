import React, { useEffect, useState, useCallback } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';
import { VideoSignageView } from './VideoSignageView';
import { ShopListView } from './ShopListView';
import { BootScreen } from './BootScreen';
import { sseClient } from '../api/sseClient';
import { fetchShopsFromApi } from '../api/restClient';
import { normalizeShops, generateMockShops } from '../utils/shopData';
import { logInfo, logWarn } from '../logs/logging';
import type { Shop } from '../types/shop';

export const GidoApp: React.FC = () => {
  const { settings, loading: settingsLoading } = useAppSettings();
  const [shops, setShops] = useState<Shop[]>([]);
  const [bootComplete, setBootComplete] = useState(false);
  // const [isSseConnected, setIsSseConnected] = useState(false);

  // ショップデータをロードする関数
  // providedShopsがあればそれを使い、なければREST APIから取得する
  const loadShops = useCallback(async (providedShops?: Shop[]) => {
    // 1. SSEからデータ(providedShops)が渡された場合はそれを使う
    if (providedShops && providedShops.length > 0) {
      logInfo('DATA_SYNC', 'Using shops data provided via SSE', {
        count: providedShops.length
      });
      setShops(providedShops);
      return;
    }

    // 2. データがない場合（初期表示やupdate通知時）はREST APIを取りに行く
    logInfo('DATA_SYNC', 'Fetching shops from REST API...');
    const apiData = await fetchShopsFromApi();

    // API取得失敗時はモックデータなどを維持するか、空にするかは要件次第
    // ここでは取得できた場合のみ更新
    if (apiData.length > 0) {
        setShops(apiData);
    } else if (shops.length === 0) {
        // 初回ロード失敗時にのみモックを使うなどのフォールバックも検討可能
        logWarn('DATA_SYNC', 'REST API returned 0 shops');
    }
  }, []); // shopsを依存配列に入れるとループの恐れがあるので空に

  // 初期データロードとSSE接続
  useEffect(() => {
    if (!settings) return;

    // 1. まずモックデータをロード (開発用)
    setShops(generateMockShops());

    // 2. 初回REST APIコール
    loadShops();

    // 3. SSE接続とイベントリスナー設定
    const connectSse = async () => {
      // SSE接続状態ログ
      sseClient.on('status_change', ({ status }) => {
        // setIsSseConnected(status === 'connected');
        logInfo('DATA_SYNC', 'SSE Status changed', { status });
      });

      // 'shops' イベント: JSONデータを直接反映
      sseClient.on('shops', (data) => {
        logInfo('DATA_SYNC', 'Received "shops" event via SSE', {
          dataSize: JSON.stringify(data).length
        });
        const normalized = normalizeShops(data, settings.apiEndpoint);
        loadShops(normalized);
      });

      // 'update' イベント: REST API再取得
      sseClient.on('update', () => {
         logInfo('DATA_SYNC', 'Received "update" event via SSE - Reloading from API');
         loadShops();
      });
      
      // エンドポイントが設定されていれば接続
      if (settings.apiEndpoint) {
        await sseClient.connect(settings.apiEndpoint);
      }
    };

    connectSse();

    return () => {
      sseClient.disconnect();
    };
  }, [settings, loadShops]);

  if (settingsLoading || !settings) {
    return <div className="flex items-center justify-center h-screen">Loading settings...</div>;
  }

  // ブート完了するまで BootScreen を表示
  if (!bootComplete) {
    return <BootScreen onBootComplete={() => setBootComplete(true)} />;
  }

  // 設定に応じて表示モード切り替え
  return (
    <div className="w-full h-full relative">
       {/* デバッグ用ステータス表示 (必要なら削除) */}
       {/* 
       <div className="absolute top-0 right-0 p-2 bg-black/50 text-white text-xs z-50">
          Mode: {settings.appMode} | SSE: {isSseConnected ? 'OK' : 'Disconnected'}
       </div>
       */}

       {settings.appMode === 'VIDEO_AD' ? (
         <VideoSignageView shops={shops} />
       ) : settings.appMode === 'SHOP_LIST' ? (
         <ShopListView shops={shops} gridConfig={settings.shopListGrid} />
       ) : (
         <div className="flex items-center justify-center h-screen text-red-500">
           Invalid App Mode: {settings.appMode}
         </div>
       )}
    </div>
  );
};
