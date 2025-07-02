import { useEffect, useRef, useState } from 'react';

interface MetronomeProps {
  /** Starting tempo in beats-per-minute */
  initialBpm?: number;
  /** Minimum BPM allowed (defaults to 30) */
  minBpm?: number;
  /** Maximum BPM allowed (defaults to 300) */
  maxBpm?: number;
  /** Optional callback whenever tempo changes */
  onBpmChange?: (bpm: number) => void;
}

/**
 * Very small, self-contained metronome built with the Web Audio API.
 *
 * It generates a short click sound on every beat and lets the user
 * start/stop playback and adjust the tempo with either a number input
 * or a range slider.
 */
export default function Metronome({
  initialBpm = 120,
  minBpm = 30,
  maxBpm = 300,
  onBpmChange
}: MetronomeProps) {
  const [bpm, setBpm] = useState<number>(initialBpm);
  const [isRunning, setIsRunning] = useState(false);

  // Store references so they survive re-renders
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalIdRef = useRef<number | null>(null);

  /**
   * Create a very short click sound using an oscillator → gain → destination.
   */
  const playClick = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new window.AudioContext();
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Create oscillator (square wave for a nice click)
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 1000; // Hz

      // Shape click envelope – quick attack & release
      const gain = ctx.createGain();
      gain.gain.value = 0.0001; // start near silence
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.2, now); // quick attack
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05); // decay over 50 ms

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06); // stop after ~60 ms so we don't leak nodes
    } catch (err) {
      // In rare cases the AudioContext can throw if user gestures are required.
      console.warn('Metronome click failed:', err);
    }
  };

  /**
   * (Re)start interval whenever BPM or running state changes.
   */
  useEffect(() => {
    // Clear previous interval if any
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    if (isRunning) {
      // Immediately play a click so the user hears the start cue
      playClick();

      const intervalMs = (60_000) / bpm; // ms per beat
      intervalIdRef.current = window.setInterval(playClick, intervalMs);
    }

    // Cleanup when component unmounts OR when deps change
    return () => {
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [isRunning, bpm]);

  /** Notify host component whenever BPM changes */
  useEffect(() => {
    onBpmChange?.(bpm);
  }, [bpm, onBpmChange]);

  const handleBpmInput = (newVal: number) => {
    const clamped = Math.min(maxBpm, Math.max(minBpm, newVal));
    setBpm(clamped);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button
        onClick={() => setIsRunning(prev => !prev)}
        className="button secondary"
        style={{ minWidth: '110px' }}
      >
        {isRunning ? '⏹️ Stop' : '▶️ Metronome'}
      </button>

      {/* BPM number input */}
      <input
        type="number"
        value={bpm}
        min={minBpm}
        max={maxBpm}
        step={1}
        onChange={e => handleBpmInput(parseInt(e.target.value, 10) || minBpm)}
        style={{ width: '60px', textAlign: 'center' }}
      />
      <span style={{ fontSize: '0.85em', color: '#666' }}>BPM</span>

      {/* Optional slider for quick tempo changes */}
      <input
        type="range"
        min={minBpm}
        max={maxBpm}
        value={bpm}
        onChange={e => handleBpmInput(parseInt(e.target.value, 10))}
        style={{ flex: 1, maxWidth: '150px' }}
      />
    </div>
  );
} 