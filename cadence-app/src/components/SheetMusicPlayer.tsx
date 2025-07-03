import { useState, useCallback, useEffect, useRef } from 'react';
import OsmdViewer, { type OsmdViewerRef } from './OsmdViewer';
import PerformanceMetricsDisplay from './PerformanceMetricsDisplay';
import NotePanel from './NotePanel';
import Metronome from './Metronome';
import { ChordNavigator } from '../utils/ChordNavigator';
import { PerformanceEvaluator } from '../utils/PerformanceEvaluator';
import { PerformanceTracker } from '../utils/PerformanceTracker';

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
  performanceTracker?: PerformanceTracker; // optional performance tracker
}

export default function SheetMusicPlayer({ activeMidiNotes, onMidiMessage, musicData, musicXml, musicXmlIsBinary, performanceTracker }: SheetMusicPlayerProps) {
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
  const [errorCount, setErrorCount] = useState(0);
  const [successStreak, setSuccessStreak] = useState(0);
  const [errorStreak, setErrorStreak] = useState(0);
  const [correctChords, setCorrectChords] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  
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
          
          // Get final state before completing session
          const finalState = chordNavigatorRef.current?.getState();
          if (finalState && performanceTracker) {
            // Update session with final statistics
            performanceTracker.updateSession({
              correctChords: finalState.correctChords,
              errorCount: finalState.errorCount,
              successStreak: finalState.successStreak,
              longestStreak: finalState.longestStreak
            });
            
            // Complete performance tracking session when piece is finished
            const completedSession = performanceTracker.completeSession();
            if (completedSession) {
              console.log('Performance session completed automatically:', completedSession);
              // Show completion message
              setShowCompletionMessage(true);
              setTimeout(() => setShowCompletionMessage(false), 3000);
            }
          }
          
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
      setErrorCount(state.errorCount);
      setSuccessStreak(state.successStreak);
      setErrorStreak(state.errorStreak);
      setCorrectChords(state.correctChords);
      setLongestStreak(state.longestStreak);
      
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
        setErrorCount(state.errorCount);
        setSuccessStreak(state.successStreak);
        setErrorStreak(state.errorStreak);
        setCorrectChords(state.correctChords);
        setLongestStreak(state.longestStreak);
        
        // Update performance tracking session
        if (performanceTracker) {
          performanceTracker.updateSession({
            correctChords: state.correctChords,
            errorCount: state.errorCount,
            successStreak: state.successStreak,
            longestStreak: state.longestStreak
          });
        }
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
      
      // Start performance tracking session
      if (performanceTracker) {
        performanceTracker.startSession({
          id: musicData.metadata?.title || `piece_${Date.now()}`,
          title: musicData.metadata?.title || 'Untitled Piece',
          composer: musicData.metadata?.composer,
          tempo: musicData.tempo || 120,
          totalChords: totalChords
        });
      }
      
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
  }, [musicData, performanceTracker, totalChords]);

  // Stop chord navigation
  const stopChordNavigation = useCallback(() => {
    console.log('Stopping chord navigation');
    setIsNavigationActive(false);
    
    // Complete performance tracking session
    if (performanceTracker) {
      const completedSession = performanceTracker.completeSession();
      if (completedSession) {
        console.log('Performance session completed:', completedSession);
      }
    }
    
    // Hide cursor
    if (osmdViewerRef.current) {
      osmdViewerRef.current.hideCursor();
    }
    
    // Stop performance evaluation
    if (evaluatorRef.current) {
      evaluatorRef.current.stopEvaluation();
      setIsEvaluationActive(false);
    }
  }, [performanceTracker]);

  // Reset to beginning
  const resetNavigation = useCallback(() => {
    if (chordNavigatorRef.current) {
      chordNavigatorRef.current.reset();
      
      // Reset cursor position
      if (osmdViewerRef.current && isNavigationActive) {
        osmdViewerRef.current.moveCursorToChord(0);
      }
    }
    setErrorCount(0);
    setSuccessStreak(0);
    setErrorStreak(0);
    setCorrectChords(0);
    setLongestStreak(0);
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
    <div className="sheet-music-player" style={{ display: 'flex', flex: 1, overflow: 'visible', height: '100%' }}>
      {/* Main sheet music area */}
      <div style={{ 
        flex: showDebugPanel ? 2 : 3, 
        overflow: 'auto', 
        padding: '20px', 
        backgroundColor: musicData ? '#fff' : 'transparent',
        color: musicData ? '#000' : '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: musicData ? 'flex-start' : 'center',
        alignItems: musicData ? 'stretch' : 'center',
        minHeight: '100vh'
      }}>
        {musicData ? (
          <>
            {/* Completion Message */}
            {showCompletionMessage && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '8px',
                marginBottom: '15px',
                color: '#22c55e',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>🎉</span>
                <span>Piece completed! Performance data saved to your profile.</span>
              </div>
            )}
            
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
              {showDebugPanel ? '🔍 Hide Note Panel' : '🔍 Show Note Panel'}
            </button>
            
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

          <OsmdViewer
            ref={osmdViewerRef}
            musicXml={musicXml}
            zoom={zoom}
            isBinary={musicXmlIsBinary}
            currentChordIndex={currentChordIndex}
            showCursor={isNavigationActive}
          />
          </>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: '20px',
            opacity: 0.7
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '10px' }}>🎼</div>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>No Sheet Music Loaded</h3>
            <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
              Load a MusicXML file using the "Load MusicXML" button in the header to get started.
            </p>
          </div>
        )}
      </div>

      {/* Note panel */}
      {showDebugPanel && (
        <div style={{ 
          flex: 1, 
          minWidth: '400px', 
          maxWidth: '500px',
          overflow: 'auto', 
          padding: '20px', 
          backgroundColor: 'rgba(42, 42, 62, 0.6)',
          color: '#ffffff',
          borderLeft: '1px solid #3a3a4a',
          backdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          alignSelf: 'flex-start'
        }}>
          <NotePanel
            expectedNotes={expectedNotes}
            userInput={userInput}
            currentChordIndex={currentChordIndex}
            totalChords={totalChords}
            isChordComplete={isChordComplete}
            currentChord={currentChord}
            errorCount={errorCount}
            successStreak={successStreak}
            errorStreak={errorStreak}
            correctChords={correctChords}
            longestStreak={longestStreak}
          />

          {/* Metronome placed below debug panel */}
          <div style={{ marginTop: '24px' }}>
            <Metronome initialBpm={musicData?.tempo || 120} />
          </div>
        </div>
      )}
      
      {/* Performance metrics (when debug panel is hidden) */}
      {!showDebugPanel && musicData && (
        <div style={{ 
          flex: 1, 
          minWidth: '350px', 
          overflow: 'auto', 
          padding: '20px', 
          backgroundColor: 'rgba(42, 42, 62, 0.6)',
          color: '#ffffff',
          borderLeft: '1px solid #3a3a4a',
          backdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          alignSelf: 'flex-start'
        }}>
          <PerformanceMetricsDisplay
            metrics={performanceMetrics}
            recentEvaluations={recentEvaluations}
            isActive={isEvaluationActive}
            expectedTempo={musicData.tempo || 120}
          />

          {/* Metronome when PerformanceMetrics panel is visible */}
          <div style={{ marginTop: '24px' }}>
            <Metronome initialBpm={musicData?.tempo || 120} />
          </div>
        </div>
      )}
    </div>
  );
}
