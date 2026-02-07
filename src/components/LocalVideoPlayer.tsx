import React, { useRef, useEffect, useState, useCallback } from 'react';

interface LocalVideoPlayerProps {
  playlist: string[];
  onVideoChange: (fileName: string) => void;
  className?: string;
}

export const LocalVideoPlayer: React.FC<LocalVideoPlayerProps> = ({ 
  playlist, 
  onVideoChange,
  className 
}) => {
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  
  // 現在アクティブなプレイヤー ('A' | 'B')
  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');
  
  // 現在のプレイリストインデックス
  const [currentIndex, setCurrentIndex] = useState(0);

  // 初期化完了フラグ
  const [isInitialized, setIsInitialized] = useState(false);

  // 指定されたプレイヤーに動画をセットして準備する関数
  const preparePlayer = useCallback((player: 'A' | 'B', fileIndex: number) => {
    if (playlist.length === 0) return;
    
    const index = fileIndex % playlist.length;
    const file = playlist[index];
    const ref = player === 'A' ? videoRefA : videoRefB;

    if (ref.current) {
      ref.current.src = `file://${file}`;
      ref.current.load();
    }
  }, [playlist]);

  // 動画再生を開始する関数
  const playVideo = useCallback(async (player: 'A' | 'B') => {
    const ref = player === 'A' ? videoRefA : videoRefB;
    if (ref.current) {
      try {
        await ref.current.play();
      } catch (e) {
        console.error(`Player ${player} auto-play failed:`, e);
      }
    }
  }, []);

  // 初期化処理
  useEffect(() => {
    if (playlist.length > 0 && !isInitialized) {
      // 最初の動画をAにセットして再生
      preparePlayer('A', 0);
      playVideo('A');
      
      // 次の動画をBにセットしておく（プリロード）
      if (playlist.length > 1) {
        preparePlayer('B', 1);
      } else {
        preparePlayer('B', 0); // 1曲ループの場合
      }

      // 通知
      const currentFile = playlist[0];
      const fileName = currentFile.split(/[/\\]/).pop() || currentFile;
      onVideoChange(fileName);

      setIsInitialized(true);
    }
  }, [playlist, isInitialized, preparePlayer, playVideo, onVideoChange]);

  // 動画終了ハンドラ
  const handleEnded = useCallback(() => {
    const nextIndex = (currentIndex + 1) % playlist.length;
    const nextPlayer = activePlayer === 'A' ? 'B' : 'A';
    
    // 1. 次のプレイヤーで再生開始 (すでにロード済み)
    playVideo(nextPlayer);
    
    // 2. アクティブプレイヤーを切り替え (クロスフェード開始)
    setActivePlayer(nextPlayer);
    setCurrentIndex(nextIndex);

    // 3. 通知
    const nextFile = playlist[nextIndex];
    const fileName = nextFile.split(/[/\\]/).pop() || nextFile;
    onVideoChange(fileName);

    // 4. 再生が終わったプレイヤーで「さらに次の動画」をプリロード
    // ただし、即座に行うとフェードアウト中の動画が切り替わってしまうため、フェード時間分待つ
    const futureIndex = (nextIndex + 1) % playlist.length;
    setTimeout(() => {
        preparePlayer(activePlayer, futureIndex); // activePlayerはこれから非アクティブになる方
    }, 1000); // クロスフェード時間(1s)待機

  }, [currentIndex, playlist, activePlayer, playVideo, preparePlayer, onVideoChange]);

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
        muted
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
        muted
        playsInline
        onEnded={handleEnded}
      />
    </div>
  );
};
