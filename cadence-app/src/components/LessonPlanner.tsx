import { useState, useEffect, useMemo } from 'react';
import Button from './Button';
import { ToastContainer } from './Toast';
import { LessonPlannerTracker, type LessonPlan, type LessonSession, type LessonActivity } from '../utils/LessonPlannerTracker';

interface LessonPlannerProps {
  onStartActivity: (activity: LessonActivity) => void;
  onActivityComplete: (activityId: string, metrics: any) => void;
}

const LessonPlanner = ({ onStartActivity, onActivityComplete }: LessonPlannerProps) => {
  const [currentView, setCurrentView] = useState<'library' | 'create' | 'session' | 'history'>('library');
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [currentSession, setCurrentSession] = useState<LessonSession | null>(null);
  const [lessonHistory, setLessonHistory] = useState<LessonSession[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<LessonPlan | null>(null);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionRating, setSessionRating] = useState(0);

  // Form state for creating new lessons
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonDescription, setNewLessonDescription] = useState('');
  const [newLessonDifficulty, setNewLessonDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [newLessonActivities, setNewLessonActivities] = useState<LessonActivity[]>([]);

  // Initialize tracker
  const tracker = useMemo(() => new LessonPlannerTracker(), []);

  // Initialize with data from tracker
  useEffect(() => {
    const updateFromTracker = () => {
      setLessonPlans(tracker.getLessonPlans());
      setCurrentSession(tracker.getCurrentSession());
      setLessonHistory(tracker.getLessonHistory());
    };

    updateFromTracker();
    tracker.addListener(updateFromTracker);

    return () => {
      tracker.removeListener(updateFromTracker);
    };
  }, [tracker]);

  const getDefaultTemplates = (): LessonPlan[] => [
    {
      id: 'template_beginner',
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isTemplate: true,
      createdBy: 'system'
    },
    {
      id: 'template_intermediate',
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
          id: 'activity_6',
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isTemplate: true,
      createdBy: 'system'
    }
  ];

  const startLessonSession = (plan: LessonPlan) => {
    const sessionId = tracker.startLessonSession(plan.id);
    if (sessionId) {
      setSelectedPlan(plan);
      setCurrentActivityIndex(0);
      setCurrentView('session');
      setSessionNotes('');
      setSessionRating(0);

      (window as any).showToast?.({
        type: 'success',
        title: 'Lesson Started!',
        message: `Started ${plan.title}`,
        duration: 3000
      });
    }
  };

  const completeActivity = (activityId: string) => {
    if (!currentSession) return;

    tracker.completeActivity(activityId, {
      activityType: 'custom', // Will be updated based on actual activity
      activityId: activityId,
      notes: ''
    });

    onActivityComplete(activityId, {});

    (window as any).showToast?.({
      type: 'success',
      title: 'Activity Completed!',
      message: 'Great job! Moving to next activity.',
      duration: 2000
    });

    // Move to next activity
    if (selectedPlan && currentActivityIndex < selectedPlan.activities.length - 1) {
      setCurrentActivityIndex(prev => prev + 1);
    }
  };

  const endLessonSession = () => {
    if (!currentSession) return;

    // Add notes and rating to current session
    tracker.addSessionNotes(sessionNotes);
    if (sessionRating > 0) {
      tracker.rateSession(sessionRating);
    }

    const completedSession = tracker.endLessonSession();
    if (completedSession) {
      setSelectedPlan(null);
      setCurrentView('library');

      (window as any).showToast?.({
        type: completedSession.completed ? 'success' : 'info',
        title: completedSession.completed ? 'Lesson Completed!' : 'Lesson Ended',
        message: `Session lasted ${Math.floor(completedSession.duration / 60)} minutes`,
        duration: 4000
      });
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getActivityTypeIcon = (type: string): string => {
    switch (type) {
      case 'scale': return '🎹';
      case 'piece': return '🎼';
      case 'ear-training': return '👂';
      case 'custom': return '📝';
      default: return '🎵';
    }
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case 'beginner': return '#4ade80';
      case 'intermediate': return '#f59e0b';
      case 'advanced': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Lesson Library View
  const renderLessonLibrary = () => (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ margin: 0, color: '#e4e4f4' }}>Lesson Library</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button onClick={() => setCurrentView('create')} variant="gradient" leftIcon="➕">
            Create New Lesson
          </Button>
          <Button onClick={() => setCurrentView('history')} variant="secondary" leftIcon="📊">
            View History
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
        {lessonPlans.map((plan) => (
          <div key={plan.id} style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '12px',
            padding: '20px',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0', color: '#e4e4f4' }}>{plan.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{
                    backgroundColor: getDifficultyColor(plan.difficulty),
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {plan.difficulty}
                  </span>
                  <span style={{ color: '#a0a0b0', fontSize: '14px' }}>
                    {plan.estimatedDuration} min
                  </span>
                  {plan.isTemplate && (
                    <span style={{ color: '#3b82f6', fontSize: '12px' }}>📋 Template</span>
                  )}
                </div>
              </div>
            </div>

            <p style={{ color: '#a0a0b0', fontSize: '14px', marginBottom: '15px' }}>
              {plan.description}
            </p>

            <div style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {plan.activities.slice(0, 3).map((activity) => (
                  <span key={activity.id} style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#e4e4f4',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {getActivityTypeIcon(activity.type)} {activity.title}
                  </span>
                ))}
                {plan.activities.length > 3 && (
                  <span style={{ color: '#a0a0b0', fontSize: '12px' }}>
                    +{plan.activities.length - 3} more
                  </span>
                )}
              </div>
            </div>

            <Button
              onClick={() => startLessonSession(plan)}
              variant="gradient"
              leftIcon="▶️"
            >
              Start Lesson
            </Button>
          </div>
        ))}
      </div>

      {currentSession && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          color: 'white',
          padding: '15px 20px',
          borderRadius: '10px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          cursor: 'pointer'
        }} onClick={() => setCurrentView('session')}>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
            📚 Active Lesson: {currentSession.lessonTitle}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>
            {formatDuration(Math.floor((Date.now() - currentSession.startTime) / 1000))} elapsed
          </div>
        </div>
      )}
    </div>
  );

  // Active Session View
  const renderActiveSession = () => {
    if (!currentSession || !selectedPlan) return null;

    const currentActivity = selectedPlan.activities[currentActivityIndex];
    const progress = (currentSession.completedActivities.length / selectedPlan.activities.length) * 100;

    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#e4e4f4' }}>📚 {currentSession.lessonTitle}</h2>
          <Button onClick={endLessonSession} variant="danger" leftIcon="⏹️">
            End Lesson
          </Button>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#a0a0b0', fontSize: '14px' }}>
              Progress: {currentSession.completedActivities.length} / {selectedPlan.activities.length} activities
            </span>
            <span style={{ color: '#a0a0b0', fontSize: '14px' }}>
              {formatDuration(Math.floor((Date.now() - currentSession.startTime) / 1000))} elapsed
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {/* Current Activity */}
        {currentActivity && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '12px',
            padding: '25px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <span style={{ fontSize: '24px' }}>{getActivityTypeIcon(currentActivity.type)}</span>
              <h3 style={{ margin: 0, color: '#e4e4f4' }}>{currentActivity.title}</h3>
              <span style={{
                backgroundColor: getDifficultyColor(currentActivity.difficulty || 'intermediate'),
                color: 'white',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {currentActivity.difficulty}
              </span>
            </div>

            <p style={{ color: '#a0a0b0', fontSize: '16px', marginBottom: '15px' }}>
              {currentActivity.description}
            </p>

            {currentActivity.targetDuration && (
              <p style={{ color: '#a0a0b0', fontSize: '14px', marginBottom: '15px' }}>
                ⏱️ Target Duration: {currentActivity.targetDuration} minutes
              </p>
            )}

            {currentActivity.type === 'custom' && currentActivity.customConfig && (
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ color: '#e4e4f4', marginBottom: '10px' }}>Instructions:</h4>
                <p style={{ color: '#a0a0b0', fontSize: '14px' }}>
                  {currentActivity.customConfig.instructions}
                </p>
                {currentActivity.customConfig.notes && (
                  <p style={{ color: '#a0a0b0', fontSize: '14px', fontStyle: 'italic' }}>
                    Note: {currentActivity.customConfig.notes}
                  </p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <Button
                onClick={() => onStartActivity(currentActivity)}
                variant="gradient"
                leftIcon="▶️"
              >
                Start Activity
              </Button>
              <Button
                onClick={() => completeActivity(currentActivity.id)}
                variant="success"
                leftIcon="✅"
                disabled={currentSession.completedActivities.includes(currentActivity.id)}
              >
                {currentSession.completedActivities.includes(currentActivity.id) ? 'Completed' : 'Mark Complete'}
              </Button>
            </div>
          </div>
        )}

        {/* All Activities List */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h4 style={{ color: '#e4e4f4', marginBottom: '15px' }}>All Activities</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {selectedPlan.activities.map((activity, index) => (
              <div key={activity.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px',
                backgroundColor: index === currentActivityIndex ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                borderRadius: '8px',
                border: index === currentActivityIndex ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent'
              }}>
                <span style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: currentSession.completedActivities.includes(activity.id) ? '#10b981' : 
                    index === currentActivityIndex ? '#3b82f6' : 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: 'white'
                }}>
                  {currentSession.completedActivities.includes(activity.id) ? '✓' : index + 1}
                </span>
                <span style={{ fontSize: '16px' }}>{getActivityTypeIcon(activity.type)}</span>
                <span style={{ color: '#e4e4f4' }}>{activity.title}</span>
                {activity.targetDuration && (
                  <span style={{ color: '#a0a0b0', fontSize: '12px' }}>
                    ({activity.targetDuration} min)
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Session Notes */}
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ color: '#e4e4f4', marginBottom: '10px' }}>Session Notes</h4>
            <textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Add notes about your practice session..."
              style={{
                width: '100%',
                height: '80px',
                padding: '10px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: '#e4e4f4',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Session Rating */}
          <div style={{ marginTop: '15px' }}>
            <h4 style={{ color: '#e4e4f4', marginBottom: '10px' }}>Rate This Session</h4>
            <div style={{ display: 'flex', gap: '5px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setSessionRating(star)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '24px',
                    color: star <= sessionRating ? '#fbbf24' : '#6b7280',
                    cursor: 'pointer',
                    transition: 'color 0.2s ease'
                  }}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // History View
  const renderHistory = () => (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ margin: 0, color: '#e4e4f4' }}>Lesson History</h2>
        <Button onClick={() => setCurrentView('library')} variant="secondary" leftIcon="📚">
          Back to Library
        </Button>
      </div>

      {lessonHistory.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#a0a0b0'
        }}>
          <p>No lesson history yet. Complete your first lesson to see it here!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {lessonHistory.map((session) => (
            <div key={session.id} style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#e4e4f4' }}>{session.lessonTitle}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#a0a0b0', fontSize: '14px' }}>
                  <span>📅 {new Date(session.startTime).toLocaleDateString()}</span>
                  <span>⏱️ {formatDuration(session.duration)}</span>
                  <span>✅ {session.completedActivities.length} activities</span>
                  {session.overallRating && (
                    <span>⭐ {session.overallRating}/5</span>
                  )}
                  <span style={{
                    backgroundColor: session.completed ? '#10b981' : '#f59e0b',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {session.completed ? 'Completed' : 'Partial'}
                  </span>
                </div>
                {session.notes && (
                  <p style={{ color: '#a0a0b0', fontSize: '14px', marginTop: '10px', fontStyle: 'italic' }}>
                    "{session.notes}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Create Lesson View
  const renderCreateLesson = () => {
    const addActivity = () => {
      const newActivity: LessonActivity = {
        id: `activity_${Date.now()}`,
        type: 'custom',
        title: 'New Activity',
        description: 'Describe your activity here',
        targetDuration: 10,
        difficulty: newLessonDifficulty,
        customConfig: {
          instructions: 'Add instructions here',
          notes: ''
        }
      };
      setNewLessonActivities([...newLessonActivities, newActivity]);
    };

    const removeActivity = (activityId: string) => {
      setNewLessonActivities(newLessonActivities.filter(a => a.id !== activityId));
    };

    const updateActivity = (activityId: string, updates: Partial<LessonActivity>) => {
      setNewLessonActivities(newLessonActivities.map(a => 
        a.id === activityId ? { ...a, ...updates } : a
      ));
    };

    const saveLessonPlan = () => {
      if (!newLessonTitle.trim()) {
        (window as any).showToast?.({
          type: 'error',
          title: 'Validation Error',
          message: 'Please provide a lesson title',
          duration: 3000
        });
        return;
      }

      if (newLessonActivities.length === 0) {
        (window as any).showToast?.({
          type: 'error',
          title: 'Validation Error',
          message: 'Please add at least one activity',
          duration: 3000
        });
        return;
      }

      const estimatedDuration = newLessonActivities.reduce((total, activity) => 
        total + (activity.targetDuration || 0), 0
      );

      const newPlan: LessonPlan = {
        id: `lesson_${Date.now()}`,
        title: newLessonTitle,
        description: newLessonDescription,
        difficulty: newLessonDifficulty,
        estimatedDuration,
        activities: newLessonActivities,
        tags: [newLessonDifficulty, 'custom'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isTemplate: false,
        createdBy: 'user'
      };

      tracker.createLessonPlan(newPlan);

      // Reset form
      setNewLessonTitle('');
      setNewLessonDescription('');
      setNewLessonDifficulty('beginner');
      setNewLessonActivities([]);
      setCurrentView('library');

      (window as any).showToast?.({
        type: 'success',
        title: 'Lesson Created!',
        message: `Successfully created "${newPlan.title}"`,
        duration: 3000
      });
    };

    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h2 style={{ margin: 0, color: '#e4e4f4' }}>Create New Lesson</h2>
          <Button onClick={() => setCurrentView('library')} variant="secondary" leftIcon="←">
            Back to Library
          </Button>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '12px',
          padding: '25px',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: '#e4e4f4', marginBottom: '20px' }}>Lesson Details</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', color: '#e4e4f4', marginBottom: '5px' }}>Title</label>
              <input
                type="text"
                value={newLessonTitle}
                onChange={(e) => setNewLessonTitle(e.target.value)}
                placeholder="Enter lesson title"
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#e4e4f4',
                  fontSize: '16px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#e4e4f4', marginBottom: '5px' }}>Description</label>
              <textarea
                value={newLessonDescription}
                onChange={(e) => setNewLessonDescription(e.target.value)}
                placeholder="Describe your lesson"
                style={{
                  width: '100%',
                  height: '80px',
                  padding: '10px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#e4e4f4',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#e4e4f4', marginBottom: '5px' }}>Difficulty</label>
              <select
                value={newLessonDifficulty}
                onChange={(e) => setNewLessonDifficulty(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                style={{
                  padding: '10px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#e4e4f4',
                  fontSize: '14px'
                }}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '12px',
          padding: '25px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: '#e4e4f4', margin: 0 }}>Activities</h3>
            <Button onClick={addActivity} variant="gradient" leftIcon="➕">
              Add Activity
            </Button>
          </div>

          {newLessonActivities.length === 0 ? (
            <p style={{ color: '#a0a0b0', textAlign: 'center', padding: '20px' }}>
              No activities yet. Click "Add Activity" to get started!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {newLessonActivities.map((activity, index) => (
                <div key={activity.id} style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '15px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ color: '#e4e4f4', fontWeight: 'bold' }}>Activity {index + 1}</span>
                    <Button onClick={() => removeActivity(activity.id)} variant="danger" size="small">
                      Remove
                    </Button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ display: 'block', color: '#e4e4f4', marginBottom: '5px', fontSize: '14px' }}>Title</label>
                      <input
                        type="text"
                        value={activity.title}
                        onChange={(e) => updateActivity(activity.id, { title: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px',
                          backgroundColor: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '6px',
                          color: '#e4e4f4',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', color: '#e4e4f4', marginBottom: '5px', fontSize: '14px' }}>Duration (minutes)</label>
                      <input
                        type="number"
                        value={activity.targetDuration || 0}
                        onChange={(e) => updateActivity(activity.id, { targetDuration: parseInt(e.target.value) || 0 })}
                        min="1"
                        max="60"
                        style={{
                          width: '100%',
                          padding: '8px',
                          backgroundColor: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '6px',
                          color: '#e4e4f4',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', color: '#e4e4f4', marginBottom: '5px', fontSize: '14px' }}>Description</label>
                    <textarea
                      value={activity.description}
                      onChange={(e) => updateActivity(activity.id, { description: e.target.value })}
                      style={{
                        width: '100%',
                        height: '60px',
                        padding: '8px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        color: '#e4e4f4',
                        fontSize: '14px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
          <Button onClick={() => setCurrentView('library')} variant="secondary">
            Cancel
          </Button>
          <Button onClick={saveLessonPlan} variant="gradient" leftIcon="💾">
            Save Lesson Plan
          </Button>
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div style={{
      minHeight: 'calc(100vh - 100px)',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      color: '#e4e4f4'
    }}>
      {currentView === 'library' && renderLessonLibrary()}
      {currentView === 'create' && renderCreateLesson()}
      {currentView === 'session' && renderActiveSession()}
      {currentView === 'history' && renderHistory()}
      
      <ToastContainer position="top-right" maxToasts={3} />
    </div>
  );
};

export default LessonPlanner; 