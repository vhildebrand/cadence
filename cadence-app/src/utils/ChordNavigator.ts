interface ChordData {
  id: string;
  measureNumber: number;
  startTimeQuarters: number;
  endTimeQuarters: number;
  midiNumbers: number[];
  keys: string[];
  duration: string;
}

interface NavigationState {
  currentChordIndex: number;
  totalChords: number;
  currentChord: ChordData | null;
  completedChords: string[];
  userInput: Set<number>; // Currently pressed MIDI numbers
  isChordComplete: boolean;
}

interface ChordNavigatorOptions {
  onChordChange?: (chord: ChordData | null, index: number) => void;
  onChordComplete?: (chord: ChordData) => void;
  onNavigationComplete?: () => void;
  requireExactMatch?: boolean; // If true, no extra notes allowed
}

export class ChordNavigator {
  private chords: ChordData[] = [];
  private state: NavigationState;
  private options: ChordNavigatorOptions;

  constructor(options: ChordNavigatorOptions = {}) {
    this.options = {
      requireExactMatch: true,
      ...options
    };
    
    this.state = {
      currentChordIndex: 0,
      totalChords: 0,
      currentChord: null,
      completedChords: [],
      userInput: new Set(),
      isChordComplete: false
    };
  }

  /**
   * Load chords from sheet music data
   */
  loadChords(musicData: any): void {
    this.chords = [];
    
    if (!musicData?.measures) return;

    console.log(`Processing ${musicData.measures.length} measures`);
    
    // Debug: Look at the full structure to understand how bass clef is stored
    if (musicData.measures[0]) {
      console.log('First measure full structure:', musicData.measures[0]);
      console.log('All keys in first measure:', Object.keys(musicData.measures[0]));
      
      // Check if there are multiple clefs or parts
      if (musicData.measures[0].notes) {
        console.log('Notes in first measure:', musicData.measures[0].notes.length);
        console.log('First few notes:', musicData.measures[0].notes.slice(0, 3));
      }
    }
    
    // Debug: Look at the overall musicData structure
    console.log('Overall musicData structure keys:', Object.keys(musicData));
    console.log('Any clef information:', musicData.clef || 'No clef info');
    
    // Check if there are multiple parts/voices
    if (musicData.parts) {
      console.log('Found parts:', musicData.parts.length);
      console.log('Parts structure:', musicData.parts.map((part: any, i: number) => ({
        partIndex: i,
        keys: Object.keys(part),
        measures: part.measures?.length || 0
      })));
    }

    // Group measures by measure number (to combine treble and bass clef)
    const measureGroups = new Map<number, any[]>();
    
    musicData.measures.forEach((measure: any) => {
      const measureNum = measure.measureNumber;
      if (!measureGroups.has(measureNum)) {
        measureGroups.set(measureNum, []);
      }
      measureGroups.get(measureNum)!.push(measure);
    });

    console.log(`Found ${measureGroups.size} unique measure numbers`);
    console.log('Measure groups:', Array.from(measureGroups.entries()).slice(0, 5).map(([num, measures]) => ({
      measureNumber: num,
      partCount: measures.length,
      clefs: measures.map(m => m.clef).filter(Boolean)
    })));

    let navigationIndex = 0;

    // Process measures in order, combining all parts (clefs) for each measure
    const sortedMeasureNumbers = Array.from(measureGroups.keys()).sort((a, b) => a - b);
    
    sortedMeasureNumbers.forEach(measureNumber => {
      const measuresForThisNumber = measureGroups.get(measureNumber)!;
      
      // Collect all notes from all parts (clefs) for this measure
      const allNotesInMeasure: Array<{note: any, partIndex: number, clef: string}> = [];
      
      measuresForThisNumber.forEach((measure, partIndex) => {
        if (!measure.notes || measure.notes.length === 0) return;
        
        console.log(`Measure ${measureNumber}, Part ${partIndex} (${measure.clef || 'unknown clef'}): ${measure.notes.length} notes`);
        
        measure.notes.forEach((note: any) => {
          if (note.midiNumbers && note.midiNumbers.length > 0) {
            allNotesInMeasure.push({
              note,
              partIndex,
              clef: measure.clef || 'treble'
            });
          }
        });
      });

      // Sort notes by start time within this measure
      allNotesInMeasure.sort((a, b) => (a.note.startTime || 0) - (b.note.startTime || 0));
      
      // Group notes that share the same start time (simultaneous notes across clefs)
      const TIME_TOLERANCE = 0.0001; // very small tolerance
      const chordClusters: Array<typeof allNotesInMeasure> = [];
      let currentCluster: typeof allNotesInMeasure = [];
      let clusterStartTime: number | null = null;
      
      allNotesInMeasure.forEach(noteInfo => {
        const st = noteInfo.note.startTime || 0;
        if (clusterStartTime === null || Math.abs(st - clusterStartTime) <= TIME_TOLERANCE) {
          currentCluster.push(noteInfo);
          clusterStartTime = clusterStartTime === null ? st : clusterStartTime;
        } else {
          chordClusters.push([...currentCluster]);
          currentCluster = [noteInfo];
          clusterStartTime = st;
        }
      });
      if (currentCluster.length > 0) chordClusters.push(currentCluster);
      
      console.log(`Measure ${measureNumber} clustered into ${chordClusters.length} chords/groups`);
      
      // Convert clusters to navigation points
      chordClusters.forEach((cluster, clusterIdx) => {
        const midiNumbersUnion: number[] = [];
        const keysUnion: string[] = [];
        let startTime = cluster[0].note.startTime || 0;
        let endTime = cluster[0].note.endTime || 0;
        let durationVal = cluster[0].note.duration || 'q';
        
        cluster.forEach(ci => {
          midiNumbersUnion.push(...ci.note.midiNumbers);
          keysUnion.push(...ci.note.keys);
          if ((ci.note.endTime || 0) > endTime) {
            endTime = ci.note.endTime || endTime;
            durationVal = ci.note.duration || durationVal;
          }
        });
        
        const chordData: ChordData = {
          id: `m${measureNumber}_g${clusterIdx}_${navigationIndex}`,
          measureNumber: measureNumber,
          startTimeQuarters: startTime,
          endTimeQuarters: endTime,
          midiNumbers: Array.from(new Set(midiNumbersUnion)),
          keys: Array.from(new Set(keysUnion)),
          duration: durationVal
        };
        this.chords.push(chordData);
        navigationIndex++;
      });
    });

    this.state.totalChords = this.chords.length;
    this.state.currentChordIndex = 0;
    this.state.currentChord = this.chords[0] || null;
    this.state.completedChords = [];
    this.state.userInput.clear();
    this.state.isChordComplete = false;

    // Analyze the breakdown of single notes vs multi-note chords
    const singleNotes = this.chords.filter(chord => chord.midiNumbers.length === 1).length;
    const actualChords = this.chords.filter(chord => chord.midiNumbers.length > 1).length;
    
    console.log(`Loaded ${this.chords.length} navigation points for note-by-note navigation`);
    console.log(`Breakdown: ${singleNotes} single notes, ${actualChords} multi-note chords`);
    console.log('First 10 navigation points:', this.chords.slice(0, 10).map(chord => ({
      id: chord.id,
      noteCount: chord.midiNumbers.length,
      midiNumbers: chord.midiNumbers,
      measure: chord.measureNumber,
      type: chord.midiNumbers.length === 1 ? 'single' : 'chord'
    })));
    
    // Notify about initial chord
    if (this.options.onChordChange && this.state.currentChord) {
      this.options.onChordChange(this.state.currentChord, this.state.currentChordIndex);
    }
  }

