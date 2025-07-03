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
  errorCount: number; // Number of erroneous note-on events
  successStreak: number; // consecutive chords with zero errors
  errorStreak: number;   // consecutive chords that had at least 1 error
  correctChords: number; // Total number of chords played correctly
  longestStreak: number; // Best streak achieved during this performance
}

interface ChordNavigatorOptions {
  onChordChange?: (chord: ChordData | null, index: number) => void;
  onChordComplete?: (chord: ChordData) => void;
  onNavigationComplete?: () => void;
  requireExactMatch?: boolean; // If true, no extra notes allowed
  timeTolerance?: number; // Tolerance for considering notes simultaneous (default: 0.0001)
  minChordSize?: number; // Minimum number of notes to consider a chord (default: 1)
  maxChordGap?: number; // Maximum gap between notes to group them (default: 0.1)
  groupByBeat?: boolean; // Group notes by beat position rather than exact timing
  beatSubdivision?: number; // How many subdivisions per beat (default: 4 for sixteenth notes)
}

export class ChordNavigator {
  private chords: ChordData[] = [];
  private state: NavigationState;
  private options: ChordNavigatorOptions;

  // Tracks what notes were physically held at the moment the last chord was completed
  private prevUserInput: Set<number> = new Set();

  // Flag indicating whether an error has already been registered for the current chord
  private hasErrorThisChord: boolean = false;

  constructor(options: ChordNavigatorOptions = {}) {
    this.options = {
      requireExactMatch: true,
      timeTolerance: 0.0001,
      minChordSize: 1,
      maxChordGap: 0.1,
      groupByBeat: false,
      beatSubdivision: 4,
      ...options
    };
    
    this.state = {
      currentChordIndex: 0,
      totalChords: 0,
      currentChord: null,
      completedChords: [],
      userInput: new Set(),
      isChordComplete: false,
      errorCount: 0,
      successStreak: 0,
      errorStreak: 0,
      correctChords: 0,
      longestStreak: 0
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
      const chordClusters: Array<typeof allNotesInMeasure> = [];
      
      if (this.options.groupByBeat) {
        // Group by beat position for more flexible chord detection
        const beatGroups = new Map<number, typeof allNotesInMeasure>();
        
        allNotesInMeasure.forEach(noteInfo => {
          const st = noteInfo.note.startTime || 0;
          // Round to nearest beat subdivision
          const beatPosition = Math.round(st * this.options.beatSubdivision!) / this.options.beatSubdivision!;
          
          if (!beatGroups.has(beatPosition)) {
            beatGroups.set(beatPosition, []);
          }
          beatGroups.get(beatPosition)!.push(noteInfo);
        });
        
        // Convert beat groups to clusters
        const sortedBeatPositions = Array.from(beatGroups.keys()).sort((a, b) => a - b);
        sortedBeatPositions.forEach(beatPos => {
          const cluster = beatGroups.get(beatPos)!;
          if (cluster.length >= this.options.minChordSize!) {
            chordClusters.push(cluster);
          } else {
            // If cluster is too small, add individual notes
            cluster.forEach(noteInfo => chordClusters.push([noteInfo]));
          }
        });
      } else {
        // Original time-based clustering with configurable tolerance
        let currentCluster: typeof allNotesInMeasure = [];
        let clusterStartTime: number | null = null;
        
        allNotesInMeasure.forEach(noteInfo => {
          const st = noteInfo.note.startTime || 0;
          
          if (clusterStartTime === null || Math.abs(st - clusterStartTime) <= this.options.timeTolerance!) {
            currentCluster.push(noteInfo);
            clusterStartTime = clusterStartTime === null ? st : clusterStartTime;
          } else {
            // Check if we should extend the cluster based on maxChordGap
            if (currentCluster.length > 0 && st - clusterStartTime <= this.options.maxChordGap!) {
              currentCluster.push(noteInfo);
            } else {
              // Finalize current cluster
              if (currentCluster.length >= this.options.minChordSize!) {
                chordClusters.push([...currentCluster]);
              } else {
                // Add individual notes if cluster is too small
                currentCluster.forEach(ni => chordClusters.push([ni]));
              }
              currentCluster = [noteInfo];
              clusterStartTime = st;
            }
          }
        });
        if (currentCluster.length > 0) {
          if (currentCluster.length >= this.options.minChordSize!) {
            chordClusters.push(currentCluster);
          } else {
            currentCluster.forEach(ni => chordClusters.push([ni]));
          }
        }
      }
      
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
    this.state.errorCount = 0;
    this.state.successStreak = 0;
    this.state.errorStreak = 0;
    this.hasErrorThisChord = false;

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

      // Count an error only once per chord if the pressed note is NOT part of the expected chord
      if (!this.state.currentChord?.midiNumbers.includes(midiNumber) && !this.hasErrorThisChord) {
        this.state.errorCount += 1;
        this.hasErrorThisChord = true;
      }
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
      // Only consider hold-over if in the same measure AND the note is still physically held
      if (
        prevChord.measureNumber === this.state.currentChord!.measureNumber &&
        prevChord.endTimeQuarters > currentStart
      ) {
        prevChord.midiNumbers.forEach(n => {
          if (this.prevUserInput.has(n)) held.add(n);
        });
      }
    }

    return held;
  }

  /**
   * Check if the current chord is complete based on user input
   */
  private checkChordComplete(): boolean {
    if (!this.state.currentChord) return false;

    // Required notes are ONLY the notes that start at this chord
    const requiredNotes = new Set<number>(this.state.currentChord.midiNumbers);
    const userNotes = this.state.userInput;

    // Must have all required notes pressed
    const hasAllRequired = Array.from(requiredNotes).every(n => userNotes.has(n));

    // We no longer block on extra notes; as long as all required are pressed, chord is complete.
    return hasAllRequired;
  }

  /**
   * Complete the current chord and advance to next
   */
  private completeCurrentChord(): void {
    if (!this.state.currentChord) return;

    // Mark chord as completed
    this.state.completedChords.push(this.state.currentChord.id);
    
    // Snapshot which notes are physically held at this moment
    this.prevUserInput = new Set(this.state.userInput);
    
    // Update streaks based on whether an error occurred during this chord
    if (this.hasErrorThisChord) {
      this.state.errorStreak += 1;
      this.state.successStreak = 0;
    } else {
      this.state.successStreak += 1;
      this.state.errorStreak = 0;
      this.state.correctChords += 1;
      
      // Update longest streak if current streak is better
      if (this.state.successStreak > this.state.longestStreak) {
        this.state.longestStreak = this.state.successStreak;
      }
    }
    // Reset flag for next chord
    this.hasErrorThisChord = false;
    
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
      this.hasErrorThisChord = false;
      
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
    this.hasErrorThisChord = false;

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
    this.state.errorCount = 0;
    this.state.successStreak = 0;
    this.state.errorStreak = 0;
    this.state.correctChords = 0;
    this.state.longestStreak = 0;
    this.hasErrorThisChord = false;

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

  /**
   * Get total errors recorded so far
   */
  getErrorCount(): number {
    return this.state.errorCount;
  }

  /**
   * Get current streaks
   */
  getStreaks(): { successStreak: number; errorStreak: number } {
    return { successStreak: this.state.successStreak, errorStreak: this.state.errorStreak };
  }
} 