// Performance data structures
export interface PerformanceSession {
  id: string;
  pieceId: string;
  pieceTitle: string;
  composer?: string;
  timestamp: number;
  duration: number; // in seconds
  totalChords: number;
  correctChords: number;
  errorCount: number;
  successStreak: number;
  longestStreak: number;
  accuracy: number; // percentage
  tempo: number;
  completed: boolean;
}

export interface PiecePerformance {
  pieceId: string;
  pieceTitle: string;
  composer?: string;
  firstPlayed: number;
  lastPlayed: number;
  totalSessions: number;
  totalPlayTime: number; // in seconds
  bestAccuracy: number;
  bestStreak: number;
  averageAccuracy: number;
  sessions: PerformanceSession[];
}

export interface UserProfile {
  userId: string;
  username: string;
  createdAt: number;
  totalPlayTime: number; // in seconds
  totalSessions: number;
  totalPieces: number;
  bestAccuracy: number;
  bestStreak: number;
  averageAccuracy: number;
  pieces: Map<string, PiecePerformance>;
  recentSessions: PerformanceSession[];
}

export class PerformanceTracker {
  private profile: UserProfile;
  private currentSession: PerformanceSession | null = null;
  private storageKey = 'cadence_user_profile';
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.profile = this.loadProfile();
  }

  /**
   * Start a new performance session
   */
  startSession(pieceData: {
    id: string;
    title: string;
    composer?: string;
    tempo: number;
    totalChords: number;
  }): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      id: sessionId,
      pieceId: pieceData.id,
      pieceTitle: pieceData.title,
      composer: pieceData.composer,
      timestamp: Date.now(),
      duration: 0,
      totalChords: pieceData.totalChords,
      correctChords: 0,
      errorCount: 0,
      successStreak: 0,
      longestStreak: 0,
      accuracy: 0,
      tempo: pieceData.tempo,
      completed: false
    };

    return sessionId;
  }

  /**
   * Update current session with performance data
   */
  updateSession(stats: {
    correctChords: number;
    errorCount: number;
    successStreak: number;
    longestStreak: number;
  }): void {
    if (!this.currentSession) return;

    this.currentSession.correctChords = stats.correctChords;
    this.currentSession.errorCount = stats.errorCount;
    this.currentSession.successStreak = stats.successStreak;
    this.currentSession.longestStreak = stats.longestStreak;
    this.currentSession.accuracy = this.currentSession.totalChords > 0 
      ? (stats.correctChords / this.currentSession.totalChords) * 100 
      : 0;
  }

  /**
   * Complete the current session
   */
  completeSession(): PerformanceSession | null {
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
  getCurrentSession(): PerformanceSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Get user profile
   */
  getProfile(): UserProfile {
    return { ...this.profile };
  }

  /**
   * Get performance for a specific piece
   */
  getPiecePerformance(pieceId: string): PiecePerformance | null {
    return this.profile.pieces.get(pieceId) || null;
  }

  /**
   * Get recent sessions (last 10)
   */
  getRecentSessions(limit: number = 10): PerformanceSession[] {
    return this.profile.recentSessions.slice(0, limit);
  }

  /**
   * Get performance trends for a piece
   */
  getPieceTrends(pieceId: string, days: number = 30): {
    dates: string[];
    accuracies: number[];
    streaks: number[];
  } {
    const piece = this.profile.pieces.get(pieceId);
    if (!piece) return { dates: [], accuracies: [], streaks: [] };

    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentSessions = piece.sessions
      .filter(session => session.timestamp >= cutoffDate)
      .sort((a, b) => a.timestamp - b.timestamp);

    return {
      dates: recentSessions.map(session => 
        new Date(session.timestamp).toLocaleDateString()
      ),
      accuracies: recentSessions.map(session => session.accuracy),
      streaks: recentSessions.map(session => session.longestStreak)
    };
  }

  /**
   * Get overall performance trends
   */
  getOverallTrends(days: number = 30): {
    dates: string[];
    averageAccuracies: number[];
    totalSessions: number[];
  } {
    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentSessions = this.profile.recentSessions
      .filter(session => session.timestamp >= cutoffDate);

    // Group by date
    const sessionsByDate = new Map<string, PerformanceSession[]>();
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

    return { dates, averageAccuracies, totalSessions };
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
  private addSessionToProfile(session: PerformanceSession): void {
    // Add to recent sessions
    this.profile.recentSessions.unshift(session);
    this.profile.recentSessions = this.profile.recentSessions.slice(0, 50); // Keep last 50

    // Update piece performance
    let piecePerformance = this.profile.pieces.get(session.pieceId);
    if (!piecePerformance) {
      piecePerformance = {
        pieceId: session.pieceId,
        pieceTitle: session.pieceTitle,
        composer: session.composer,
        firstPlayed: session.timestamp,
        lastPlayed: session.timestamp,
        totalSessions: 0,
        totalPlayTime: 0,
        bestAccuracy: 0,
        bestStreak: 0,
        averageAccuracy: 0,
        sessions: []
      };
      this.profile.pieces.set(session.pieceId, piecePerformance);
      this.profile.totalPieces = this.profile.pieces.size;
    }

    // Update piece statistics
    piecePerformance.lastPlayed = session.timestamp;
    piecePerformance.totalSessions++;
    piecePerformance.totalPlayTime += session.duration;
    piecePerformance.sessions.push(session);

    if (session.accuracy > piecePerformance.bestAccuracy) {
      piecePerformance.bestAccuracy = session.accuracy;
    }
    if (session.longestStreak > piecePerformance.bestStreak) {
      piecePerformance.bestStreak = session.longestStreak;
    }

    // Recalculate average accuracy
    const totalAccuracy = piecePerformance.sessions.reduce((sum, s) => sum + s.accuracy, 0);
    piecePerformance.averageAccuracy = totalAccuracy / piecePerformance.sessions.length;

    // Update overall profile statistics
    this.profile.totalSessions++;
    this.profile.totalPlayTime += session.duration;

    if (session.accuracy > this.profile.bestAccuracy) {
      this.profile.bestAccuracy = session.accuracy;
    }
    if (session.longestStreak > this.profile.bestStreak) {
      this.profile.bestStreak = session.longestStreak;
    }

    // Recalculate overall average accuracy
    const allSessions = Array.from(this.profile.pieces.values())
      .flatMap(piece => piece.sessions);
    const totalOverallAccuracy = allSessions.reduce((sum, s) => sum + s.accuracy, 0);
    this.profile.averageAccuracy = totalOverallAccuracy / allSessions.length;
  }

  /**
   * Load profile from localStorage
   */
  private loadProfile(): UserProfile {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert pieces back to Map
        parsed.pieces = new Map(Object.entries(parsed.pieces || {}));
        return parsed;
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
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
      profileToSave.pieces = Object.fromEntries(this.profile.pieces) as any;
      localStorage.setItem(this.storageKey, JSON.stringify(profileToSave));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  }

  /**
   * Create a new profile
   */
  private createNewProfile(): UserProfile {
    return {
      userId: `user_${Date.now()}`,
      username: 'Pianist',
      createdAt: Date.now(),
      totalPlayTime: 0,
      totalSessions: 0,
      totalPieces: 0,
      bestAccuracy: 0,
      bestStreak: 0,
      averageAccuracy: 0,
      pieces: new Map(),
      recentSessions: []
    };
  }
} 