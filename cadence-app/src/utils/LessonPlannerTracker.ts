// Lesson Planner data structures and tracker
export interface LessonActivity {
  id: string;
  type: 'scale' | 'piece' | 'ear-training' | 'custom';
  title: string;
  description: string;
  targetDuration?: number; // minutes
  repetitions?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  
  // Type-specific parameters
  scaleConfig?: {
    scaleName: string;
    rootNote: string;
    octave: number;
    tempo: number;
    metronomeEnabled: boolean;
  };
  pieceConfig?: {
    pieceId: string;
    pieceTitle: string;
    composer?: string;
    tempo: number;
  };
  earTrainingConfig?: {
    exerciseType: 'interval' | 'chord' | 'scale-identification';
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
  };
  customConfig?: {
    instructions: string;
    notes: string;
  };
}

export interface LessonPlan {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number; // minutes
  activities: LessonActivity[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
  isTemplate: boolean;
  createdBy: 'user' | 'system';
}

export interface LessonSession {
  id: string;
  lessonPlanId: string;
  lessonTitle: string;
  startTime: number;
  endTime?: number;
  duration: number; // seconds
  completedActivities: string[]; // activity IDs
  activityProgress: Map<string, ActivityProgress>;
  notes: string;
  overallRating?: number; // 1-5 stars
  completed: boolean;
}

export interface ActivityProgress {
  activityId: string;
  activityType: 'scale' | 'piece' | 'ear-training' | 'custom';
  startTime: number;
  endTime?: number;
  duration: number; // seconds
  completed: boolean;
  notes: string;
  
  // Performance metrics (varies by activity type)
  accuracy?: number;
  streak?: number;
  errors?: number;
  sessionId?: string; // Reference to performance tracker session
}

export interface LessonStatistics {
  totalLessons: number;
  totalLessonTime: number; // seconds
  completedLessons: number;
  averageRating: number;
  favoriteActivityType: string;
  currentStreak: number;
  longestStreak: number;
  lessonsThisWeek: number;
  lessonsThisMonth: number;
  averageLessonDuration: number;
}

export interface LessonPlannerProfile {
  userId: string;
  username: string;
  createdAt: number;
  lessonPlans: Map<string, LessonPlan>;
  lessonHistory: LessonSession[];
  currentSession: LessonSession | null;
  statistics: LessonStatistics;
  preferences: {
    defaultLessonDuration: number;
    reminderEnabled: boolean;
    favoriteActivityTypes: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  };
}

export class LessonPlannerTracker {
  private profile: LessonPlannerProfile;
  private storageKey = 'cadence_lesson_planner_profile';
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.profile = this.loadProfile();
    this.initializeDefaultTemplates();
  }

