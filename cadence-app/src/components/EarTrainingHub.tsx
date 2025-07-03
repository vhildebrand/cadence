import React, { useState, useEffect, useCallback, useRef } from 'react';
import './EarTrainingHub.css';
import { EarTrainingStatsManager } from '../utils/EarTrainingStats';
import type { EarTrainingStats } from '../utils/EarTrainingStats';

interface ActiveNote {
  note: number;
  velocity: number;
  timestamp: number;
}



interface Exercise {
  id: string;
  type: 'single-note' | 'interval' | 'chord';
  notes: number[];
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
}

interface EarTrainingHubProps {
  activeMidiNotes: Map<number, ActiveNote>;
  onMidiMessage?: (note: number, isNoteOn: boolean) => void;
}

const EarTrainingHub: React.FC<EarTrainingHubProps> = ({ 
  activeMidiNotes, 
  onMidiMessage 
}) => {
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWaitingForAnswer, setIsWaitingForAnswer] = useState(false);
  const [userAnswer, setUserAnswer] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<string>('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [stats, setStats] = useState<EarTrainingStats>(EarTrainingStatsManager.getStats());
  const [exerciseType, setExerciseType] = useState<'single-note' | 'interval' | 'chord'>('single-note');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [isExerciseActive, setIsExerciseActive] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Initialize Web Audio API
  useEffect(() => {
    const initAudio = async () => {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
        gainNodeRef.current.gain.value = 0.3; // Set volume
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
      }
    };

    initAudio();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Generate exercises based on type and difficulty
  const generateExercise = useCallback((type: 'single-note' | 'interval' | 'chord', difficulty: 'easy' | 'medium' | 'hard'): Exercise => {
    const baseNote = 60; // Middle C
    
    switch (type) {
      case 'single-note':
        const noteRange = difficulty === 'easy' ? 12 : difficulty === 'medium' ? 24 : 36;
        const randomNote = baseNote + Math.floor(Math.random() * noteRange) - Math.floor(noteRange / 2);
        return {
          id: `single-${Date.now()}`,
          type: 'single-note',
          notes: [randomNote],
          difficulty,
          description: `Play the note you hear`
        };
      
      case 'interval':
        const intervals = difficulty === 'easy' 
          ? [2, 3, 4, 5, 7, 8] // Major 2nd, minor 3rd, major 3rd, perfect 4th, perfect 5th, octave
          : difficulty === 'medium'
          ? [2, 3, 4, 5, 6, 7, 8, 9, 10] // Add minor 6th, major 6th, minor 7th, major 7th
          : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // All intervals up to octave
        
        const interval = intervals[Math.floor(Math.random() * intervals.length)];
        const direction = Math.random() > 0.5 ? 1 : -1; // Up or down
        const startNote = baseNote + Math.floor(Math.random() * 12);
        const endNote = startNote + (interval * direction);
        
        return {
          id: `interval-${Date.now()}`,
          type: 'interval',
          notes: [startNote, endNote],
          difficulty,
          description: `Play the interval you hear (${interval} semitones ${direction > 0 ? 'up' : 'down'})`
        };
      
      case 'chord':
        const chordTypes = difficulty === 'easy'
          ? ['major', 'minor']
          : difficulty === 'medium'
          ? ['major', 'minor', 'diminished', 'augmented']
          : ['major', 'minor', 'diminished', 'augmented', 'major7', 'minor7', 'dominant7'];
        
        const chordType = chordTypes[Math.floor(Math.random() * chordTypes.length)];
        const rootNote = baseNote + Math.floor(Math.random() * 12);
        let chordNotes: number[];
        
        switch (chordType) {
          case 'major':
            chordNotes = [rootNote, rootNote + 4, rootNote + 7];
            break;
          case 'minor':
            chordNotes = [rootNote, rootNote + 3, rootNote + 7];
            break;
          case 'diminished':
            chordNotes = [rootNote, rootNote + 3, rootNote + 6];
            break;
          case 'augmented':
            chordNotes = [rootNote, rootNote + 4, rootNote + 8];
            break;
          case 'major7':
            chordNotes = [rootNote, rootNote + 4, rootNote + 7, rootNote + 11];
            break;
          case 'minor7':
            chordNotes = [rootNote, rootNote + 3, rootNote + 7, rootNote + 10];
            break;
          case 'dominant7':
            chordNotes = [rootNote, rootNote + 4, rootNote + 7, rootNote + 10];
            break;
          default:
            chordNotes = [rootNote, rootNote + 4, rootNote + 7];
        }
        
        return {
          id: `chord-${Date.now()}`,
          type: 'chord',
          notes: chordNotes,
          difficulty,
          description: `Play the ${chordType} chord you hear`
        };
      
      default:
        return {
          id: `single-${Date.now()}`,
          type: 'single-note',
          notes: [baseNote],
          difficulty,
          description: `Play the note you hear`
        };
    }
  }, []);

  // Play a note using Web Audio API
  const playNote = useCallback((noteNumber: number, duration: number = 1000) => {
    if (!audioContextRef.current || !gainNodeRef.current) return;

    const frequency = 440 * Math.pow(2, (noteNumber - 69) / 12);
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(gainNodeRef.current);
    
    oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
    oscillator.type = 'sine';
    
    // Envelope
    gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContextRef.current.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration / 1000);
    
    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + duration / 1000);
  }, []);

  // Play an exercise
  const playExercise = useCallback(async (exercise: Exercise) => {
    if (!exercise) return;
    
    setIsPlaying(true);
    
    if (exercise.type === 'single-note') {
      playNote(exercise.notes[0], 1500);
    } else if (exercise.type === 'interval') {
      // Play first note
      playNote(exercise.notes[0], 800);
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Play second note
      playNote(exercise.notes[1], 800);
    } else if (exercise.type === 'chord') {
      // Play all notes in the chord simultaneously
      exercise.notes.forEach(note => playNote(note, 1500));
    }
    
    setTimeout(() => {
      setIsPlaying(false);
      setIsWaitingForAnswer(true);
    }, exercise.type === 'interval' ? 2000 : 1500);
  }, [playNote]);

  // Start a new exercise
  const startExercise = useCallback(() => {
    const exercise = generateExercise(exerciseType, difficulty);
    setCurrentExercise(exercise);
    setUserAnswer([]);
    setFeedback('');
    setIsCorrect(null);
    setIsExerciseActive(true);
    setIsWaitingForAnswer(false);
    
    // Play the exercise after a short delay
    setTimeout(() => {
      playExercise(exercise);
    }, 500);
  }, [exerciseType, difficulty, generateExercise, playExercise]);

  // Check user answer
  const checkAnswer = useCallback(() => {
    if (!currentExercise || !isWaitingForAnswer) return;
    
    const userNotes = Array.from(activeMidiNotes.keys()).sort();
    const expectedNotes = [...currentExercise.notes].sort();
    
    const isAnswerCorrect = userNotes.length === expectedNotes.length &&
      userNotes.every((note, index) => note === expectedNotes[index]);
    
    setIsCorrect(isAnswerCorrect);
    
    if (isAnswerCorrect) {
      setFeedback('✅ Correct! Well done!');
    } else {
      setFeedback(`❌ Incorrect. Expected: ${expectedNotes.map(n => noteNumberToName(n)).join(', ')}. You played: ${userNotes.map(n => noteNumberToName(n)).join(', ')}`);
    }

    // Save session to persistent storage
    EarTrainingStatsManager.addSession({
      exerciseType: currentExercise.type,
      difficulty: currentExercise.difficulty,
      correct: isAnswerCorrect,
      expectedNotes: currentExercise.notes,
      userNotes: userNotes
    });

    // Update local stats
    setStats(EarTrainingStatsManager.getStats());
    
    setIsWaitingForAnswer(false);
  }, [currentExercise, isWaitingForAnswer, activeMidiNotes]);

  // Auto-check answer when user plays the expected number of notes
  useEffect(() => {
    if (isWaitingForAnswer && currentExercise) {
      const userNotes = Array.from(activeMidiNotes.keys());
      const expectedCount = currentExercise.notes.length;
      
      if (userNotes.length === expectedCount) {
        // Small delay to allow for chord input
        const timeoutId = setTimeout(() => {
          checkAnswer();
        }, 500);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [activeMidiNotes, isWaitingForAnswer, currentExercise, checkAnswer]);

  // Reset exercise
  const resetExercise = useCallback(() => {
    setCurrentExercise(null);
    setUserAnswer([]);
    setFeedback('');
    setIsCorrect(null);
    setIsExerciseActive(false);
    setIsWaitingForAnswer(false);
    setIsPlaying(false);
  }, []);

  // Helper function to convert MIDI note number to note name
  const noteNumberToName = (noteNumber: number): string => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteName = noteNames[noteNumber % 12];
    return `${noteName}${octave}`;
  };

  // Calculate accuracy percentage
  const accuracyPercentage = Math.round(stats.averageAccuracy);

  return (
    <div className="ear-training-hub">
      <div className="hub-header">
        <h2>🎵 Ear Training Hub</h2>
        <p>Listen to notes, intervals, and chords, then play them back on your MIDI keyboard</p>
      </div>

      {/* Statistics */}
      <div className="stats-panel">
        <div className="stat-card">
          <div className="stat-value">{stats.totalSessions}</div>
          <div className="stat-label">Total Exercises</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{accuracyPercentage}%</div>
          <div className="stat-label">Accuracy</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.currentStreak}</div>
          <div className="stat-label">Current Streak</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.bestStreak}</div>
          <div className="stat-label">Best Streak</div>
        </div>
      </div>

      {/* Exercise Configuration */}
      <div className="exercise-config">
        <div className="config-group">
          <label>Exercise Type:</label>
          <select 
            value={exerciseType} 
            onChange={(e) => setExerciseType(e.target.value as 'single-note' | 'interval' | 'chord')}
            disabled={isExerciseActive}
          >
            <option value="single-note">Single Note</option>
            <option value="interval">Interval</option>
            <option value="chord">Chord</option>
          </select>
        </div>
        
        <div className="config-group">
          <label>Difficulty:</label>
          <select 
            value={difficulty} 
            onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
            disabled={isExerciseActive}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Exercise Area */}
      <div className="exercise-area">
        {!isExerciseActive ? (
          <div className="start-exercise">
            <button 
              onClick={startExercise}
              className="start-button"
              disabled={activeMidiNotes.size > 0}
            >
              Start Exercise
            </button>
            {activeMidiNotes.size > 0 && (
              <p className="warning">Release all keys before starting</p>
            )}
          </div>
        ) : (
          <div className="exercise-active">
            {currentExercise && (
              <div className="exercise-info">
                <h3>Current Exercise</h3>
                <p className="exercise-description">{currentExercise.description}</p>
                <p className="exercise-type">
                  Type: {currentExercise.type.replace('-', ' ').toUpperCase()} | 
                  Difficulty: {currentExercise.difficulty.toUpperCase()}
                </p>
              </div>
            )}

            <div className="exercise-controls">
              {!isWaitingForAnswer && !isPlaying && (
                <button 
                  onClick={() => playExercise(currentExercise!)}
                  className="play-button"
                >
                  🔊 Play Again
                </button>
              )}
              
              {isPlaying && (
                <div className="playing-indicator">
                  🔊 Playing...
                </div>
              )}
              
              {isWaitingForAnswer && (
                <div className="waiting-for-answer">
                  <div className="listening-indicator">🎹 Listening for your answer...</div>
                  <div className="answer-controls">
                    <button 
                      onClick={() => playExercise(currentExercise!)}
                      className="play-button"
                      disabled={isPlaying}
                    >
                      🔊 Replay
                    </button>
                    <button 
                      onClick={checkAnswer}
                      className="check-button"
                      disabled={activeMidiNotes.size === 0}
                    >
                      Check Answer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Input Display */}
            <div className="user-input-display">
              <h4>Your Input:</h4>
              <div className="input-notes">
                {activeMidiNotes.size > 0 ? (
                  Array.from(activeMidiNotes.keys()).sort().map((note) => (
                    <span key={note} className="input-note">
                      {noteNumberToName(note)}
                    </span>
                  ))
                ) : (
                  <span className="no-input">No keys pressed</span>
                )}
              </div>
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
                <p>{feedback}</p>
                <div className="feedback-actions">
                  <button onClick={startExercise} className="next-button">
                    Next Exercise
                  </button>
                  <button onClick={resetExercise} className="reset-button">
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="instructions">
        <h3>How to Play:</h3>
        <ol>
          <li>Choose your exercise type and difficulty</li>
          <li>Click "Start Exercise" to begin</li>
          <li>Listen carefully to the notes/chords played</li>
          <li>Play the same notes on your MIDI keyboard</li>
          <li>Your answer will be automatically checked when you play the correct number of notes</li>
          <li>Or click "Check Answer" to manually submit</li>
        </ol>
      </div>
    </div>
  );
};

export default EarTrainingHub; 