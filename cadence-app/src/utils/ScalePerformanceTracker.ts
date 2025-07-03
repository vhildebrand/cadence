// Scale performance data structures
export interface ScalePerformanceSession {
  id: string;
  scaleId: string;
  scaleName: string;
  rootNote: string;
  octave: number;
  direction: 'ascending' | 'descending' | 'both';
  timestamp: number;
  duration: number; // in seconds
  totalNotes: number;
  correctNotes: number;
  errorCount: number;
  successStreak: number;
  longestStreak: number;
  accuracy: number; // percentage
  metronomeEnabled: boolean;
  bpm?: number;
  timingAccuracy?: number; // percentage of notes played on time
  toleranceMs?: number;
  avgTimingError?: number; // average timing error in ms
  completed: boolean;
}

export interface ScalePerformance {
  scaleId: string;
  scaleName: string;
  rootNote: string;
  octave: number;
  firstPlayed: number;
  lastPlayed: number;
  totalSessions: number;
  totalPlayTime: number; // in seconds
  bestAccuracy: number;
  bestStreak: number;
  averageAccuracy: number;
  bestTimingAccuracy: number;
  averageTimingAccuracy: number;
  sessionsWithMetronome: number;
  sessionsWithoutMetronome: number;
  sessions: ScalePerformanceSession[];
}

export interface ScaleUserProfile {
  userId: string;
  username: string;
  createdAt: number;
  totalPlayTime: number; // in seconds
  totalSessions: number;
  totalScales: number;
  bestAccuracy: number;
  bestStreak: number;
  averageAccuracy: number;
  bestTimingAccuracy: number;
  averageTimingAccuracy: number;
  metronomeUsageRate: number; // percentage
  scales: Map<string, ScalePerformance>;
  recentSessions: ScalePerformanceSession[];
}

