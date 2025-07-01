import { useState, useEffect } from 'react'
import './App.css'

// Define the MIDI message type
interface MidiMessage {
  type: 'noteOn' | 'noteOff';
  note: number;
  velocity: number;
  channel: number;
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

function App() {
  const [midiMessage, setMidiMessage] = useState<MidiMessage | null>(null)
  const [midiHistory, setMidiHistory] = useState<MidiMessage[]>([])
  const [midiAccess, setMidiAccess] = useState<any>(null);
  const [midiStatus, setMidiStatus] = useState<string>('Not connected');
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  
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
      
      console.log(`MIDI ${isNoteOn ? 'Note On' : 'Note Off'}: Note ${noteNumber}, Velocity ${velocity}, Channel ${channel}`);
      
      setMidiMessage(midiMessage);
      
      // Add to history (keep last 10 messages)
      setMidiHistory(prev => {
        const newHistory = [midiMessage, ...prev];
        return newHistory.slice(0, 10);
      });

      // If drill is active and this is a note on, add to user answer
      if (drillState.isActive && isNoteOn) {
        setDrillState(prev => ({
          ...prev,
          userAnswer: [...prev.userAnswer, noteNumber]
        }));
      }
    }
  };

  const startIntervalDrill = async () => {
    setIsRunningDrill(true);
    
    try {
      // Call the LangGraph script to start a drill
      const result = await (window as any).electronAPI.runCadenceGraph('start_drill');
      const drillData = JSON.parse(result);
      
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
    if (!drillState.isActive || drillState.userAnswer.length === 0) return;
    
    setIsRunningDrill(true);
    
    try {
      // Send user answer to LangGraph for evaluation
      const evaluationData = {
        expected_notes: drillState.expectedNotes,
        user_answer: drillState.userAnswer,
        current_score: drillState.score,
        current_streak: drillState.streak
      };
      
      const result = await (window as any).electronAPI.runCadenceGraph('evaluate_answer', JSON.stringify(evaluationData));
      const evaluation = JSON.parse(result);
      
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

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎹 Cadence</h1>
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
                <strong>Your Answer:</strong>
                <div className="note-list">
                  {drillState.userAnswer.length > 0 ? (
                    drillState.userAnswer.map((note, index) => (
                      <span key={index} className="note-chip user">
                        {noteNumberToName(note)}
                      </span>
                    ))
                  ) : (
                    <span className="placeholder">Play the notes on your keyboard...</span>
                  )}
                </div>
              </div>

              <div className="drill-controls">
                <button 
                  onClick={evaluateAnswer} 
                  disabled={isRunningDrill || drillState.userAnswer.length === 0}
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
            <div className="feedback">
              <h3>Feedback:</h3>
              <p>{drillState.feedback}</p>
            </div>
          )}
        </section>

        {/* Current MIDI Input Display */}
        <section className="section">
          <h2>Live MIDI Input</h2>
          
          {midiMessage ? (
            <div className={`midi-message ${midiMessage.type}`}>
              <div className="midi-note">
                <span className="note-name">{noteNumberToName(midiMessage.note)}</span>
                <span className="note-number">#{midiMessage.note}</span>
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
