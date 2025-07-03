import { PerformanceTracker } from './PerformanceTracker';
import { ScalePerformanceTracker } from './ScalePerformanceTracker';
import { LessonPlannerTracker } from './LessonPlannerTracker';
import { EarTrainingStatsManager } from './EarTrainingStats';

export interface CollectedPerformanceData {
  // Overall summary
  studentLevel: 'beginner' | 'intermediate' | 'advanced';
  practiceConsistency: 'low' | 'medium' | 'high';
  strengths: string[];
  weaknesses: string[];
  recommendedFocus: string[];
  
  // Sheet music performance
  sheetMusicStats: {
    totalSessions: number;
    totalPlayTime: number;
    averageAccuracy: number;
    bestAccuracy: number;
    totalPieces: number;
    recentTrend: 'improving' | 'stable' | 'declining';
    favoriteComposer?: string;
    strugglingAreas: string[];
  };
  
  // Scale performance
  scaleStats: {
    totalSessions: number;
    totalPlayTime: number;
    averageAccuracy: number;
    bestAccuracy: number;
    totalScales: number;
    metronomeUsage: number;
    averageTimingAccuracy: number;
    preferredScales: string[];
    needsImprovementScales: string[];
  };
  
  // Ear training performance
  earTrainingStats: {
    totalSessions: number;
    averageAccuracy: number;
    bestStreak: number;
    strongExerciseTypes: string[];
    weakExerciseTypes: string[];
    recentProgress: 'improving' | 'stable' | 'declining';
  };
  
  // Lesson planner data
  lessonStats: {
    totalLessons: number;
    completedLessons: number;
    averageRating: number;
    favoriteActivityType: string;
    currentStreak: number;
    lessonsThisWeek: number;
    averageLessonDuration: number;
    completionRate: number;
  };
  
  // Recent activity patterns
  recentActivity: {
    daysActive: number;
    preferredPracticeTime: number; // in minutes
    consistencyScore: number; // 0-100
    lastActiveDate: number;
  };
}

export class PerformanceDataCollector {
  static collectAllPerformanceData(
    performanceTracker: PerformanceTracker,
    scalePerformanceTracker?: ScalePerformanceTracker,
    lessonPlannerTracker?: LessonPlannerTracker
  ): CollectedPerformanceData {
    const sheetMusicProfile = performanceTracker.getProfile();
    const scaleProfile = scalePerformanceTracker?.getProfile();
    const lessonStats = lessonPlannerTracker?.getStatistics();
    const earTrainingStats = EarTrainingStatsManager.getStats();
    
    // Determine student level based on overall performance
    const studentLevel = this.determineStudentLevel(
      sheetMusicProfile.averageAccuracy,
      scaleProfile?.averageAccuracy || 0,
      earTrainingStats.averageAccuracy || 0,
      lessonStats?.averageRating || 0
    );
    
    // Analyze practice consistency
    const practiceConsistency = this.analyzePracticeConsistency(
      sheetMusicProfile.recentSessions,
      scaleProfile?.recentSessions || [],
      lessonStats?.lessonsThisWeek || 0
    );
    
    // Identify strengths and weaknesses
    const { strengths, weaknesses } = this.identifyStrengthsAndWeaknesses(
      sheetMusicProfile,
      scaleProfile,
      earTrainingStats,
      lessonStats
    );
    
    // Generate recommendations
    const recommendedFocus = this.generateRecommendations(strengths, weaknesses);
    
    // Collect sheet music stats
    const sheetMusicStats = {
      totalSessions: sheetMusicProfile.totalSessions,
      totalPlayTime: sheetMusicProfile.totalPlayTime,
      averageAccuracy: sheetMusicProfile.averageAccuracy,
      bestAccuracy: sheetMusicProfile.bestAccuracy,
      totalPieces: sheetMusicProfile.totalPieces,
      recentTrend: this.analyzeTrend(sheetMusicProfile.recentSessions.map(s => s.accuracy)),
      favoriteComposer: this.findFavoriteComposer(Array.from(sheetMusicProfile.pieces.values())),
      strugglingAreas: this.identifyStrugglingAreas(sheetMusicProfile)
    };
    
    // Collect scale stats
    const scaleStats = {
      totalSessions: scaleProfile?.totalSessions || 0,
      totalPlayTime: scaleProfile?.totalPlayTime || 0,
      averageAccuracy: scaleProfile?.averageAccuracy || 0,
      bestAccuracy: scaleProfile?.bestAccuracy || 0,
      totalScales: scaleProfile?.totalScales || 0,
      metronomeUsage: scaleProfile?.metronomeUsageRate || 0,
      averageTimingAccuracy: scaleProfile?.averageTimingAccuracy || 0,
      preferredScales: this.findPreferredScales(scaleProfile),
      needsImprovementScales: this.findNeedsImprovementScales(scaleProfile)
    };
    
    // Collect ear training stats
    const earTrainingData = {
      totalSessions: earTrainingStats.totalSessions || 0,
      averageAccuracy: earTrainingStats.averageAccuracy || 0,
      bestStreak: earTrainingStats.bestStreak || 0,
      strongExerciseTypes: this.findStrongExerciseTypes(earTrainingStats),
      weakExerciseTypes: this.findWeakExerciseTypes(earTrainingStats),
      recentProgress: this.analyzeEarTrainingProgress(earTrainingStats)
    };
    
    // Collect lesson planner stats
    const lessonData = {
      totalLessons: lessonStats?.totalLessons || 0,
      completedLessons: lessonStats?.completedLessons || 0,
      averageRating: lessonStats?.averageRating || 0,
      favoriteActivityType: lessonStats?.favoriteActivityType || 'scale',
      currentStreak: lessonStats?.currentStreak || 0,
      lessonsThisWeek: lessonStats?.lessonsThisWeek || 0,
      averageLessonDuration: lessonStats?.averageLessonDuration || 0,
      completionRate: lessonStats?.totalLessons && lessonStats.totalLessons > 0 ? 
        (lessonStats.completedLessons / lessonStats.totalLessons) * 100 : 0
    };
    
    // Analyze recent activity patterns
    const recentActivity = this.analyzeRecentActivity(
      sheetMusicProfile.recentSessions,
      scaleProfile?.recentSessions || [],
      lessonStats
    );
    
    return {
      studentLevel,
      practiceConsistency,
      strengths,
      weaknesses,
      recommendedFocus,
      sheetMusicStats,
      scaleStats,
      earTrainingStats: earTrainingData,
      lessonStats: lessonData,
      recentActivity
    };
  }
  