export class ScalePerformanceTracker {
  private profile: ScaleUserProfile;
  private currentSession: ScalePerformanceSession | null = null;
  private storageKey = 'cadence_scale_user_profile';
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.profile = this.loadProfile();
  }

  /**
   * Start a new scale practice session
   */
  startSession(scaleData: {
    scaleName: string;
    rootNote: string;
    octave: number;
    direction: 'ascending' | 'descending' | 'both';
    totalNotes: number;
    metronomeEnabled: boolean;
    bpm?: number;
    toleranceMs?: number;
  }): string {
    const sessionId = `scale_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const scaleId = `${scaleData.scaleName}_${scaleData.rootNote}_${scaleData.octave}`;
    
    this.currentSession = {
      id: sessionId,
      scaleId,
      scaleName: scaleData.scaleName,
      rootNote: scaleData.rootNote,
      octave: scaleData.octave,
      direction: scaleData.direction,
      timestamp: Date.now(),
      duration: 0,
      totalNotes: scaleData.totalNotes,
      correctNotes: 0,
      errorCount: 0,
      successStreak: 0,
      longestStreak: 0,
      accuracy: 0,
      metronomeEnabled: scaleData.metronomeEnabled,
      bpm: scaleData.bpm,
      timingAccuracy: scaleData.metronomeEnabled ? 0 : undefined,
      toleranceMs: scaleData.toleranceMs,
      avgTimingError: scaleData.metronomeEnabled ? 0 : undefined,
      completed: false
    };

    return sessionId;
  }

  /**
   * Update current session with performance data
   */
  updateSession(stats: {
    correctNotes: number;
    errorCount: number;
    successStreak: number;
    longestStreak: number;
    onTimeNotes?: number;
    totalTimingError?: number;
  }): void {
    if (!this.currentSession) return;

    this.currentSession.correctNotes = stats.correctNotes;
    this.currentSession.errorCount = stats.errorCount;
    this.currentSession.successStreak = stats.successStreak;
    this.currentSession.longestStreak = stats.longestStreak;
    this.currentSession.accuracy = this.currentSession.totalNotes > 0 
      ? (stats.correctNotes / this.currentSession.totalNotes) * 100 
      : 0;

    // Update timing accuracy if metronome is enabled
    if (this.currentSession.metronomeEnabled && stats.onTimeNotes !== undefined) {
      this.currentSession.timingAccuracy = stats.correctNotes > 0
        ? (stats.onTimeNotes / stats.correctNotes) * 100
        : 0;
      
      if (stats.totalTimingError !== undefined && stats.correctNotes > 0) {
        this.currentSession.avgTimingError = stats.totalTimingError / stats.correctNotes;
      }
    }
  }

  /**
   * Complete the current session
   */
  completeSession(): ScalePerformanceSession | null {
    if (!this.currentSession) return null;

    this.currentSession.completed = true;
    this.currentSession.duration = (Date.now() - this.currentSession.timestamp) / 1000;

    // Add session to profile
    this.addSessionToProfile(this.currentSession);

    // Save profile
    this.saveProfile();

    const completedSession = { ...this.currentSession };
    this.currentSession = null;

    return completedSession;
  }

  /**
   * Get current session
   */
  getCurrentSession(): ScalePerformanceSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Get user profile
   */
  getProfile(): ScaleUserProfile {
    return { ...this.profile };
  }

  /**
   * Get performance for a specific scale
   */
  getScalePerformance(scaleId: string): ScalePerformance | null {
    return this.profile.scales.get(scaleId) || null;
  }

  /**
   * Get recent sessions (last 10)
   */
  getRecentSessions(limit: number = 10): ScalePerformanceSession[] {
    return this.profile.recentSessions.slice(0, limit);
  }

  /**
   * Get performance trends for a scale
   */
  getScaleTrends(scaleId: string, days: number = 30): {
    dates: string[];
    accuracies: number[];
    streaks: number[];
    timingAccuracies: number[];
  } {
    const scale = this.profile.scales.get(scaleId);
    if (!scale) return { dates: [], accuracies: [], streaks: [], timingAccuracies: [] };

    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentSessions = scale.sessions
      .filter(session => session.timestamp >= cutoffDate)
      .sort((a, b) => a.timestamp - b.timestamp);

    return {
      dates: recentSessions.map(session => 
        new Date(session.timestamp).toLocaleDateString()
      ),
      accuracies: recentSessions.map(session => session.accuracy),
      streaks: recentSessions.map(session => session.longestStreak),
      timingAccuracies: recentSessions.map(session => session.timingAccuracy || 0)
    };
  }

  /**
   * Get overall performance trends
   */
  getOverallTrends(days: number = 30): {
    dates: string[];
    averageAccuracies: number[];
    totalSessions: number[];
    timingAccuracies: number[];
  } {
    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentSessions = this.profile.recentSessions
      .filter(session => session.timestamp >= cutoffDate);

    // Group by date
    const sessionsByDate = new Map<string, ScalePerformanceSession[]>();
    recentSessions.forEach(session => {
      const date = new Date(session.timestamp).toLocaleDateString();
      if (!sessionsByDate.has(date)) {
        sessionsByDate.set(date, []);
      }
      sessionsByDate.get(date)!.push(session);
    });

    const dates = Array.from(sessionsByDate.keys()).sort();
    const averageAccuracies = dates.map(date => {
      const sessions = sessionsByDate.get(date)!;
      const totalAccuracy = sessions.reduce((sum, session) => sum + session.accuracy, 0);
      return totalAccuracy / sessions.length;
    });
    const totalSessions = dates.map(date => sessionsByDate.get(date)!.length);
    const timingAccuracies = dates.map(date => {
      const sessions = sessionsByDate.get(date)!;
      const metronomesSessions = sessions.filter(s => s.metronomeEnabled && s.timingAccuracy !== undefined);
      if (metronomesSessions.length === 0) return 0;
      const totalTimingAccuracy = metronomesSessions.reduce((sum, session) => sum + (session.timingAccuracy || 0), 0);
      return totalTimingAccuracy / metronomesSessions.length;
    });

    return { dates, averageAccuracies, totalSessions, timingAccuracies };
  }

  /**
   * Get scale statistics grouped by scale type
   */
  getScaleTypeStats(): {
    scaleType: string;
    totalSessions: number;
    averageAccuracy: number;
    bestAccuracy: number;
    averageTimingAccuracy: number;
  }[] {
    const stats = new Map<string, {
      totalSessions: number;
      totalAccuracy: number;
      bestAccuracy: number;
      totalTimingAccuracy: number;
      timingSessions: number;
    }>();

    this.profile.scales.forEach(scale => {
      const existing = stats.get(scale.scaleName) || {
        totalSessions: 0,
        totalAccuracy: 0,
        bestAccuracy: 0,
        totalTimingAccuracy: 0,
        timingSessions: 0
      };

      existing.totalSessions += scale.totalSessions;
      existing.totalAccuracy += scale.averageAccuracy * scale.totalSessions;
      existing.bestAccuracy = Math.max(existing.bestAccuracy, scale.bestAccuracy);
      
      if (scale.averageTimingAccuracy > 0) {
        existing.totalTimingAccuracy += scale.averageTimingAccuracy * scale.sessionsWithMetronome;
        existing.timingSessions += scale.sessionsWithMetronome;
      }

      stats.set(scale.scaleName, existing);
    });

    return Array.from(stats.entries()).map(([scaleType, data]) => ({
      scaleType,
      totalSessions: data.totalSessions,
      averageAccuracy: data.totalSessions > 0 ? data.totalAccuracy / data.totalSessions : 0,
      bestAccuracy: data.bestAccuracy,
      averageTimingAccuracy: data.timingSessions > 0 ? data.totalTimingAccuracy / data.timingSessions : 0
    }));
  }

  /**
   * Subscribe to profile changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Clear all performance data
   */
  clearAllData(): void {
    this.profile = this.createNewProfile();
    this.currentSession = null;
    this.saveProfile();
    this.notifyListeners();
  }

  /**
   * Add session to profile and update statistics
   */
  private addSessionToProfile(session: ScalePerformanceSession): void {
    // Add to recent sessions
    this.profile.recentSessions.unshift(session);
    this.profile.recentSessions = this.profile.recentSessions.slice(0, 50); // Keep last 50

    // Update scale performance
    let scalePerformance = this.profile.scales.get(session.scaleId);
    if (!scalePerformance) {
      scalePerformance = {
        scaleId: session.scaleId,
        scaleName: session.scaleName,
        rootNote: session.rootNote,
        octave: session.octave,
        firstPlayed: session.timestamp,
        lastPlayed: session.timestamp,
        totalSessions: 0,
        totalPlayTime: 0,
        bestAccuracy: 0,
        bestStreak: 0,
        averageAccuracy: 0,
        bestTimingAccuracy: 0,
        averageTimingAccuracy: 0,
        sessionsWithMetronome: 0,
        sessionsWithoutMetronome: 0,
        sessions: []
      };
      this.profile.scales.set(session.scaleId, scalePerformance);
      this.profile.totalScales = this.profile.scales.size;
    }

    // Update scale statistics
    scalePerformance.lastPlayed = session.timestamp;
    scalePerformance.totalSessions++;
    scalePerformance.totalPlayTime += session.duration;
    scalePerformance.sessions.push(session);

    if (session.metronomeEnabled) {
      scalePerformance.sessionsWithMetronome++;
    } else {
      scalePerformance.sessionsWithoutMetronome++;
    }

    if (session.accuracy > scalePerformance.bestAccuracy) {
      scalePerformance.bestAccuracy = session.accuracy;
    }
    if (session.longestStreak > scalePerformance.bestStreak) {
      scalePerformance.bestStreak = session.longestStreak;
    }
    if (session.timingAccuracy !== undefined && session.timingAccuracy > scalePerformance.bestTimingAccuracy) {
      scalePerformance.bestTimingAccuracy = session.timingAccuracy;
    }

    // Recalculate average accuracy
    const totalAccuracy = scalePerformance.sessions.reduce((sum, s) => sum + s.accuracy, 0);
    scalePerformance.averageAccuracy = totalAccuracy / scalePerformance.sessions.length;

    // Recalculate average timing accuracy
    const timingSessions = scalePerformance.sessions.filter(s => s.timingAccuracy !== undefined);
    if (timingSessions.length > 0) {
      const totalTimingAccuracy = timingSessions.reduce((sum, s) => sum + (s.timingAccuracy || 0), 0);
      scalePerformance.averageTimingAccuracy = totalTimingAccuracy / timingSessions.length;
    }

    // Update overall profile statistics
    this.profile.totalSessions++;
    this.profile.totalPlayTime += session.duration;

    if (session.accuracy > this.profile.bestAccuracy) {
      this.profile.bestAccuracy = session.accuracy;
    }
    if (session.longestStreak > this.profile.bestStreak) {
      this.profile.bestStreak = session.longestStreak;
    }
    if (session.timingAccuracy !== undefined && session.timingAccuracy > this.profile.bestTimingAccuracy) {
      this.profile.bestTimingAccuracy = session.timingAccuracy;
    }

    // Recalculate overall averages
    const allSessions = Array.from(this.profile.scales.values())
      .flatMap(scale => scale.sessions);
    const totalOverallAccuracy = allSessions.reduce((sum, s) => sum + s.accuracy, 0);
    this.profile.averageAccuracy = totalOverallAccuracy / allSessions.length;

    const allTimingSessions = allSessions.filter(s => s.timingAccuracy !== undefined);
    if (allTimingSessions.length > 0) {
      const totalTimingAccuracy = allTimingSessions.reduce((sum, s) => sum + (s.timingAccuracy || 0), 0);
      this.profile.averageTimingAccuracy = totalTimingAccuracy / allTimingSessions.length;
    }

    // Update metronome usage rate
    const metronomesSessions = allSessions.filter(s => s.metronomeEnabled).length;
    this.profile.metronomeUsageRate = (metronomesSessions / allSessions.length) * 100;
  }

  /**
   * Load profile from localStorage
   */
  private loadProfile(): ScaleUserProfile {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert scales back to Map
        parsed.scales = new Map(Object.entries(parsed.scales || {}));
        return parsed;
      }
    } catch (error) {
      console.error('Failed to load scale profile:', error);
    }
    return this.createNewProfile();
  }

  /**
   * Save profile to localStorage
   */
  private saveProfile(): void {
    try {
      const profileToSave = { ...this.profile };
      // Convert Map to object for JSON serialization
      profileToSave.scales = Object.fromEntries(this.profile.scales) as any;
      localStorage.setItem(this.storageKey, JSON.stringify(profileToSave));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save scale profile:', error);
    }
  }

  /**
   * Create a new profile
   */
  private createNewProfile(): ScaleUserProfile {
    return {
      userId: `scale_user_${Date.now()}`,
      username: 'Scale Practitioner',
      createdAt: Date.now(),
      totalPlayTime: 0,
      totalSessions: 0,
      totalScales: 0,
      bestAccuracy: 0,
      bestStreak: 0,
      averageAccuracy: 0,
      bestTimingAccuracy: 0,
      averageTimingAccuracy: 0,
      metronomeUsageRate: 0,
      scales: new Map(),
      recentSessions: []
    };
  }
} 