  /**
   * Add a change listener
   */
  addListener(listener: () => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove a change listener
   */
  removeListener(listener: () => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Get the current profile
   */
  getProfile(): LessonPlannerProfile {
    return { ...this.profile };
  }

  /**
   * Create a new lesson plan
   */
  createLessonPlan(planData: Omit<LessonPlan, 'id' | 'createdAt' | 'updatedAt'>): string {
    const planId = `lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newPlan: LessonPlan = {
      ...planData,
      id: planId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.profile.lessonPlans.set(planId, newPlan);
    this.saveProfile();
    
    return planId;
  }

  /**
   * Update an existing lesson plan
   */
  updateLessonPlan(planId: string, updates: Partial<LessonPlan>): boolean {
    const plan = this.profile.lessonPlans.get(planId);
    if (!plan) return false;

    const updatedPlan = {
      ...plan,
      ...updates,
      updatedAt: Date.now()
    };

    this.profile.lessonPlans.set(planId, updatedPlan);
    this.saveProfile();
    
    return true;
  }

  /**
   * Delete a lesson plan
   */
  deleteLessonPlan(planId: string): boolean {
    const deleted = this.profile.lessonPlans.delete(planId);
    if (deleted) {
      this.saveProfile();
    }
    return deleted;
  }

  /**
   * Get all lesson plans
   */
  getLessonPlans(): LessonPlan[] {
    return Array.from(this.profile.lessonPlans.values());
  }

  /**
   * Get lesson plan by ID
   */
  getLessonPlan(planId: string): LessonPlan | null {
    return this.profile.lessonPlans.get(planId) || null;
  }

  /**
   * Start a lesson session
   */
  startLessonSession(lessonPlanId: string): string | null {
    const plan = this.profile.lessonPlans.get(lessonPlanId);
    if (!plan) return null;

    // End current session if exists
    if (this.profile.currentSession) {
      this.endLessonSession();
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: LessonSession = {
      id: sessionId,
      lessonPlanId: lessonPlanId,
      lessonTitle: plan.title,
      startTime: Date.now(),
      duration: 0,
      completedActivities: [],
      activityProgress: new Map(),
      notes: '',
      completed: false
    };

    this.profile.currentSession = session;
    this.saveProfile();
    
    return sessionId;
  }

  /**
   * End the current lesson session
   */
  endLessonSession(): LessonSession | null {
    if (!this.profile.currentSession) return null;

    const session = this.profile.currentSession;
    session.endTime = Date.now();
    session.duration = Math.floor((session.endTime - session.startTime) / 1000);
    
    // Determine if session is completed
    const plan = this.profile.lessonPlans.get(session.lessonPlanId);
    if (plan) {
      session.completed = session.completedActivities.length >= plan.activities.length;
    }

    // Add to history
    this.profile.lessonHistory.unshift(session);
    this.profile.lessonHistory = this.profile.lessonHistory.slice(0, 100); // Keep last 100

    // Update statistics
    this.updateStatistics(session);

    // Clear current session
    this.profile.currentSession = null;
    
    this.saveProfile();
    
    return session;
  }

  /**
   * Get current lesson session
   */
  getCurrentSession(): LessonSession | null {
    return this.profile.currentSession ? { ...this.profile.currentSession } : null;
  }

  /**
   * Start an activity within the current session
   */
  startActivity(activityId: string): boolean {
    if (!this.profile.currentSession) return false;

    const progress: ActivityProgress = {
      activityId: activityId,
      activityType: 'custom', // Will be updated based on activity
      startTime: Date.now(),
      duration: 0,
      completed: false,
      notes: ''
    };

    this.profile.currentSession.activityProgress.set(activityId, progress);
    this.saveProfile();
    
    return true;
  }

  /**
   * Complete an activity within the current session
   */
  completeActivity(activityId: string, progressData: Partial<ActivityProgress>): boolean {
    if (!this.profile.currentSession) return false;

    const progress = this.profile.currentSession.activityProgress.get(activityId);
    if (!progress) return false;

    progress.endTime = Date.now();
    progress.duration = Math.floor((progress.endTime - progress.startTime) / 1000);
    progress.completed = true;
    
    // Update with provided data
    Object.assign(progress, progressData);

    // Add to completed activities if not already there
    if (!this.profile.currentSession.completedActivities.includes(activityId)) {
      this.profile.currentSession.completedActivities.push(activityId);
    }

    this.saveProfile();
    
    return true;
  }

  /**
   * Add notes to current session
   */
  addSessionNotes(notes: string): boolean {
    if (!this.profile.currentSession) return false;

    this.profile.currentSession.notes = notes;
    this.saveProfile();
    
    return true;
  }

  /**
   * Rate the current session
   */
  rateSession(rating: number): boolean {
    if (!this.profile.currentSession) return false;

    this.profile.currentSession.overallRating = Math.max(1, Math.min(5, rating));
    this.saveProfile();
    
    return true;
  }

  /**
   * Get lesson history
   */
  getLessonHistory(limit: number = 20): LessonSession[] {
    return this.profile.lessonHistory.slice(0, limit);
  }

  /**
   * Get lesson statistics
   */
  getStatistics(): LessonStatistics {
    return { ...this.profile.statistics };
  }

  /**
   * Get lesson trends over time
   */
  getLessonTrends(days: number = 30): {
    dates: string[];
    completedLessons: number[];
    averageRatings: number[];
    totalDurations: number[];
  } {
    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentSessions = this.profile.lessonHistory
      .filter(session => session.startTime >= cutoffDate)
      .sort((a, b) => a.startTime - b.startTime);

    // Group by date
    const sessionsByDate = new Map<string, LessonSession[]>();
    recentSessions.forEach(session => {
      const date = new Date(session.startTime).toLocaleDateString();
      if (!sessionsByDate.has(date)) {
        sessionsByDate.set(date, []);
      }
      sessionsByDate.get(date)!.push(session);
    });

    const dates = Array.from(sessionsByDate.keys()).sort();
    const completedLessons = dates.map(date => 
      sessionsByDate.get(date)!.filter(s => s.completed).length
    );
    const averageRatings = dates.map(date => {
      const sessions = sessionsByDate.get(date)!;
      const ratedSessions = sessions.filter(s => s.overallRating !== undefined);
      if (ratedSessions.length === 0) return 0;
      const totalRating = ratedSessions.reduce((sum, s) => sum + (s.overallRating || 0), 0);
      return totalRating / ratedSessions.length;
    });
    const totalDurations = dates.map(date => {
      const sessions = sessionsByDate.get(date)!;
      return sessions.reduce((sum, s) => sum + s.duration, 0);
    });

    return { dates, completedLessons, averageRatings, totalDurations };
  }

  /**
   * Load profile from localStorage
   */
  private loadProfile(): LessonPlannerProfile {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convert objects back to Maps
        parsed.lessonPlans = new Map(Object.entries(parsed.lessonPlans || {}));
        parsed.lessonHistory = parsed.lessonHistory || [];
        
        // Convert activityProgress back to Maps for each session
        parsed.lessonHistory.forEach((session: any) => {
          session.activityProgress = new Map(Object.entries(session.activityProgress || {}));
        });
        
        if (parsed.currentSession && parsed.currentSession.activityProgress) {
          parsed.currentSession.activityProgress = new Map(Object.entries(parsed.currentSession.activityProgress));
        }
        
        return parsed;
      }
    } catch (error) {
      console.error('Failed to load lesson planner profile:', error);
    }
    
    return this.createNewProfile();
  }

  /**
   * Save profile to localStorage
   */
  private saveProfile(): void {
    try {
      const profileToSave = { ...this.profile };
      
      // Convert Maps to objects for JSON serialization
      profileToSave.lessonPlans = Object.fromEntries(this.profile.lessonPlans) as any;
      
      // Convert activityProgress Maps to objects
      profileToSave.lessonHistory = this.profile.lessonHistory.map(session => ({
        ...session,
        activityProgress: Object.fromEntries(session.activityProgress)
      }));
      
      if (profileToSave.currentSession && profileToSave.currentSession.activityProgress) {
        profileToSave.currentSession.activityProgress = Object.fromEntries(
          this.profile.currentSession!.activityProgress
        ) as any;
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(profileToSave));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save lesson planner profile:', error);
    }
  }

  /**
   * Create a new profile
   */
  private createNewProfile(): LessonPlannerProfile {
    return {
      userId: `lesson_user_${Date.now()}`,
      username: 'Piano Student',
      createdAt: Date.now(),
      lessonPlans: new Map(),
      lessonHistory: [],
      currentSession: null,
      statistics: {
        totalLessons: 0,
        totalLessonTime: 0,
        completedLessons: 0,
        averageRating: 0,
        favoriteActivityType: 'scale',
        currentStreak: 0,
        longestStreak: 0,
        lessonsThisWeek: 0,
        lessonsThisMonth: 0,
        averageLessonDuration: 0
      },
      preferences: {
        defaultLessonDuration: 30,
        reminderEnabled: false,
        favoriteActivityTypes: ['scale', 'piece'],
        difficulty: 'intermediate'
      }
    };
  }

  /**
   * Update statistics based on completed session
   */
  private updateStatistics(session: LessonSession): void {
    const stats = this.profile.statistics;
    
    stats.totalLessons++;
    stats.totalLessonTime += session.duration;
    
    if (session.completed) {
      stats.completedLessons++;
    }
    
    if (session.overallRating) {
      const totalRatedSessions = this.profile.lessonHistory.filter(s => s.overallRating).length;
      const currentTotal = stats.averageRating * (totalRatedSessions - 1);
      stats.averageRating = (currentTotal + session.overallRating) / totalRatedSessions;
    }
    
    stats.averageLessonDuration = stats.totalLessonTime / stats.totalLessons;
    
    // Update streaks
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    const sessionDate = new Date(session.startTime).toDateString();
    
    if (session.completed) {
      if (sessionDate === today) {
        // Continue or start streak
        stats.currentStreak++;
      } else if (sessionDate === yesterday) {
        // Continue streak from yesterday
        stats.currentStreak++;
      }
      
      stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
    } else {
      // Reset streak if lesson not completed
      stats.currentStreak = 0;
    }
    
    // Update weekly/monthly counts
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    stats.lessonsThisWeek = this.profile.lessonHistory.filter(s => s.startTime >= weekAgo).length;
    stats.lessonsThisMonth = this.profile.lessonHistory.filter(s => s.startTime >= monthAgo).length;
    
    // Update favorite activity type
    const activityCounts = new Map<string, number>();
    this.profile.lessonHistory.forEach(historySession => {
      const plan = this.profile.lessonPlans.get(historySession.lessonPlanId);
      if (plan) {
        plan.activities.forEach(activity => {
          if (historySession.completedActivities.includes(activity.id)) {
            activityCounts.set(activity.type, (activityCounts.get(activity.type) || 0) + 1);
          }
        });
      }
    });
    
    let maxCount = 0;
    let favoriteType = 'scale';
    activityCounts.forEach((count, type) => {
      if (count > maxCount) {
        maxCount = count;
        favoriteType = type;
      }
    });
    
    stats.favoriteActivityType = favoriteType;
  }

  /**
   * Initialize default lesson templates
   */
  private initializeDefaultTemplates(): void {
    // Only create templates if none exist
    if (this.profile.lessonPlans.size === 0) {
      this.createDefaultTemplates();
    }
  }

  /**
   * Create default lesson plan templates
   */
  private createDefaultTemplates(): void {
    const templates: Omit<LessonPlan, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        title: 'Beginner Fundamentals',
        description: 'Basic scales and simple pieces for beginning pianists',
        difficulty: 'beginner',
        estimatedDuration: 30,
        activities: [
          {
            id: 'activity_1',
            type: 'scale',
            title: 'C Major Scale',
            description: 'Practice C major scale with proper fingering',
            targetDuration: 10,
            repetitions: 5,
            difficulty: 'beginner',
            scaleConfig: {
              scaleName: 'Major',
              rootNote: 'C',
              octave: 4,
              tempo: 60,
              metronomeEnabled: true
            }
          },
          {
            id: 'activity_2',
            type: 'ear-training',
            title: 'Interval Recognition',
            description: 'Practice identifying basic intervals',
            targetDuration: 15,
            difficulty: 'beginner',
            earTrainingConfig: {
              exerciseType: 'interval',
              difficulty: 'easy',
              questionCount: 10
            }
          },
          {
            id: 'activity_3',
            type: 'custom',
            title: 'Hand Position Practice',
            description: 'Practice proper hand position and posture',
            targetDuration: 5,
            difficulty: 'beginner',
            customConfig: {
              instructions: 'Focus on relaxed wrists and curved fingers',
              notes: 'Remember to keep shoulders relaxed'
            }
          }
        ],
        tags: ['beginner', 'fundamentals', 'scales', 'ear-training'],
        isTemplate: true,
        createdBy: 'system'
      },
      {
        title: 'Intermediate Practice Session',
        description: 'Balanced practice for developing pianists',
        difficulty: 'intermediate',
        estimatedDuration: 45,
        activities: [
          {
            id: 'activity_4',
            type: 'scale',
            title: 'G Major Scale',
            description: 'Practice G major scale with dynamics',
            targetDuration: 8,
            repetitions: 4,
            difficulty: 'intermediate',
            scaleConfig: {
              scaleName: 'Major',
              rootNote: 'G',
              octave: 4,
              tempo: 80,
              metronomeEnabled: true
            }
          },
          {
            id: 'activity_5',
            type: 'scale',
            title: 'F# Minor Scale',
            description: 'Practice F# minor scale (natural minor)',
            targetDuration: 10,
            repetitions: 3,
            difficulty: 'intermediate',
            scaleConfig: {
              scaleName: 'Minor',
              rootNote: 'F#',
              octave: 4,
              tempo: 70,
              metronomeEnabled: true
            }
          },
          {
            id: 'activity_6',
            type: 'ear-training',
            title: 'Chord Recognition',
            description: 'Practice identifying major and minor chords',
            targetDuration: 15,
            difficulty: 'intermediate',
            earTrainingConfig: {
              exerciseType: 'chord',
              difficulty: 'medium',
              questionCount: 15
            }
          },
          {
            id: 'activity_7',
            type: 'custom',
            title: 'Sight Reading',
            description: 'Practice reading simple melodies',
            targetDuration: 12,
            difficulty: 'intermediate',
            customConfig: {
              instructions: 'Focus on reading ahead and maintaining steady tempo',
              notes: 'Use simple folk songs or etudes'
            }
          }
        ],
        tags: ['intermediate', 'scales', 'ear-training', 'sight-reading'],
        isTemplate: true,
        createdBy: 'system'
      },
      {
        title: 'Advanced Technique Builder',
        description: 'Challenging practice for advanced students',
        difficulty: 'advanced',
        estimatedDuration: 60,
        activities: [
          {
            id: 'activity_8',
            type: 'scale',
            title: 'Chromatic Scale',
            description: 'Practice chromatic scale with varying rhythms',
            targetDuration: 10,
            repetitions: 3,
            difficulty: 'advanced',
            scaleConfig: {
              scaleName: 'Chromatic',
              rootNote: 'C',
              octave: 4,
              tempo: 120,
              metronomeEnabled: true
            }
          },
          {
            id: 'activity_9',
            type: 'ear-training',
            title: 'Advanced Intervals',
            description: 'Practice identifying complex intervals and progressions',
            targetDuration: 20,
            difficulty: 'advanced',
            earTrainingConfig: {
              exerciseType: 'interval',
              difficulty: 'hard',
              questionCount: 20
            }
          },
          {
            id: 'activity_10',
            type: 'custom',
            title: 'Arpeggios Practice',
            description: 'Practice major and minor arpeggios',
            targetDuration: 15,
            difficulty: 'advanced',
            customConfig: {
              instructions: 'Focus on smooth thumb crossings and even timing',
              notes: 'Practice all major and minor arpeggios'
            }
          },
          {
            id: 'activity_11',
            type: 'custom',
            title: 'Performance Practice',
            description: 'Work on expression and interpretation',
            targetDuration: 15,
            difficulty: 'advanced',
            customConfig: {
              instructions: 'Focus on musical expression and dynamic contrast',
              notes: 'Practice performing without stopping'
            }
          }
        ],
        tags: ['advanced', 'technique', 'performance', 'expression'],
        isTemplate: true,
        createdBy: 'system'
      }
    ];

    templates.forEach(template => {
      this.createLessonPlan(template);
    });
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Clear all lesson data
   */
  clearAllData(): void {
    this.profile = this.createNewProfile();
    this.initializeDefaultTemplates();
    this.saveProfile();
  }
} 