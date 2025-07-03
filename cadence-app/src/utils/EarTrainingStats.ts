export interface EarTrainingSession {
  id: string;
  date: string;
  exerciseType: 'single-note' | 'interval' | 'chord';
  difficulty: 'easy' | 'medium' | 'hard';
  correct: boolean;
  expectedNotes: number[];
  userNotes: number[];
  responseTime?: number; // in milliseconds
}

export interface EarTrainingStats {
  totalSessions: number;
  totalCorrect: number;
  totalIncorrect: number;
  currentStreak: number;
  bestStreak: number;
  averageAccuracy: number;
  sessionsByType: {
    'single-note': { total: number; correct: number; accuracy: number };
    'interval': { total: number; correct: number; accuracy: number };
    'chord': { total: number; correct: number; accuracy: number };
  };
  sessionsByDifficulty: {
    'easy': { total: number; correct: number; accuracy: number };
    'medium': { total: number; correct: number; accuracy: number };
    'hard': { total: number; correct: number; accuracy: number };
  };
  recentSessions: EarTrainingSession[];
  dailyStats: {
    [date: string]: {
      total: number;
      correct: number;
      accuracy: number;
    };
  };
  weeklyTrends: {
    [weekKey: string]: {
      total: number;
      correct: number;
      accuracy: number;
    };
  };
}

export class EarTrainingStatsManager {
  private static readonly STORAGE_KEY = 'cadence_ear_training_stats';
  private static readonly SESSIONS_KEY = 'cadence_ear_training_sessions';
  private static readonly MAX_SESSIONS = 1000; // Keep last 1000 sessions
  private static readonly MAX_DAILY_STATS = 90; // Keep last 90 days

  static getStats(): EarTrainingStats {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    
    return this.getDefaultStats();
  }

  static getSessions(): EarTrainingSession[] {
    const stored = localStorage.getItem(this.SESSIONS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  }

  static addSession(session: Omit<EarTrainingSession, 'id' | 'date'>): void {
    const sessions = this.getSessions();
    const newSession: EarTrainingSession = {
      ...session,
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: new Date().toISOString()
    };

    // Add new session
    sessions.unshift(newSession);

    // Keep only the last MAX_SESSIONS
    if (sessions.length > this.MAX_SESSIONS) {
      sessions.splice(this.MAX_SESSIONS);
    }

    // Save sessions
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));

    // Update stats
    this.updateStats(sessions);
  }

  static resetStats(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.SESSIONS_KEY);
  }

  private static updateStats(sessions: EarTrainingSession[]): void {
    const stats = this.calculateStats(sessions);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stats));
  }

  private static calculateStats(sessions: EarTrainingSession[]): EarTrainingStats {
    const totalSessions = sessions.length;
    const totalCorrect = sessions.filter(s => s.correct).length;
    const totalIncorrect = totalSessions - totalCorrect;
    const averageAccuracy = totalSessions > 0 ? (totalCorrect / totalSessions) * 100 : 0;

    // Calculate current streak
    let currentStreak = 0;
    for (const session of sessions) {
      if (session.correct) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate best streak
    let bestStreak = 0;
    let tempStreak = 0;
    for (const session of sessions) {
      if (session.correct) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    // Calculate stats by type
    const sessionsByType = {
      'single-note': this.calculateTypeStats(sessions, 'single-note'),
      'interval': this.calculateTypeStats(sessions, 'interval'),
      'chord': this.calculateTypeStats(sessions, 'chord')
    };

    // Calculate stats by difficulty
    const sessionsByDifficulty = {
      'easy': this.calculateDifficultyStats(sessions, 'easy'),
      'medium': this.calculateDifficultyStats(sessions, 'medium'),
      'hard': this.calculateDifficultyStats(sessions, 'hard')
    };

    // Calculate daily stats
    const dailyStats: { [date: string]: { total: number; correct: number; accuracy: number } } = {};
    const today = new Date();
    
    for (let i = 0; i < this.MAX_DAILY_STATS; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      
      const daySessions = sessions.filter(s => s.date.startsWith(dateKey));
      const dayTotal = daySessions.length;
      const dayCorrect = daySessions.filter(s => s.correct).length;
      
      if (dayTotal > 0) {
        dailyStats[dateKey] = {
          total: dayTotal,
          correct: dayCorrect,
          accuracy: (dayCorrect / dayTotal) * 100
        };
      }
    }

    // Calculate weekly trends
    const weeklyTrends: { [weekKey: string]: { total: number; correct: number; accuracy: number } } = {};
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of current week
    
    for (let i = 0; i < 12; i++) { // Last 12 weeks
      const weekDate = new Date(weekStart);
      weekDate.setDate(weekDate.getDate() - (i * 7));
      const weekKey = weekDate.toISOString().split('T')[0];
      
      const weekSessions = sessions.filter(s => {
        const sessionDate = new Date(s.date);
        const sessionWeekStart = new Date(sessionDate);
        sessionWeekStart.setDate(sessionWeekStart.getDate() - sessionWeekStart.getDay());
        return sessionWeekStart.toISOString().split('T')[0] === weekKey;
      });
      
      const weekTotal = weekSessions.length;
      const weekCorrect = weekSessions.filter(s => s.correct).length;
      
      if (weekTotal > 0) {
        weeklyTrends[weekKey] = {
          total: weekTotal,
          correct: weekCorrect,
          accuracy: (weekCorrect / weekTotal) * 100
        };
      }
    }

    return {
      totalSessions,
      totalCorrect,
      totalIncorrect,
      currentStreak,
      bestStreak,
      averageAccuracy,
      sessionsByType,
      sessionsByDifficulty,
      recentSessions: sessions.slice(0, 20), // Last 20 sessions
      dailyStats,
      weeklyTrends
    };
  }

  private static calculateTypeStats(sessions: EarTrainingSession[], type: 'single-note' | 'interval' | 'chord') {
    const typeSessions = sessions.filter(s => s.exerciseType === type);
    const total = typeSessions.length;
    const correct = typeSessions.filter(s => s.correct).length;
    return {
      total,
      correct,
      accuracy: total > 0 ? (correct / total) * 100 : 0
    };
  }

  private static calculateDifficultyStats(sessions: EarTrainingSession[], difficulty: 'easy' | 'medium' | 'hard') {
    const difficultySessions = sessions.filter(s => s.difficulty === difficulty);
    const total = difficultySessions.length;
    const correct = difficultySessions.filter(s => s.correct).length;
    return {
      total,
      correct,
      accuracy: total > 0 ? (correct / total) * 100 : 0
    };
  }

  private static getDefaultStats(): EarTrainingStats {
    return {
      totalSessions: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      currentStreak: 0,
      bestStreak: 0,
      averageAccuracy: 0,
      sessionsByType: {
        'single-note': { total: 0, correct: 0, accuracy: 0 },
        'interval': { total: 0, correct: 0, accuracy: 0 },
        'chord': { total: 0, correct: 0, accuracy: 0 }
      },
      sessionsByDifficulty: {
        'easy': { total: 0, correct: 0, accuracy: 0 },
        'medium': { total: 0, correct: 0, accuracy: 0 },
        'hard': { total: 0, correct: 0, accuracy: 0 }
      },
      recentSessions: [],
      dailyStats: {},
      weeklyTrends: {}
    };
  }

  // Helper method to get formatted date
  static formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Helper method to get week label
  static formatWeek(weekKey: string): string {
    const date = new Date(weekKey);
    return `Week of ${date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    })}`;
  }
} 