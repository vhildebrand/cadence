import { useState, useEffect, useRef, useCallback } from 'react';
import './NoteFall.css';

interface FallingNote {
  id: string;
  note: number;
  startTime: number;
  lane: number;
  isHit: boolean;
  isMissed: boolean;
}

interface HitFeedback {
  id: string;
  type: 'perfect' | 'good' | 'miss';
  position: number;
  timestamp: number;
}

interface MidiPressEvent {
  note: number;
  timestamp: number;
  lane: number;
}

interface NoteFallProps {
  onMidiMessage: (note: number, isNoteOn: boolean) => void;
  activeMidiNotes: Map<number, any>;
}

// Color scheme for notes A-G with neon colors
const NOTE_COLORS = {
  'C': '#ff4444', // Red
  'C#': '#ff6644', // Red-Orange
  'D': '#ff8844', // Orange
  'D#': '#ffaa44', // Orange-Yellow
  'E': '#ffcc44', // Yellow
  'F': '#ccff44', // Yellow-Green
  'F#': '#88ff44', // Green-Yellow
  'G': '#44ff44', // Green
  'G#': '#44ff88', // Green-Cyan
  'A': '#44ffcc', // Cyan
  'A#': '#44ccff', // Cyan-Blue
  'B': '#4488ff', // Blue
};

// Define all notes from C4 to C6 (24 notes) - organized as lanes for Guitar Hero style
const GAME_LANES = (() => {
  const notes = [];
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // C4 starts at MIDI note 60, C6 is at MIDI note 84
  for (let octave = 4; octave <= 6; octave++) {
    for (let i = 0; i < 12; i++) {
      const midiNote = octave * 12 + i + 12; // MIDI formula
      if (midiNote > 84) break; // Stop at C6
      
      const noteName = noteNames[i];
      const isBlackKey = noteName.includes('#');
      
      notes.push({
        note: midiNote,
        name: `${noteName}${octave}`,
        noteName: noteName, // Just the note name without octave
        octave,
        isBlackKey,
        color: NOTE_COLORS[noteName as keyof typeof NOTE_COLORS]
      });
    }
  }
  
  return notes;
})();

const FALL_DURATION = 4000; // 4 seconds for note to fall
const PERFECT_WINDOW = 100; // Perfect timing window in ms
const GOOD_WINDOW = 200; // Good timing window in ms

// Dynamic calculations based on actual container size
const getDynamicDimensions = (gameAreaRef: React.RefObject<HTMLDivElement | null>) => {
  if (!gameAreaRef.current) {
    // Fallback values
    return {
      GAME_AREA_HEIGHT: 600,
      LANE_HEADER_HEIGHT: 100,
      HIT_ZONE_HEIGHT: 60,
      NOTES_CONTAINER_HEIGHT: 440,
      HIT_ZONE_POSITION_PX: 380
    };
  }
  
  const gameAreaRect = gameAreaRef.current.getBoundingClientRect();
  const GAME_AREA_HEIGHT = gameAreaRect.height;
  const LANE_HEADER_HEIGHT = Math.min(100, GAME_AREA_HEIGHT * 0.15); // 15% of game area or 100px max
  const HIT_ZONE_HEIGHT = Math.min(60, GAME_AREA_HEIGHT * 0.1); // 10% of game area or 60px max
  const NOTES_CONTAINER_HEIGHT = GAME_AREA_HEIGHT - LANE_HEADER_HEIGHT - 80;
  const HIT_ZONE_POSITION_PX = NOTES_CONTAINER_HEIGHT - HIT_ZONE_HEIGHT;
  
  return {
    GAME_AREA_HEIGHT,
    LANE_HEADER_HEIGHT,
    HIT_ZONE_HEIGHT,
    NOTES_CONTAINER_HEIGHT,
    HIT_ZONE_POSITION_PX
  };
};

