import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { OpenSheetMusicDisplay as OSMD } from 'opensheetmusicdisplay';
import JSZip from 'jszip';

interface OsmdViewerProps {
  /** Raw MusicXML contents (utf8 XML string or base64-encoded binary). */
  musicXml: string | null;
  /** Whether musicXml is base64-encoded zipped (.mxl) data. */
  isBinary?: boolean;
  /** Zoom factor (1.0 = 100%). */
  zoom?: number;
  /** Current chord index for cursor positioning */
  currentChordIndex?: number;
  /** Whether to show the cursor */
  showCursor?: boolean;
}

export interface OsmdViewerRef {
  /** Move cursor to a specific chord index */
  moveCursorToChord: (chordIndex: number) => void;
  /** Show the cursor */
  showCursor: () => void;
  /** Hide the cursor */
  hideCursor: () => void;
  /** Get current cursor position info */
  getCursorInfo: () => any;
}

const OsmdViewer = forwardRef<OsmdViewerRef, OsmdViewerProps>(
  ({ musicXml, zoom = 1.0, isBinary = false, currentChordIndex = 0, showCursor = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const osmdRef = useRef<OSMD | null>(null);
    const isLoadedRef = useRef<boolean>(false);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      moveCursorToChord: (chordIndex: number) => {
        if (!osmdRef.current || !osmdRef.current.cursor || !isLoadedRef.current) return;
        
        try {
          // First, reset cursor to the beginning of the piece
          osmdRef.current.cursor.reset();

          // Move cursor to the specified chord index, but only count entries that contain at least
          // one *sounding* (non-rest) note across ANY voice/staff. This prevents skipping a moment
          // where, for example, the treble staff shows a rest but the bass staff has a note.

          const isSoundingNotePresent = (voiceEntries: any[] | undefined): boolean => {
            if (!voiceEntries || voiceEntries.length === 0) return false;

            for (const ve of voiceEntries) {
              const hasNotes = ve?.Notes && ve.Notes.length > 0;
              if (!hasNotes) continue;

              // Determine if ALL notes in this voice entry are rests. If at least one note is NOT a rest,
              // we treat this timeslice as containing a sounding note.
              const hasNonRestNote = ve.Notes.some((n: any) => {
                const isRest = (n as any)?.isRestFlag || (typeof (n as any)?.isRest === 'function' && (n as any).isRest());
                return !isRest;
              });

              if (hasNonRestNote) return true;
            }

            return false;
          };

          let soundingNotesFound = 0;
          let totalSteps = 0;

          while (soundingNotesFound < chordIndex && !osmdRef.current.cursor.Iterator.EndReached) {
            osmdRef.current.cursor.next();
            totalSteps++;

            const entries = osmdRef.current.cursor.Iterator?.CurrentVoiceEntries;
            const isSounding = isSoundingNotePresent(entries);

            // Debug log: collect some statistics per step
            if (entries && entries.length) {
              const noteSummary = entries.map((ve: any) => ve?.Notes?.length || 0).join(',');
              console.log(`Step ${totalSteps}: entries=${entries.length} noteCount=[${noteSummary}] isSounding=${isSounding}`);
            }

            if (isSounding) {
              soundingNotesFound++;
              console.log(`  -> Counted as sounding note ${soundingNotesFound}`);
            } else {
              console.log('  -> Skipped (all rests / empty)');
            }
          }

          // Ensure the cursor lands on a sounding note (max 10 extra steps)
          let finalSteps = 0;
          while (!osmdRef.current.cursor.Iterator.EndReached && finalSteps < 10) {
            const entries = osmdRef.current.cursor.Iterator?.CurrentVoiceEntries;
            if (isSoundingNotePresent(entries)) {
              break; // Found a valid sounding note across any staff
            }
            osmdRef.current.cursor.next();
            finalSteps++;
          }

          console.log(`Moved cursor to chord ${chordIndex} (found ${soundingNotesFound} sounding notes, took ${totalSteps} steps, ${finalSteps} adjustment steps)`);
        } catch (error) {
          console.error('Error moving cursor:', error);
        }
      },
      
      showCursor: () => {
        if (osmdRef.current && osmdRef.current.cursor && isLoadedRef.current) {
          osmdRef.current.cursor.show();
        }
      },
      
      hideCursor: () => {
        if (osmdRef.current && osmdRef.current.cursor && isLoadedRef.current) {
          osmdRef.current.cursor.hide();
        }
      },
      
      getCursorInfo: () => {
        if (!osmdRef.current || !osmdRef.current.cursor || !isLoadedRef.current) return null;
        
        try {
          const cursor = osmdRef.current.cursor;
          const currentVoiceEntry = cursor.Iterator?.CurrentVoiceEntries?.[0];
          
          if (currentVoiceEntry) {
            const baseNote = currentVoiceEntry.Notes?.[0];
            return {
              stemDirection: currentVoiceEntry.StemDirection,
              baseNotePitch: baseNote?.Pitch?.ToString(),
              notes: currentVoiceEntry.Notes?.map((note: any) => note.Pitch?.ToString()) || []
            };
          }
        } catch (error) {
          console.error('Error getting cursor info:', error);
        }
        
        return null;
      }
    }), []);
  
    // Update cursor position when currentChordIndex changes
    useEffect(() => {
      if (osmdRef.current && osmdRef.current.cursor && showCursor && isLoadedRef.current) {
        try {
          // Reset cursor to beginning before we start counting steps
          osmdRef.current.cursor.reset();

          // Helper shared with moveCursorToChord.
          const isSoundingNotePresent = (voiceEntries: any[] | undefined): boolean => {
            if (!voiceEntries || voiceEntries.length === 0) return false;

            for (const ve of voiceEntries) {
              const hasNotes = ve?.Notes && ve.Notes.length > 0;
              if (!hasNotes) continue;

              const hasNonRestNote = ve.Notes.some((n: any) => {
                const isRest = (n as any)?.isRestFlag || (typeof (n as any)?.isRest === 'function' && (n as any).isRest());
                return !isRest;
              });

              if (hasNonRestNote) return true;
            }

            return false;
          };

          // Move cursor to the specified chord index, but count steps only when at least one
          // staff/voice has a sounding note.
          let soundingNotesFound = 0;

          while (soundingNotesFound < currentChordIndex && !osmdRef.current.cursor.Iterator.EndReached) {
            osmdRef.current.cursor.next();

            const entries = osmdRef.current.cursor.Iterator?.CurrentVoiceEntries;
            if (isSoundingNotePresent(entries)) {
              soundingNotesFound++;
            }
          }

          // Ensure cursor ends on a sounding note
          let finalSteps = 0;
          while (!osmdRef.current.cursor.Iterator.EndReached && finalSteps < 10) {
            const entries = osmdRef.current.cursor.Iterator?.CurrentVoiceEntries;
            if (isSoundingNotePresent(entries)) {
              break;
            }
            osmdRef.current.cursor.next();
            finalSteps++;
          }
           
          osmdRef.current.cursor.show();
        } catch (error) {
          console.error('Error updating cursor position:', error);
        }
      }
    }, [currentChordIndex, showCursor]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create the OSMD instance once.
    if (!osmdRef.current) {
      osmdRef.current = new OSMD(containerRef.current, {
        autoResize: true,
        drawTitle: true,
        cursorsOptions: [{
          type: 0, // Standard cursor
          color: '#74ee74',
          alpha: 0.4,
          follow: true
        }]
      });
    }

            // Load & render whenever the XML changes.
        if (musicXml) {
          // Reset loaded state when new music data is provided
          isLoadedRef.current = false;
          
          console.log('OsmdViewer: Loading music data', {
            isBinary,
            dataLength: musicXml.length,
            dataPreview: musicXml.substring(0, 100) + (musicXml.length > 100 ? '...' : '')
          });

          const loadMusicData = async () => {
        let loadData: string;
        
        if (isBinary) {
          try {
            // For MXL files (ZIP archives), extract the XML content
            console.log('OsmdViewer: Processing MXL file...');
            
            // Convert base64 to ArrayBuffer
            const binaryString = atob(musicXml);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            console.log('OsmdViewer: Decoded MXL binary data', {
              arrayBufferSize: bytes.buffer.byteLength,
              firstBytes: Array.from(bytes.slice(0, 10))
            });

            // Load ZIP file with JSZip
            const zip = await JSZip.loadAsync(bytes.buffer);
            console.log('OsmdViewer: Loaded ZIP archive, files:', Object.keys(zip.files));

            // Look for the main MusicXML file
            // First, try to find container.xml to get the rootfile path
            let musicXmlContent: string | null = null;
            
            if (zip.files['META-INF/container.xml']) {
              console.log('OsmdViewer: Found container.xml, parsing...');
              const containerXml = await zip.files['META-INF/container.xml'].async('string');
              console.log('OsmdViewer: Container XML:', containerXml.substring(0, 200));
              
              // Parse container.xml to find the main score file
              const parser = new DOMParser();
              const containerDoc = parser.parseFromString(containerXml, 'text/xml');
              const rootFileElement = containerDoc.querySelector('rootfile');
              
              if (rootFileElement) {
                const rootFilePath = rootFileElement.getAttribute('full-path');
                console.log('OsmdViewer: Root file path from container:', rootFilePath);
                
                if (rootFilePath && zip.files[rootFilePath]) {
                  musicXmlContent = await zip.files[rootFilePath].async('string');
                  console.log('OsmdViewer: Extracted MusicXML from', rootFilePath, '- length:', musicXmlContent.length);
                }
              }
            }
            
            // Fallback: look for common MusicXML file names
            if (!musicXmlContent) {
              console.log('OsmdViewer: No container.xml found, looking for common file names...');
              const commonNames = ['score.xml', 'music.xml', 'document.xml'];
              
              for (const name of commonNames) {
                if (zip.files[name]) {
                  musicXmlContent = await zip.files[name].async('string');
                  console.log('OsmdViewer: Found MusicXML file:', name, '- length:', musicXmlContent.length);
                  break;
                }
              }
            }
            
            // Last resort: use the first .xml file
            if (!musicXmlContent) {
              console.log('OsmdViewer: Looking for any .xml file...');
              const xmlFiles = Object.keys(zip.files).filter(name => name.endsWith('.xml') && !name.includes('META-INF'));
              
              if (xmlFiles.length > 0) {
                console.log('OsmdViewer: Found XML files:', xmlFiles);
                musicXmlContent = await zip.files[xmlFiles[0]].async('string');
                console.log('OsmdViewer: Using first XML file:', xmlFiles[0], '- length:', musicXmlContent.length);
              }
            }
            
            if (!musicXmlContent) {
              throw new Error('No MusicXML content found in MXL file');
            }
            
            loadData = musicXmlContent;
            
          } catch (error) {
            console.error('Error extracting MXL content:', error);
            return;
          }
        } else {
          // For regular XML files, clean up the string
          let xml = musicXml.replace(/^\uFEFF/, ''); // Remove BOM
          const firstIdx = xml.indexOf('<');
          if (firstIdx > 0) xml = xml.slice(firstIdx); // Remove leading whitespace
          loadData = xml;
          console.log('OsmdViewer: Prepared XML data', {
            xmlLength: xml.length,
            startsWithXml: xml.startsWith('<?xml') || xml.startsWith('<score-partwise')
          });
        }

        // Load the XML string into OSMD
        try {
          console.log('OsmdViewer: Loading XML into OSMD...', {
            dataType: typeof loadData,
            dataLength: loadData.length,
            startsWithXml: loadData.startsWith('<?xml') || loadData.startsWith('<score-partwise')
          });

          await osmdRef.current!.load(loadData);
          console.log('OsmdViewer: Successfully loaded music data into OSMD');
          
          // Set loaded state and render
          isLoadedRef.current = true;
          if (osmdRef.current) {
            osmdRef.current.zoom = zoom;
            osmdRef.current.render();
            console.log('OsmdViewer: Successfully rendered music notation');
          }
          
        } catch (err) {
          console.error('OSMD load error:', err);
          console.error('XML preview:', loadData.substring(0, 500));
          // Don't set loaded state on error
          isLoadedRef.current = false;
        }
      };

      loadMusicData();
    }
  }, [musicXml, zoom, isBinary]);

  // Update zoom on prop change (without re‐loading the score).
  useEffect(() => {
    if (osmdRef.current && isLoadedRef.current) {
      osmdRef.current.zoom = zoom;
      osmdRef.current.render();
    }
  }, [zoom]);

    return (
      <div 
        ref={containerRef} 
        className={`osmd-container ${!musicXml ? 'osmd-empty' : ''}`}
        style={{ 
          width: '100%', 
          minHeight: musicXml ? '400px' : '0px',
          backgroundColor: musicXml ? 'white' : 'transparent',
          transition: 'all 0.3s ease'
        }} 
      />
    );
  }
);

OsmdViewer.displayName = 'OsmdViewer';

export default OsmdViewer; 