  private static determineStudentLevel(
    sheetMusicAccuracy: number,
    scaleAccuracy: number,
    earTrainingAccuracy: number,
    lessonRating: number
  ): 'beginner' | 'intermediate' | 'advanced' {
    const overallScore = (sheetMusicAccuracy + scaleAccuracy + earTrainingAccuracy + lessonRating * 20) / 4;
    
    if (overallScore >= 85) return 'advanced';
    if (overallScore >= 65) return 'intermediate';
    return 'beginner';
  }
  
  private static analyzePracticeConsistency(
    sheetMusicSessions: any[],
    scaleSessions: any[],
    lessonsThisWeek: number
  ): 'low' | 'medium' | 'high' {
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentSheetMusic = sheetMusicSessions.filter(s => s.timestamp >= weekAgo).length;
    const recentScales = scaleSessions.filter(s => s.timestamp >= weekAgo).length;
    
    const totalRecentSessions = recentSheetMusic + recentScales + lessonsThisWeek;
    
    if (totalRecentSessions >= 10) return 'high';
    if (totalRecentSessions >= 5) return 'medium';
    return 'low';
  }
  
  private static identifyStrengthsAndWeaknesses(
    sheetMusicProfile: any,
    scaleProfile: any,
    earTrainingStats: any,
    lessonStats: any
  ): { strengths: string[]; weaknesses: string[] } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    
    // Analyze sheet music performance
    if (sheetMusicProfile.averageAccuracy >= 80) {
      strengths.push('Sheet music reading accuracy');
    } else if (sheetMusicProfile.averageAccuracy < 60) {
      weaknesses.push('Sheet music reading accuracy');
    }
    
    // Analyze scale performance
    if (scaleProfile?.averageAccuracy >= 85) {
      strengths.push('Scale technique');
    } else if (scaleProfile?.averageAccuracy < 70) {
      weaknesses.push('Scale technique');
    }
    
    // Analyze timing
    if (scaleProfile?.averageTimingAccuracy >= 80) {
      strengths.push('Timing and rhythm');
    } else if (scaleProfile?.averageTimingAccuracy < 60) {
      weaknesses.push('Timing and rhythm');
    }
    
    // Analyze ear training
    if (earTrainingStats.averageAccuracy >= 80) {
      strengths.push('Ear training');
    } else if (earTrainingStats.averageAccuracy < 60) {
      weaknesses.push('Ear training');
    }
    
    // Analyze consistency
    if (lessonStats?.currentStreak >= 5) {
      strengths.push('Practice consistency');
    } else if (lessonStats?.currentStreak < 2) {
      weaknesses.push('Practice consistency');
    }
    
