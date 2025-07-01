import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './NoteFall.css';

interface FallingNote {
  id: string;
  note: number;
  startTime: number;
  lane: number;
  isHit: boolean;
  isMissed: boolean;
  type: 'tap' | 'hold';
  duration: number; // Duration in milliseconds for hold notes, 0 for tap notes
  holdProgress: number; // For hold notes: 0-1 representing completion percentage
  isActivelyHeld: boolean; // Visual feedback for correctly held notes
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

interface ActiveHoldNote {
  noteId: string;
  startTime: number;
  expectedDuration: number;
  lane: number;
  startTimingQuality: 'perfect' | 'good' | 'late'; // Track how well-timed the start was
}

interface NoteFallProps {
  onMidiMessage: (note: number, isNoteOn: boolean) => void;
  activeMidiNotes: Map<number, { velocity: number; timestamp: number }>;
  noteRange?: {
    startOctave: number;
    endOctave: number;
  };
}

interface MusicXMLNote {
  midi_number: number;
  start_time_ms: number;
  duration_ms: number;
  pitch_name: string;
  velocity: number;
  measure: number;
  note_type: 'tap' | 'hold';
}

interface MusicXMLData {
  notes: MusicXMLNote[];
  metadata: {
    title?: string;
    composer?: string;
    copyright?: string;
  };
  tempo: number;
  total_duration: number;
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

// Generate game lanes based on configurable range
const generateGameLanes = (startOctave: number = 4, endOctave: number = 6) => {
  const notes = [];
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  for (let octave = startOctave; octave <= endOctave; octave++) {
    for (let i = 0; i < 12; i++) {
      const midiNote = octave * 12 + i + 12; // MIDI formula
      if (midiNote > 127) break; // MIDI note range limit
      
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
};

// --- Gameplay constants -----------------------------------------------------
// Delay (ms) between hitting "Play" and the first notes appearing.  Gives the
// player time to prepare and guarantees that initial notes spawn at the top of
// the play-field instead of mid-fall.
const SONG_START_DELAY_MS = 8000;

// Default time (ms) a note spends falling from the very top to the hit-zone.
const DEFAULT_FALL_DURATION = 6000;

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

export default function NoteFall({ activeMidiNotes, noteRange }: NoteFallProps) {
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
  // Fall duration is now stateful so tempo/speed can be tweaked mid-game.
  const [fallDuration, setFallDuration] = useState<number>(DEFAULT_FALL_DURATION);
  const [musicXMLData, setMusicXMLData] = useState<MusicXMLData | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [gameMode, setGameMode] = useState<'random' | 'musicxml'>('random');

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const noteIdCounter = useRef(0);
  const lastNoteSpawn = useRef(0);
  const gameLoopRef = useRef<number | null>(null);
  const recentKeyPresses = useRef<MidiPressEvent[]>([]);
  const previousActiveMidiNotes = useRef<Set<number>>(new Set());
  const activeHoldNotes = useRef<Map<number, ActiveHoldNote>>(new Map()); // lane -> active hold note

  // Generate game lanes based on note range
  const GAME_LANES = useMemo(() => {
    const startOctave = noteRange?.startOctave ?? 4;
    const endOctave = noteRange?.endOctave ?? 6;
    return generateGameLanes(startOctave, endOctave);
  }, [noteRange]);

  // Convert MIDI note to lane index
  const noteToLane = useCallback((note: number): number => {
    return GAME_LANES.findIndex(lane => lane.note === note);
  }, [GAME_LANES]);

  // Calculate note position in pixels within the notes container
  const calculateNotePosition = useCallback((startTime: number, currentTime: number): number => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(1, elapsed / fallDuration);
    const { NOTES_CONTAINER_HEIGHT } = getDynamicDimensions(gameAreaRef);
    return progress * NOTES_CONTAINER_HEIGHT;
  }, [fallDuration]);

  // Generate a random note within C4-C6 range
  const generateRandomNote = useCallback((): FallingNote => {
    const randomLane = Math.floor(Math.random() * GAME_LANES.length);
    const note = GAME_LANES[randomLane].note;
    
    // 70% chance for tap notes, 30% chance for hold notes
    const isHoldNote = Math.random() < 0.3;
    const noteType: 'tap' | 'hold' = isHoldNote ? 'hold' : 'tap';
    
    // Hold notes can be 500ms to 2000ms long
    const holdDuration = isHoldNote ? 500 + Math.random() * 1500 : 0;
    
    return {
      id: `note-${noteIdCounter.current++}`,
      note,
      lane: randomLane,
      startTime: Date.now(),
      isHit: false,
      isMissed: false,
      type: noteType,
      duration: holdDuration,
      holdProgress: 0,
      isActivelyHeld: false
    };
  }, []);

  const spawnedRef = useRef<Set<string>>(new Set());

  const createNoteFromMusicXML = useCallback(
    (m: MusicXMLNote, origin: number): FallingNote | null => {
      const lane = noteToLane(m.midi_number);
      if (lane === -1) return null;
  
      return {
        id: `${m.start_time_ms}-${m.midi_number}`,      // deterministic
        note: m.midi_number,
        lane,
        // enter the play-field exactly `fallDuration` ms before hit-time, plus
        // a global SONG_START_DELAY_MS so that the very first notes spawn only
        // after the countdown has finished.
        startTime: origin + SONG_START_DELAY_MS + m.start_time_ms - fallDuration,
        isHit: false,
        isMissed: false,
        type: m.note_type,
        duration: m.duration_ms,
        holdProgress: 0,
        isActivelyHeld: false
      };
    },
    [noteToLane, fallDuration]
  );
  

  // Handle MusicXML file selection
  const handleSelectMusicXMLFile = useCallback(async () => {
    try {
      setIsLoadingFile(true);
      const result = await window.electronAPI.selectMusicXMLFile();
      
      if (result.success && !result.canceled) {
        setSelectedFile(result.filePath);
        
        // Parse the selected file
        const parseResult = await window.electronAPI.parseMusicXML(result.filePath);
        
        if (parseResult.success) {
          setMusicXMLData(parseResult.data);
          setGameMode('musicxml');
          console.log('✅ MusicXML file loaded:', parseResult.data.metadata);
        } else {
          console.error('❌ Failed to parse MusicXML:', parseResult.error);
          alert(`Failed to parse MusicXML file: ${parseResult.error}`);
        }
      }
    } catch (error) {
      console.error('❌ Error selecting MusicXML file:', error);
      alert(`Error selecting file: ${error}`);
    } finally {
      setIsLoadingFile(false);
    }
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

  // Track key presses and releases for hold notes
  useEffect(() => {
    if (!isPlaying) return;

    const currentActiveNotes = new Set(activeMidiNotes.keys());
    const previousActive = previousActiveMidiNotes.current;
    
    // Find newly pressed keys (keys that are active now but weren't before)
    const newlyPressed = Array.from(currentActiveNotes).filter(note => !previousActive.has(note));
    
    // Find newly released keys (keys that were active but aren't now)
    const newlyReleased = Array.from(previousActive).filter(note => !currentActiveNotes.has(note));
    
    // Handle key presses
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
    
    // Handle key releases for hold notes
    newlyReleased.forEach(midiNote => {
      const lane = noteToLane(midiNote);
      if (lane !== -1 && activeHoldNotes.current.has(lane)) {
        const holdNote = activeHoldNotes.current.get(lane)!;
        const holdDuration = Date.now() - holdNote.startTime;
        const completionRatio = Math.min(1, holdDuration / holdNote.expectedDuration);
        
        // Evaluate hold note completion, factoring in start timing quality
        let hitType: 'perfect' | 'good' | 'miss';
        let points = 0;
        
        if (completionRatio >= 0.9) {
          // Perfect completion, but adjust based on start timing
          if (holdNote.startTimingQuality === 'perfect') {
            hitType = 'perfect';
            points = 150; // Full bonus for perfect start + perfect hold
          } else if (holdNote.startTimingQuality === 'good') {
            hitType = 'perfect';
            points = 125; // Slight reduction for good start
          } else {
            hitType = 'good'; // Late start caps at 'good' even with perfect hold
            points = 100;
          }
        } else if (completionRatio >= 0.7) {
          // Good completion
          if (holdNote.startTimingQuality === 'perfect') {
            hitType = 'good';
            points = 100;
          } else if (holdNote.startTimingQuality === 'good') {
            hitType = 'good';
            points = 85;
          } else {
            hitType = 'good'; // Late start with good completion
            points = 70;
          }
        } else {
          hitType = 'miss';
          points = 0;
        }
        
        // Mark the note as completed and update score
        setFallingNotes(prev => 
          prev.map(n => 
            n.id === holdNote.noteId 
              ? { ...n, isHit: true, holdProgress: completionRatio }
              : n
          )
        );
        
        if (points > 0) {
          setScore(prev => prev + points * Math.max(1, Math.floor(combo / 10)));
          setCombo(prev => prev + 1);
          
          setGameStats(prev => ({
            ...prev,
            [hitType]: prev[hitType] + 1,
            streak: prev.streak + 1,
            maxStreak: Math.max(prev.maxStreak, prev.streak + 1)
          }));
        } else {
          setCombo(0);
          setGameStats(prev => ({
            ...prev,
            miss: prev.miss + 1,
            streak: 0
          }));
        }
        
        addHitFeedback(hitType, lane);
        console.log(`🎵 HOLD ${hitType.toUpperCase()}! Start: ${holdNote.startTimingQuality}, Duration: ${holdDuration}ms/${holdNote.expectedDuration}ms (${Math.round(completionRatio * 100)}%), Points: ${points}`);
        
        // Remove from active holds
        activeHoldNotes.current.delete(lane);
      }
    });
    
    // Update previous state
    previousActiveMidiNotes.current = new Set(currentActiveNotes);
  }, [activeMidiNotes, isPlaying, noteToLane, combo, addHitFeedback]);

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
        if (note.type === 'tap') {
          // For tap notes, check center position as before
          const notePositionAtPress = calculateNotePosition(note.startTime, keyPress.timestamp);
          const { HIT_ZONE_POSITION_PX, NOTES_CONTAINER_HEIGHT } = getDynamicDimensions(gameAreaRef);
          const distanceFromHitZone = Math.abs(notePositionAtPress - HIT_ZONE_POSITION_PX);
          const timingDiffMs = (distanceFromHitZone / NOTES_CONTAINER_HEIGHT) * fallDuration;
          
          if (timingDiffMs < bestTimingDiff) {
            bestNote = note;
            bestTimingDiff = timingDiffMs;
          }
        } else if (note.type === 'hold') {
          // For hold notes, use pixel-based timing similar to tap notes
          const noteTopPosition = calculateNotePosition(note.startTime, keyPress.timestamp);
          const noteHeight = (note.duration / fallDuration) * getDynamicDimensions(gameAreaRef).NOTES_CONTAINER_HEIGHT;
          const noteBottomPosition = noteTopPosition + noteHeight;
          
          const { HIT_ZONE_POSITION_PX, HIT_ZONE_HEIGHT, NOTES_CONTAINER_HEIGHT } = getDynamicDimensions(gameAreaRef);
          const hitZoneTop = HIT_ZONE_POSITION_PX;
          const hitZoneBottom = HIT_ZONE_POSITION_PX + HIT_ZONE_HEIGHT;
          
          // Perfect timing: when bottom of note aligns with bottom of hit zone
          // This gives players more time to react and makes long notes more forgiving
          const idealBottomPosition = hitZoneBottom;
          const bottomDistanceFromIdeal = Math.abs(noteBottomPosition - idealBottomPosition);
          
          // Allow hitting when any part of the note overlaps or has recently passed through hit zone
          // Extended tolerance range since ideal timing is now later (at bottom of hit zone)
          const noteInOrNearHitZone = (noteBottomPosition >= hitZoneTop - 20) && // Allow early press when note first enters
                                      (noteTopPosition <= hitZoneBottom + 50); // Allow late press with more tolerance
          
          if (noteInOrNearHitZone) {
            // Calculate timing diff based on bottom position (ideal start point)
            const timingDiffMs = (bottomDistanceFromIdeal / NOTES_CONTAINER_HEIGHT) * fallDuration;
            
            // Extend timing window for hold notes to account for their length
            const extendedGoodWindow = GOOD_WINDOW + (note.duration * 0.1); // Add 10% of note duration to timing window
            
            if (timingDiffMs <= extendedGoodWindow) {
              if (timingDiffMs < bestTimingDiff) {
                bestNote = note;
                bestTimingDiff = timingDiffMs;
              }
            }
          }
        }
      });

      if (bestNote && bestTimingDiff <= GOOD_WINDOW) {
        // `bestNote` is guaranteed not to be null in this branch – create a
        // narrowed alias to appease TypeScript strict-null checks.
        const targetNote = bestNote as FallingNote;

        if (targetNote.type === 'tap') {
          // Handle tap notes (immediate hit)
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
              n.id === targetNote.id 
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
          console.log(`🎯 TAP ${hitType.toUpperCase()}! Note: ${GAME_LANES[keyPress.lane].name}, Distance: ${bestTimingDiff.toFixed(1)}ms, Points: ${points}, Combo: ${combo + 1}`);
          
        } else if (targetNote.type === 'hold') {
          // Handle hold notes (start tracking the hold)
          if (!activeHoldNotes.current.has(keyPress.lane)) {
            // Determine timing quality based on how close to ideal the start was
            // Use more granular timing for hold notes to provide better feedback
            let startTimingQuality: 'perfect' | 'good' | 'late';
            const extendedGoodWindow = GOOD_WINDOW + (targetNote.duration * 0.1);
            
            if (bestTimingDiff <= PERFECT_WINDOW) {
              startTimingQuality = 'perfect';
            } else if (bestTimingDiff <= GOOD_WINDOW) {
              startTimingQuality = 'good';
            } else if (bestTimingDiff <= extendedGoodWindow) {
              startTimingQuality = 'late'; // Still acceptable but marked as late
            } else {
              startTimingQuality = 'late'; // Very late but still within extended window
            }
            
            const holdNote: ActiveHoldNote = {
              noteId: targetNote.id,
              startTime: keyPress.timestamp,
              expectedDuration: targetNote.duration,
              lane: keyPress.lane,
              startTimingQuality: startTimingQuality
            };
            
            activeHoldNotes.current.set(keyPress.lane, holdNote);
            console.log(`🎵 HOLD STARTED (${startTimingQuality.toUpperCase()})! Note: ${GAME_LANES[keyPress.lane].name}, Expected duration: ${targetNote.duration}ms`);
          }
        }
        
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
      const gameStartTime = gameStartRef.current;      // constant for this run
      const elapsed = currentTime - gameStartTime;

      // ------------------------------------------------------------------
      // MUSICXML MODE – spawn notes just-in-time
      // ------------------------------------------------------------------
      if (gameMode === 'musicxml' && musicXMLData) {
        const tolerance = 30; // ms – small allowance for frame-timing jitter

        const upcoming = musicXMLData.notes.filter((n) => {
          // Absolute world-time (ms since epoch) at which this note should
          // *enter* the play-field (i.e. FALL_DURATION ms before its hit time).
          const spawnTime = gameStartTime + SONG_START_DELAY_MS + n.start_time_ms - fallDuration;

          return (
            spawnTime <= currentTime + tolerance &&
            !spawnedRef.current.has(`${n.start_time_ms}-${n.midi_number}`)
          );
        });

        if (upcoming.length) {
          const fresh = upcoming
            .map((n) => createNoteFromMusicXML(n, gameStartTime))
            .filter((x): x is FallingNote => x !== null);

          if (fresh.length) {
            setFallingNotes((prev) => [...prev, ...fresh]);
            fresh.forEach((n) => spawnedRef.current.add(n.id));
          }
        }
      }

      // Spawn new notes based on game mode
      if (gameMode === 'random') {
        // Random mode: spawn notes at random intervals
        if (currentTime - lastNoteSpawn.current > 600 + Math.random() * 400) {
          setFallingNotes((prev) => [...prev, generateRandomNote()]);
          lastNoteSpawn.current = currentTime;
        }
      }

      // Update falling notes and check for misses
      const { HIT_ZONE_POSITION_PX, HIT_ZONE_HEIGHT, NOTES_CONTAINER_HEIGHT } = getDynamicDimensions(gameAreaRef);
      
      setFallingNotes(prev => 
        prev.map(note => {
          const noteTopPosition = calculateNotePosition(note.startTime, currentTime);
          let updatedNote = { ...note };
          
          // Update hold progress and visual feedback for active hold notes
          if (note.type === 'hold' && activeHoldNotes.current.has(note.lane)) {
            const holdNote = activeHoldNotes.current.get(note.lane)!;
            if (holdNote.noteId === note.id) {
              const holdDuration = currentTime - holdNote.startTime;
              const progress = Math.min(1, holdDuration / holdNote.expectedDuration);
              
              // Check if the note is currently in the correct position for holding
              const noteHeight = (note.duration / fallDuration) * getDynamicDimensions(gameAreaRef).NOTES_CONTAINER_HEIGHT;
              const noteBottomPosition = noteTopPosition + noteHeight;
              const isInHitZone = noteBottomPosition >= HIT_ZONE_POSITION_PX && 
                                 noteTopPosition <= HIT_ZONE_POSITION_PX + HIT_ZONE_HEIGHT;
              
              updatedNote = { ...note, holdProgress: progress, isActivelyHeld: isInHitZone };
            }
          }
          
          // Check if note has passed the hit zone without being hit
          let notePassedHitZone = false;
          if (note.type === 'tap') {
            notePassedHitZone = noteTopPosition > HIT_ZONE_POSITION_PX + HIT_ZONE_HEIGHT;
          } else if (note.type === 'hold') {
            // For hold notes, only mark as missed if:
            // 1. The note has passed the hit zone AND
            // 2. The player is NOT actively holding the note
            const noteHeight = (note.duration / fallDuration) * getDynamicDimensions(gameAreaRef).NOTES_CONTAINER_HEIGHT;
            const noteBottomPosition = noteTopPosition + noteHeight;
            const tolerance = 50; // More generous tolerance for hold notes
            const hasPassedHitZone = noteBottomPosition > HIT_ZONE_POSITION_PX + HIT_ZONE_HEIGHT + tolerance;
            const isActivelyHeld = activeHoldNotes.current.has(note.lane);
            
            // Only mark as missed if passed hit zone AND not being actively held
            notePassedHitZone = hasPassedHitZone && !isActivelyHeld;
          }
          
          if (notePassedHitZone && !updatedNote.isHit && !updatedNote.isMissed) {
            // Miss!
            setCombo(0);
            setGameStats(prevStats => ({
              ...prevStats,
              miss: prevStats.miss + 1,
              streak: 0
            }));
            addHitFeedback('miss', updatedNote.lane);
            console.log(`❌ MISS! Note: ${GAME_LANES[updatedNote.lane].name}`);
            
            // Clean up any active hold tracking
            if (updatedNote.type === 'hold' && activeHoldNotes.current.has(updatedNote.lane)) {
              activeHoldNotes.current.delete(updatedNote.lane);
            }
            
            return { ...updatedNote, isMissed: true };
          }
          
          return updatedNote;
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
  }, [isPlaying, generateRandomNote, addHitFeedback, calculateNotePosition, gameMode, musicXMLData, createNoteFromMusicXML, fallingNotes, GAME_LANES]);

  const gameStartRef = useRef<number>(0);

  const startGame = () => {
    gameStartRef.current = Date.now();   // <-- NEW
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
    console.log(`🎮 Note Fall game started! Range: ${GAME_LANES[0]?.name} to ${GAME_LANES[GAME_LANES.length - 1]?.name} (${GAME_LANES.length} keys)`);
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
          <button 
            onClick={handleSelectMusicXMLFile} 
            disabled={isLoadingFile}
            className="button secondary"
          >
            {isLoadingFile ? 'Loading...' : 'Load MusicXML'}
          </button>
          <button 
            onClick={() => setGameMode('random')} 
            className={`button ${gameMode === 'random' ? 'primary' : 'secondary'}`}
          >
            Random Mode
          </button>
          {!isPlaying ? (
            <button onClick={startGame} className="button primary">
              {gameMode === 'musicxml' && musicXMLData ? 'Play Song' : 'Start Game'}
            </button>
          ) : (
            <button onClick={stopGame} className="button secondary">
              Stop Game
            </button>
          )}
          <button onClick={resetGame} className="button secondary">
            Reset
          </button>
          {/* Tempo / fall-speed control */}
          <label className="tempo-slider">
            Fall&nbsp;Time&nbsp;{(fallDuration / 1000).toFixed(1)} s
            <input
              type="range"
              min={2000}
              max={10000}
              step={500}
              value={fallDuration}
              onChange={(e) => setFallDuration(Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      {/* File Status Display */}
      {gameMode === 'musicxml' && (
        <div className="game-stats">
          <div className="stat">
            <span className="stat-label">Mode</span>
            <span className="stat-value">MusicXML</span>
          </div>
          {musicXMLData && (
            <>
              <div className="stat">
                <span className="stat-label">Title</span>
                <span className="stat-value">{musicXMLData.metadata.title || 'Unknown'}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Composer</span>
                <span className="stat-value">{musicXMLData.metadata.composer || 'Unknown'}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Tempo</span>
                <span className="stat-value">{musicXMLData.tempo} BPM</span>
              </div>
              <div className="stat">
                <span className="stat-label">Notes</span>
                <span className="stat-value">{musicXMLData.notes.length}</span>
              </div>
            </>
          )}
        </div>
      )}

      <div 
        className="game-area" 
        ref={gameAreaRef}
        style={{ '--total-lanes': GAME_LANES.length } as React.CSSProperties}
      >
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
            const { NOTES_CONTAINER_HEIGHT } = getDynamicDimensions(gameAreaRef);
            
            // Calculate note height based on type and duration
            let noteHeight = 45; // Default tap note height
            if (note.type === 'hold') {
              // Convert duration to pixels using same scale as falling speed
              const durationInPixels = (note.duration / fallDuration) * NOTES_CONTAINER_HEIGHT;
              noteHeight = Math.max(45, Math.min(200, durationInPixels)); // Min 45px, max 200px
            }
            
            return (
              <div
                key={note.id}
                className={`falling-note ${note.type} ${note.isHit ? 'hit' : ''} ${note.isMissed ? 'missed' : ''} ${note.isActivelyHeld ? 'actively-held' : ''}`}
                style={{
                  '--lane-index': note.lane,
                  '--lane-color': lane.color,
                  '--note-height': `${noteHeight}px`,
                  '--hold-progress': note.holdProgress,
                  top: `${notePositionPx}px`,
                  height: `${noteHeight}px`,
                } as React.CSSProperties}
              >
                <div className="note-inner">
                  <div className="note-label">
                    {lane.name}
                    {note.type === 'hold' && (
                      <div className="note-duration">
                        {Math.round(note.duration)}ms
                      </div>
                    )}
                  </div>
                  {note.type === 'hold' && (
                    <div className="hold-progress-bar">
                      <div 
                        className="hold-progress-fill"
                        style={{ height: `${note.holdProgress * 100}%` }}
                      />
                    </div>
                  )}
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
        <p>Note range: {GAME_LANES[0]?.name} ({GAME_LANES[0]?.note}) to {GAME_LANES[GAME_LANES.length - 1]?.name} ({GAME_LANES[GAME_LANES.length - 1]?.note}) - {GAME_LANES.length} keys total</p>
        <p>Timing is everything - press at the RIGHT moment for maximum points!</p>
      </div>
    </div>
  );
} 