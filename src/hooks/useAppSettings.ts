import { useState, useEffect, useCallback } from 'react';
import type { AppSettings } from '../types/settings';
import { loadSettings } from '../utils/settings';

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    loadSettings().then((config) => {
      setSettings(config);
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    loadSettings().then((config) => {
      if (!mounted) return;
      setSettings(config);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  // reload-settings イベントで設定を再読み込み
  useEffect(() => {
    const handleReloadSettings = () => reload();
    window.addEventListener('reload-settings', handleReloadSettings);
    return () => window.removeEventListener('reload-settings', handleReloadSettings);
  }, [reload]);

  return { settings, loading };
};
