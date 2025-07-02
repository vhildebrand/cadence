import { useState, useEffect, useCallback } from 'react'
import './App.css'
import NoteFall from './components/NoteFall'
import SheetMusicPlayer from './components/SheetMusicPlayer'

// Define the MIDI message type
interface MidiMessage {
  type: 'noteOn' | 'noteOff';
  note: number;
  velocity: number;
  channel: number;
  timestamp: number;
}

// Define active note type
interface ActiveNote {
  note: number;
  velocity: number;
  timestamp: number;
}

// Define the drill state type
interface DrillState {
  isActive: boolean;
  currentPrompt: string | null;
  expectedNotes: number[];
  userAnswer: number[];
  feedback: string | null;
  score: number;
  streak: number;
}

// Define the SheetMusicData interface, which will be used to pass data
interface SheetMusicData {
  measures: Array<{
    notes: Array<{
      keys: string[];
      duration: string;
      startTime: number;
      endTime: number;
      id: string;
      midiNumbers: number[];
    }>;
    measureNumber: number;
    clef: string;
    timeSignature?: [number, number];
    keySignature?: string;
  }>;
  tempo: number;
  totalDuration: number;
  metadata: {
    title?: string;
    composer?: string;
  };
}

type AppMode = 'interval-drill' | 'note-fall' | 'sheet-music';

