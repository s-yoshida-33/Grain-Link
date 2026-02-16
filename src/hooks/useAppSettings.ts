import { useState, useEffect } from 'react';
import type { AppSettings } from '../types/settings';
import { loadSettings } from '../utils/settings';

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

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

  return { settings, loading };
};
