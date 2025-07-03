import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Button from './Button';
import Metronome from './Metronome';

interface ScalePracticeProps {
  activeMidiNotes: Map<number, { note: number; velocity: number; timestamp: number }>;
  onMidiMessage: (message: any) => void;
}

// Scale definitions - MIDI note numbers relative to the root note
const SCALE_PATTERNS = {
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Natural Minor': [0, 2, 3, 5, 7, 8, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  'Melodic Minor': [0, 2, 3, 5, 7, 9, 11],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Pentatonic Major': [0, 2, 4, 7, 9],
  'Pentatonic Minor': [0, 3, 5, 7, 10],
  'Blues': [0, 3, 5, 6, 7, 10],
  'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'Whole Tone': [0, 2, 4, 6, 8, 10],
  'Diminished': [0, 2, 3, 5, 6, 8, 9, 11]
};

// Root notes (C through B)
const ROOT_NOTES = [
  { name: 'C', midi: 60 },
  { name: 'C#/Db', midi: 61 },
  { name: 'D', midi: 62 },
  { name: 'D#/Eb', midi: 63 },
  { name: 'E', midi: 64 },
  { name: 'F', midi: 65 },
  { name: 'F#/Gb', midi: 66 },
  { name: 'G', midi: 67 },
  { name: 'G#/Ab', midi: 68 },
  { name: 'A', midi: 69 },
  { name: 'A#/Bb', midi: 70 },
  { name: 'B', midi: 71 }
];

const OCTAVE_RANGES = [
  { name: '3rd-4th', startOctave: 3 },
  { name: '4th-5th', startOctave: 4 },
  { name: '5th-6th', startOctave: 5 },
  { name: '6th-7th', startOctave: 6 }
];

interface ScalePracticeState {
  isActive: boolean;
  currentScale: string;
  currentRoot: string;
  currentOctave: number;
  expectedNotes: number[];
  currentNoteIndex: number;
  isAscending: boolean;
  shouldPlayAscending: boolean;
  shouldPlayDescending: boolean;
  completedNotes: number[];
  score: number;
  consecutiveCorrect: number;
  startTime: number | null;
  totalNotes: number;
  correctNotes: number;
  lastNoteTime: number | null;
  metronomeBpm: number;
  isMetronomeEnabled: boolean;
  toleranceMs: number;
}

