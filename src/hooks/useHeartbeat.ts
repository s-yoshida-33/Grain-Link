import { useEffect, useRef } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { logInfo } from '../logs/logging';

const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000; // 1時間

export const useHeartbeat = () => {
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const start = async () => {
      const version = await getVersion().catch(() => 'unknown');

      logInfo('SYS_INIT', `App started - v${version}`);

      intervalId = setInterval(() => {
        const uptimeMs = Date.now() - startTimeRef.current;
        const uptimeH = Math.floor(uptimeMs / (60 * 60 * 1000));
        const uptimeM = Math.floor((uptimeMs % (60 * 60 * 1000)) / (60 * 1000));
        logInfo('SYS_INIT', `Heartbeat - v${version} - uptime: ${uptimeH}h${uptimeM}m`);
      }, HEARTBEAT_INTERVAL_MS);
    };

    start();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);
};