    return { strengths, weaknesses };
  }
  
  private static generateRecommendations(strengths: string[], weaknesses: string[]): string[] {
    const recommendations: string[] = [];
    
    if (weaknesses.includes('Sheet music reading accuracy')) {
      recommendations.push('Focus on sight-reading exercises');
    }
    
    if (weaknesses.includes('Scale technique')) {
      recommendations.push('Practice scales at slower tempos with metronome');
    }
    
    if (weaknesses.includes('Timing and rhythm')) {
      recommendations.push('Increase metronome usage and rhythm exercises');
    }
    
    if (weaknesses.includes('Ear training')) {
      recommendations.push('Dedicate time to interval and chord recognition');
    }
    
    if (weaknesses.includes('Practice consistency')) {
      recommendations.push('Establish a regular practice schedule');
    }
    
    return recommendations;
  }
  
  private static analyzeTrend(accuracies: number[]): 'improving' | 'stable' | 'declining' {
    if (accuracies.length < 3) return 'stable';
    
    const recent = accuracies.slice(-5);
    const older = accuracies.slice(-10, -5);
    
    if (recent.length === 0 || older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, acc) => sum + acc, 0) / recent.length;
    const olderAvg = older.reduce((sum, acc) => sum + acc, 0) / older.length;
    
    if (recentAvg > olderAvg + 5) return 'improving';
    if (recentAvg < olderAvg - 5) return 'declining';
    return 'stable';
  }
  
  private static findFavoriteComposer(pieces: any[]): string | undefined {
    const composerCounts = new Map<string, number>();
    
    pieces.forEach(piece => {
      if (piece.composer) {
        composerCounts.set(piece.composer, (composerCounts.get(piece.composer) || 0) + 1);
      }
    });
    
    let maxCount = 0;
    let favoriteComposer: string | undefined;
    
    composerCounts.forEach((count, composer) => {
      if (count > maxCount) {
        maxCount = count;
        favoriteComposer = composer;
      }
    });
    
    return favoriteComposer;
  }
  
  private static identifyStrugglingAreas(profile: any): string[] {
    const areas: string[] = [];
    
    if (profile.averageAccuracy < 70) {
      areas.push('Overall accuracy');
    }
    
    if (profile.bestStreak < 10) {
      areas.push('Maintaining focus');
    }
    
    return areas;
  }
  
  private static findPreferredScales(scaleProfile: any): string[] {
    if (!scaleProfile) return [];
    
    const scales = Array.from(scaleProfile.scales.values())
      .sort((a: any, b: any) => b.averageAccuracy - a.averageAccuracy)
      .slice(0, 3)
      .map((scale: any) => `${scale.scaleName} ${scale.rootNote}`);
    
    return scales;
  }
  
  private static findNeedsImprovementScales(scaleProfile: any): string[] {
    if (!scaleProfile) return [];
    
    const scales = Array.from(scaleProfile.scales.values())
      .filter((scale: any) => scale.averageAccuracy < 75)
      .sort((a: any, b: any) => a.averageAccuracy - b.averageAccuracy)
      .slice(0, 3)
      .map((scale: any) => `${scale.scaleName} ${scale.rootNote}`);
    
    return scales;
  }
  
  private static findStrongExerciseTypes(stats: any): string[] {
    const types: string[] = [];
    
    if (stats.intervals && stats.intervals.accuracy >= 80) {
      types.push('Interval recognition');
    }
    
    if (stats.chords && stats.chords.accuracy >= 80) {
      types.push('Chord recognition');
    }
    
    return types;
  }
  
  private static findWeakExerciseTypes(stats: any): string[] {
    const types: string[] = [];
    
    if (stats.intervals && stats.intervals.accuracy < 60) {
      types.push('Interval recognition');
    }
    
    if (stats.chords && stats.chords.accuracy < 60) {
      types.push('Chord recognition');
    }
    
    return types;
  }
  
  private static analyzeEarTrainingProgress(stats: any): 'improving' | 'stable' | 'declining' {
    // This would need more detailed session history to implement properly
    return 'stable';
  }
  
  private static analyzeRecentActivity(
    sheetMusicSessions: any[],
    scaleSessions: any[],
    lessonStats: any
  ): any {
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    const recentSessions = [
      ...sheetMusicSessions.filter(s => s.timestamp >= weekAgo),
      ...scaleSessions.filter(s => s.timestamp >= weekAgo)
    ];
    
    const daysActive = new Set(
      recentSessions.map(s => new Date(s.timestamp).toDateString())
    ).size;
    
    const totalDuration = recentSessions.reduce((sum, s) => sum + s.duration, 0);
    const preferredPracticeTime = recentSessions.length > 0 ? totalDuration / recentSessions.length : 0;
    
    const consistencyScore = Math.min(100, (daysActive / 7) * 100);
    
    const lastActiveDate = Math.max(
      ...sheetMusicSessions.map(s => s.timestamp),
      ...scaleSessions.map(s => s.timestamp)
    );
    
    return {
      daysActive,
      preferredPracticeTime,
      consistencyScore,
      lastActiveDate
    };
  }
} 