function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>('sheet-music');
  const [midiMessage, setMidiMessage] = useState<MidiMessage | null>(null);
  const [midiHistory, setMidiHistory] = useState<MidiMessage[]>([]);
  const [activeMidiNotes, setActiveMidiNotes] = useState<Map<number, ActiveNote>>(new Map());
  const [midiAccess, setMidiAccess] = useState<any>(null);
  const [midiStatus, setMidiStatus] = useState<string>('Not connected');
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  
  // Note Fall configuration
  const [noteRange, setNoteRange] = useState({
    startOctave: 4,
    endOctave: 6
  });
  
  // Drill state
  const [drillState, setDrillState] = useState<DrillState>({
    isActive: false,
    currentPrompt: null,
    expectedNotes: [],
    userAnswer: [],
    feedback: null,
    score: 0,
    streak: 0
  });
  const [isRunningDrill, setIsRunningDrill] = useState(false);

  // State for sheet music file loading (moved from SheetMusicPlayer)
  const [musicData, setMusicData] = useState<SheetMusicData | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Initialize Web MIDI API
  useEffect(() => {
    const initializeMIDI = async () => {
      try {
        // Check if Web MIDI API is supported
        if (!(navigator as any).requestMIDIAccess) {
          setMidiStatus('Web MIDI API not supported in this browser');
          return;
        }

        setMidiStatus('Requesting MIDI access...');
        
        // Request MIDI access
        const access = await (navigator as any).requestMIDIAccess({ sysex: false });
        setMidiAccess(access);
        
        // Get list of connected devices
        const devices: string[] = [];
        access.inputs.forEach((input: any) => {
          devices.push(input.name || input.id);
          console.log(`Found MIDI input: ${input.name} (${input.id})`);
        });
        
        setConnectedDevices(devices);
        
        if (devices.length > 0) {
          setMidiStatus(`Connected to ${devices.length} MIDI device(s)`);
          
          // Set up message handling for all inputs
          access.inputs.forEach((input: any) => {
            input.onmidimessage = handleMIDIMessage;
          });
        } else {
          setMidiStatus('No MIDI devices found. Connect a MIDI keyboard and refresh.');
        }
        
        // Listen for device connections/disconnections
        access.onstatechange = (event: Event) => {
          console.log('MIDI device state changed:', event);
          // Refresh device list
          const newDevices: string[] = [];
          access.inputs.forEach((input: any) => {
            newDevices.push(input.name || input.id);
            input.onmidimessage = handleMIDIMessage;
          });
          setConnectedDevices(newDevices);
          setMidiStatus(newDevices.length > 0 
            ? `Connected to ${newDevices.length} MIDI device(s)`
            : 'No MIDI devices connected');
        };
        
      } catch (error) {
        console.error('Failed to initialize MIDI:', error);
        setMidiStatus('Failed to access MIDI: ' + (error as Error).message);
      }
    };

    initializeMIDI();
  }, []);

  // Handle MIDI message
  const handleMIDIMessage = (event: any) => {
    const [status, data1, data2] = event.data;
    const command = status & 0xf0;
    const channel = status & 0x0f;
    
    // Check if it's a Note On or Note Off message
    if (command === 0x90 || command === 0x80) {
      const isNoteOn = command === 0x90 && data2 > 0; // Note on with velocity > 0
      const noteNumber = data1;
      const velocity = data2;
      
      const midiMessage: MidiMessage = {
        type: isNoteOn ? 'noteOn' : 'noteOff',
        note: noteNumber,
        velocity: velocity,
        channel: channel,
        timestamp: Date.now()
      };
      
      console.log(`MIDI ${isNoteOn ? 'Note On' : 'Note Off'}: Note ${noteNumber} (${noteNumberToName(noteNumber)}), Velocity ${velocity}, Channel ${channel}`);
      
      setMidiMessage(midiMessage);
      
      // Add to history (keep last 10 messages)
      setMidiHistory(prev => {
        const newHistory = [midiMessage, ...prev];
        return newHistory.slice(0, 10);
      });

      // Update active notes
      setActiveMidiNotes(prev => {
        const newActiveNotes = new Map(prev);
        if (isNoteOn) {
          newActiveNotes.set(noteNumber, {
            note: noteNumber,
            velocity: velocity,
            timestamp: Date.now()
          });
        } else {
          newActiveNotes.delete(noteNumber);
        }
        
        // If drill is active, update user answer with currently active notes
        if (currentMode === 'interval-drill' && drillState.isActive) {
          const activeNoteNumbers = Array.from(newActiveNotes.keys()).sort();
          setDrillState(prev => ({
            ...prev,
            userAnswer: activeNoteNumbers
          }));
          
          // Auto-evaluate when user has played the expected number of notes
          if (activeNoteNumbers.length === drillState.expectedNotes.length && activeNoteNumbers.length > 0) {
            setTimeout(() => {
              evaluateCurrentAnswer(activeNoteNumbers);
            }, 500); // Small delay to allow for chord input
          }
        }
        
        return newActiveNotes;
      });
    }
  };

  const loadMusicXMLFile = useCallback(async () => {
    try {
      setIsLoadingFile(true);
      setFileError(null);
      
      const fileResult = await (window as any).electronAPI.selectMusicXMLFile();
      
      if (fileResult.canceled) {
        setIsLoadingFile(false);
        return;
      }
      
      setSelectedFile(fileResult.filePath);
      
      const parseResult = await (window as any).electronAPI.parseSheetMusic(fileResult.filePath);
      
      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Failed to parse MusicXML file');
      }
      
      setMusicData(parseResult.data);
      console.log('Sheet music loaded:', parseResult.data);
      
    } catch (error) {
      console.error('Error loading MusicXML file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setFileError(errorMessage);
    } finally {
      setIsLoadingFile(false);
    }
  }, []);

  const evaluateCurrentAnswer = async (userAnswer: number[]) => {
    if (!drillState.isActive || userAnswer.length === 0) return;
    
    console.log('🎯 Evaluating answer:', {
      expected: drillState.expectedNotes.map(n => noteNumberToName(n)),
      user: userAnswer.map(n => noteNumberToName(n))
    });
    
    setIsRunningDrill(true);
    
    try {
      // Send user answer to LangGraph for evaluation
      const evaluationData = {
        expected_notes: drillState.expectedNotes,
        user_answer: userAnswer,
        current_score: drillState.score,
        current_streak: drillState.streak
      };
      
      const result = await (window as any).electronAPI.runCadenceGraph('evaluate_answer', JSON.stringify(evaluationData));
      const evaluation = JSON.parse(result);
      
      // Log the feedback to console
      const isCorrect = evaluation.feedback.includes('✅');
      console.log(`${isCorrect ? '✅ CORRECT!' : '❌ INCORRECT'}: ${evaluation.feedback}`);
      console.log(`Score: ${evaluation.score}, Streak: ${evaluation.streak}`);
      
      setDrillState(prev => ({
        ...prev,
        feedback: evaluation.feedback,
        score: evaluation.score,
        streak: evaluation.streak,
        isActive: false // End current drill
      }));
      
    } catch (error) {
      console.error('Error evaluating answer:', error);
      setDrillState(prev => ({
        ...prev,
        feedback: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    } finally {
      setIsRunningDrill(false);
    }
  };

  const startIntervalDrill = async () => {
    setIsRunningDrill(true);
    
    // Clear any currently active notes
    setActiveMidiNotes(new Map());
    
    try {
      // Call the LangGraph script to start a drill
      const result = await (window as any).electronAPI.runCadenceGraph('start_drill');
      const drillData = JSON.parse(result);
      
      console.log('🎵 New drill started:', {
        prompt: drillData.prompt,
        expectedNotes: drillData.expected_notes.map((n: number) => noteNumberToName(n))
      });
      
      setDrillState({
        isActive: true,
        currentPrompt: drillData.prompt,
        expectedNotes: drillData.expected_notes,
        userAnswer: [],
        feedback: null,
        score: drillData.score || 0,
        streak: drillData.streak || 0
      });
      
    } catch (error) {
      console.error('Error starting drill:', error);
      setDrillState(prev => ({
        ...prev,
        feedback: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    } finally {
      setIsRunningDrill(false);
    }
  };

  const evaluateAnswer = async () => {
    const userAnswer = Array.from(activeMidiNotes.keys()).sort();
    await evaluateCurrentAnswer(userAnswer);
  };

  const resetDrill = () => {
    setDrillState({
      isActive: false,
      currentPrompt: null,
      expectedNotes: [],
      userAnswer: [],
      feedback: null,
      score: 0,
      streak: 0
    });
    setActiveMidiNotes(new Map());
  };

  // Helper function to convert MIDI note number to note name
  const noteNumberToName = (noteNumber: number): string => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteName = noteNames[noteNumber % 12];
    return `${noteName}${octave}`;
  };

  const refreshMIDI = async () => {
    setMidiStatus('Refreshing MIDI devices...');
    // Re-initialize MIDI
    window.location.reload();
  };

  // Handle MIDI message for NoteFall component
  const handleNoteFallMIDI = (note: number, isNoteOn: boolean) => {
    // This is called from NoteFall component if needed
    console.log(`NoteFall MIDI: ${isNoteOn ? 'On' : 'Off'} - ${noteNumberToName(note)}`);
  };

  // If we're in NoteFall mode, render the NoteFall component
  if (currentMode === 'note-fall') {
    return (
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <h1>🎹 Cadence</h1>
                      <nav className="mode-nav">
            <button 
              onClick={() => setCurrentMode('interval-drill')}
              className="button secondary"
            >
              Interval Drill
            </button>
            <button 
              onClick={() => setCurrentMode('note-fall')}
              className={currentMode === 'note-fall' ? 'button primary' : 'button secondary'}
            >
              Note Fall
            </button>
            <button 
              onClick={() => setCurrentMode('sheet-music')}
              className={currentMode === 'sheet-music' ? 'button primary' : 'button secondary'}
            >
              Sheet Music
            </button>
          </nav>
            <div className="note-range-controls">
              <label>Note Range:</label>
              <select 
                value={noteRange.startOctave} 
                onChange={(e) => setNoteRange(prev => ({...prev, startOctave: parseInt(e.target.value)}))}
              >
                <option value={3}>C3</option>
                <option value={4}>C4</option>
                <option value={5}>C5</option>
              </select>
              <span>to</span>
              <select 
                value={noteRange.endOctave} 
                onChange={(e) => setNoteRange(prev => ({...prev, endOctave: parseInt(e.target.value)}))}
              >
                <option value={4}>C4</option>
                <option value={5}>C5</option>
                <option value={6}>C6</option>
                <option value={7}>C7</option>
              </select>
            </div>
          </div>
          <div className="midi-status-compact">
            <span className={`status-dot ${connectedDevices.length > 0 ? 'connected' : 'disconnected'}`}></span>
            {connectedDevices.length > 0 ? `${connectedDevices.length} MIDI device(s)` : 'No MIDI'}
          </div>
        </header>

        <NoteFall 
          onMidiMessage={handleNoteFallMIDI}
          activeMidiNotes={activeMidiNotes}
          noteRange={noteRange}
        />
      </div>
    );
  }

  // UPDATED: Sheet Music mode
  if (currentMode === 'sheet-music') {
    return (
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <h1>🎹 Cadence</h1>
            <nav className="mode-nav">
              <button onClick={() => setCurrentMode('interval-drill')} className="button secondary">Interval Drill</button>
              <button onClick={() => setCurrentMode('note-fall')} className="button secondary">Note Fall</button>
              <button onClick={() => setCurrentMode('sheet-music')} className="button primary">Sheet Music</button>
            </nav>
            {/* ADDED FILE CONTROLS TO THE MAIN HEADER */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={loadMusicXMLFile}
                  disabled={isLoadingFile}
                  className="button secondary"
                >
                  {isLoadingFile ? 'Loading...' : 'Load MusicXML'}
                </button>
                {selectedFile && (
                  <span style={{ fontSize: '12px', color: '#ccc', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedFile.split(/[\\/]/).pop()}
                  </span>
                )}
            </div>
          </div>
          <div className="midi-status-compact">
            <span className={`status-dot ${connectedDevices.length > 0 ? 'connected' : 'disconnected'}`}></span>
            {connectedDevices.length > 0 ? `${connectedDevices.length} MIDI device(s)` : 'No MIDI'}
          </div>
        </header>

        {fileError && (
          <div style={{ padding: '10px', backgroundColor: '#8B0000', color: 'white', textAlign: 'center' }}>
            <strong>Error:</strong> {fileError}
          </div>
        )}

        <SheetMusicPlayer 
          activeMidiNotes={activeMidiNotes}
          onMidiMessage={handleMIDIMessage}
          musicData={musicData} // Pass the loaded data as a prop
        />
      </div>
    );
  }

  // Default: Interval Drill mode
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🎹 Cadence</h1>
          <nav className="mode-nav">
            <button 
              onClick={() => setCurrentMode('interval-drill')}
              className={currentMode === 'interval-drill' ? 'button primary' : 'button secondary'}
            >
              Interval Drill
            </button>
            <button 
              onClick={() => setCurrentMode('note-fall')}
              className="button secondary"
            >
              Note Fall
            </button>
            <button 
              onClick={() => setCurrentMode('sheet-music')}
              className="button secondary"
            >
              Sheet Music
            </button>
          </nav>
        </div>
        <p className="subtitle">Intelligent MIDI Ear Trainer</p>
      </header>

      <main className="app-main">
        {/* MIDI Connection Status */}
        <section className="section">
          <h2>MIDI Connection</h2>
          <div className={`status-indicator ${connectedDevices.length > 0 ? 'connected' : 'disconnected'}`}>
            <div className="status-text">
              <strong>Status:</strong> {midiStatus}
            </div>
          </div>
          
          {connectedDevices.length > 0 && (
            <div className="connected-devices">
              <strong>Connected Devices:</strong>
              <ul>
                {connectedDevices.map((device, index) => (
                  <li key={index}>{device}</li>
                ))}
              </ul>
            </div>
          )}
          
          <button onClick={refreshMIDI} className="button secondary">
            Refresh MIDI Devices
          </button>
        </section>

        {/* Interval Drill Section */}
        <section className="section">
          <h2>Interval Drill</h2>
          
          <div className="drill-stats">
            <div className="stat">
              <span className="stat-label">Score:</span>
              <span className="stat-value">{drillState.score}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Streak:</span>
              <span className="stat-value">{drillState.streak}</span>
            </div>
          </div>

          {!drillState.isActive ? (
            <div className="drill-controls">
              <button 
                onClick={startIntervalDrill} 
                disabled={isRunningDrill || connectedDevices.length === 0}
                className="button primary large"
              >
                {isRunningDrill ? 'Starting Drill...' : 'Start Interval Drill'}
              </button>
              {connectedDevices.length === 0 && (
                <p className="warning">Connect a MIDI keyboard to start practicing</p>
              )}
            </div>
          ) : (
            <div className="drill-active">
              <div className="prompt">
                <h3>Challenge:</h3>
                <p>{drillState.currentPrompt}</p>
              </div>
              
              <div className="expected-notes">
                <strong>Expected Notes:</strong>
                <div className="note-list">
                  {drillState.expectedNotes.map((note, index) => (
                    <span key={index} className="note-chip">
                      {noteNumberToName(note)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="user-answer">
                <strong>Currently Pressed Keys:</strong>
                <div className="note-list">
                  {activeMidiNotes.size > 0 ? (
                    Array.from(activeMidiNotes.keys()).sort().map((note) => (
                      <span key={note} className="note-chip user active-note">
                        {noteNumberToName(note)}
                      </span>
                    ))
                  ) : (
                    <span className="placeholder">Press keys on your keyboard...</span>
                  )}
                </div>
              </div>

              <div className="drill-controls">
                <button 
                  onClick={evaluateAnswer} 
                  disabled={isRunningDrill || activeMidiNotes.size === 0}
                  className="button primary"
                >
                  {isRunningDrill ? 'Evaluating...' : 'Submit Answer'}
                </button>
                <button onClick={resetDrill} className="button secondary">
                  Reset
                </button>
              </div>
            </div>
          )}

          {drillState.feedback && (
            <div className={`feedback ${drillState.feedback.includes('✅') ? 'correct' : 'incorrect'}`}>
              <h3>Feedback:</h3>
              <p>{drillState.feedback}</p>
              <button onClick={startIntervalDrill} className="button primary">
                Next Challenge
              </button>
            </div>
          )}
        </section>

        {/* Current MIDI Input Display */}
        <section className="section">
          <h2>Live MIDI Input</h2>
          
          {/* Currently Active Notes */}
          {activeMidiNotes.size > 0 && (
            <div className="active-notes-display">
              <h3>🎹 Currently Pressed Keys:</h3>
              <div className="active-notes-grid">
                {Array.from(activeMidiNotes.entries())
                  .sort(([a], [b]) => a - b)
                  .map(([note, noteData]) => (
                    <div key={note} className="active-note-card">
                      <div className="note-name">{noteNumberToName(note)}</div>
                      <div className="note-details">
                        <div>Note #{note}</div>
                        <div>Velocity: {noteData.velocity}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
          
          {/* Last MIDI Message */}
          {midiMessage ? (
            <div className={`midi-message ${midiMessage.type}`}>
              <h3>Last MIDI Event:</h3>
              <div className="midi-note">
                <span className="note-name">{noteNumberToName(midiMessage.note)}</span>
                <span className="note-number">#{midiMessage.note}</span>
                <span className={`event-type ${midiMessage.type}`}>
                  {midiMessage.type === 'noteOn' ? '🎹 Press' : '🔇 Release'}
                </span>
              </div>
              <div className="midi-details">
                <div>Velocity: {midiMessage.velocity}</div>
                <div>Channel: {midiMessage.channel + 1}</div>
                <div className="timestamp">
                  {new Date(midiMessage.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ) : (
            <div className="midi-placeholder">
              <p>🎹 Connect a MIDI keyboard and play a note to see it here!</p>
            </div>
          )}
          
          {midiHistory.length > 0 && (
            <details className="midi-history">
              <summary>Recent MIDI Messages ({midiHistory.length})</summary>
              <div className="history-list">
                {midiHistory.map((msg, index) => (
                  <div key={`${msg.timestamp}-${index}`} className={`history-item ${msg.type}`}>
                    <span className="note">{noteNumberToName(msg.note)}</span>
                    <span className="event">{msg.type === 'noteOn' ? '▶' : '⏹'}</span>
                    <span className="velocity">vel: {msg.velocity}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
