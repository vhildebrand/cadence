interface ExpectedNote {
  id: string;
  midiNumber: number;
  startTimeQuarters: number;
  endTimeQuarters: number;
  duration: number;
  velocity?: number;
  isOptional?: boolean; // For grace notes, ornaments, etc.
}

interface PlayedNote {
  midiNumber: number;
  startTime: number; // Performance time in ms
  endTime?: number;
  velocity: number;
  timestamp: number;
}

interface NoteEvaluation {
  expectedNote: ExpectedNote;
  playedNote?: PlayedNote;
  evaluation: 'perfect' | 'good' | 'early' | 'late' | 'wrong' | 'missed';
  timingError: number; // ms difference from expected
  accuracyScore: number; // 0-100
  feedback: string;
}

interface PerformanceMetrics {
  noteAccuracy: number;        // % of correct notes
  rhythmAccuracy: number;      // Timing precision
  tempoConsistency: number;    // BPM adherence  
  dynamicsAccuracy: number;    // Velocity matching
  overallScore: number;        // Weighted composite
  
  // Detailed stats
  totalNotes: number;
  correctNotes: number;
  perfectTiming: number;
  goodTiming: number;
  earlyNotes: number;
  lateNotes: number;
  wrongNotes: number;
  missedNotes: number;
  
  // Timing analysis
  avgTimingError: number;      // Average ms early/late
  timingStdDev: number;        // Consistency measure
  currentTempo: number;        // Detected tempo
  tempoVariation: number;      // % variation from expected
}

interface ToleranceSettings {
  perfectWindow: number;       // ±ms for perfect timing
  goodWindow: number;          // ±ms for good timing
  acceptableWindow: number;    // ±ms for acceptable timing
  tempoTolerance: number;      // ±BPM tolerance
  velocityTolerance: number;   // ±velocity tolerance
}

export class PerformanceEvaluator {
  private expectedNotes: Map<string, ExpectedNote> = new Map();
  private playedNotes: PlayedNote[] = [];
  private evaluations: NoteEvaluation[] = [];
  private startTime: number = 0;
  private currentTempo: number = 120;
  private isEvaluating: boolean = false;
  
  private toleranceSettings: ToleranceSettings = {
    perfectWindow: 50,        // ±50ms for perfect
    goodWindow: 100,          // ±100ms for good  
    acceptableWindow: 200,    // ±200ms for acceptable
    tempoTolerance: 10,       // ±10 BPM tolerance
    velocityTolerance: 20     // ±20 velocity tolerance
  };
  
  private recentTimings: number[] = []; // For tempo detection
  private lastNoteTime: number = 0;
  
  constructor(expectedTempo: number = 120, customTolerances?: Partial<ToleranceSettings>) {
    this.currentTempo = expectedTempo;
    if (customTolerances) {
      this.toleranceSettings = { ...this.toleranceSettings, ...customTolerances };
    }
  }
  
  /**
   * Load expected notes from sheet music data
   */
  loadExpectedNotes(musicData: any, startTimeQuarters: number = 0): void {
    this.expectedNotes.clear();
    
    if (!musicData?.measures) return;
    
    musicData.measures.forEach((measure: any) => {
      if (!measure.notes) return;
      
      measure.notes.forEach((note: any) => {
        if (note.midiNumbers && note.midiNumbers.length > 0) {
          note.midiNumbers.forEach((midiNumber: number, index: number) => {
            const expectedNote: ExpectedNote = {
              id: `${note.id}_${index}`,
              midiNumber,
              startTimeQuarters: note.startTime + startTimeQuarters,
              endTimeQuarters: note.endTime + startTimeQuarters,
              duration: note.endTime - note.startTime,
              velocity: note.velocity || 64
            };
            
            this.expectedNotes.set(expectedNote.id, expectedNote);
          });
        }
      });
    });
    
    console.log(`Loaded ${this.expectedNotes.size} expected notes for evaluation`);
  }
  
  /**
   * Start performance evaluation
   */
  startEvaluation(): void {
    this.isEvaluating = true;
    this.startTime = performance.now();
    this.playedNotes = [];
    this.evaluations = [];
    this.recentTimings = [];
    this.lastNoteTime = 0;
    
    console.log('Performance evaluation started');
  }
  
  /**
   * Stop performance evaluation
   */
  stopEvaluation(): void {
    this.isEvaluating = false;
    console.log('Performance evaluation stopped');
  }
  
