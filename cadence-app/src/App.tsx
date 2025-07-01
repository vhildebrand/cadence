import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

// Define the MIDI message type
interface MidiMessage {
  type: 'noteOn' | 'noteOff';
  note: number;
  velocity: number;
  channel: number;
  timestamp: number;
}

function App() {
  const [count, setCount] = useState(0)
  const [pythonResult, setPythonResult] = useState<string>('')
  const [isRunningPython, setIsRunningPython] = useState(false)
  const [midiMessage, setMidiMessage] = useState<MidiMessage | null>(null)
  const [midiHistory, setMidiHistory] = useState<MidiMessage[]>([])
  const [midiAccess, setMidiAccess] = useState<any>(null);
  const [midiStatus, setMidiStatus] = useState<string>('Not connected');
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);

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
    }
  };

  const runPythonScript = async () => {
    setIsRunningPython(true)
    setPythonResult('')
    
    try {
      // Use the electron API to run Python script via IPC
      const result = await (window as any).electronAPI.runPythonHello()
      setPythonResult(result)
    } catch (error) {
      setPythonResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsRunningPython(false)
    }
  }

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
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Cadence - MIDI Ear Trainer</h1>
      
      {/* MIDI Input Section */}
      <div className="card">
        <h2>MIDI Input</h2>
        
        {/* MIDI Status */}
        <div style={{ 
          padding: '0.5rem', 
          backgroundColor: connectedDevices.length > 0 ? '#1a4d1a' : '#4d1a1a', 
          borderRadius: '4px',
          marginBottom: '1rem',
          fontSize: '0.9em'
        }}>
          <strong>Status:</strong> {midiStatus}
        </div>
        
        {/* Connected Devices */}
        {connectedDevices.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <strong>Connected Devices:</strong>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
              {connectedDevices.map((device, index) => (
                <li key={index} style={{ fontSize: '0.9em', color: '#4caf50' }}>
                  {device}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Refresh Button */}
        <button 
          onClick={refreshMIDI}
          style={{ 
            marginBottom: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#646cff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Refresh MIDI Devices
        </button>
        
        {/* Current MIDI Message */}
        {midiMessage ? (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: midiMessage.type === 'noteOn' ? '#2d5016' : '#1a1a1a', 
            borderRadius: '8px',
            border: '2px solid ' + (midiMessage.type === 'noteOn' ? '#4caf50' : '#666'),
            marginBottom: '1rem'
          }}>
            <h3 style={{ 
              color: midiMessage.type === 'noteOn' ? '#4caf50' : '#ff6b6b',
              margin: '0 0 0.5rem 0'
            }}>
              {midiMessage.type === 'noteOn' ? '🎹 Note On' : '🔇 Note Off'}
            </h3>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Note: {noteNumberToName(midiMessage.note)} (#{midiMessage.note})
            </div>
            <div>Velocity: {midiMessage.velocity}</div>
            <div>Channel: {midiMessage.channel + 1}</div>
            <div style={{ fontSize: '0.8em', color: '#888' }}>
              Time: {new Date(midiMessage.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#1a1a1a', 
            borderRadius: '8px',
            border: '1px dashed #666',
            marginBottom: '1rem',
            color: '#888'
          }}>
            <p>🎹 Connect a MIDI keyboard and play a note to see it here!</p>
            <p style={{ fontSize: '0.8em', margin: '0.5rem 0 0 0' }}>
              Make sure to allow MIDI access when prompted by your browser.
            </p>
          </div>
        )}
        
        {/* MIDI History */}
        {midiHistory.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h3>Recent MIDI Messages:</h3>
            <div style={{ 
              maxHeight: '200px', 
              overflowY: 'auto', 
              backgroundColor: '#1a1a1a', 
              borderRadius: '8px',
              border: '1px solid #333',
              padding: '0.5rem'
            }}>
              {midiHistory.map((msg, index) => (
                <div key={`${msg.timestamp}-${index}`} style={{ 
                  fontSize: '0.9em', 
                  padding: '0.25rem', 
                  borderBottom: index < midiHistory.length - 1 ? '1px solid #333' : 'none',
                  color: msg.type === 'noteOn' ? '#4caf50' : '#ff6b6b'
                }}>
                  {msg.type === 'noteOn' ? '▶' : '⏹'} {noteNumberToName(msg.note)} (vel: {msg.velocity})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      
      {/* Python Integration Section */}
      <div className="card">
        <h2>Python Integration</h2>
        <button 
          onClick={runPythonScript}
          disabled={isRunningPython}
          style={{ 
            backgroundColor: isRunningPython ? '#666' : '#646cff',
            cursor: isRunningPython ? 'not-allowed' : 'pointer'
          }}
        >
          {isRunningPython ? 'Running Python...' : 'Run Python Script'}
        </button>
        
        {pythonResult && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            backgroundColor: '#1a1a1a', 
            borderRadius: '8px',
            border: '1px solid #333'
          }}>
            <h3>Python Output:</h3>
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word',
              color: '#00ff00'
            }}>
              {pythonResult}
            </pre>
          </div>
        )}
      </div>
      
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
