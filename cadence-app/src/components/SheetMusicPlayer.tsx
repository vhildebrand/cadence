import { useState, useCallback, useEffect, useRef } from 'react';
import SheetMusicRenderer from './SheetMusicRenderer';
import PerformanceMetricsDisplay from './PerformanceMetricsDisplay';
import { usePlaybackCursor } from '../utils/usePlaybackCursor';
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

interface NoteHighlight {
  noteId: string;
  type: 'correct' | 'incorrect' | 'missed' | 'early' | 'late' | 'current';
  intensity: number;
  timestamp: number;
}

interface SheetMusicPlayerProps {
  activeMidiNotes: Map<number, { velocity: number; timestamp: number }>;
  onMidiMessage: (note: number, isNoteOn: boolean) => void;
  musicData: SheetMusicData | null; // Receives music data as a prop
}

export default function SheetMusicPlayer({ activeMidiNotes, onMidiMessage, musicData }: SheetMusicPlayerProps) {
  const [highlightedNotes, setHighlightedNotes] = useState<NoteHighlight[]>([]);
  const [zoom, setZoom] = useState(1.0);
  
  // Performance evaluation state
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const [recentEvaluations, setRecentEvaluations] = useState<any[]>([]);
  const [isEvaluationActive, setIsEvaluationActive] = useState(false);
  const evaluatorRef = useRef<PerformanceEvaluator | null>(null);

  // This function is called when the playback cursor's position changes.
  const handlePositionChange = useCallback((positionQuarters: number) => {
    if (!musicData) return;

    // Highlight the notes that are currently supposed to be playing.
    const currentNotes: NoteHighlight[] = [];
    musicData.measures.forEach(measure => {
      measure.notes.forEach(note => {
        if (positionQuarters >= note.startTime && positionQuarters < note.endTime) {
          currentNotes.push({
            noteId: note.id,
            type: 'current',
            intensity: 1.0,
            timestamp: Date.now()
          });
        }
      });
    });

    // We merge the new "current" notes with existing highlights from MIDI input.
    setHighlightedNotes(prev => [
        ...prev.filter(h => h.type !== 'current'),
        ...currentNotes
    ]);

    // Update performance metrics if evaluation is active.
    if (evaluatorRef.current && isEvaluationActive) {
      const metrics = evaluatorRef.current.calculateMetrics();
      setPerformanceMetrics(metrics);
      setRecentEvaluations(evaluatorRef.current.getRecentEvaluations());
    }
  }, [musicData, isEvaluationActive]);
  
  // This function is called when playback completes.
  const handlePlaybackComplete = useCallback(() => {
    console.log('Playback completed');
    setHighlightedNotes([]);
    
    if (evaluatorRef.current) {
      evaluatorRef.current.stopEvaluation();
      setIsEvaluationActive(false);
      const finalMetrics = evaluatorRef.current.calculateMetrics();
      setPerformanceMetrics(finalMetrics);
      console.log('Final performance metrics:', finalMetrics);
    }
  }, []);
  
  // The usePlaybackCursor hook gets re-initialized on every render.
  // When musicData changes, these values are updated, and the hook gets the new state.
  const playback = usePlaybackCursor({
    tempo: musicData?.tempo || 120,
    totalDurationQuarters: musicData?.totalDuration || 0,
    onPositionChange: handlePositionChange,
    onComplete: handlePlaybackComplete
  });
  
  // This useEffect now correctly handles loading new music data.
  useEffect(() => {
    // When a new file is loaded, stop any ongoing playback.
    playback.stop();
    
    // If there is new music data, create a new PerformanceEvaluator for it.
    if (musicData) {
      evaluatorRef.current = new PerformanceEvaluator(musicData.tempo || 120);
      evaluatorRef.current.loadExpectedNotes(musicData);
      
      // Reset performance metrics display for the new song
      setPerformanceMetrics(null);
      setRecentEvaluations([]);
      setIsEvaluationActive(false);
    }
  }, [musicData]);

  const startEvaluation = useCallback(() => {
    if (evaluatorRef.current && musicData) {
      evaluatorRef.current.startEvaluation();
      setIsEvaluationActive(true);
      setPerformanceMetrics(null);
      setRecentEvaluations([]);
      console.log('Performance evaluation started');
    }
  }, [musicData]);

  const stopEvaluation = useCallback(() => {
    if (evaluatorRef.current) {
      evaluatorRef.current.stopEvaluation();
      setIsEvaluationActive(false);
      console.log('Performance evaluation stopped');
    }
  }, []);

  // Handle MIDI input for performance evaluation and note highlighting.
  useEffect(() => {
    if (!playback.isPlaying || !musicData) return;

    const midiHighlights: NoteHighlight[] = [];
    
    activeMidiNotes.forEach((noteInfo, midiNumber) => {
      musicData.measures.forEach(measure => {
        measure.notes.forEach(note => {
          if (note.midiNumbers.includes(midiNumber)) {
            const timingWindow = 0.5;
            const noteTime = note.startTime;
            const currentTime = playback.currentPositionQuarters;
            
            if (Math.abs(currentTime - noteTime) <= timingWindow) {
              midiHighlights.push({
                noteId: note.id,
                type: 'correct',
                intensity: 1.0,
                timestamp: Date.now()
              });
            }
          }
        });
      });
    });
    
    setHighlightedNotes(prev => {
      const positionHighlights = prev.filter(h => h.type !== 'current');
      return [...positionHighlights, ...midiHighlights];
    });
    
  }, [activeMidiNotes, playback.isPlaying, playback.currentPositionQuarters, musicData]);

  // This effect fades out old highlights over time.
  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightedNotes(prev => 
        prev.map(highlight => ({
          ...highlight,
          intensity: Math.max(0, highlight.intensity - 0.05)
        })).filter(highlight => highlight.intensity > 0 && highlight.type !== 'current')
      );
    }, 50);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="sheet-music-player" style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
      <div style={{ flex: 3, overflow: 'auto', padding: '20px', backgroundColor: '#fff', color: '#000' }}>
          {musicData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', paddingBottom: '15px', borderBottom: '1px solid #dee2e6', marginBottom: '15px' }}>
              <button onClick={playback.isPlaying ? playback.pause : playback.play} className="button primary">
                {playback.isPlaying ? '⏸️ Pause' : '▶️ Play'}
              </button>
              <button onClick={playback.stop} className="button secondary">⏹️ Stop</button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>Zoom:</span>
                <input type="range" min="0.5" max="2.0" step="0.1" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} />
                <span>{(zoom * 100).toFixed(0)}%</span>
              </div>
               <div style={{flex: 1, marginLeft: '20px'}}>
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${playback.progress * 100}%`, height: '100%', backgroundColor: '#007bff', transition: 'width 0.1s linear' }} />
                  </div>
              </div>
            </div>
          )}

          <SheetMusicRenderer
            musicData={musicData}
            currentPositionQuarters={playback.currentPositionQuarters}
            highlightedNotes={highlightedNotes}
            zoom={zoom}
            isPlaying={playback.isPlaying}
          />
        </div>
        
        {musicData && (
          <div style={{ flex: 1, minWidth: '350px', overflow: 'auto', padding: '20px', backgroundColor: '#f8f9fa', borderLeft: '1px solid #dee2e6' }}>
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
