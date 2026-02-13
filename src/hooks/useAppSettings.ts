import { useState, useEffect } from 'react';
import type { AppSettings } from '../types/settings';
import { loadSettings } from '../utils/settings';

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings().then((config) => {
      setSettings(config);
      setLoading(false);
    });

    // メインプロセスからの設定更新イベントをリッスン
    if (window.electronAPI && window.electronAPI.onSettingsUpdate) {
      window.electronAPI.onSettingsUpdate((updatedSettings) => {
        setSettings(updatedSettings);
      });
    }
  }, []);

  return { settings, loading };
};