export default function NoteFall({ onMidiMessage, activeMidiNotes }: NoteFallProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [fallingNotes, setFallingNotes] = useState<FallingNote[]>([]);
  const [hitFeedback, setHitFeedback] = useState<HitFeedback[]>([]);
  const [gameStats, setGameStats] = useState({
    perfect: 0,
    good: 0,
    miss: 0,
    streak: 0,
    maxStreak: 0
  });

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const noteIdCounter = useRef(0);
  const lastNoteSpawn = useRef(0);
  const gameLoopRef = useRef<number>();
  const recentKeyPresses = useRef<MidiPressEvent[]>([]);
  const previousActiveMidiNotes = useRef<Set<number>>(new Set());

  // Convert MIDI note to lane index
  const noteToLane = useCallback((note: number): number => {
    return GAME_LANES.findIndex(lane => lane.note === note);
  }, []);

  // Calculate note position in pixels within the notes container
  const calculateNotePosition = useCallback((startTime: number, currentTime: number): number => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(1, elapsed / FALL_DURATION);
    const { NOTES_CONTAINER_HEIGHT } = getDynamicDimensions(gameAreaRef);
    return progress * NOTES_CONTAINER_HEIGHT;
  }, []);

  // Generate a random note within C4-C6 range
  const generateRandomNote = useCallback((): FallingNote => {
    const randomLane = Math.floor(Math.random() * GAME_LANES.length);
    const note = GAME_LANES[randomLane].note;
    
    return {
      id: `note-${noteIdCounter.current++}`,
      note,
      lane: randomLane,
      startTime: Date.now(),
      isHit: false,
      isMissed: false
    };
  }, []);

  // Add hit feedback
  const addHitFeedback = useCallback((type: 'perfect' | 'good' | 'miss', lane: number) => {
    const feedback: HitFeedback = {
      id: `feedback-${Date.now()}-${Math.random()}`,
      type,
      position: lane,
      timestamp: Date.now()
    };
    
    setHitFeedback(prev => [...prev, feedback]);
    
    // Remove feedback after animation
    setTimeout(() => {
      setHitFeedback(prev => prev.filter(f => f.id !== feedback.id));
    }, 1200);
  }, []);

  // Track key presses (note-on events)
  useEffect(() => {
    if (!isPlaying) return;

    const currentActiveNotes = new Set(activeMidiNotes.keys());
    const previousActive = previousActiveMidiNotes.current;
    
    // Find newly pressed keys (keys that are active now but weren't before)
    const newlyPressed = Array.from(currentActiveNotes).filter(note => !previousActive.has(note));
    
    // Record the key press events with timestamps
    newlyPressed.forEach(midiNote => {
      const lane = noteToLane(midiNote);
      if (lane !== -1) {
        const pressEvent: MidiPressEvent = {
          note: midiNote,
          timestamp: Date.now(),
          lane
        };
        recentKeyPresses.current.push(pressEvent);
        
        // Keep only recent presses (last 2 seconds)
        recentKeyPresses.current = recentKeyPresses.current.filter(
          press => Date.now() - press.timestamp < 2000
        );
      }
    });
    
    // Update previous state
    previousActiveMidiNotes.current = new Set(currentActiveNotes);
  }, [activeMidiNotes, isPlaying, noteToLane]);

  // Process hits based on key press timing
  useEffect(() => {
    if (!isPlaying || recentKeyPresses.current.length === 0) return;

    // Check each recent key press against falling notes
    recentKeyPresses.current.forEach(keyPress => {
      // Find notes in this lane that could be hit
      const hitTargets = fallingNotes.filter(note => 
        note.lane === keyPress.lane && 
        !note.isHit && 
        !note.isMissed
      );

      if (hitTargets.length === 0) return;

      // Find the closest note to the hit zone at the time of key press
      let bestNote: FallingNote | null = null;
      let bestTimingDiff = Infinity;

      hitTargets.forEach(note => {
        // Calculate where the note was (in pixels) when the key was pressed
        const notePositionAtPress = calculateNotePosition(note.startTime, keyPress.timestamp);
        
        // Get dynamic dimensions for current game area size
        const { HIT_ZONE_POSITION_PX, NOTES_CONTAINER_HEIGHT } = getDynamicDimensions(gameAreaRef);
        
        // Distance from hit zone center (in pixels)
        const distanceFromHitZone = Math.abs(notePositionAtPress - HIT_ZONE_POSITION_PX);
        
        // Convert pixel distance to timing difference (approximate)
        const timingDiffMs = (distanceFromHitZone / NOTES_CONTAINER_HEIGHT) * FALL_DURATION;
        
        if (timingDiffMs < bestTimingDiff) {
          bestNote = note;
          bestTimingDiff = timingDiffMs;
        }
      });

      if (bestNote && bestTimingDiff <= GOOD_WINDOW) {
        let hitType: 'perfect' | 'good';
        let points = 0;

        if (bestTimingDiff <= PERFECT_WINDOW) {
          hitType = 'perfect';
          points = 100;
        } else {
          hitType = 'good';
          points = 50;
        }

        // Mark note as hit
        setFallingNotes(prev => 
          prev.map(n => 
            n.id === bestNote!.id 
              ? { ...n, isHit: true }
              : n
          )
        );

        // Update score and combo
        setScore(prev => prev + points * Math.max(1, Math.floor(combo / 10)));
        setCombo(prev => prev + 1);
        
        setGameStats(prev => ({
          ...prev,
          [hitType]: prev[hitType] + 1,
          streak: prev.streak + 1,
          maxStreak: Math.max(prev.maxStreak, prev.streak + 1)
        }));

        // Add visual feedback
        addHitFeedback(hitType, keyPress.lane);

        console.log(`🎯 ${hitType.toUpperCase()}! Note: ${GAME_LANES[keyPress.lane].name}, Distance: ${bestTimingDiff.toFixed(1)}ms, Points: ${points}, Combo: ${combo + 1}`);
        
        // Remove this key press so it doesn't trigger multiple hits
        recentKeyPresses.current = recentKeyPresses.current.filter(
          press => press !== keyPress
        );
      }
    });
  }, [fallingNotes, isPlaying, combo, addHitFeedback, calculateNotePosition]);

  // Game loop
  useEffect(() => {
    if (!isPlaying) return;

    const gameLoop = () => {
      const currentTime = Date.now();

      // Spawn new notes (slightly less frequent due to more lanes)
      if (currentTime - lastNoteSpawn.current > 600 + Math.random() * 400) { // Random interval between 600-1000ms
        setFallingNotes(prev => [...prev, generateRandomNote()]);
        lastNoteSpawn.current = currentTime;
      }

      // Update falling notes and check for misses
      const { HIT_ZONE_POSITION_PX, HIT_ZONE_HEIGHT, NOTES_CONTAINER_HEIGHT } = getDynamicDimensions(gameAreaRef);
      
      setFallingNotes(prev => 
        prev.map(note => {
          const notePosition = calculateNotePosition(note.startTime, currentTime);
          
          // Check if note has passed the hit zone without being hit
          if (notePosition > HIT_ZONE_POSITION_PX + HIT_ZONE_HEIGHT && !note.isHit && !note.isMissed) {
            // Miss!
            setCombo(0);
            setGameStats(prevStats => ({
              ...prevStats,
              miss: prevStats.miss + 1,
              streak: 0
            }));
            addHitFeedback('miss', note.lane);
            console.log(`❌ MISS! Note: ${GAME_LANES[note.lane].name}`);
            return { ...note, isMissed: true };
          }
          
          return note;
        }).filter(note => {
          // Remove notes that are off-screen - this fixes the cleanup issue!
          const notePosition = calculateNotePosition(note.startTime, currentTime);
          return notePosition < NOTES_CONTAINER_HEIGHT + 50; // Keep for a bit after they pass
        })
      );

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [isPlaying, generateRandomNote, addHitFeedback, calculateNotePosition]);

  const startGame = () => {
    setIsPlaying(true);
    setScore(0);
    setCombo(0);
    setFallingNotes([]);
    setHitFeedback([]);
    setGameStats({
      perfect: 0,
      good: 0,
      miss: 0,
      streak: 0,
      maxStreak: 0
    });
    lastNoteSpawn.current = Date.now();
    recentKeyPresses.current = [];
    previousActiveMidiNotes.current = new Set();
    console.log('🎮 Full Keyboard Note Fall game started! (C4-C6)');
  };

  const stopGame = () => {
    setIsPlaying(false);
    recentKeyPresses.current = [];
    console.log('🎮 Note Fall game stopped!', gameStats);
  };

  const resetGame = () => {
    stopGame();
    setFallingNotes([]);
    setHitFeedback([]);
  };

  return (
    <div className="notefall-container">
      <div className="notefall-header">
        <h2>🎸 Cadence Note Fall</h2>
        <div className="game-controls">
          {!isPlaying ? (
            <button onClick={startGame} className="button primary">
              Start Game
            </button>
          ) : (
            <button onClick={stopGame} className="button secondary">
              Stop Game
            </button>
          )}
          <button onClick={resetGame} className="button secondary">
            Reset
          </button>
        </div>
      </div>

      <div className="game-stats">
        <div className="stat">
          <span className="stat-label">Score</span>
          <span className="stat-value">{score.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Combo</span>
          <span className="stat-value combo-value">{combo}x</span>
        </div>
        <div className="stat">
          <span className="stat-label">Streak</span>
          <span className="stat-value">{gameStats.streak}</span>
        </div>
      </div>

      <div className="detailed-stats">
        <div className="stat-item perfect">Perfect: {gameStats.perfect}</div>
        <div className="stat-item good">Good: {gameStats.good}</div>
        <div className="stat-item miss">Miss: {gameStats.miss}</div>
        <div className="stat-item">Max Streak: {gameStats.maxStreak}</div>
      </div>

      <div className="game-area" ref={gameAreaRef}>
        {/* Lane Headers - Guitar Hero Style */}
        <div className="lane-headers">
          {GAME_LANES.map((lane, index) => (
            <div 
              key={index}
              className={`lane-header ${activeMidiNotes.has(lane.note) ? 'active' : ''}`}
              style={{ '--lane-color': lane.color } as React.CSSProperties}
            >
              <div className="lane-note">{lane.name}</div>
              <div className="lane-indicator"></div>
            </div>
          ))}
        </div>

        {/* Falling Notes */}
        <div className="notes-container">
          {fallingNotes.map(note => {
            const currentTime = Date.now();
            const notePositionPx = calculateNotePosition(note.startTime, currentTime);
            const lane = GAME_LANES[note.lane];
            
            return (
              <div
                key={note.id}
                className={`falling-note ${note.isHit ? 'hit' : ''} ${note.isMissed ? 'missed' : ''}`}
                style={{
                  '--lane-index': note.lane,
                  '--lane-color': lane.color,
                  top: `${notePositionPx}px`,
                } as React.CSSProperties}
              >
                <div className="note-inner">
                  <div className="note-label">{lane.name}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hit Zone */}
        <div className="hit-zone" style={{ top: `${(() => {
          const { LANE_HEADER_HEIGHT, HIT_ZONE_POSITION_PX } = getDynamicDimensions(gameAreaRef);
          return LANE_HEADER_HEIGHT + HIT_ZONE_POSITION_PX;
        })()}px` }}>
          {GAME_LANES.map((_, index) => (
            <div 
              key={index} 
              className="hit-zone-lane"
            >
              <div className="hit-zone-indicator"></div>
            </div>
          ))}
        </div>

        {/* Hit Feedback */}
        {hitFeedback.map(feedback => (
          <div
            key={feedback.id}
            className={`hit-feedback ${feedback.type}`}
            style={{
              '--lane-index': feedback.position,
            } as React.CSSProperties}
          >
            {feedback.type === 'perfect' && '★ PERFECT!'}
            {feedback.type === 'good' && '✓ GOOD!'}
            {feedback.type === 'miss' && '✗ MISS!'}
          </div>
        ))}
      </div>

      <div className="game-instructions">
        <p>🎹 Play the highlighted keys as the glowing notes reach the hit zone!</p>
        <p>Full keyboard: C4 ({60}) to C6 ({84}) - {GAME_LANES.length} keys total</p>
        <p>Timing is everything - press at the RIGHT moment for maximum points!</p>
      </div>
    </div>
  );
} 