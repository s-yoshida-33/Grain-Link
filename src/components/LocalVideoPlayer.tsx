import React, { useRef, useEffect, useState, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { logError, logDebug, logInfo, logWarn } from '../logs/logging';

const MAX_RETRY_COUNT = 3;
const WATCHDOG_INTERVAL_MS = 1000;
const FREEZE_WARN_THRESHOLD = 5;
const FREEZE_SKIP_THRESHOLD = 30;
const STUCK_WARN_MS = 10_000;
const STUCK_SKIP_MS = 30_000;

function getBufferedRanges(video: HTMLVideoElement): string {
  try {
    const ranges: string[] = [];
    for (let i = 0; i < video.buffered.length; i++) {
      ranges.push(`[${video.buffered.start(i).toFixed(2)}-${video.buffered.end(i).toFixed(2)}]`);
    }
    return ranges.join(', ') || 'none';
  } catch {
    return 'unknown';
  }
}

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

  // Refs mirroring state for use in stable callbacks (watchdog, event listeners)
  const activePlayerRef = useRef(activePlayer);
  activePlayerRef.current = activePlayer;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;
  const isFadingRef = useRef(isFading);
  isFadingRef.current = isFading;

  // Transition guard
  const isTransitioningRef = useRef(false);

  // Error retry
  const retryCountRef = useRef(0);
  const errorRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Watchdog
  const lastTimeRef = useRef(0);
  const freezeCounterRef = useRef(0);
  const lastGoodStateRef = useRef(Date.now());

  // Fade transition timers (for cleanup)
  const fadePlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadePrepareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const releaseVideoElement = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
  }, []);

  // Cleanup on unmount: release Chromium's decoded frame buffers
  useEffect(() => {
    return () => {
      [videoRefA.current, videoRefB.current].forEach(releaseVideoElement);
      if (errorRetryTimerRef.current) clearTimeout(errorRetryTimerRef.current);
      if (fadePlayTimerRef.current) clearTimeout(fadePlayTimerRef.current);
      if (fadePrepareTimerRef.current) clearTimeout(fadePrepareTimerRef.current);
    };
  }, [releaseVideoElement]);

  const getVideoRef = useCallback((player: 'A' | 'B') => player === 'A' ? videoRefA : videoRefB, []);
  const getInactivePlayer = useCallback((active: 'A' | 'B'): 'A' | 'B' => active === 'A' ? 'B' : 'A', []);

  const preparePlayer = useCallback((player: 'A' | 'B', fileIndex: number, autoPlay: boolean = false) => {
    if (playlist.length === 0) return;
    
    const index = fileIndex % playlist.length;
    const filePath = playlist[index];
    const ref = getVideoRef(player);

    if (ref.current) {
      try {
        const videoUrl = convertFileSrc(filePath);
        const filename = filePath.split(/[/\\]/).pop() || '';

        // Release previous decoded frames before loading new source
        releaseVideoElement(ref.current);
        ref.current.src = videoUrl;
        ref.current.load();
        
        if (autoPlay) {
          const timer = setTimeout(() => {
            if (ref.current) {
              ref.current.play().catch(e => {
                logWarn('LOCAL_VIDEO', `Auto-play blocked for ${player}`, {
                  error: e.message
                });
              });
            }
          }, 50);
          return () => clearTimeout(timer);
        }
        
        logDebug('LOCAL_VIDEO', `Video prepared for player ${player}`, {
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
  }, [playlist, getVideoRef, releaseVideoElement]);

  // Stable advance function: reads from refs to avoid stale closures
  const advanceToNext = useCallback(() => {
    if (isTransitioningRef.current || isFadingRef.current) {
      logDebug('LOCAL_VIDEO', 'advanceToNext skipped: transition/fade in progress');
      return;
    }
    isTransitioningRef.current = true;

    const latestPlaylist = playlistRef.current;
    const latestIndex = currentIndexRef.current;
    const latestActive = activePlayerRef.current;

    if (latestPlaylist.length === 0) {
      isTransitioningRef.current = false;
      return;
    }

    // Reset watchdog
    lastTimeRef.current = 0;
    freezeCounterRef.current = 0;
    lastGoodStateRef.current = Date.now();
    retryCountRef.current = 0;

    const nextIndex = (latestIndex + 1) % latestPlaylist.length;
    const nextPlayer = latestActive === 'A' ? 'B' : 'A';
    const futureIndex = (nextIndex + 1) % latestPlaylist.length;

    // Release outgoing player's decoded frame buffers
    const outgoing = (latestActive === 'A' ? videoRefA : videoRefB).current;
    releaseVideoElement(outgoing);

    setActivePlayer(nextPlayer);
    setCurrentIndex(nextIndex);
    setIsFading(true);

    const nextFile = latestPlaylist[nextIndex];
    const fileName = nextFile.split(/[/\\]/).pop() || nextFile;
    onVideoChange(fileName);

    logDebug('LOCAL_VIDEO', 'Watchdog forced advance', {
      from: latestActive,
      to: nextPlayer,
      nextIndex,
      fileName,
    });

    fadePlayTimerRef.current = setTimeout(() => {
      fadePlayTimerRef.current = null;
      const ref = nextPlayer === 'A' ? videoRefA : videoRefB;
      if (ref.current) {
        ref.current.play().catch(e => {
          logWarn('LOCAL_VIDEO', `Play failed for player ${nextPlayer}`, { error: e.message });
        });
      }
    }, 50);

    fadePrepareTimerRef.current = setTimeout(() => {
      fadePrepareTimerRef.current = null;
      const inactiveP = nextPlayer === 'A' ? 'B' : 'A';
      const inactiveRef = inactiveP === 'A' ? videoRefA : videoRefB;
      if (inactiveRef.current && latestPlaylist.length > 0) {
        const futureFile = latestPlaylist[futureIndex];
        const futureUrl = convertFileSrc(futureFile);
        releaseVideoElement(inactiveRef.current);
        inactiveRef.current.src = futureUrl;
        inactiveRef.current.load();
      }
      setIsFading(false);
      isTransitioningRef.current = false;
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onVideoChange, releaseVideoElement]);

  // 初期化処理
  useEffect(() => {
    if (playlist.length > 0 && !isInitialized) {
      preparePlayer('A', 0, true);
      
      if (playlist.length > 1) {
        preparePlayer('B', 1, false);
      } else {
        preparePlayer('B', 0, false);
      }

      const currentFile = playlist[0];
      const fileName = currentFile.split(/[/\\]/).pop() || currentFile;
      onVideoChange(fileName);

      logInfo('LOCAL_VIDEO', 'Playlist initialized', {
        playlistLength: playlist.length,
        firstFile: fileName,
      });

      lastGoodStateRef.current = Date.now();
      setIsInitialized(true);
    }
  }, [playlist, isInitialized, preparePlayer, onVideoChange]);

  // 動画終了ハンドラ
  const handleEnded = useCallback(() => {
    if (playlist.length === 0 || isFading) return;
    if (isTransitioningRef.current) {
      logDebug('LOCAL_VIDEO', 'handleEnded skipped: transition in progress');
      return;
    }
    isTransitioningRef.current = true;

    const nextIndex = (currentIndex + 1) % playlist.length;
    const nextPlayer = getInactivePlayer(activePlayer);
    const inactivePlayer = getInactivePlayer(nextPlayer);
    const futureIndex = (nextIndex + 1) % playlist.length;

    logDebug('LOCAL_VIDEO', 'Video ended, starting fade transition', {
      from: activePlayer,
      to: nextPlayer,
      nextIndex,
    });

    // Reset watchdog & retry state for next video
    lastTimeRef.current = 0;
    freezeCounterRef.current = 0;
    lastGoodStateRef.current = Date.now();
    retryCountRef.current = 0;

    // Release decoded frame buffers from the outgoing player
    const outgoing = getVideoRef(activePlayer).current;
    releaseVideoElement(outgoing);

    setIsFading(true);
    setActivePlayer(nextPlayer);
    setCurrentIndex(nextIndex);
    
    const nextFile = playlist[nextIndex];
    const fileName = nextFile.split(/[/\\]/).pop() || nextFile;
    onVideoChange(fileName);
    logDebug('LOCAL_VIDEO', 'Video change notified at fade start', {
      nextIndex, 
      fileName,
    });

    fadePlayTimerRef.current = setTimeout(() => {
      fadePlayTimerRef.current = null;
      const ref = getVideoRef(nextPlayer);
      if (ref.current) {
        ref.current.play().catch(e => {
          logWarn('LOCAL_VIDEO', `Play failed for player ${nextPlayer}`, {
            error: e.message
          });
        });
      }
    }, 50);

    fadePrepareTimerRef.current = setTimeout(() => {
      fadePrepareTimerRef.current = null;
      preparePlayer(inactivePlayer, futureIndex, false);
      logDebug('LOCAL_VIDEO', 'Next video preloaded for transition', {
        futureIndex, 
        player: inactivePlayer,
      });
      setIsFading(false);
      isTransitioningRef.current = false;
    }, 1000);

  }, [currentIndex, playlist, activePlayer, isFading, preparePlayer, onVideoChange, getInactivePlayer, getVideoRef, releaseVideoElement]);

  // Error handler for video elements
  const handleError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const currentFile = playlistRef.current[currentIndexRef.current] || '';
    const fileName = currentFile.split(/[/\\]/).pop() || currentFile;

    logError('LOCAL_VIDEO', 'Video playback error', {
      file: fileName,
      error: video.error?.message,
      code: video.error?.code,
      readyState: video.readyState,
      networkState: video.networkState,
      buffered: getBufferedRanges(video),
      retryCount: retryCountRef.current,
    });

    if (retryCountRef.current < MAX_RETRY_COUNT) {
      retryCountRef.current += 1;
      const delay = 1000 * retryCountRef.current;
      logWarn('LOCAL_VIDEO', `Retrying video load (${retryCountRef.current}/${MAX_RETRY_COUNT})`, {
        file: fileName,
        delay,
      });
      errorRetryTimerRef.current = setTimeout(() => {
        errorRetryTimerRef.current = null;
        if (video.src) {
          video.load();
          video.play().catch(() => {});
        }
      }, delay);
    } else {
      logError('LOCAL_VIDEO', 'Max retries reached, skipping to next', {
        file: fileName,
        retryCount: retryCountRef.current,
      });
      retryCountRef.current = 0;
      advanceToNext();
    }
  }, [advanceToNext]);

  // Stalled handler
  const handleStalled = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const currentFile = playlistRef.current[currentIndexRef.current] || '';
    const fileName = currentFile.split(/[/\\]/).pop() || currentFile;
    logWarn('LOCAL_VIDEO', 'Playback stalled (buffer underrun)', {
      file: fileName,
      readyState: video.readyState,
      networkState: video.networkState,
      buffered: getBufferedRanges(video),
    });
  }, []);

  // Watchdog: freeze detection, stuck detection
  useEffect(() => {
    if (playlist.length === 0 || !isInitialized) return;

    const interval = setInterval(() => {
      const active = activePlayerRef.current;
      const video = (active === 'A' ? videoRefA : videoRefB).current;
      if (!video) return;

      const now = Date.now();
      const currentFile = playlistRef.current[currentIndexRef.current] || '';
      const fileName = currentFile.split(/[/\\]/).pop() || '';
      const isReady = video.readyState >= 3;

      // Skip checks while fading or transitioning
      if (isFadingRef.current || isTransitioningRef.current) return;

      // Freeze detection: video should be playing but currentTime isn't advancing
      if (!video.paused && !video.ended) {
        if (isReady) {
          lastGoodStateRef.current = now;
          if (Math.abs(video.currentTime - lastTimeRef.current) < 0.05) {
            freezeCounterRef.current++;
            if (freezeCounterRef.current === FREEZE_WARN_THRESHOLD) {
              logWarn('LOCAL_VIDEO', 'Playback freeze detected', {
                file: fileName,
                player: active,
                frozenAt: video.currentTime?.toFixed(2),
                readyState: video.readyState,
                networkState: video.networkState,
                buffered: getBufferedRanges(video),
              });
            } else if (freezeCounterRef.current >= FREEZE_SKIP_THRESHOLD) {
              logError('LOCAL_VIDEO', 'Force skipping due to extended freeze', {
                file: fileName,
                secondsFrozen: freezeCounterRef.current,
                readyState: video.readyState,
                buffered: getBufferedRanges(video),
              });
              advanceToNext();
            }
          } else {
            if (freezeCounterRef.current >= FREEZE_WARN_THRESHOLD) {
              logInfo('LOCAL_VIDEO', 'Playback recovered from freeze', {
                file: fileName,
                frozenDuration: freezeCounterRef.current,
              });
            }
            freezeCounterRef.current = 0;
          }
          lastTimeRef.current = video.currentTime;
        } else {
          // Not ready but should be playing: stuck in low readyState
          const stuckMs = now - lastGoodStateRef.current;
          if (stuckMs > STUCK_WARN_MS && Math.floor(stuckMs / STUCK_WARN_MS) !== Math.floor((stuckMs - WATCHDOG_INTERVAL_MS) / STUCK_WARN_MS)) {
            logWarn('LOCAL_VIDEO', 'Playback stuck in non-ready state', {
              file: fileName,
              stuckMs,
              readyState: video.readyState,
              networkState: video.networkState,
              buffered: getBufferedRanges(video),
            });
          }
          if (stuckMs > STUCK_SKIP_MS) {
            logError('LOCAL_VIDEO', 'Force skipping due to stuck readyState', {
              file: fileName,
              stuckMs,
              readyState: video.readyState,
            });
            advanceToNext();
            lastGoodStateRef.current = now;
          }
        }
      }

      // Fallback: duration exceeded without ended event
      if (video.duration && !video.paused && video.currentTime >= video.duration) {
        logWarn('LOCAL_VIDEO', 'Duration exceeded without ended event, forcing advance', {
          file: fileName,
          currentTime: video.currentTime?.toFixed(2),
          duration: video.duration?.toFixed(2),
        });
        advanceToNext();
      }
    }, WATCHDOG_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [playlist.length, isInitialized, advanceToNext]);

  if (playlist.length === 0) {
    return <div className="flex items-center justify-center h-full bg-white text-black">No Videos</div>;
  }

  return (
    <div className={`relative w-full h-full bg-white ${className}`}>
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
        onError={handleError}
        onStalled={handleStalled}
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
        onError={handleError}
        onStalled={handleStalled}
      />
    </div>
  );
};
