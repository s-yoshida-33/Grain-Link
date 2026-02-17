import React, { useRef, useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logError, logWarn } from '../logs/logging';

interface LocalVideoPlayerProps {
  playlist: string[];
  onVideoChange: (fileName: string) => void;
  className?: string;
  muted?: boolean;
}

export const LocalVideoPlayer: React.FC<LocalVideoPlayerProps> = ({
  playlist,
  onVideoChange,
  className,
  muted = false
}) => {
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  
  // 現在アクティブなプレイヤー ('A' | 'B')
  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');
  
  // 現在のプレイリストインデックス
  const [currentIndex, setCurrentIndex] = useState(0);

  // 初期化完了フラグ
  const [isInitialized, setIsInitialized] = useState(false);

  // 非アクティブなプレイヤーを取得
  const getInactivePlayer = useCallback((active: 'A' | 'B'): 'A' | 'B' => active === 'A' ? 'B' : 'A', []);

  // 指定されたプレイヤーに動画をセットして準備する関数
  const preparePlayer = useCallback(async (player: 'A' | 'B', fileIndex: number) => {
    if (playlist.length === 0) return;
    
    const index = fileIndex % playlist.length;
    const filePath = playlist[index];
    const ref = player === 'A' ? videoRefA : videoRefB;

    if (ref.current) {
      try {
        // Tauri invoke でビデオファイルをバイナリで読み込む
        const data = await invoke<number[]>('read_video_file', { filePath });
        const uint8Array = new Uint8Array(data);
        const blob = new Blob([uint8Array], { type: 'video/mp4' });
        const blobUrl = URL.createObjectURL(blob);
        
        ref.current.src = blobUrl;
        ref.current.load();
        
        logWarn('LOCAL_VIDEO', `Video prepared for player ${player}`, {
          fileIndex: index,
          filePath,
          blobUrl,
        });
      } catch (error) {
        logError('LOCAL_VIDEO', `Failed to prepare player ${player}`, {
          error: error instanceof Error ? error.message : String(error),
          filePath,
        });
      }
    }
  }, [playlist]);

  // 動画再生を開始する関数
  const playVideo = useCallback(async (player: 'A' | 'B') => {
    const ref = player === 'A' ? videoRefA : videoRefB;
    if (ref.current) {
      try {
        // autoPlayが機能しない場合に備えて、明示的に再生を試みる
        const playPromise = ref.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            logWarn('LOCAL_VIDEO', `Player ${player} play() failed, will retry`, {
              error: error.message || String(error)
            });
            // 自動再生ポリシー失敗時は、次のユーザーアクション待つか、ミューテッド属性を確認
            // ミューテッド状態で再度試行
            if (ref.current && ref.current.muted) {
              ref.current.play().catch(e => {
                logError('LOCAL_VIDEO', `Player ${player} play() failed twice`, {
                  error: e instanceof Error ? e.message : String(e)
                });
              });
            }
          });
        }
      } catch (e) {
        logError('LOCAL_VIDEO', `Player ${player} auto-play error`, {
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }
  }, []);

  // 初期化処理
  useEffect(() => {
    const initialize = async () => {
      if (playlist.length > 0 && !isInitialized) {
        // 最初の動画をAにセットして再生
        await preparePlayer('A', 0);
        await playVideo('A');
        
        // 次の動画をBにセットしておく（プリロード）
        if (playlist.length > 1) {
          await preparePlayer('B', 1);
        } else {
          await preparePlayer('B', 0); // 1曲ループの場合
        }

        // 通知
        const currentFile = playlist[0];
        const fileName = currentFile.split(/[/\\]/).pop() || currentFile;
        onVideoChange(fileName);

        logWarn('LOCAL_VIDEO', 'Playlist initialized', {
          playlistLength: playlist.length,
          firstFile: fileName,
        });

        setIsInitialized(true);
      }
    };
    
    initialize();
  }, [playlist, isInitialized, preparePlayer, playVideo, onVideoChange]);

  // 動画終了ハンドラ
  const handleEnded = useCallback(() => {
    if (playlist.length === 0) return;

    const nextIndex = (currentIndex + 1) % playlist.length;
    const nextPlayer = getInactivePlayer(activePlayer);
    const inactivePlayer = getInactivePlayer(nextPlayer);
    const futureIndex = (nextIndex + 1) % playlist.length;

    logWarn('LOCAL_VIDEO', 'Video ended, transitioning', {
      currentIndex,
      nextIndex,
      activePlayer,
      nextPlayer,
    });

    // 1. 状態を更新: 次のプレイヤーをアクティブに
    setActivePlayer(nextPlayer);
    setCurrentIndex(nextIndex);

    // 2. 通知
    const nextFile = playlist[nextIndex];
    const fileName = nextFile.split(/[/\\]/).pop() || nextFile;
    onVideoChange(fileName);

    // 3. 非同期で処理
    (async () => {
      // 次のプレイヤーで再生開始 (すでにロード済みのはず)
      await playVideo(nextPlayer);

      // バックグラウンドで「さらに次の動画」をプリロード
      // クロスフェード中（1秒間）に準備する
      setTimeout(() => {
        preparePlayer(inactivePlayer, futureIndex);
        logWarn('LOCAL_VIDEO', 'Next video preloaded', { 
          futureIndex, 
          player: inactivePlayer,
          filePath: playlist[futureIndex],
        });
      }, 500); // クロスフェード中盤で準備開始
    })();

  }, [currentIndex, playlist, activePlayer, playVideo, preparePlayer, onVideoChange, getInactivePlayer]);

  if (playlist.length === 0) {
    return <div className="flex items-center justify-center h-full bg-black text-white">No Videos</div>;
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Video Player A */}
      <video
        ref={videoRefA}
        className="absolute top-0 left-0 w-full h-full object-cover"
        style={{
          opacity: activePlayer === 'A' ? 1 : 0,
          transition: 'opacity 1s ease-in-out', // クロスフェード時間
          zIndex: activePlayer === 'A' ? 2 : 1, // アクティブな方を上に
        }}
        muted={muted}
        playsInline
        autoPlay
        onEnded={handleEnded}
      />
      
      {/* Video Player B */}
      <video
        ref={videoRefB}
        className="absolute top-0 left-0 w-full h-full object-cover"
        style={{
          opacity: activePlayer === 'B' ? 1 : 0,
          transition: 'opacity 1s ease-in-out',
          zIndex: activePlayer === 'B' ? 2 : 1,
        }}
        muted={muted}
        playsInline
        autoPlay
        onEnded={handleEnded}
      />
    </div>
  );
};
