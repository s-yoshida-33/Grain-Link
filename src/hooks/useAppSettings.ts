import { useState, useEffect } from 'react';
import { AppSettings } from '../types/settings';
import { loadSettings } from '../utils/settings';

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings().then((config) => {
      setSettings(config);
      setLoading(false);
    });
  }, []);

  return { settings, loading };
};
