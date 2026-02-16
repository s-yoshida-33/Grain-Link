import { useEffect, useState } from 'react';
import appIcon from '../assets/icon.svg';

const RELEASE_URL = 'https://github.com/s-yoshida-33/Grain-Link/releases/latest';

export function PatchScreen() {
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    // フェーズ1: 自動アップデートは停止。手動更新案内のみ。
    setAppVersion('');
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        color: '#fff',
      }}
    >
      <div
        style={{
          minWidth: 720,
          maxWidth: 820,
          minHeight: 420,
          maxHeight: 520,
          padding: 32,
          borderRadius: 8,
          backgroundColor: '#0a0a0a',
          border: '2px solid #1a1a1a',
          boxShadow: '0 0 0 1px #2a2a2a, 0 8px 32px rgba(0,0,0,0.9)',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 4,
                border: '2px solid #2a2a2a',
                backgroundColor: '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <img
                src={appIcon}
                alt="App Icon"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ffffff' }}>Grain Link</div>
              <div style={{ fontSize: 12, color: '#888888' }}>
                アップデートは現在手動更新のみです。
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#666666' }}>
            {appVersion ? `v${appVersion}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
            手動更新の手順
          </div>

          <p
            style={{
              fontSize: 13,
              color: '#cccccc',
              lineHeight: 1.6,
              whiteSpace: 'pre-line',
            }}
          >
            1. 下のリンクから最新のリリースページを開きます。\n
            2. インストーラーをダウンロードして実行します。\n
            3. インストール後、アプリを再起動してください。
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: 16,
            borderRadius: 4,
            border: '2px solid #1a1a1a',
            backgroundColor: '#0f0f0f',
          }}
        >
          <div style={{ fontSize: 13, color: '#cccccc' }}>
            最新版を取得するには GitHub Releases を開いてください。
          </div>
          <a
            href={RELEASE_URL}
            target="_blank"
            rel="noreferrer"
            style={{
              backgroundColor: '#F08300',
              color: '#0a0a0a',
              border: '1px solid #d07000',
              borderRadius: 4,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(240,131,0,0.35)',
            }}
          >
            GitHub Releases を開く
          </a>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: '#666666',
            marginTop: 'auto',
            paddingTop: 12,
            borderTop: '1px solid #1a1a1a',
          }}
        >
          <div>© 2026 Toei Techno International Inc.</div>
          <div style={{ color: '#888888' }}>Updates are paused (manual only)</div>
        </div>
      </div>
    </div>
  );
}
