import React from 'react';
import { useScreenSleepState } from '../hooks/useScreenSleepState';

/**
 * 焼き付き防止コンポーネント
 * 営業時間外に全画面黒オーバーレイを表示する。
 * バックグラウンド処理（SSE、データ同期など）はそのまま継続する。
 */
export const ScreenSleep: React.FC = () => {
  const sleeping = useScreenSleepState();

  if (!sleeping) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000',
        zIndex: 9998, // コンテキストメニュー(9999)の直下
      }}
    />
  );
};
