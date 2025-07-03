import { useMemo } from 'react';

interface NotePanelProps {
  expectedNotes: number[]; // MIDI numbers for expected chord
  userInput: number[];     // MIDI numbers currently being pressed
  currentChordIndex: number;
  totalChords: number;
  isChordComplete: boolean;
  currentChord?: {
    id: string;
    measureNumber: number;
    keys: string[];
    duration: string;
  } | null;
  errorCount: number;
  successStreak: number;
  errorStreak: number;
  correctChords: number;
  longestStreak: number;
}

// Helper function to convert MIDI number to note name
const midiToNoteName = (midiNumber: number): string => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteIndex = midiNumber % 12;
  return `${noteNames[noteIndex]}${octave}`;
};

// Helper function to get note color based on status
const getNoteColor = (midiNumber: number, expectedNotes: number[], userInput: number[]): string => {
  const isExpected = expectedNotes.includes(midiNumber);
  const isPressed = userInput.includes(midiNumber);
  
  if (isExpected && isPressed) {
    return '#28a745'; // Green - correct note pressed
  } else if (isExpected && !isPressed) {
    return '#ffc107'; // Yellow - expected but not pressed
  } else if (!isExpected && isPressed) {
    return '#dc3545'; // Red - unexpected note pressed
  } else {
    return '#6c757d'; // Gray - not relevant
  }
};

