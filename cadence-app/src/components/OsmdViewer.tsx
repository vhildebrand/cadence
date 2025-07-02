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

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      moveCursorToChord: (chordIndex: number) => {
        if (!osmdRef.current || !osmdRef.current.cursor) return;
        
        try {
          // Reset cursor to beginning
          osmdRef.current.cursor.reset();
          
          // Move cursor to the specified chord index, but only count entries with actual notes
          let soundingNotesFound = 0;
          let totalSteps = 0;
          
          while (soundingNotesFound < chordIndex && !osmdRef.current.cursor.Iterator.EndReached) {
            osmdRef.current.cursor.next();
            totalSteps++;
            
            // Debug: Log what we're seeing at each step
            const currentVoiceEntry = osmdRef.current.cursor.Iterator?.CurrentVoiceEntries?.[0];
            const hasNotes = currentVoiceEntry?.Notes && currentVoiceEntry.Notes.length > 0;
            
            // Check if this is a rest using the proper methods
            let isRest = false;
            if (hasNotes) {
              const noteObj = currentVoiceEntry.Notes[0];
              // Use isRestFlag property or call isRest() function
              isRest = (noteObj as any)?.isRestFlag || 
                       (typeof (noteObj as any)?.isRest === 'function' && (noteObj as any).isRest());
            }
            
            console.log(`Step ${totalSteps}: hasNotes=${hasNotes}, isRest=${isRest}, notes=${currentVoiceEntry?.Notes?.length || 0}`);
            
            // Only count this step if it has actual notes AND they are not rests
            if (hasNotes && !isRest) {
              soundingNotesFound++;
              console.log(`  -> Counted as sounding note ${soundingNotesFound}`);
            } else if (hasNotes && isRest) {
              console.log(`  -> Skipped rest`);
            } else {
              console.log(`  -> Skipped empty entry`);
            }
          }
          
          // Ensure we're positioned on a note, not a rest or empty entry
          let finalSteps = 0;
          while (!osmdRef.current.cursor.Iterator.EndReached && finalSteps < 10) { // Safety limit
            const currentVoiceEntry = osmdRef.current.cursor.Iterator?.CurrentVoiceEntries?.[0];
            const hasNotes = currentVoiceEntry?.Notes && currentVoiceEntry.Notes.length > 0;
            
            // Check if this is a rest using the proper methods
            let isRest = false;
            if (hasNotes) {
              const noteObj = currentVoiceEntry.Notes[0];
              // Use isRestFlag property or call isRest() function
              isRest = (noteObj as any)?.isRestFlag || 
                       (typeof (noteObj as any)?.isRest === 'function' && (noteObj as any).isRest());
            }
            
            console.log(`Final positioning: hasNotes=${hasNotes}, isRest=${isRest}`);
            
            // Stop if we found a sounding note (has notes and is not a rest)
            if (hasNotes && !isRest) {
              console.log(`  -> Found sounding note, stopping here`);
              break;
            }
            
            console.log(`  -> Advancing past ${hasNotes ? 'rest' : 'empty entry'}`);
            osmdRef.current.cursor.next();
            finalSteps++;
          }
          
          console.log(`Moved cursor to chord ${chordIndex} (found ${soundingNotesFound} sounding notes, took ${totalSteps} total steps, ${finalSteps} final steps)`);
        } catch (error) {
          console.error('Error moving cursor:', error);
        }
      },
      
      showCursor: () => {
        if (osmdRef.current && osmdRef.current.cursor) {
          osmdRef.current.cursor.show();
        }
      },
      
      hideCursor: () => {
        if (osmdRef.current && osmdRef.current.cursor) {
          osmdRef.current.cursor.hide();
        }
      },
      
      getCursorInfo: () => {
        if (!osmdRef.current || !osmdRef.current.cursor) return null;
        
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
      if (osmdRef.current && osmdRef.current.cursor && showCursor) {
        try {
          // Reset cursor to beginning
          osmdRef.current.cursor.reset();
          
          // Move cursor to the specified chord index, but only count entries with actual notes
          let soundingNotesFound = 0;
          
          while (soundingNotesFound < currentChordIndex && !osmdRef.current.cursor.Iterator.EndReached) {
            osmdRef.current.cursor.next();
            
            // Debug: Log what we're seeing at each step
            const currentVoiceEntry = osmdRef.current.cursor.Iterator?.CurrentVoiceEntries?.[0];
            const hasNotes = currentVoiceEntry?.Notes && currentVoiceEntry.Notes.length > 0;
            
            // Check if this is a rest using the proper methods
            let isRest = false;
            if (hasNotes) {
              const noteObj = currentVoiceEntry.Notes[0];
              // Use isRestFlag property or call isRest() function
              isRest = (noteObj as any)?.isRestFlag || 
                       (typeof (noteObj as any)?.isRest === 'function' && (noteObj as any).isRest());
            }
            
            // Only count this step if it has actual notes AND they are not rests
            if (hasNotes && !isRest) {
              soundingNotesFound++;
            }
          }
          
          // Ensure we're positioned on a note, not a rest or empty entry
          let finalSteps = 0;
          while (!osmdRef.current.cursor.Iterator.EndReached && finalSteps < 10) { // Safety limit
            const currentVoiceEntry = osmdRef.current.cursor.Iterator?.CurrentVoiceEntries?.[0];
            const hasNotes = currentVoiceEntry?.Notes && currentVoiceEntry.Notes.length > 0;
            
            // Check if this is a rest using the proper methods
            let isRest = false;
            if (hasNotes) {
              const noteObj = currentVoiceEntry.Notes[0];
              // Use isRestFlag property or call isRest() function
              isRest = (noteObj as any)?.isRestFlag || 
                       (typeof (noteObj as any)?.isRest === 'function' && (noteObj as any).isRest());
            }
            
            // Stop if we found a sounding note (has notes and is not a rest)
            if (hasNotes && !isRest) {
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
          color: '#ff0000', // Red cursor
          alpha: 0.8,
          follow: true
        }]
      });
    }

    // Load & render whenever the XML changes.
    if (musicXml) {
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
          
          osmdRef.current!.zoom = zoom;
          osmdRef.current!.render();
          console.log('OsmdViewer: Successfully rendered music notation');
          
        } catch (err) {
          console.error('OSMD load error:', err);
          console.error('XML preview:', loadData.substring(0, 500));
        }
      };

      loadMusicData();
    }
  }, [musicXml, zoom, isBinary]);

  // Update zoom on prop change (without re‐loading the score).
  useEffect(() => {
    if (osmdRef.current && musicXml) {
      osmdRef.current.zoom = zoom;
      osmdRef.current.render();
    }
  }, [zoom]);

    return <div ref={containerRef} style={{ width: '100%', minHeight: '400px' }} />;
  }
);

OsmdViewer.displayName = 'OsmdViewer';

export default OsmdViewer; 