  /**
   * Record a MIDI note input
   */
  recordNote(midiNumber: number, velocity: number, isNoteOn: boolean): NoteEvaluation | null {
    if (!this.isEvaluating) return null;
    
    const now = performance.now();
    const relativeTime = now - this.startTime;
    
    if (isNoteOn) {
      // Record note start
      const playedNote: PlayedNote = {
        midiNumber,
        startTime: relativeTime,
        velocity,
        timestamp: now
      };
      
      this.playedNotes.push(playedNote);
      
      // Update tempo detection
      this.updateTempoDetection(relativeTime);
      
      // Evaluate this note against expected notes
      return this.evaluateNote(playedNote);
    } else {
      // Record note end
      const startedNote = this.playedNotes.find(note => 
        note.midiNumber === midiNumber && !note.endTime
      );
      
      if (startedNote) {
        startedNote.endTime = relativeTime;
      }
    }
    
    return null;
  }
  
  /**
   * Evaluate a played note against expected notes
   */
  private evaluateNote(playedNote: PlayedNote): NoteEvaluation {
    const currentTimeQuarters = this.msToQuarters(playedNote.startTime);
    
    // Find the closest expected note within a reasonable window
    let bestMatch: ExpectedNote | null = null;
    let bestMatchScore = Infinity;
    
    for (const expectedNote of this.expectedNotes.values()) {
      // Check if this note matches the MIDI number
      if (expectedNote.midiNumber !== playedNote.midiNumber) continue;
      
      // Calculate timing difference
      const timingDiff = Math.abs(currentTimeQuarters - expectedNote.startTimeQuarters);
      const timingDiffMs = this.quartersToMs(timingDiff);
      
      // Only consider notes within the acceptable window
      if (timingDiffMs <= this.toleranceSettings.acceptableWindow) {
        if (timingDiffMs < bestMatchScore) {
          bestMatch = expectedNote;
          bestMatchScore = timingDiffMs;
        }
      }
    }
    
    const evaluation = this.createEvaluation(playedNote, bestMatch, bestMatchScore);
    this.evaluations.push(evaluation);
    
    return evaluation;
  }
  
  /**
   * Create note evaluation with scoring
   */
  private createEvaluation(
    playedNote: PlayedNote, 
    expectedNote: ExpectedNote | null, 
    timingErrorMs: number
  ): NoteEvaluation {
    if (!expectedNote) {
      // Unexpected note
      return {
        expectedNote: {
          id: 'unexpected',
          midiNumber: playedNote.midiNumber,
          startTimeQuarters: this.msToQuarters(playedNote.startTime),
          endTimeQuarters: this.msToQuarters(playedNote.startTime),
          duration: 0
        },
        playedNote,
        evaluation: 'wrong',
        timingError: 0,
        accuracyScore: 0,
        feedback: `Unexpected note: ${this.midiToNoteName(playedNote.midiNumber)}`
      };
    }
    
    // Determine evaluation based on timing accuracy
    let evaluation: NoteEvaluation['evaluation'];
    let accuracyScore: number;
    let feedback: string;
    
    const expectedTimeMs = this.quartersToMs(expectedNote.startTimeQuarters);
    const actualTimingError = playedNote.startTime - expectedTimeMs;
    
    if (Math.abs(actualTimingError) <= this.toleranceSettings.perfectWindow) {
      evaluation = 'perfect';
      accuracyScore = 100;
      feedback = 'Perfect timing!';
    } else if (Math.abs(actualTimingError) <= this.toleranceSettings.goodWindow) {
      evaluation = 'good';
      accuracyScore = 85;
      feedback = 'Good timing';
    } else if (actualTimingError < 0) {
      evaluation = 'early';
      accuracyScore = Math.max(50, 70 - Math.abs(actualTimingError) / 5);
      feedback = `Early by ${Math.abs(actualTimingError).toFixed(0)}ms`;
    } else {
      evaluation = 'late';
      accuracyScore = Math.max(50, 70 - Math.abs(actualTimingError) / 5);
      feedback = `Late by ${Math.abs(actualTimingError).toFixed(0)}ms`;
    }
    
    return {
      expectedNote,
      playedNote,
      evaluation,
      timingError: actualTimingError,
      accuracyScore,
      feedback
    };
  }
  
