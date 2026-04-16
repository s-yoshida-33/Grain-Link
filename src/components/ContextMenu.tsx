import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { loadSettings, saveSettings } from '../utils/settings';
import type { AppMode, SleepSettings } from '../types/settings';

const GENRE_SUB_OPTIONS = ['フードコート', 'レストラン', 'カフェ', 'スイーツ/その他'] as const;

interface ContextMenuProps {
  children: React.ReactNode;
}

const RELEASE_URL = 'https://github.com/s-yoshida-33/Grain-Link/releases/latest';

const MODE_LABELS: Record<AppMode, string> = {
  VIDEO_AD: '動画広告モード',
  SHOP_LIST: 'ショップ一覧モード',
};

const DEFAULT_SLEEP: SleepSettings = { enabled: false, startTime: '10:00', endTime: '21:00' };

type Position = { x: number; y: number };

export const ContextMenu: React.FC<ContextMenuProps> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [currentMode, setCurrentMode] = useState<AppMode | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [sleepSettings, setSleepSettings] = useState<SleepSettings>(DEFAULT_SLEEP);
  const [genreSubFilter, setGenreSubFilter] = useState<string | undefined>(undefined);
  const [hostname, setHostname] = useState<string>('');
  const [appVersion, setAppVersion] = useState<string>('');

  const hideMenu = useCallback(() => setVisible(false), []);

  useEffect(() => {
    const handleContextMenu = async (event: MouseEvent) => {
      event.preventDefault();
      // メニュー表示時に最新の設定を読み込む
      try {
        const [settings, version] = await Promise.all([
          loadSettings(),
          getVersion().catch(() => ''),
        ]);
        setCurrentMode(settings.appMode);
        setIsMuted(settings.isMuted ?? false);
        setSleepSettings(settings.sleepSettings ?? DEFAULT_SLEEP);
        setGenreSubFilter(settings.genreSubFilter);
        setHostname(settings.hostname ?? '');
        setAppVersion(version);
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
    window.location.reload();
  }, []);

  const quitApp = useCallback(async () => {
    await invoke('quit_app');
  }, []);

  const minimizeWindow = useCallback(async () => {
    await invoke('minimize_window');
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

  // スリープのオンオフを切り替える
  const toggleSleep = useCallback(async () => {
    hideMenu();
    try {
      const settings = await loadSettings();
      const newSleep: SleepSettings = {
        ...(settings.sleepSettings ?? DEFAULT_SLEEP),
        enabled: !sleepSettings.enabled,
      };
      settings.sleepSettings = newSleep;
      await saveSettings(settings);
      setSleepSettings(newSleep);
      window.dispatchEvent(new CustomEvent('reload-settings'));
    } catch {
      // 保存失敗時は何もしない
    }
  }, [hideMenu, sleepSettings]);

  // 営業開始時刻を変更する
  const changeSleepStartTime = useCallback(async () => {
    hideMenu();
    const input = window.prompt(
      '営業開始時刻を入力してください（HH:MM）',
      sleepSettings.startTime,
    );
    if (!input || !/^\d{1,2}:\d{2}$/.test(input)) return;

    try {
      const settings = await loadSettings();
      const newSleep: SleepSettings = {
        ...(settings.sleepSettings ?? DEFAULT_SLEEP),
        startTime: input,
      };
      settings.sleepSettings = newSleep;
      await saveSettings(settings);
      setSleepSettings(newSleep);
      window.dispatchEvent(new CustomEvent('reload-settings'));
    } catch {
      // 保存失敗時は何もしない
    }
  }, [hideMenu, sleepSettings]);

  // 営業終了時刻を変更する
  const changeSleepEndTime = useCallback(async () => {
    hideMenu();
    const input = window.prompt(
      '営業終了時刻を入力してください（HH:MM）',
      sleepSettings.endTime,
    );
    if (!input || !/^\d{1,2}:\d{2}$/.test(input)) return;

    try {
      const settings = await loadSettings();
      const newSleep: SleepSettings = {
        ...(settings.sleepSettings ?? DEFAULT_SLEEP),
        endTime: input,
      };
      settings.sleepSettings = newSleep;
      await saveSettings(settings);
      setSleepSettings(newSleep);
      window.dispatchEvent(new CustomEvent('reload-settings'));
    } catch {
      // 保存失敗時は何もしない
    }
  }, [hideMenu, sleepSettings]);

  // ホスト名を変更する
  const changeHostname = useCallback(async () => {
    hideMenu();
    const input = window.prompt(
      'ホスト名を入力してください（例: 3-WMT-55-01）',
      hostname,
    );
    if (input === null) return;
    const trimmed = input.trim();
    try {
      const settings = await loadSettings();
      settings.hostname = trimmed || undefined;
      await saveSettings(settings);
      setHostname(trimmed);
      window.dispatchEvent(new CustomEvent('reload-settings'));
    } catch {
      // 保存失敗時は何もしない
    }
  }, [hideMenu, hostname]);

  // genreSub フィルターを設定・解除する
  const changeGenreSubFilter = useCallback(async (value: string | undefined) => {
    hideMenu();
    try {
      const settings = await loadSettings();
      settings.genreSubFilter = value;
      await saveSettings(settings);
      setGenreSubFilter(value);
      window.dispatchEvent(new CustomEvent('reload-settings'));
    } catch {
      // 保存失敗時は何もしない
    }
  }, [hideMenu]);

  // 切り替え先のモード
  const targetMode: AppMode | null = currentMode === 'VIDEO_AD' ? 'SHOP_LIST'
    : currentMode === 'SHOP_LIST' ? 'VIDEO_AD'
    : null;

  type MenuItem = { label: string; action: () => void; separator?: boolean; disabled?: boolean };
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
    {
      label: `焼き付き防止: ${sleepSettings.enabled ? 'オン' : 'オフ'}`,
      action: toggleSleep,
    },
    {
      label: `開始時刻: ${sleepSettings.startTime}`,
      action: changeSleepStartTime,
    },
    {
      label: `終了時刻: ${sleepSettings.endTime}`,
      action: changeSleepEndTime,
    },
    {
      label: `ホスト名: ${hostname || '未設定'}`,
      action: changeHostname,
      separator: true,
    },
    // genreSub フィルター（新API対応）
    {
      label: `ジャンル絞り込み: ${genreSubFilter ?? '従来（自動）'}`,
      action: () => {},
      disabled: true,
    },
    ...GENRE_SUB_OPTIONS.map((opt) => ({
      label: `${genreSubFilter === opt ? '✓ ' : '　'}${opt}`,
      action: () => changeGenreSubFilter(opt),
    })),
    {
      label: `${!genreSubFilter ? '✓ ' : '　'}解除（従来動作）`,
      action: () => changeGenreSubFilter(undefined),
      separator: true,
    },
    { label: '手動更新 (Releases)', action: openReleases },
    {
      label: `バージョン: ${appVersion ? `v${appVersion}` : '取得中…'}`,
      action: () => {},
      disabled: true,
      separator: true,
    },
    { label: '最小化', action: minimizeWindow },
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
            minWidth: 160,
            maxWidth: 200,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              onClick={() => {
                if (item.disabled) return;
                hideMenu();
                item.action();
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                backgroundColor: 'transparent',
                color: item.disabled ? '#666' : '#f8f8f8',
                border: 'none',
                borderBottom: index === items.length - 1 ? 'none'
                  : item.separator ? '1px solid #444'
                  : '1px solid #2a2a2a',
                cursor: item.disabled ? 'default' : 'pointer',
                fontSize: 12,
              }}
              onMouseEnter={(e) => {
                if (!item.disabled) e.currentTarget.style.backgroundColor = '#2a2a2a';
              }}
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
