import React, { useEffect, useState, useCallback } from 'react';
import { exit } from '@tauri-apps/plugin-process';
import { loadSettings, saveSettings } from '../utils/settings';
import type { AppMode } from '../types/settings';

interface ContextMenuProps {
  children: React.ReactNode;
}

const RELEASE_URL = 'https://github.com/s-yoshida-33/Grain-Link/releases/latest';

const MODE_LABELS: Record<AppMode, string> = {
  VIDEO_AD: '動画広告モード',
  SHOP_LIST: 'ショップ一覧モード',
};

type Position = { x: number; y: number };

export const ContextMenu: React.FC<ContextMenuProps> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [currentMode, setCurrentMode] = useState<AppMode | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const hideMenu = useCallback(() => setVisible(false), []);

  useEffect(() => {
    const handleContextMenu = async (event: MouseEvent) => {
      event.preventDefault();
      // メニュー表示時に最新の設定を読み込む
      try {
        const settings = await loadSettings();
        setCurrentMode(settings.appMode);
        setIsMuted(settings.isMuted ?? false);
      } catch {
        setCurrentMode(null);
      }
      setPosition({ x: event.clientX, y: event.clientY });
      setVisible(true);
    };

    const handleClick = () => hideMenu();

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('click', handleClick);
    };
  }, [hideMenu]);

  const reloadApp = useCallback(() => {
    const event = new CustomEvent('reload-current-view');
    window.dispatchEvent(event);
    hideMenu();
  }, [hideMenu]);

  const quitApp = useCallback(async () => {
    await exit(0);
  }, []);

  const openReleases = useCallback(() => {
    window.open(RELEASE_URL, '_blank', 'noreferrer');
  }, []);

  const switchMode = useCallback(async (newMode: AppMode) => {
    hideMenu();
    try {
      const settings = await loadSettings();
      settings.appMode = newMode;
      await saveSettings(settings);
      // 設定再読み込みイベントを発火（アプリ再起動なしでモード切替）
      window.dispatchEvent(new CustomEvent('reload-settings'));
    } catch {
      // 保存失敗時は何もしない（logging は saveSettings 内で実施済み）
    }
  }, [hideMenu]);

  const toggleMute = useCallback(async () => {
    hideMenu();
    try {
      const settings = await loadSettings();
      settings.isMuted = !isMuted;
      await saveSettings(settings);
      window.dispatchEvent(new CustomEvent('reload-settings'));
    } catch {
      // 保存失敗時は何もしない
    }
  }, [hideMenu, isMuted]);

  // 切り替え先のモード
  const targetMode: AppMode | null = currentMode === 'VIDEO_AD' ? 'SHOP_LIST'
    : currentMode === 'SHOP_LIST' ? 'VIDEO_AD'
    : null;

  type MenuItem = { label: string; action: () => void; separator?: boolean };
  const items: MenuItem[] = [
    { label: 'リロード', action: reloadApp },
    ...(targetMode ? [{
      label: `${MODE_LABELS[targetMode]} に切替`,
      action: () => switchMode(targetMode),
    }] : []),
    {
      label: isMuted ? 'ミュート解除' : 'ミュート',
      action: toggleMute,
      separator: true,
    },
    { label: '手動更新 (Releasesを開く)', action: openReleases, separator: true },
    { label: '終了', action: quitApp },
  ];

  return (
    <>
      {children}
      {visible && (
        <div
          style={{
            position: 'fixed',
            top: position.y,
            left: position.x,
            backgroundColor: '#1c1c1c',
            color: '#f8f8f8',
            border: '1px solid #333',
            borderRadius: 4,
            minWidth: 220,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              onClick={() => {
                hideMenu();
                item.action();
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                backgroundColor: 'transparent',
                color: '#f8f8f8',
                border: 'none',
                borderBottom: index === items.length - 1 ? 'none'
                  : item.separator ? '1px solid #444'
                  : '1px solid #2a2a2a',
                cursor: 'pointer',
                fontSize: 13,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2a2a2a')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
};
