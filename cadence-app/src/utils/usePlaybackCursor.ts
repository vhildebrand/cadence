import { useState, useEffect, useRef, useCallback } from 'react';

interface PlaybackState {
  isPlaying: boolean;
  currentPositionQuarters: number;
  currentPositionSeconds: number;
  startTime: number | null;
  pausedAt: number;
}

interface UsePlaybackCursorOptions {
  tempo: number; // BPM
  totalDurationQuarters?: number;
  onPositionChange?: (position: number) => void;
  onComplete?: () => void;
}

interface UsePlaybackCursorReturn {
  // State
  isPlaying: boolean;
  currentPositionQuarters: number;
  currentPositionSeconds: number;
  progress: number; // 0-1 percentage
  
  // Controls
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (positionQuarters: number) => void;
  
  // Tempo control
  setTempo: (newTempo: number) => void;
  
  // Utilities
  quartersToSeconds: (quarters: number) => number;
  secondsToQuarters: (seconds: number) => number;
}

export function usePlaybackCursor({
  tempo: initialTempo,
  totalDurationQuarters = 0,
  onPositionChange,
  onComplete
}: UsePlaybackCursorOptions): UsePlaybackCursorReturn {
  
  const [tempo, setTempoState] = useState(initialTempo);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentPositionQuarters: 0,
    currentPositionSeconds: 0,
    startTime: null,
    pausedAt: 0
  });
  
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  
  // Convert between quarters and seconds based on tempo
  const quartersToSeconds = useCallback((quarters: number): number => {
    return (60.0 / tempo) * quarters;
  }, [tempo]);
  
  const secondsToQuarters = useCallback((seconds: number): number => {
    return (tempo / 60.0) * seconds;
  }, [tempo]);
  
  // Calculate current position based on elapsed time
  const updatePosition = useCallback(() => {
    if (!playbackState.isPlaying || !playbackState.startTime) return;
    
    const now = performance.now();
    const elapsedMs = now - playbackState.startTime;
    const elapsedSeconds = elapsedMs / 1000;
    
    // Add any previously paused time
    const totalElapsedSeconds = elapsedSeconds + playbackState.pausedAt;
    const currentQuarters = secondsToQuarters(totalElapsedSeconds);
    
    // Check if we've reached the end
    if (totalDurationQuarters > 0 && currentQuarters >= totalDurationQuarters) {
      setPlaybackState(prev => ({
        ...prev,
        isPlaying: false,
        currentPositionQuarters: totalDurationQuarters,
        currentPositionSeconds: quartersToSeconds(totalDurationQuarters),
        startTime: null
      }));
      
      if (onComplete) {
        onComplete();
      }
      return;
    }
    
    // Update state
    setPlaybackState(prev => ({
      ...prev,
      currentPositionQuarters: currentQuarters,
      currentPositionSeconds: totalElapsedSeconds
    }));
    
    // Call position change callback
    if (onPositionChange) {
      onPositionChange(currentQuarters);
    }
    
    lastUpdateTimeRef.current = now;
  }, [
    playbackState.isPlaying,
    playbackState.startTime,
    playbackState.pausedAt,
    secondsToQuarters,
    quartersToSeconds,
    totalDurationQuarters,
    onPositionChange,
    onComplete
  ]);
  
  // Animation loop for smooth position updates
  useEffect(() => {
    if (playbackState.isPlaying) {
      const animate = () => {
        updatePosition();
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [playbackState.isPlaying, updatePosition]);
  
  // Playback controls
  const play = useCallback(() => {
    const now = performance.now();
    setPlaybackState(prev => ({
      ...prev,
      isPlaying: true,
      startTime: now
    }));
  }, []);
  
  const pause = useCallback(() => {
    if (playbackState.isPlaying && playbackState.startTime) {
      const now = performance.now();
      const elapsedSeconds = (now - playbackState.startTime) / 1000;
      
      setPlaybackState(prev => ({
        ...prev,
        isPlaying: false,
        startTime: null,
        pausedAt: prev.pausedAt + elapsedSeconds
      }));
    }
  }, [playbackState.isPlaying, playbackState.startTime]);
  
  const stop = useCallback(() => {
    setPlaybackState({
      isPlaying: false,
      currentPositionQuarters: 0,
      currentPositionSeconds: 0,
      startTime: null,
      pausedAt: 0
    });
  }, []);
  
  const seek = useCallback((positionQuarters: number) => {
    const clampedPosition = Math.max(0, Math.min(positionQuarters, totalDurationQuarters));
    const positionSeconds = quartersToSeconds(clampedPosition);
    
    setPlaybackState(prev => ({
      ...prev,
      currentPositionQuarters: clampedPosition,
      currentPositionSeconds: positionSeconds,
      pausedAt: positionSeconds,
      startTime: prev.isPlaying ? performance.now() : null
    }));
    
    if (onPositionChange) {
      onPositionChange(clampedPosition);
    }
  }, [totalDurationQuarters, quartersToSeconds, onPositionChange]);
  
  const setTempo = useCallback((newTempo: number) => {
    // When tempo changes, we need to adjust the current position to maintain
    // the same musical position but with different timing
    const currentMusicalPosition = playbackState.currentPositionQuarters;
    
    setTempoState(newTempo);
    
    // If we're playing, restart timing with new tempo
    if (playbackState.isPlaying) {
      const newPositionSeconds = (60.0 / newTempo) * currentMusicalPosition;
      setPlaybackState(prev => ({
        ...prev,
        currentPositionSeconds: newPositionSeconds,
        pausedAt: newPositionSeconds,
        startTime: performance.now()
      }));
    }
  }, [playbackState.currentPositionQuarters, playbackState.isPlaying]);
  
  // Calculate progress percentage
  const progress = totalDurationQuarters > 0 
    ? Math.min(1, playbackState.currentPositionQuarters / totalDurationQuarters)
    : 0;
  
  return {
    // State
    isPlaying: playbackState.isPlaying,
    currentPositionQuarters: playbackState.currentPositionQuarters,
    currentPositionSeconds: playbackState.currentPositionSeconds,
    progress,
    
    // Controls
    play,
    pause,
    stop,
    seek,
    
    // Tempo
    setTempo,
    
    // Utilities
    quartersToSeconds,
    secondsToQuarters
  };
} 