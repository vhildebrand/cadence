import { useMemo } from 'react';

interface ChordDebugPanelProps {
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

export default function ChordDebugPanel({
  expectedNotes,
  userInput,
  currentChordIndex,
  totalChords,
  isChordComplete,
  currentChord
}: ChordDebugPanelProps) {
  // Combine all notes for display (expected + pressed)
  const allRelevantNotes = useMemo(() => {
    const noteSet = new Set([...expectedNotes, ...userInput]);
    return Array.from(noteSet).sort((a, b) => a - b);
  }, [expectedNotes, userInput]);

  // Statistics
  const correctNotes = expectedNotes.filter(note => userInput.includes(note)).length;
  const extraNotes = userInput.filter(note => !expectedNotes.includes(note)).length;
  const missingNotes = expectedNotes.filter(note => !userInput.includes(note)).length;

  return (
    <div style={{
      padding: '15px',
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      fontFamily: 'monospace',
      fontSize: '14px'
    }}>
      <h3 style={{ 
        margin: '0 0 15px 0', 
        color: '#495057',
        fontFamily: 'inherit'
      }}>
        🎹 {expectedNotes.length === 1 ? 'Note' : 'Chord'} Debug Panel
      </h3>

      {/* Progress Info */}
      <div style={{
        marginBottom: '15px',
        padding: '10px',
        backgroundColor: 'white',
        borderRadius: '6px',
        border: '1px solid #dee2e6'
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
          padding: '10px',
          backgroundColor: 'white',
          borderRadius: '6px',
          border: '1px solid #dee2e6'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#495057' }}>Expected ({expectedNotes.length})</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {expectedNotes.length > 0 ? (
              expectedNotes.map(note => (
                <div
                  key={note}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: userInput.includes(note) ? '#28a745' : '#ffc107',
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
          padding: '10px',
          backgroundColor: 'white',
          borderRadius: '6px',
          border: '1px solid #dee2e6'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#495057' }}>Pressed ({userInput.length})</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {userInput.length > 0 ? (
              userInput.map(note => (
                <div
                  key={note}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: expectedNotes.includes(note) ? '#28a745' : '#dc3545',
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

      {/* Statistics */}
      <div style={{
        padding: '10px',
        backgroundColor: 'white',
        borderRadius: '6px',
        border: '1px solid #dee2e6',
        marginBottom: '15px'
      }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#495057' }}>Statistics</h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
          gap: '8px',
          fontSize: '12px'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '8px',
            backgroundColor: '#d4edda',
            borderRadius: '4px',
            color: '#155724'
          }}>
            <div style={{ fontWeight: 'bold' }}>{correctNotes}</div>
            <div>Correct</div>
          </div>
          <div style={{
            textAlign: 'center',
            padding: '8px',
            backgroundColor: '#f8d7da',
            borderRadius: '4px',
            color: '#721c24'
          }}>
            <div style={{ fontWeight: 'bold' }}>{extraNotes}</div>
            <div>Extra</div>
          </div>
          <div style={{
            textAlign: 'center',
            padding: '8px',
            backgroundColor: '#fff3cd',
            borderRadius: '4px',
            color: '#856404'
          }}>
            <div style={{ fontWeight: 'bold' }}>{missingNotes}</div>
            <div>Missing</div>
          </div>
        </div>
      </div>

      {/* Visual Piano Roll */}
      <div style={{
        padding: '10px',
        backgroundColor: 'white',
        borderRadius: '6px',
        border: '1px solid #dee2e6'
      }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#495057' }}>Visual Notes</h4>
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
                  border: '1px solid #333',
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