export default function NotePanel({
  expectedNotes,
  userInput,
  currentChordIndex,
  totalChords,
  isChordComplete,
  currentChord,
  errorCount,
  successStreak,
  errorStreak,
  correctChords,
  longestStreak
}: NotePanelProps) {
  // Combine all notes for display (expected + pressed)
  const allRelevantNotes = useMemo(() => {
    const noteSet = new Set([...expectedNotes, ...userInput]);
    return Array.from(noteSet).sort((a, b) => a - b);
  }, [expectedNotes, userInput]);

  return (
    <div style={{
      padding: '20px',
      background: 'rgba(42, 42, 62, 0.8)',
      border: '1px solid #3a3a4a',
      borderRadius: '16px',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#e4e4f4'
    }}>
      <h3 style={{ 
        margin: '0 0 15px 0', 
        color: '#ffffff',
        fontFamily: 'inherit'
      }}>
        🎹 {expectedNotes.length === 1 ? 'Note' : 'Chord'} Panel
      </h3>

      {/* Progress Info */}
      <div style={{
        marginBottom: '15px',
        padding: '12px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <span><strong>Progress:</strong> {currentChordIndex + 1} / {totalChords}</span>
          <span style={{
            padding: '4px 8px',
            borderRadius: '12px',
            backgroundColor: isChordComplete ? '#28a745' : '#ffc107',
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            {isChordComplete ? '✅ COMPLETE' : '⏳ WAITING'}
          </span>
        </div>
        
        {currentChord && (
          <div style={{ fontSize: '12px', color: '#6c757d' }}>
            <div>Chord ID: {currentChord.id}</div>
            <div>Measure: {currentChord.measureNumber}</div>
            <div>Duration: {currentChord.duration}</div>
          </div>
        )}
      </div>

      {/* Expected vs Actual */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '15px',
        marginBottom: '15px'
      }}>
        {/* Expected Notes */}
        <div style={{
          padding: '12px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#e4e4f4' }}>Expected ({expectedNotes.length})</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {expectedNotes.length > 0 ? (
              expectedNotes.map(note => (
                <div
                  key={note}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: userInput.includes(note) ? '#22c55e' : '#eab308',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  {midiToNoteName(note)}
                </div>
              ))
            ) : (
              <span style={{ color: '#6c757d', fontStyle: 'italic' }}>No chord selected</span>
            )}
          </div>
        </div>

        {/* User Input */}
        <div style={{
          padding: '12px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#e4e4f4' }}>Pressed ({userInput.length})</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {userInput.length > 0 ? (
              userInput.map(note => (
                <div
                  key={note}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: expectedNotes.includes(note) ? '#22c55e' : '#ef4444',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  {midiToNoteName(note)}
                </div>
              ))
            ) : (
              <span style={{ color: '#6c757d', fontStyle: 'italic' }}>No keys pressed</span>
            )}
          </div>
        </div>
      </div>

      {/* Performance Statistics */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.12)',
        marginBottom: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <h4 style={{ 
          margin: '0 0 16px 0', 
          color: '#ffffff',
          fontSize: '16px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          📊 Performance Statistics
        </h4>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          fontSize: '13px'
        }}>
          {/* Correct Chords */}
          <div style={{
            padding: '12px',
            background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.08) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(34,197,94,0.2)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              height: '2px',
              background: 'linear-gradient(90deg, #22c55e, #16a34a)'
            }} />
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: '#22c55e',
              marginBottom: '4px'
            }}>
              {correctChords}
            </div>
            <div style={{ color: '#86efac', fontWeight: '500' }}>Correct</div>
          </div>

          {/* Errors */}
          <div style={{
            padding: '12px',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.08) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(239,68,68,0.2)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              height: '2px',
              background: 'linear-gradient(90deg, #ef4444, #dc2626)'
            }} />
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: '#ef4444',
              marginBottom: '4px'
            }}>
              {errorCount}
            </div>
            <div style={{ color: '#fca5a5', fontWeight: '500' }}>Errors</div>
          </div>

          {/* Current Streak */}
          <div style={{
            padding: '12px',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.08) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(59,130,246,0.2)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              height: '2px',
              background: 'linear-gradient(90deg, #3b82f6, #2563eb)'
            }} />
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: '#3b82f6',
              marginBottom: '4px'
            }}>
              {successStreak}
            </div>
            <div style={{ color: '#93c5fd', fontWeight: '500' }}>Streak</div>
          </div>

          {/* Longest Streak */}
          <div style={{
            padding: '12px',
            background: 'linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(168,85,247,0.08) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(168,85,247,0.2)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              height: '2px',
              background: 'linear-gradient(90deg, #a855f7, #9333ea)'
            }} />
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: '#a855f7',
              marginBottom: '4px'
            }}>
              {longestStreak}
            </div>
            <div style={{ color: '#c4b5fd', fontWeight: '500' }}>Best Streak</div>
          </div>
        </div>

        {/* Accuracy Bar */}
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ color: '#e4e4f4', fontWeight: '500' }}>Accuracy</span>
            <span style={{ 
              color: '#ffffff', 
              fontWeight: 'bold',
              fontSize: '16px'
            }}>
              {totalChords > 0 ? Math.round((correctChords / totalChords) * 100) : 0}%
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${totalChords > 0 ? (correctChords / totalChords) * 100 : 0}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #22c55e, #16a34a)',
              borderRadius: '4px',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>

      {/* Visual Piano Roll */}
      <div style={{
        padding: '12px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#e4e4f4' }}>Visual Notes</h4>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2px',
          maxHeight: '100px',
          overflow: 'auto'
        }}>
          {allRelevantNotes.map(note => {
            const color = getNoteColor(note, expectedNotes, userInput);
            const isPressed = userInput.includes(note);
            const isExpected = expectedNotes.includes(note);
            
            return (
              <div
                key={note}
                style={{
                  width: '40px',
                  height: '30px',
                  backgroundColor: color,
                  border: '1px solid rgba(0,0,0,0.6)',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  position: 'relative',
                  boxShadow: isPressed ? '0 0 8px rgba(0,0,0,0.5)' : 'none',
                  transform: isPressed ? 'scale(1.05)' : 'scale(1)',
                  transition: 'all 0.1s ease'
                }}
                title={`${midiToNoteName(note)} (${note}) - ${
                  isExpected && isPressed ? 'Correct' :
                  isExpected ? 'Expected' :
                  isPressed ? 'Extra' : 'Inactive'
                }`}
              >
                {midiToNoteName(note).replace(/\d+/, '')}
                <div style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  fontSize: '8px',
                  opacity: 0.8
                }}>
                  {note}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '10px',
        fontSize: '11px',
        color: '#6c757d',
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#28a745', borderRadius: '2px' }}></div>
          <span>Correct</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#ffc107', borderRadius: '2px' }}></div>
          <span>Missing</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#dc3545', borderRadius: '2px' }}></div>
          <span>Extra</span>
        </div>
      </div>
    </div>
  );
} 