  /**
   * Update user MIDI input
   */
  updateMidiInput(midiNumber: number, isNoteOn: boolean): boolean {
    if (isNoteOn) {
      this.state.userInput.add(midiNumber);
    } else {
      this.state.userInput.delete(midiNumber);
    }

    // Check if current chord is complete
    const wasComplete = this.state.isChordComplete;
    this.state.isChordComplete = this.checkChordComplete();

    // If chord just became complete, advance to next
    if (!wasComplete && this.state.isChordComplete) {
      this.completeCurrentChord();
      return true; // Indicate navigation occurred
    }

    return false;
  }

  /**
   * Compute the set of notes that should still be held from previous chords
   */
  private getHeldNotesForCurrent(): Set<number> {
    if (!this.state.currentChord) return new Set();

    const held: Set<number> = new Set();
    const currentStart = this.state.currentChord.startTimeQuarters;

    // Look back through all previous chords to see if their endTime goes past current start
    for (let i = 0; i < this.state.currentChordIndex; i++) {
      const prevChord = this.chords[i];
      if (!prevChord) continue;
      // Only consider hold-over if in the same measure to avoid incorrect carry-over when
      // measure startTime values reset (MusicXML offsets are per-measure).
      if (prevChord.measureNumber === this.state.currentChord!.measureNumber &&
          prevChord.endTimeQuarters > currentStart) {
        prevChord.midiNumbers.forEach(n => held.add(n));
      }
    }

    return held;
  }

