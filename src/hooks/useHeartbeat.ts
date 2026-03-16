import { useEffect, useRef } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { logInfo, logWarn } from '../logs/logging';

const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000; // 1時間
const WATCHDOG_PING_INTERVAL_MS = 10 * 1000;   // 10秒

export const useHeartbeat = () => {
  const startTimeRef = useRef(Date.now());

  // Watchdog ping: Rust 側ウォッチドッグに生存通知を送る
  useEffect(() => {
    const sendPing = () => {
      invoke('webview_ping').catch(() => {
        logWarn('SYS_INIT', 'Failed to send watchdog ping');
      });
    };

    sendPing();
    const pingInterval = setInterval(sendPing, WATCHDOG_PING_INTERVAL_MS);
    return () => clearInterval(pingInterval);
  }, []);

  // Application heartbeat logging (1-hour interval)
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