const ScalePractice: React.FC<ScalePracticeProps> = ({
  activeMidiNotes,
  onMidiMessage
}) => {
  const [practiceState, setPracticeState] = useState<ScalePracticeState>({
    isActive: false,
    currentScale: 'Major',
    currentRoot: 'C',
    currentOctave: 4,
    expectedNotes: [],
    currentNoteIndex: 0,
    isAscending: true,
    shouldPlayAscending: true,
    shouldPlayDescending: true,
    completedNotes: [],
    score: 0,
    consecutiveCorrect: 0,
    startTime: null,
    totalNotes: 0,
    correctNotes: 0,
    lastNoteTime: null,
    metronomeBpm: 120,
    isMetronomeEnabled: false,
    toleranceMs: 200 // 200ms tolerance for timing
  });

  const [lastBeatTime, setLastBeatTime] = useState<number | null>(null);

  // Convert MIDI note number to note name
  const noteNumberToName = (noteNumber: number): string => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteName = noteNames[noteNumber % 12];
    return `${noteName}${octave}`;
  };

  // Generate scale notes based on current settings
  const generateScaleNotes = useCallback(() => {
    const pattern = SCALE_PATTERNS[practiceState.currentScale as keyof typeof SCALE_PATTERNS];
    const rootNote = ROOT_NOTES.find(note => note.name.startsWith(practiceState.currentRoot));
    
    if (!pattern || !rootNote) return [];

    const startMidi = rootNote.midi + (practiceState.currentOctave - 4) * 12;
    let notes: number[] = [];

    if (practiceState.shouldPlayAscending) {
      // Add ascending notes
      notes = notes.concat(pattern.map(interval => startMidi + interval));
    }

    if (practiceState.shouldPlayDescending) {
      // Add descending notes (reverse pattern, skip the octave if we already played ascending)
      const descendingPattern = [...pattern].reverse();
      const startIndex = practiceState.shouldPlayAscending ? 1 : 0; // Skip octave if ascending was included
      notes = notes.concat(descendingPattern.slice(startIndex).map(interval => startMidi + interval));
    }

    return notes;
  }, [practiceState.currentScale, practiceState.currentRoot, practiceState.currentOctave, practiceState.shouldPlayAscending, practiceState.shouldPlayDescending]);

  // Start scale practice
  const startPractice = useCallback(() => {
    const notes = generateScaleNotes();
    if (notes.length === 0) return;

    setPracticeState(prev => ({
      ...prev,
      isActive: true,
      expectedNotes: notes,
      currentNoteIndex: 0,
      completedNotes: [],
      startTime: Date.now(),
      totalNotes: notes.length,
      correctNotes: 0,
      lastNoteTime: null
    }));

    setLastBeatTime(Date.now());

    (window as any).showToast?.({
      type: 'info',
      title: 'Scale Practice Started!',
      message: `Practice ${practiceState.currentScale} scale in ${practiceState.currentRoot}`,
      duration: 3000
    });
  }, [generateScaleNotes, practiceState.currentScale, practiceState.currentRoot]);

  // Stop practice
  const stopPractice = useCallback(() => {
    const accuracy = practiceState.totalNotes > 0 ? (practiceState.correctNotes / practiceState.totalNotes) * 100 : 0;
    const duration = practiceState.startTime ? (Date.now() - practiceState.startTime) / 1000 : 0;

    setPracticeState(prev => ({
      ...prev,
      isActive: false,
      currentNoteIndex: 0,
      completedNotes: [],
      startTime: null,
      lastNoteTime: null
    }));

    setLastBeatTime(null);

    (window as any).showToast?.({
      type: 'success',
      title: 'Practice Complete!',
      message: `Accuracy: ${accuracy.toFixed(1)}% | Duration: ${duration.toFixed(1)}s`,
      duration: 4000
    });
  }, [practiceState.totalNotes, practiceState.correctNotes, practiceState.startTime]);

  // Handle MIDI input
  useEffect(() => {
    if (!practiceState.isActive) return;

    const currentExpectedNote = practiceState.expectedNotes[practiceState.currentNoteIndex];
    if (currentExpectedNote === undefined) return;

    // Check if the expected note is currently being played
    const isCorrectNotePressed = activeMidiNotes.has(currentExpectedNote);
    
    if (isCorrectNotePressed) {
      const currentTime = Date.now();
      let isOnTime = true;

      // Check timing if metronome is enabled
      if (practiceState.isMetronomeEnabled && lastBeatTime) {
        const beatInterval = (60 / practiceState.metronomeBpm) * 1000;
        const timeSinceLastBeat = currentTime - lastBeatTime;
        const expectedBeatTime = Math.round(timeSinceLastBeat / beatInterval) * beatInterval;
        const timingError = Math.abs(timeSinceLastBeat - expectedBeatTime);
        
        isOnTime = timingError <= practiceState.toleranceMs;
      }

      // Move to next note
      setPracticeState(prev => {
        const newCorrectNotes = prev.correctNotes + (isOnTime ? 1 : 0);
        const newCompletedNotes = [...prev.completedNotes, currentExpectedNote];
        const newIndex = prev.currentNoteIndex + 1;
        const newConsecutiveCorrect = isOnTime ? prev.consecutiveCorrect + 1 : 0;

        return {
          ...prev,
          currentNoteIndex: newIndex,
          completedNotes: newCompletedNotes,
          correctNotes: newCorrectNotes,
          consecutiveCorrect: newConsecutiveCorrect,
          score: prev.score + (isOnTime ? 10 : 5),
          lastNoteTime: currentTime
        };
      });

      // Show timing feedback
      if (practiceState.isMetronomeEnabled) {
        const feedbackType = isOnTime ? 'success' : 'warning';
        const feedbackMessage = isOnTime ? 'Perfect timing!' : 'Note the timing!';
        
        (window as any).showToast?.({
          type: feedbackType,
          title: feedbackMessage,
          message: `${noteNumberToName(currentExpectedNote)} played`,
          duration: 1000
        });
      }

      // Check if scale is complete
      if (practiceState.currentNoteIndex + 1 >= practiceState.expectedNotes.length) {
        setTimeout(stopPractice, 500);
      }
    }
  }, [activeMidiNotes, practiceState, lastBeatTime, stopPractice]);

  // Update beat time when metronome ticks
  const handleMetronomeClick = useCallback(() => {
    if (practiceState.isActive && practiceState.isMetronomeEnabled) {
      setLastBeatTime(Date.now());
    }
  }, [practiceState.isActive, practiceState.isMetronomeEnabled]);

  // Metronome with beat callback
  const MetronomeWithCallback = useMemo(() => {
    return (
      <div style={{ position: 'relative' }}>
        <Metronome
          initialBpm={practiceState.metronomeBpm}
          onBpmChange={(bpm) => setPracticeState(prev => ({ ...prev, metronomeBpm: bpm }))}
        />
        {practiceState.isMetronomeEnabled && (
          <div style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 1000
          }}>
            <div
              style={{
                width: '4px',
                height: '4px',
                backgroundColor: '#ff0000',
                borderRadius: '50%',
                opacity: lastBeatTime && (Date.now() - lastBeatTime) < 100 ? 1 : 0,
                transition: 'opacity 0.1s ease'
              }}
            />
          </div>
        )}
      </div>
    );
  }, [practiceState.metronomeBpm, practiceState.isMetronomeEnabled, lastBeatTime]);

  // Calculate progress
  const progress = practiceState.expectedNotes.length > 0 
    ? (practiceState.currentNoteIndex / practiceState.expectedNotes.length) * 100 
    : 0;

  const accuracy = practiceState.totalNotes > 0 
    ? (practiceState.correctNotes / practiceState.totalNotes) * 100 
    : 0;

  return (
    <div style={{ 
      padding: '20px', 
      height: '100%', 
      overflow: 'auto',
      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(56, 189, 248, 0.1) 50%, rgba(34, 197, 94, 0.1) 100%)'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ 
          fontSize: '2rem', 
          marginBottom: '30px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #3b82f6, #10b981)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          🎼 Scale Practice
        </h2>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '20px',
          marginBottom: '30px'
        }}>
          {/* Scale Configuration */}
          <div className="section">
            <h3>Scale Configuration</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Scale Type:</label>
                <select 
                  value={practiceState.currentScale}
                  onChange={(e) => setPracticeState(prev => ({ ...prev, currentScale: e.target.value }))}
                  disabled={practiceState.isActive}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #4a5568',
                    backgroundColor: '#2d3748',
                    color: '#ffffff'
                  }}
                >
                  {Object.keys(SCALE_PATTERNS).map(scale => (
                    <option key={scale} value={scale}>{scale}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Root Note:</label>
                <select 
                  value={practiceState.currentRoot}
                  onChange={(e) => setPracticeState(prev => ({ ...prev, currentRoot: e.target.value }))}
                  disabled={practiceState.isActive}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #4a5568',
                    backgroundColor: '#2d3748',
                    color: '#ffffff'
                  }}
                >
                  {ROOT_NOTES.map(note => (
                    <option key={note.name} value={note.name.split('/')[0]}>{note.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Octave Range:</label>
              <select 
                value={practiceState.currentOctave}
                onChange={(e) => setPracticeState(prev => ({ ...prev, currentOctave: parseInt(e.target.value) }))}
                disabled={practiceState.isActive}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #4a5568',
                  backgroundColor: '#2d3748',
                  color: '#ffffff'
                }}
              >
                {OCTAVE_RANGES.map(range => (
                  <option key={range.name} value={range.startOctave}>{range.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Direction:</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input
                    type="checkbox"
                    checked={practiceState.shouldPlayAscending}
                    onChange={(e) => setPracticeState(prev => ({ ...prev, shouldPlayAscending: e.target.checked }))}
                    disabled={practiceState.isActive}
                  />
                  Ascending
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input
                    type="checkbox"
                    checked={practiceState.shouldPlayDescending}
                    onChange={(e) => setPracticeState(prev => ({ ...prev, shouldPlayDescending: e.target.checked }))}
                    disabled={practiceState.isActive}
                  />
                  Descending
                </label>
              </div>
            </div>
          </div>

          {/* Metronome Controls */}
          <div className="section">
            <h3>Metronome & Timing</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={practiceState.isMetronomeEnabled}
                  onChange={(e) => setPracticeState(prev => ({ ...prev, isMetronomeEnabled: e.target.checked }))}
                />
                <span style={{ fontWeight: 'bold' }}>Enable Metronome Timing</span>
              </label>
              <p style={{ fontSize: '0.9rem', color: '#a0aec0', margin: '5px 0' }}>
                When enabled, notes must be played in time with the metronome beats
              </p>
            </div>

            {MetronomeWithCallback}

            {practiceState.isMetronomeEnabled && (
              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Timing Tolerance: {practiceState.toleranceMs}ms
                </label>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="50"
                  value={practiceState.toleranceMs}
                  onChange={(e) => setPracticeState(prev => ({ ...prev, toleranceMs: parseInt(e.target.value) }))}
                  style={{ width: '100%', accentColor: '#3b82f6' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#a0aec0' }}>
                  <span>Strict</span>
                  <span>Relaxed</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Practice Status */}
        {practiceState.isActive && (
          <div className="section" style={{ marginBottom: '20px' }}>
            <h3>Practice Status</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div className="stat">
                <span className="stat-label">Progress:</span>
                <span className="stat-value">{Math.round(progress)}%</span>
              </div>
              <div className="stat">
                <span className="stat-label">Score:</span>
                <span className="stat-value">{practiceState.score}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Accuracy:</span>
                <span className="stat-value">{Math.round(accuracy)}%</span>
              </div>
              <div className="stat">
                <span className="stat-label">Streak:</span>
                <span className="stat-value">{practiceState.consecutiveCorrect}</span>
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <div style={{ 
                width: '100%', 
                height: '8px', 
                backgroundColor: '#2d3748', 
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${progress}%`, 
                  height: '100%', 
                  backgroundColor: '#10b981',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>
        )}

        {/* Current Scale Display */}
        <div className="section" style={{ marginBottom: '20px' }}>
          <h3>
            {practiceState.currentScale} Scale in {practiceState.currentRoot}
            {practiceState.isActive && (
              <span style={{ marginLeft: '10px', fontSize: '0.9rem', color: '#10b981' }}>
                🎯 Active
              </span>
            )}
          </h3>
          
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '8px',
            marginBottom: '15px'
          }}>
            {generateScaleNotes().map((note, index) => {
              const isCompleted = practiceState.completedNotes.includes(note);
              const isCurrent = practiceState.isActive && index === practiceState.currentNoteIndex;
              const isPressed = activeMidiNotes.has(note);
              
              return (
                <div
                  key={`${note}-${index}`}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: isCurrent ? '#3b82f6' : isCompleted ? '#10b981' : '#374151',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    border: isPressed ? '2px solid #fbbf24' : '2px solid transparent',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  {noteNumberToName(note)}
                  {isCurrent && (
                    <span style={{ 
                      position: 'absolute', 
                      top: '-8px', 
                      right: '-8px', 
                      fontSize: '1.2rem' 
                    }}>
                      👆
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {practiceState.isActive && (
            <div style={{ 
              padding: '15px', 
              backgroundColor: '#1f2937', 
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '1.1rem' }}>
                <strong>Next Note:</strong> {' '}
                {practiceState.currentNoteIndex < practiceState.expectedNotes.length ? 
                  noteNumberToName(practiceState.expectedNotes[practiceState.currentNoteIndex]) : 
                  'Complete!'
                }
              </p>
              {practiceState.isMetronomeEnabled && (
                <p style={{ margin: '0', fontSize: '0.9rem', color: '#a0aec0' }}>
                  Play in time with the metronome beats
                </p>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
          {!practiceState.isActive ? (
            <Button
              onClick={startPractice}
              variant="gradient"
              size="large"
              leftIcon="🎯"
              animated
              disabled={!practiceState.shouldPlayAscending && !practiceState.shouldPlayDescending}
            >
              Start Practice
            </Button>
          ) : (
            <Button
              onClick={stopPractice}
              variant="danger"
              size="large"
              leftIcon="⏹"
              animated
            >
              Stop Practice
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScalePractice; 