  /**
   * Update tempo detection based on note timings
   */
  private updateTempoDetection(currentTime: number): void {
    if (this.lastNoteTime > 0) {
      const interval = currentTime - this.lastNoteTime;
      this.recentTimings.push(interval);
      
      // Keep only recent timings (last 8 notes)
      if (this.recentTimings.length > 8) {
        this.recentTimings.shift();
      }
      
      // Calculate average tempo from recent intervals
      if (this.recentTimings.length >= 3) {
        const avgInterval = this.recentTimings.reduce((a, b) => a + b) / this.recentTimings.length;
        const detectedTempo = 60000 / avgInterval; // Convert ms to BPM
        
        // Smooth tempo changes
        this.currentTempo = this.currentTempo * 0.7 + detectedTempo * 0.3;
      }
    }
    
    this.lastNoteTime = currentTime;
  }
  
  /**
   * Calculate comprehensive performance metrics
   */
  calculateMetrics(): PerformanceMetrics {
    const totalExpected = this.expectedNotes.size;
    const totalPlayed = this.evaluations.length;
    
    // Count evaluation types
    const perfect = this.evaluations.filter(e => e.evaluation === 'perfect').length;
    const good = this.evaluations.filter(e => e.evaluation === 'good').length;
    const early = this.evaluations.filter(e => e.evaluation === 'early').length;
    const late = this.evaluations.filter(e => e.evaluation === 'late').length;
    const wrong = this.evaluations.filter(e => e.evaluation === 'wrong').length;
    const correct = perfect + good;
    const missed = Math.max(0, totalExpected - totalPlayed);
    
    // Calculate accuracy percentages
    const noteAccuracy = totalExpected > 0 ? (correct / totalExpected) * 100 : 0;
    const rhythmAccuracy = totalPlayed > 0 ? ((perfect + good * 0.85) / totalPlayed) * 100 : 0;
    
    // Calculate timing statistics
    const timingErrors = this.evaluations
      .filter(e => e.evaluation !== 'wrong')
      .map(e => e.timingError);
    
    const avgTimingError = timingErrors.length > 0 
      ? timingErrors.reduce((a, b) => a + b) / timingErrors.length 
      : 0;
    
    const timingStdDev = timingErrors.length > 1
      ? Math.sqrt(timingErrors.reduce((sum, x) => sum + Math.pow(x - avgTimingError, 2), 0) / timingErrors.length)
      : 0;
    
    // Calculate tempo consistency
    const expectedTempo = 120; // Should come from music data
    const tempoVariation = Math.abs(this.currentTempo - expectedTempo) / expectedTempo * 100;
    const tempoConsistency = Math.max(0, 100 - tempoVariation * 2);
    
    // Calculate overall score (weighted combination)
    const overallScore = (
      noteAccuracy * 0.4 +
      rhythmAccuracy * 0.3 +
      tempoConsistency * 0.2 +
      (100 - Math.min(100, timingStdDev * 2)) * 0.1
    );
    
    return {
      noteAccuracy,
      rhythmAccuracy,
      tempoConsistency,
      dynamicsAccuracy: 85, // Placeholder - would analyze velocity
      overallScore,
      
      totalNotes: totalExpected,
      correctNotes: correct,
      perfectTiming: perfect,
      goodTiming: good,
      earlyNotes: early,
      lateNotes: late,
      wrongNotes: wrong,
      missedNotes: missed,
      
      avgTimingError,
      timingStdDev,
      currentTempo: this.currentTempo,
      tempoVariation
    };
  }
  
  /**
   * Get recent evaluations for visual feedback
   */
  getRecentEvaluations(maxAge: number = 2000): NoteEvaluation[] {
    const cutoff = performance.now() - maxAge;
    return this.evaluations.filter(e => 
      e.playedNote && e.playedNote.timestamp > cutoff
    );
  }
  
  /**
   * Utility: Convert milliseconds to quarter notes
   */
  private msToQuarters(ms: number): number {
    return (ms / 1000) * (this.currentTempo / 60);
  }
  
  /**
   * Utility: Convert quarter notes to milliseconds
   */
  private quartersToMs(quarters: number): number {
    return (quarters * 60 / this.currentTempo) * 1000;
  }
  
  /**
   * Utility: Convert MIDI number to note name
   */
  private midiToNoteName(midiNumber: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNumber / 12) - 1;
    const noteIndex = midiNumber % 12;
    return `${noteNames[noteIndex]}${octave}`;
  }
  
  /**
   * Update tolerance settings for difficulty adjustment
   */
  updateTolerances(newTolerances: Partial<ToleranceSettings>): void {
    this.toleranceSettings = { ...this.toleranceSettings, ...newTolerances };
  }
  
  /**
   * Reset evaluator state
   */
  reset(): void {
    this.expectedNotes.clear();
    this.playedNotes = [];
    this.evaluations = [];
    this.recentTimings = [];
    this.lastNoteTime = 0;
    this.isEvaluating = false;
  }
} 