import React, { useEffect, useState } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';
import type { SleepSettings } from '../types/settings';

const DEFAULT_SLEEP: SleepSettings = { enabled: false, startTime: '10:00', endTime: '21:00' };

/** HH:MM 文字列を当日の分数（0〜1439）に変換する */
const timeToMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** 現在時刻が営業時間内かどうかを判定する */
const isWithinBusinessHours = (sleep: SleepSettings): boolean => {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(sleep.startTime);
  const end = timeToMinutes(sleep.endTime);

  // 通常: startTime < endTime (例: 10:00〜21:00)
  if (start <= end) {
    return current >= start && current < end;
  }
  // 深夜跨ぎ: startTime > endTime (例: 22:00〜06:00)
  return current >= start || current < end;
};

/**
 * 焼き付き防止コンポーネント
 * 営業時間外に全画面黒オーバーレイを表示する。
 * バックグラウンド処理（SSE、データ同期など）はそのまま継続する。
 */
export const ScreenSleep: React.FC = () => {
  const { settings } = useAppSettings();
  const [sleeping, setSleeping] = useState(false);

  useEffect(() => {
    const sleep = settings?.sleepSettings ?? DEFAULT_SLEEP;
    if (!sleep.enabled) {
      setSleeping(false);
      return;
    }

    // 初回チェック
    setSleeping(!isWithinBusinessHours(sleep));

    // 1分ごとに営業時間をチェック
    const timer = setInterval(() => {
      setSleeping(!isWithinBusinessHours(sleep));
    }, 60_000);

    return () => clearInterval(timer);
  }, [settings]);

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
