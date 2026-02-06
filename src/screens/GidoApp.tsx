import React, { useEffect, useState } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';
import { VideoSignageView } from './VideoSignageView';
import { ShopListView } from './ShopListView';
import { sseClient } from '../api/sseClient';
import { normalizeShops, generateMockShops } from '../utils/shopData';
import type { Shop } from '../types/shop';

export const GidoApp: React.FC = () => {
  const { settings, loading: settingsLoading } = useAppSettings();
  const [shops, setShops] = useState<Shop[]>([]);
  // const [isSseConnected, setIsSseConnected] = useState(false);

  // 初期データロードとSSE接続
  useEffect(() => {
    if (!settings) return;

    // 1. まずモックデータをロード (開発用)
    // 本番環境でもSSE接続までのつなぎとして使用可能
    setShops(generateMockShops());

    // 2. SSE接続開始
    const connectSse = async () => {
      // SSEクライアントのセットアップ
      sseClient.on('status_change', ({ status }) => {
        // setIsSseConnected(status === 'connected');
        console.log('SSE Status:', status);
      });

      sseClient.on('shops', (data) => {
        console.log('Shops updated via SSE:', data);
        const normalized = normalizeShops(data);
        if (normalized.length > 0) {
           setShops(normalized);
        }
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
  }, [settings]);

  if (settingsLoading || !settings) {
    return <div className="flex items-center justify-center h-screen">Loading settings...</div>;
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
