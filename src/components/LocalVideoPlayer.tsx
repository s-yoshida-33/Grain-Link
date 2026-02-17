import React, { useRef, useEffect, useState, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
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
  
  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFading, setIsFading] = useState(false);

  const getInactivePlayer = useCallback((active: 'A' | 'B'): 'A' | 'B' => active === 'A' ? 'B' : 'A', []);

  const preparePlayer = useCallback((player: 'A' | 'B', fileIndex: number, autoPlay: boolean = false) => {
    if (playlist.length === 0) return;
    
    const index = fileIndex % playlist.length;
    const filePath = playlist[index];
    const ref = player === 'A' ? videoRefA : videoRefB;

    if (ref.current) {
      try {
        const videoUrl = convertFileSrc(filePath);
        const filename = filePath.split(/[/\\]/).pop() || '';
        
        ref.current.src = videoUrl;
        ref.current.currentTime = 0; // 時間をリセット
        ref.current.load();
        
        // 準備ができたら再生を試みる
        if (autoPlay) {
          const timer = setTimeout(() => {
            if (ref.current) {
              ref.current.play().catch(e => {
                logWarn('LOCAL_VIDEO', `Auto-play failed for ${player}`, {
                  error: e.message
                });
              });
            }
          }, 50);
          return () => clearTimeout(timer);
        }
        
        logWarn('LOCAL_VIDEO', `Video prepared for player ${player}`, {
          fileIndex: index,
          filename,
          autoPlay,
        });
      } catch (error) {
        logError('LOCAL_VIDEO', `Failed to prepare player ${player}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, [playlist]);

  // 初期化処理
  useEffect(() => {
    if (playlist.length > 0 && !isInitialized) {
      // 最初の動画をAにセットして再生開始
      preparePlayer('A', 0, true);
      
      // 次の動画をBにプリロード（まだ再生しない）
      if (playlist.length > 1) {
        preparePlayer('B', 1, false);
      } else {
        preparePlayer('B', 0, false);
      }

      const currentFile = playlist[0];
      const fileName = currentFile.split(/[/\\]/).pop() || currentFile;
      onVideoChange(fileName);

      logWarn('LOCAL_VIDEO', 'Playlist initialized', {
        playlistLength: playlist.length,
        firstFile: fileName,
      });

      setIsInitialized(true);
    }
  }, [playlist, isInitialized, preparePlayer, onVideoChange]);

  // 動画終了ハンドラ
  const handleEnded = useCallback(() => {
    if (playlist.length === 0 || isFading) return;

    const nextIndex = (currentIndex + 1) % playlist.length;
    const nextPlayer = getInactivePlayer(activePlayer);
    const inactivePlayer = getInactivePlayer(nextPlayer);
    const futureIndex = (nextIndex + 1) % playlist.length;

    logWarn('LOCAL_VIDEO', 'Video ended, starting fade transition', {
      from: activePlayer,
      to: nextPlayer,
      nextIndex,
    });

    setIsFading(true);

    // 1. フェード開始：activePlayer を切り替え + 画像・テキスト通知を同時実行
    setActivePlayer(nextPlayer);
    setCurrentIndex(nextIndex);
    
    const nextFile = playlist[nextIndex];
    const fileName = nextFile.split(/[/\\]/).pop() || nextFile;
    onVideoChange(fileName);
    logWarn('LOCAL_VIDEO', 'Video change notified at fade start', { 
      nextIndex, 
      fileName,
    });

    // 2. 次のプレイヤーを再生開始（フェード中に）
    const playTimer = setTimeout(() => {
      const ref = nextPlayer === 'A' ? videoRefA : videoRefB;
      if (ref.current) {
        ref.current.play().catch(e => {
          logWarn('LOCAL_VIDEO', `Play failed for ${nextPlayer}`, {
            error: e.message
          });
        });
      }
    }, 50);

    // 3. フェード完了後：今フェードアウトしたプレイヤーに次の動画をプリロード
    const prepareTimer = setTimeout(() => {
      preparePlayer(inactivePlayer, futureIndex, false);
      logWarn('LOCAL_VIDEO', 'Next video preloaded for transition', { 
        futureIndex, 
        player: inactivePlayer,
      });
      setIsFading(false);
    }, 1000);

    return () => {
      clearTimeout(playTimer);
      clearTimeout(prepareTimer);
    };

  }, [currentIndex, playlist, activePlayer, isFading, preparePlayer, onVideoChange, getInactivePlayer]);

  if (playlist.length === 0) {
    return <div className="flex items-center justify-center h-full bg-black text-white">No Videos</div>;
  }

  return (
    <div className={`relative w-full h-full bg-black ${className}`}>
      {/* Video Player A */}
      <video
        ref={videoRefA}
        className="absolute top-0 left-0 w-full h-full object-cover"
        style={{
          opacity: activePlayer === 'A' ? 1 : 0,
          transition: 'opacity 1s ease-in-out',
          zIndex: activePlayer === 'A' ? 2 : 1,
        }}
        muted={muted}
        playsInline
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
        onEnded={handleEnded}
      />
    </div>
  );
};