  /**
   * Check if the current chord is complete based on user input
   */
  private checkChordComplete(): boolean {
    if (!this.state.currentChord) return false;

    // Notes that start at this chord
    const currentChordNotes = new Set(this.state.currentChord.midiNumbers);
    // Notes that should still be held from previous chords
    const heldNotes = this.getHeldNotesForCurrent();

    // Required notes are union of held + current chord notes
    const requiredNotes = new Set<number>([...heldNotes, ...currentChordNotes]);
    const userNotes = this.state.userInput;

    // Must have all required notes pressed
    const hasAllRequired = Array.from(requiredNotes).every(n => userNotes.has(n));

    if (!hasAllRequired) return false;

    if (this.options.requireExactMatch) {
      // Allow overlap: notes that belonged to the immediately previous chord (grace overlap)
      const toleratedExtra = new Set<number>();
      if (this.state.currentChordIndex > 0) {
        this.chords[this.state.currentChordIndex - 1].midiNumbers.forEach(n => toleratedExtra.add(n));
      }

      const hasOnlyAllowed = Array.from(userNotes).every(n => requiredNotes.has(n) || toleratedExtra.has(n));
      return hasOnlyAllowed;
    }

    return true;
  }

  /**
   * Complete the current chord and advance to next
   */
  private completeCurrentChord(): void {
    if (!this.state.currentChord) return;

    // Mark chord as completed
    this.state.completedChords.push(this.state.currentChord.id);
    
    // Notify about completion
    if (this.options.onChordComplete) {
      this.options.onChordComplete(this.state.currentChord);
    }

    // Advance to next chord
    this.state.currentChordIndex++;
    
    if (this.state.currentChordIndex >= this.chords.length) {
      // Navigation complete
      this.state.currentChord = null;
      this.state.isChordComplete = false;
      
      if (this.options.onNavigationComplete) {
        this.options.onNavigationComplete();
      }
    } else {
      // Move to next chord
      this.state.currentChord = this.chords[this.state.currentChordIndex];
      this.state.isChordComplete = false;
      
      if (this.options.onChordChange) {
        this.options.onChordChange(this.state.currentChord, this.state.currentChordIndex);
      }
    }
  }

  /**
   * Navigate to a specific chord by index
   */
  seekToChord(index: number): void {
    if (index < 0 || index >= this.chords.length) return;

    this.state.currentChordIndex = index;
    this.state.currentChord = this.chords[index];
    this.state.isChordComplete = false;
    this.state.userInput.clear();

    if (this.options.onChordChange) {
      this.options.onChordChange(this.state.currentChord, this.state.currentChordIndex);
    }
  }

  /**
   * Reset navigation to the beginning
   */
  reset(): void {
    this.state.currentChordIndex = 0;
    this.state.currentChord = this.chords[0] || null;
    this.state.completedChords = [];
    this.state.userInput.clear();
    this.state.isChordComplete = false;

    if (this.options.onChordChange && this.state.currentChord) {
      this.options.onChordChange(this.state.currentChord, this.state.currentChordIndex);
    }
  }

  /**
   * Get current navigation state
   */
  getState(): NavigationState {
    return { ...this.state };
  }

  /**
   * Get all chords
   */
  getChords(): ChordData[] {
    return [...this.chords];
  }

  /**
   * Get progress as percentage
   */
  getProgress(): number {
    if (this.state.totalChords === 0) return 0;
    return this.state.currentChordIndex / this.state.totalChords;
  }

  /**
   * Get expected MIDI numbers for current chord
   */
  getCurrentExpectedNotes(): number[] {
    return this.state.currentChord?.midiNumbers || [];
  }

  /**
   * Get currently pressed MIDI numbers
   */
  getCurrentUserInput(): number[] {
    return Array.from(this.state.userInput);
  }

  /**
   * Check if navigation is complete
   */
  isComplete(): boolean {
    return this.state.currentChord === null && this.state.currentChordIndex >= this.chords.length;
  }
} 