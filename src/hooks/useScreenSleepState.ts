import { useEffect, useState } from 'react';
import { useAppSettings } from './useAppSettings';
import type { SleepSettings } from '../types/settings';

const DEFAULT_SLEEP: SleepSettings = { enabled: false, startTime: '10:00', endTime: '21:00' };

const timeToMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const isWithinBusinessHours = (sleep: SleepSettings): boolean => {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(sleep.startTime);
  const end = timeToMinutes(sleep.endTime);

  if (start <= end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
};

/**
 * 現在スリープ中（画面オフ）かどうかを返すフック。
 * ScreenSleep と VideoSignageView の両方で使用し、
 * イベント経由ではなく独立して計算することで初期化タイミングの問題を解消する。
 */
export function useScreenSleepState(): boolean {
  const { settings } = useAppSettings();
  const [sleeping, setSleeping] = useState(false);

  useEffect(() => {
    const sleep = settings?.sleepSettings ?? DEFAULT_SLEEP;
    if (!sleep.enabled) {
      setSleeping(false);
      return;
    }

    setSleeping(!isWithinBusinessHours(sleep));

    const timer = setInterval(() => {
      setSleeping(!isWithinBusinessHours(sleep));
    }, 60_000);

    return () => clearInterval(timer);
  }, [settings]);

  return sleeping;
}
