import { useState, useCallback, useEffect, useRef } from 'react';
import OsmdViewer, { type OsmdViewerRef } from './OsmdViewer';
import PerformanceMetricsDisplay from './PerformanceMetricsDisplay';
import ChordDebugPanel from './ChordDebugPanel';
import Metronome from './Metronome';
import { ChordNavigator } from '../utils/ChordNavigator';
import { PerformanceEvaluator } from '../utils/PerformanceEvaluator';

// Define interfaces for the component's props and data structures
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

interface SheetMusicPlayerProps {
  activeMidiNotes: Map<number, { velocity: number; timestamp: number }>;
  onMidiMessage: (note: number, isNoteOn: boolean) => void;
  musicData: SheetMusicData | null; // structured data for evaluation
  musicXml: string | null;          // raw MusicXML (or base64) for rendering with OSMD
  musicXmlIsBinary?: boolean;      // whether the xml content is base64-encoded binary
}

export default function SheetMusicPlayer({ activeMidiNotes, onMidiMessage, musicData, musicXml, musicXmlIsBinary }: SheetMusicPlayerProps) {
  const [zoom, setZoom] = useState(1.0);
  
  // Chord navigation state
  const [currentChordIndex, setCurrentChordIndex] = useState(0);
  const [totalChords, setTotalChords] = useState(0);
  const [isNavigationActive, setIsNavigationActive] = useState(false);
  const [expectedNotes, setExpectedNotes] = useState<number[]>([]);
  const [userInput, setUserInput] = useState<number[]>([]);
  const [isChordComplete, setIsChordComplete] = useState(false);
  const [currentChord, setCurrentChord] = useState<any>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(true);
  
  // Refs
  const chordNavigatorRef = useRef<ChordNavigator | null>(null);
  const osmdViewerRef = useRef<OsmdViewerRef>(null);
  const evaluatorRef = useRef<PerformanceEvaluator | null>(null);
  
  // Performance evaluation state (keeping for compatibility)
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const [recentEvaluations, setRecentEvaluations] = useState<any[]>([]);
  const [isEvaluationActive, setIsEvaluationActive] = useState(false);

  // Convert MIDI note map to array of currently pressed notes
  const getCurrentlyPressedNotes = useCallback((): number[] => {
    return Array.from(activeMidiNotes.keys());
  }, [activeMidiNotes]);

  // Initialize chord navigator when music data changes
  useEffect(() => {
    if (musicData) {
      console.log('Initializing chord navigator with music data');
      
      // Create chord navigator
      chordNavigatorRef.current = new ChordNavigator({
        requireExactMatch: true,
        onChordChange: (chord, index) => {
          console.log(`Chord changed to index ${index}:`, chord);
          setCurrentChordIndex(index);
          setCurrentChord(chord);
          setExpectedNotes(chord?.midiNumbers || []);
          setIsChordComplete(false);
          
          // Update OSMD cursor position
          if (osmdViewerRef.current) {
            osmdViewerRef.current.moveCursorToChord(index);
          }
        },
        onChordComplete: (chord) => {
          console.log('Chord completed:', chord);
          setIsChordComplete(true);
          
          // Brief delay to show completion, then move to next chord
          setTimeout(() => {
            setIsChordComplete(false);
          }, 500);
        },
        onNavigationComplete: () => {
          console.log('Navigation completed!');
          setIsNavigationActive(false);
          setCurrentChord(null);
          setExpectedNotes([]);
          
          // Hide cursor when done
          if (osmdViewerRef.current) {
            osmdViewerRef.current.hideCursor();
          }
        }
      });

      // Load chords from music data
      chordNavigatorRef.current.loadChords(musicData);
      
      // Update state
      const state = chordNavigatorRef.current.getState();
      setTotalChords(state.totalChords);
      setCurrentChordIndex(state.currentChordIndex);
      setCurrentChord(state.currentChord);
      setExpectedNotes(state.currentChord?.midiNumbers || []);
      
      // Initialize performance evaluator
      evaluatorRef.current = new PerformanceEvaluator(musicData.tempo || 120);
      evaluatorRef.current.loadExpectedNotes(musicData);
      
      // Reset state
      setPerformanceMetrics(null);
      setRecentEvaluations([]);
      setIsEvaluationActive(false);
      setIsNavigationActive(false);
    }
  }, [musicData]);

  // Handle MIDI input changes
  useEffect(() => {
    const currentlyPressed = getCurrentlyPressedNotes();
    setUserInput(currentlyPressed);

    // If navigation is active, update chord navigator
    if (isNavigationActive && chordNavigatorRef.current) {
      // We need to handle note on/off events properly
      // For now, let's just update based on the current pressed notes
      const previousInput = chordNavigatorRef.current.getCurrentUserInput();
      
      // Find newly pressed and released notes
      const newlyPressed = currentlyPressed.filter(note => !previousInput.includes(note));
      const newlyReleased = previousInput.filter(note => !currentlyPressed.includes(note));
      
      // Update chord navigator for each note change
      let navigationChanged = false;
      
      newlyPressed.forEach(note => {
        const changed = chordNavigatorRef.current!.updateMidiInput(note, true);
        if (changed) navigationChanged = true;
      });
      
      newlyReleased.forEach(note => {
        const changed = chordNavigatorRef.current!.updateMidiInput(note, false);
        if (changed) navigationChanged = true;
      });

      // Update state if navigation changed
      if (navigationChanged) {
        const state = chordNavigatorRef.current.getState();
        setCurrentChordIndex(state.currentChordIndex);
        setCurrentChord(state.currentChord);
        setExpectedNotes(state.currentChord?.midiNumbers || []);
        setIsChordComplete(state.isChordComplete);
      }
    }

    // Handle performance evaluation if active
    if (isEvaluationActive && evaluatorRef.current) {
      // This is a simplified version - in a real implementation, you'd want to
      // properly handle note on/off events with timing
      const metrics = evaluatorRef.current.calculateMetrics();
      setPerformanceMetrics(metrics);
      setRecentEvaluations(evaluatorRef.current.getRecentEvaluations());
    }
  }, [activeMidiNotes, isNavigationActive, isEvaluationActive, getCurrentlyPressedNotes]);

  // Start chord navigation
  const startChordNavigation = useCallback(() => {
    if (chordNavigatorRef.current && musicData) {
      console.log('Starting chord navigation');
      chordNavigatorRef.current.reset();
      setIsNavigationActive(true);
      
      // Show cursor
      if (osmdViewerRef.current) {
        osmdViewerRef.current.showCursor();
        osmdViewerRef.current.moveCursorToChord(0);
      }
      
      // Also start performance evaluation
      if (evaluatorRef.current) {
        evaluatorRef.current.startEvaluation();
        setIsEvaluationActive(true);
      }
    }
  }, [musicData]);

  // Stop chord navigation
  const stopChordNavigation = useCallback(() => {
    console.log('Stopping chord navigation');
    setIsNavigationActive(false);
    
    // Hide cursor
    if (osmdViewerRef.current) {
      osmdViewerRef.current.hideCursor();
    }
    
    // Stop performance evaluation
    if (evaluatorRef.current) {
      evaluatorRef.current.stopEvaluation();
      setIsEvaluationActive(false);
    }
  }, []);

  // Reset to beginning
  const resetNavigation = useCallback(() => {
    if (chordNavigatorRef.current) {
      chordNavigatorRef.current.reset();
      
      // Reset cursor position
      if (osmdViewerRef.current && isNavigationActive) {
        osmdViewerRef.current.moveCursorToChord(0);
      }
    }
  }, [isNavigationActive]);

  // Seek to specific chord
  const seekToChord = useCallback((chordIndex: number) => {
    if (chordNavigatorRef.current) {
      chordNavigatorRef.current.seekToChord(chordIndex);
      
      // Update cursor position
      if (osmdViewerRef.current && isNavigationActive) {
        osmdViewerRef.current.moveCursorToChord(chordIndex);
      }
    }
  }, [isNavigationActive]);

  // Calculate progress
  const progress = totalChords > 0 ? currentChordIndex / totalChords : 0;

  return (
    <div className="sheet-music-player" style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
      {/* Main sheet music area */}
      <div style={{ flex: showDebugPanel ? 2 : 3, overflow: 'auto', padding: '20px', backgroundColor: '#fff', color: '#000' }}>
        {musicData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', paddingBottom: '15px', borderBottom: '1px solid #dee2e6', marginBottom: '15px' }}>
                         <button 
               onClick={isNavigationActive ? stopChordNavigation : startChordNavigation} 
               className="button primary"
             >
               {isNavigationActive ? '⏹️ Stop Navigation' : '▶️ Start Note-by-Note'}
             </button>
            
            <button 
              onClick={resetNavigation} 
              className="button secondary"
              disabled={!isNavigationActive}
            >
              ↺ Reset
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span>Zoom:</span>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1" 
                value={zoom} 
                onChange={(e) => setZoom(parseFloat(e.target.value))} 
              />
              <span>{(zoom * 100).toFixed(0)}%</span>
            </div>
            
            <button 
              onClick={() => setShowDebugPanel(!showDebugPanel)} 
              className="button secondary"
            >
              {showDebugPanel ? '🔍 Hide Debug' : '🔍 Show Debug'}
            </button>
            
            {/* Metronome Control */}
            <Metronome initialBpm={musicData?.tempo || 120} />
            
            <div style={{ flex: 1, marginLeft: '20px' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <span style={{ fontSize: '14px', color: '#666' }}>
                   {expectedNotes.length === 1 ? 'Note' : 'Chord'} {currentChordIndex + 1} of {totalChords}
                 </span>
                <div style={{ 
                  width: '100%', 
                  height: '8px', 
                  backgroundColor: '#e9ecef', 
                  borderRadius: '4px', 
                  overflow: 'hidden' 
                }}>
                  <div style={{ 
                    width: `${progress * 100}%`, 
                    height: '100%', 
                    backgroundColor: isChordComplete ? '#28a745' : '#007bff', 
                    transition: 'width 0.3s ease, background-color 0.3s ease' 
                  }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <OsmdViewer
          ref={osmdViewerRef}
          musicXml={musicXml}
          zoom={zoom}
          isBinary={musicXmlIsBinary}
          currentChordIndex={currentChordIndex}
          showCursor={isNavigationActive}
        />
      </div>

      {/* Debug panel */}
      {showDebugPanel && (
        <div style={{ 
          flex: 1, 
          minWidth: '400px', 
          maxWidth: '500px',
          overflow: 'auto', 
          padding: '20px', 
          backgroundColor: '#f8f9fa', 
          borderLeft: '1px solid #dee2e6' 
        }}>
          <ChordDebugPanel
            expectedNotes={expectedNotes}
            userInput={userInput}
            currentChordIndex={currentChordIndex}
            totalChords={totalChords}
            isChordComplete={isChordComplete}
            currentChord={currentChord}
          />
        </div>
      )}
      
      {/* Performance metrics (when debug panel is hidden) */}
      {!showDebugPanel && musicData && (
        <div style={{ 
          flex: 1, 
          minWidth: '350px', 
          overflow: 'auto', 
          padding: '20px', 
          backgroundColor: '#f8f9fa', 
          borderLeft: '1px solid #dee2e6' 
        }}>
          <PerformanceMetricsDisplay
            metrics={performanceMetrics}
            recentEvaluations={recentEvaluations}
            isActive={isEvaluationActive}
            expectedTempo={musicData.tempo || 120}
          />
        </div>
      )}
    </div>
  );
}
