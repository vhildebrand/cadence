import React from 'react';
import { type LessonActivity, type LessonSession, type LessonPlan } from '../utils/LessonPlannerTracker';
import Button from './Button';

interface CurrentExercisePopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: LessonSession | null;
  selectedPlan: LessonPlan | null;
  currentActivityIndex: number;
  onStartActivity: (activity: LessonActivity) => void;
  onCompleteActivity: (activityId: string) => void;
}

const CurrentExercisePopup: React.FC<CurrentExercisePopupProps> = ({
  isOpen,
  onClose,
  currentSession,
  selectedPlan,
  currentActivityIndex,
  onStartActivity,
  onCompleteActivity
}) => {
  if (!isOpen) return null;

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

  if (!currentSession || !selectedPlan) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }} onClick={onClose}>
        <div style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '16px',
          padding: '30px',
          maxWidth: '500px',
          width: '90%',
          textAlign: 'center',
          color: '#e4e4f4'
        }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📚</div>
          <h2 style={{ margin: '0 0 15px 0', color: '#e4e4f4' }}>No Active Lesson</h2>
          <p style={{ color: '#a0a0b0', marginBottom: '20px' }}>
            You don't have any active lesson sessions right now. Start a lesson from the Lesson Planner to track your progress!
          </p>
          <Button onClick={onClose} variant="gradient">
            OK
          </Button>
        </div>
      </div>
    );
  }

  const currentActivity = selectedPlan.activities[currentActivityIndex];
  const progress = (currentSession.completedActivities.length / selectedPlan.activities.length) * 100;
  const sessionElapsed = Math.floor((Date.now() - currentSession.startTime) / 1000);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '16px',
        padding: '30px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        color: '#e4e4f4'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0', color: '#e4e4f4' }}>📚 Current Exercise</h2>
            <p style={{ margin: 0, color: '#a0a0b0', fontSize: '14px' }}>
              Press <kbd style={{ 
                backgroundColor: 'rgba(255,255,255,0.1)', 
                padding: '2px 6px', 
                borderRadius: '4px', 
                fontSize: '12px',
                fontFamily: 'monospace'
              }}>Ctrl+E</kbd> anytime to check your current exercise
            </p>
          </div>
          <Button onClick={onClose} variant="secondary" size="small">
            ✕
          </Button>
        </div>

        {/* Lesson Info */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#e4e4f4' }}>{currentSession.lessonTitle}</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ color: '#a0a0b0', fontSize: '14px' }}>
              Progress: {currentSession.completedActivities.length} / {selectedPlan.activities.length} activities
            </span>
            <span style={{ color: '#a0a0b0', fontSize: '14px' }}>
              {formatDuration(sessionElapsed)} elapsed
            </span>
          </div>
          
          {/* Progress Bar */}
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
              <span style={{ fontSize: '32px' }}>{getActivityTypeIcon(currentActivity.type)}</span>
              <div>
                <h3 style={{ margin: '0 0 5px 0', color: '#e4e4f4' }}>{currentActivity.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                  {currentActivity.targetDuration && (
                    <span style={{ color: '#a0a0b0', fontSize: '12px' }}>
                      ⏱️ {currentActivity.targetDuration} min
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p style={{ color: '#a0a0b0', fontSize: '16px', marginBottom: '15px' }}>
              {currentActivity.description}
            </p>

            {/* Activity-specific details */}
            {currentActivity.type === 'scale' && currentActivity.scaleConfig && (
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ color: '#e4e4f4', marginBottom: '8px', fontSize: '14px' }}>Scale Details:</h4>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#a0a0b0', fontSize: '14px' }}>
                    🎼 {currentActivity.scaleConfig.rootNote} {currentActivity.scaleConfig.scaleName}
                  </span>
                  <span style={{ color: '#a0a0b0', fontSize: '14px' }}>
                    🎹 Octave {currentActivity.scaleConfig.octave}
                  </span>
                  <span style={{ color: '#a0a0b0', fontSize: '14px' }}>
                    🎵 {currentActivity.scaleConfig.tempo} BPM
                  </span>
                  {currentActivity.scaleConfig.metronomeEnabled && (
                    <span style={{ color: '#a0a0b0', fontSize: '14px' }}>
                      🎛️ Metronome On
                    </span>
                  )}
                </div>
              </div>
            )}

            {currentActivity.type === 'ear-training' && currentActivity.earTrainingConfig && (
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ color: '#e4e4f4', marginBottom: '8px', fontSize: '14px' }}>Ear Training Details:</h4>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#a0a0b0', fontSize: '14px' }}>
                    👂 {currentActivity.earTrainingConfig.exerciseType}
                  </span>
                  <span style={{ color: '#a0a0b0', fontSize: '14px' }}>
                    📊 {currentActivity.earTrainingConfig.difficulty}
                  </span>
                  <span style={{ color: '#a0a0b0', fontSize: '14px' }}>
                    🎯 {currentActivity.earTrainingConfig.questionCount} questions
                  </span>
                </div>
              </div>
            )}

            {currentActivity.type === 'custom' && currentActivity.customConfig && (
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ color: '#e4e4f4', marginBottom: '8px', fontSize: '14px' }}>Instructions:</h4>
                <p style={{ color: '#a0a0b0', fontSize: '14px', marginBottom: '8px' }}>
                  {currentActivity.customConfig.instructions}
                </p>
                {currentActivity.customConfig.notes && (
                  <p style={{ color: '#a0a0b0', fontSize: '14px', fontStyle: 'italic' }}>
                    Note: {currentActivity.customConfig.notes}
                  </p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <Button
                onClick={() => onStartActivity(currentActivity)}
                variant="gradient"
                leftIcon="▶️"
              >
                Start Activity
              </Button>
              <Button
                onClick={() => onCompleteActivity(currentActivity.id)}
                variant="success"
                leftIcon="✅"
                disabled={currentSession.completedActivities.includes(currentActivity.id)}
              >
                {currentSession.completedActivities.includes(currentActivity.id) ? 'Completed' : 'Mark Complete'}
              </Button>
            </div>
          </div>
        )}

        {/* Quick Activity Overview */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h4 style={{ color: '#e4e4f4', marginBottom: '15px', fontSize: '16px' }}>All Activities</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {selectedPlan.activities.map((activity, index) => (
              <div key={activity.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                backgroundColor: index === currentActivityIndex ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                borderRadius: '8px',
                border: index === currentActivityIndex ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent'
              }}>
                <span style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: currentSession.completedActivities.includes(activity.id) ? '#10b981' : 
                    index === currentActivityIndex ? '#3b82f6' : 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: 'white'
                }}>
                  {currentSession.completedActivities.includes(activity.id) ? '✓' : index + 1}
                </span>
                <span style={{ fontSize: '14px' }}>{getActivityTypeIcon(activity.type)}</span>
                <span style={{ color: '#e4e4f4', fontSize: '14px' }}>{activity.title}</span>
                {activity.targetDuration && (
                  <span style={{ color: '#a0a0b0', fontSize: '12px' }}>
                    ({activity.targetDuration} min)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrentExercisePopup; 