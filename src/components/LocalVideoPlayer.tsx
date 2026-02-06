import React, { useRef, useEffect, useState } from 'react';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (playlist.length > 0) {
      const currentFile = playlist[currentIndex];
      onVideoChange(currentFile);
      
      if (videoRef.current) {
        // atomプロトコル経由で再生
        videoRef.current.src = `atom://media/${currentFile}`;
        videoRef.current.play().catch(e => console.error("Auto-play failed:", e));
      }
    }
  }, [playlist, currentIndex]);

  const handleEnded = () => {
    const nextIndex = (currentIndex + 1) % playlist.length;
    setCurrentIndex(nextIndex);
  };

  if (playlist.length === 0) {
    return <div className="flex items-center justify-center h-full bg-black text-white">No Videos</div>;
  }

  return (
    <video
      ref={videoRef}
      className={`w-full h-full object-cover ${className}`}
      muted // 自動再生のためにミュート推奨
      autoPlay
      onEnded={handleEnded}
      playsInline
    />
  );
};
