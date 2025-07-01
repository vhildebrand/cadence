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

interface NoteFallProps {
  onMidiMessage: (note: number, isNoteOn: boolean) => void;
  activeMidiNotes: Map<number, any>;
}

// Define the lanes (keys we'll use for the game)
const GAME_LANES = [
  { note: 60, name: 'C4', color: '#ff4444' },  // C4 - Red
  { note: 62, name: 'D4', color: '#ff8844' },  // D4 - Orange  
  { note: 64, name: 'E4', color: '#ffff44' },  // E4 - Yellow
  { note: 65, name: 'F4', color: '#44ff44' },  // F4 - Green
  { note: 67, name: 'G4', color: '#4444ff' },  // G4 - Blue
];

const FALL_DURATION = 3000; // 3 seconds for note to fall
const HIT_ZONE_HEIGHT = 60; // Height of the hit zone in pixels
const PERFECT_WINDOW = 100; // Perfect timing window in ms
const GOOD_WINDOW = 200; // Good timing window in ms

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

  // Convert MIDI note to lane index
  const noteToLane = useCallback((note: number): number => {
    return GAME_LANES.findIndex(lane => lane.note === note);
  }, []);

  // Generate a random note
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
    }, 1000);
  }, []);

  // Check for hits when MIDI input changes
  useEffect(() => {
    if (!isPlaying) return;

    const currentTime = Date.now();
    const activeNotes = Array.from(activeMidiNotes.keys());

    activeNotes.forEach(midiNote => {
      const lane = noteToLane(midiNote);
      if (lane === -1) return; // Note not in our game lanes

      // Find notes in this lane that could be hit
      const hitTargets = fallingNotes.filter(note => 
        note.lane === lane && 
        !note.isHit && 
        !note.isMissed
      );

      if (hitTargets.length === 0) return;

      // Find the closest note to the hit zone
      let closestNote = hitTargets[0];
      let closestDistance = Infinity;

      hitTargets.forEach(note => {
        const notePosition = ((currentTime - note.startTime) / FALL_DURATION) * 100;
        const distance = Math.abs(notePosition - 85); // 85% is roughly the hit zone
        if (distance < closestDistance) {
          closestDistance = distance;
          closestNote = note;
        }
      });

      // Check if the note is in the hit window
      const notePosition = ((currentTime - closestNote.startTime) / FALL_DURATION) * 100;
      const hitZoneCenter = 85; // Percentage down the screen
      const positionDiff = Math.abs(notePosition - hitZoneCenter);

      // Convert position difference to timing (rough approximation)
      const timingDiff = (positionDiff / 100) * FALL_DURATION;

      let hitType: 'perfect' | 'good' | 'miss' | null = null;
      let points = 0;

      if (timingDiff <= PERFECT_WINDOW) {
        hitType = 'perfect';
        points = 100;
      } else if (timingDiff <= GOOD_WINDOW) {
        hitType = 'good';
        points = 50;
      }

      if (hitType) {
        // Mark note as hit
        setFallingNotes(prev => 
          prev.map(n => 
            n.id === closestNote.id 
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
        addHitFeedback(hitType, lane);

        console.log(`🎯 ${hitType.toUpperCase()}! Note: ${GAME_LANES[lane].name}, Points: ${points}, Combo: ${combo + 1}`);
      }
    });
  }, [activeMidiNotes, fallingNotes, isPlaying, noteToLane, combo, addHitFeedback]);

  // Game loop
  useEffect(() => {
    if (!isPlaying) return;

    const gameLoop = () => {
      const currentTime = Date.now();

      // Spawn new notes
      if (currentTime - lastNoteSpawn.current > 800 + Math.random() * 400) { // Random interval between 800-1200ms
        setFallingNotes(prev => [...prev, generateRandomNote()]);
        lastNoteSpawn.current = currentTime;
      }

      // Update falling notes and check for misses
      setFallingNotes(prev => 
        prev.map(note => {
          const notePosition = ((currentTime - note.startTime) / FALL_DURATION) * 100;
          
          // Check if note has passed the hit zone without being hit
          if (notePosition > 95 && !note.isHit && !note.isMissed) {
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
          // Remove notes that are off-screen
          const notePosition = ((currentTime - note.startTime) / FALL_DURATION) * 100;
          return notePosition < 110; // Keep for a bit after they pass
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
  }, [isPlaying, generateRandomNote, addHitFeedback]);

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
    console.log('🎮 Note Fall game started!');
  };

  const stopGame = () => {
    setIsPlaying(false);
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
        <h2>🎸 Note Fall</h2>
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
        {/* Lane Headers */}
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
            const progress = Math.min(100, ((currentTime - note.startTime) / FALL_DURATION) * 100);
            const lane = GAME_LANES[note.lane];
            
            return (
              <div
                key={note.id}
                className={`falling-note ${note.isHit ? 'hit' : ''} ${note.isMissed ? 'missed' : ''}`}
                style={{
                  '--lane-index': note.lane,
                  '--progress': `${progress}%`,
                  '--lane-color': lane.color,
                } as React.CSSProperties}
              >
                <div className="note-inner"></div>
              </div>
            );
          })}
        </div>

        {/* Hit Zone */}
        <div className="hit-zone">
          {GAME_LANES.map((_, index) => (
            <div key={index} className="hit-zone-lane">
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
        <p>🎹 Play the highlighted keys as the notes reach the bottom bar!</p>
        <p>Use keys: {GAME_LANES.map(lane => lane.name).join(', ')}</p>
      </div>
    </div>
  );
} 