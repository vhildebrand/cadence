import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import VexFlow from 'vexflow';
const { Factory, Renderer } = VexFlow;

// --- Interface Definitions ---
interface NoteHighlight {
  noteId: string;
  type: 'correct' | 'incorrect' | 'missed' | 'early' | 'late' | 'current';
  intensity: number;
  timestamp: number;
}

interface VexFlowNote {
  keys: string[];
  duration: string;
  stem_direction?: number;
  modifiers?: any[];
  startTime: number;
  endTime: number;
  id: string;
  midiNumbers: number[];
  isRest?: boolean;
}

interface VexFlowMeasure {
  notes: VexFlowNote[];
  timeSignature?: [number, number];
  keySignature?: string;
  clef: string;
  measureNumber: number;
}

interface SheetMusicData {
  measures: VexFlowMeasure[];
  tempo: number;
  totalDuration: number;
  metadata: {
    title?: string;
    composer?: string;
  };
}

interface SheetMusicRendererProps {
  musicData: SheetMusicData | null;
  currentPositionQuarters: number;
  highlightedNotes: NoteHighlight[];
  onNoteClick?: (note: VexFlowNote) => void;
  zoom: number;
  isPlaying: boolean;
}

// Helper function to convert music21 key signature strings to a format VexFlow understands.
const normalizeKeySignature = (key: string): string => {
    if (typeof key !== 'string') return 'C';

    if (!key.startsWith('<music21.key.KeySignature')) {
        return key;
    }

    const sharpKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
    const flatKeys = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
    const sharpMinorKeys = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m'];
    const flatMinorKeys = ['Am', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'];

    const isMinor = key.includes('minor');

    const matchSharps = key.match(/of (\d+) sharp/);
    if (matchSharps) {
        const numSharps = parseInt(matchSharps[1], 10);
        return isMinor ? sharpMinorKeys[numSharps] : sharpKeys[numSharps];
    }

    const matchFlats = key.match(/of (\d+) flat/);
    if (matchFlats) {
        const numFlats = parseInt(matchFlats[1], 10);
        return isMinor ? flatMinorKeys[numFlats] : flatKeys[numFlats];
    }

    if (key.includes('no sharps or flats')) {
        return isMinor ? 'Am' : 'C';
    }
    
    console.warn(`Could not parse key signature: "${key}". Defaulting to C major.`);
    return 'C';
};

// Convert note data to EasyScore format
const convertToEasyScore = (measure: VexFlowMeasure): string => {
  if (!measure.notes || measure.notes.length === 0) return '';
  
  return measure.notes
    .map(note => {
      // Handle rests
      if (note.isRest) {
        // Ensure the duration is valid
        const duration = note.duration || 'q';
        return `B4/${duration}r`;
      }
      
      // Skip notes with invalid data
      if (!note.keys || note.keys.length === 0 || !note.duration) {
        console.warn('Skipping invalid note:', note);
        return null;
      }
      
      // Clean up the keys and duration
      const cleanKeys = note.keys.filter(key => key && key.trim() !== '');
      const duration = note.duration.replace(/[^a-zA-Z0-9.]/g, '');
      
      if (cleanKeys.length === 0 || !duration) {
        console.warn('Skipping note with empty keys or duration:', note);
        return null;
      }
      
      // Handle single notes and chords
      if (cleanKeys.length === 1) {
        return `${cleanKeys[0]}/${duration}`;
      } else {
        return `(${cleanKeys.join(' ')})/${duration}`;
      }
    })
    .filter(Boolean) // Remove null entries
    .join(', ');
};

export default function SheetMusicRenderer({
  musicData,
  currentPositionQuarters,
  highlightedNotes,
  onNoteClick,
  zoom = 1.0,
  isPlaying
}: SheetMusicRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const renderWithVexFlow = useCallback(() => {
    if (!musicData || !containerRef.current) return;

    try {
      // Check VexFlow availability
      if (!Factory) {
        setError('VexFlow is not properly loaded.');
        console.error('VexFlow not available:', VexFlow);
        return;
      }

      // Clear the container
      containerRef.current.innerHTML = '';
      
      const containerWidth = containerRef.current.clientWidth;
      const measuresPerLine = Math.max(1, Math.floor(containerWidth / 250));
      const totalLines = Math.ceil(musicData.measures.length / measuresPerLine);
      const height = Math.max(200, totalLines * 150 + 100);

      // Create VexFlow Factory
      const vf = new Factory({
        renderer: { 
          elementId: containerRef.current.id || 'vexflow-output',
          width: containerWidth, 
          height: height,
          backend: Renderer.Backends.SVG
        }
      });

      const score = vf.EasyScore();
      let currentY = 40;

            // Process each measure as a separate stave
      for (let i = 0; i < musicData.measures.length; i++) {
        const measure = musicData.measures[i];
        const isNewLine = i % measuresPerLine === 0;
        
        if (isNewLine && i > 0) {
          currentY += 150;
        }
        
        const x = 20 + ((i % measuresPerLine) * 200);
        
        // Create system for this measure
        const system = vf.System({
          x: x,
          y: currentY,
          width: 180,
          spaceBetweenStaves: 10
        });

        // Convert measure to EasyScore
        const easyScoreString = convertToEasyScore(measure);
        
        let voice;
        if (easyScoreString) {
          try {
            const timeSignature = measure.timeSignature || [4, 4];
            const notes = score.notes(easyScoreString, { stem: 'auto' });
            voice = score.voice(notes, { time: `${timeSignature[0]}/${timeSignature[1]}` });
            (voice as any).setStrict?.(false);
          } catch (noteError) {
            console.warn('Error parsing measure notes:', noteError);
            // Add an empty voice with a rest to maintain structure
            const rest = score.notes('B4/wr', { stem: 'auto' });
            voice = score.voice(rest, { time: '4/4' });
            (voice as any).setStrict?.(false);
          }
        } else {
          // Empty measure - add a whole rest
          const rest = score.notes('B4/wr', { stem: 'auto' });
          voice = score.voice(rest, { time: '4/4' });
          (voice as any).setStrict?.(false);
        }

        // Add stave with voice
        const stave = system.addStave({ voices: [voice] });
        
        // Add clef, time sig, and key sig only to first measure of each line
        if (isNewLine) {
          stave.addClef(measure.clef || 'treble');
          
          if (measure.timeSignature) {
            stave.addTimeSignature(`${measure.timeSignature[0]}/${measure.timeSignature[1]}`);
          }
          
          if (measure.keySignature) {
            const normalizedKey = normalizeKeySignature(measure.keySignature);
            stave.addKeySignature(normalizedKey);
          }
        }
      }

      // Render everything
      vf.draw();
      setError(null);

    } catch (e) {
      console.error('VexFlow rendering failed:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(`Rendering failed: ${errorMessage}`);
    }
  }, [musicData, zoom]);

  // Set a unique ID for the container
  useEffect(() => {
    if (containerRef.current && !containerRef.current.id) {
      containerRef.current.id = `vexflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }, []);

  useLayoutEffect(() => {
    if (musicData && musicData.measures.length > 0) {
      // Use a small delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        try {
          renderWithVexFlow();
        } catch (error) {
          console.error('Error rendering VexFlow:', error);
          setError(`Rendering error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }, 10);
      return () => clearTimeout(timeoutId);
    }
  }, [musicData, renderWithVexFlow]);

  // Simple VexFlow test
  const renderSimpleTest = useCallback(() => {
    if (!containerRef.current) return;
    
    try {
      // Check VexFlow availability
      if (!Factory) {
        setError('VexFlow is not properly loaded.');
        console.error('VexFlow not available:', VexFlow);
        return;
      }

      containerRef.current.innerHTML = '';
      
      // Create a simple VexFlow test
      const vf = new Factory({
        renderer: { 
          elementId: containerRef.current.id || 'vexflow-test',
          width: 500, 
          height: 200,
          backend: Renderer.Backends.SVG
        }
      });

      const score = vf.EasyScore();
      const system = vf.System({ x: 50, y: 50, width: 400 });
      
      // Create a simple C major scale
      const notes = score.notes('C4/q, D4, E4, F4');
      const voice = score.voice(notes, { time: '4/4' });
      (voice as any).setStrict?.(false);
      
      system.addStave({ voices: [voice] })
        .addClef('treble')
        .addTimeSignature('4/4');
      
      vf.draw();
      setError(null);
      
    } catch (e) {
      console.error('VexFlow test failed:', e);
      setError(`VexFlow test failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  // Ensure VexFlow uses the SMuFL fonts once they are loaded.
  useEffect(() => {
    (document as any).fonts?.ready.then(() => {
      try {
        (VexFlow as any).setFonts?.('Bravura', 'Academico');
      } catch {}
    });
  }, []);

  const FallbackDisplay = ({ error }: { error: string | null }) => (
    <div style={{ padding: '40px', textAlign: 'center', color: '#666', background: 'white', borderRadius: '8px' }}>
      <h3>🎼 Sheet Music Player</h3>
      {error ? (
        <p style={{ color: '#d32f2f' }}>{error}</p>
      ) : (
        <div>
          <p>Load a MusicXML file to display sheet music.</p>
          <button 
            onClick={renderSimpleTest}
            style={{ 
              marginTop: '10px', 
              padding: '8px 16px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer' 
            }}
          >
            Test VexFlow
          </button>
        </div>
      )}
      <p style={{ fontSize: '12px', marginTop: '15px' }}>
        VexFlow Ready: ✅
      </p>
    </div>
  );

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px', overflowY: 'auto', padding: '10px' }}>
      {musicData?.metadata && (musicData.metadata.title || musicData.metadata.composer) && (
        <div style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>
          {musicData.metadata.title && <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', fontWeight: 'bold' }}>{musicData.metadata.title}</h2>}
          {musicData.metadata.composer && <p style={{ margin: '0', fontSize: '14px', fontStyle: 'italic', color: '#666' }}>by {musicData.metadata.composer}</p>}
        </div>
      )}
      <div 
        ref={containerRef}
        style={{ 
          width: '100%', 
          minHeight: '300px',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #ddd',
          padding: '10px',
          position: 'relative'
        }}
      >
        {(!musicData || error) && <FallbackDisplay error={error} />}
      </div>
    </div>
  );
}
