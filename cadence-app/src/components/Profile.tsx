import { useState, useEffect, useMemo } from 'react';
import { PerformanceTracker } from '../utils/PerformanceTracker';
import type { UserProfile, PiecePerformance, PerformanceSession } from '../utils/PerformanceTracker';
import { ScalePerformanceTracker } from '../utils/ScalePerformanceTracker';
import type { ScaleUserProfile, ScalePerformance, ScalePerformanceSession } from '../utils/ScalePerformanceTracker';
import { EarTrainingStatsManager } from '../utils/EarTrainingStats';
import type { EarTrainingStats } from '../utils/EarTrainingStats';
import { LessonPlannerTracker } from '../utils/LessonPlannerTracker';
import { PerformanceDataCollector } from '../utils/PerformanceDataCollector';

interface ProfileProps {
  performanceTracker: PerformanceTracker;
  scalePerformanceTracker?: ScalePerformanceTracker;
  lessonPlannerTracker?: LessonPlannerTracker;
}

// Line chart component for trends
const TrendChart = ({ 
  data, 
  title, 
  color = '#3b82f6',
  height = 120 
}: { 
  data: { x: string; y: number }[]; 
  title: string; 
  color?: string;
  height?: number;
}) => {
  if (data.length === 0) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6c757d',
        fontSize: '14px',
        fontStyle: 'italic'
      }}>
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.y));
  const minValue = Math.min(...data.map(d => d.y));
  const range = maxValue - minValue || 1; // Avoid division by zero
  
  const chartHeight = height - 30;
  const chartWidth = 300; // Fixed width for consistency
  const padding = 20;
  const plotWidth = chartWidth - 2 * padding;
  const plotHeight = chartHeight - 2 * padding;

  // Calculate point positions
  const points = data.map((point, index) => ({
    x: padding + (index / Math.max(data.length - 1, 1)) * plotWidth,
    y: padding + (1 - (point.y - minValue) / range) * plotHeight,
    value: point.y,
    date: point.x
  }));

  // Create path string for the line
  const pathData = points.reduce((path, point, index) => {
    const command = index === 0 ? 'M' : 'L';
    return `${path} ${command} ${point.x} ${point.y}`;
  }, '');

  return (
    <div style={{ height }}>
      <div style={{ 
        fontSize: '12px', 
        color: '#e4e4f4', 
        marginBottom: '8px',
        fontWeight: '500'
      }}>
        {title}
      </div>
      <div style={{
        height: chartHeight,
        position: 'relative',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <svg
          width={chartWidth}
          height={chartHeight}
          style={{
            width: '100%',
            height: '100%',
            display: 'block'
          }}
        >
          {/* Grid lines */}
          <defs>
            <pattern
              id={`grid-${title.replace(/\s+/g, '')}`}
              width="40"
              height="30"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 30"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect
            width={chartWidth}
            height={chartHeight}
            fill={`url(#grid-${title.replace(/\s+/g, '')})`}
          />
          
          {/* Main trend line */}
          <path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
            }}
          />
          
          {/* Data points */}
          {points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill={color}
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="2"
                style={{
                  cursor: 'pointer',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                }}
              >
                <title>{`${point.date}: ${point.value.toFixed(1)}`}</title>
              </circle>
              {/* Hover effect */}
              <circle
                cx={point.x}
                cy={point.y}
                r="8"
                fill="transparent"
                style={{ cursor: 'pointer' }}
              >
                <title>{`${point.date}: ${point.value.toFixed(1)}`}</title>
              </circle>
            </g>
          ))}
          
          {/* Y-axis labels */}
          <text
            x={padding - 5}
            y={padding + 5}
            fill="rgba(255,255,255,0.6)"
            fontSize="10"
            textAnchor="end"
          >
            {maxValue.toFixed(0)}
          </text>
          <text
            x={padding - 5}
            y={chartHeight - padding + 5}
            fill="rgba(255,255,255,0.6)"
            fontSize="10"
            textAnchor="end"
          >
            {minValue.toFixed(0)}
          </text>
        </svg>
      </div>
    </div>
  );
};

// Stat card component
const StatCard = ({ 
  title, 
  value, 
  subtitle, 
  color = '#3b82f6',
  gradient = true 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  color?: string;
  gradient?: boolean;
}) => (
  <div style={{
    padding: '16px',
    background: gradient 
      ? `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`
      : 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    border: `1px solid ${color}20`,
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden'
  }}>
    {gradient && (
      <div style={{
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        height: '2px',
        background: `linear-gradient(90deg, ${color}, ${color}80)`
      }} />
    )}
    <div style={{ 
      fontSize: '24px', 
      fontWeight: 'bold', 
      color,
      marginBottom: '4px'
    }}>
      {value}
    </div>
    <div style={{ 
      color: '#e4e4f4', 
      fontWeight: '500',
      fontSize: '14px'
    }}>
      {title}
    </div>
    {subtitle && (
      <div style={{ 
        color: '#6c757d', 
        fontSize: '12px',
        marginTop: '4px'
      }}>
        {subtitle}
      </div>
    )}
  </div>
);

// Session card component
const SessionCard = ({ session }: { session: PerformanceSession }) => (
  <div style={{
    padding: '12px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)',
    marginBottom: '8px'
  }}>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8px'
    }}>
      <div style={{ fontWeight: '500', color: '#ffffff' }}>
        {session.pieceTitle}
      </div>
      <div style={{ 
        fontSize: '12px', 
        color: '#6c757d' 
      }}>
        {new Date(session.timestamp).toLocaleDateString()}
      </div>
    </div>
    
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '8px',
      fontSize: '12px'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#22c55e', fontWeight: 'bold' }}>
          {session.accuracy.toFixed(1)}%
        </div>
        <div style={{ color: '#6c757d' }}>Accuracy</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#3b82f6', fontWeight: 'bold' }}>
          {session.longestStreak}
        </div>
        <div style={{ color: '#6c757d' }}>Best Streak</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#f59e0b', fontWeight: 'bold' }}>
          {Math.round(session.duration / 60)}m
        </div>
        <div style={{ color: '#6c757d' }}>Duration</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#8b5cf6', fontWeight: 'bold' }}>
          {session.totalChords}
        </div>
        <div style={{ color: '#6c757d' }}>Chords</div>
      </div>
    </div>
  </div>
);

export default function Profile({ performanceTracker, scalePerformanceTracker, lessonPlannerTracker }: ProfileProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [scaleProfile, setScaleProfile] = useState<ScaleUserProfile | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'pieces' | 'recent' | 'ear-training' | 'scales' | 'lessons'>('overview');
  const [earTrainingStats, setEarTrainingStats] = useState<EarTrainingStats>(EarTrainingStatsManager.getStats());
  const [lessonStats, setLessonStats] = useState(lessonPlannerTracker?.getStatistics() || null);
  
  // OpenAI lesson generation state
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [generatedLesson, setGeneratedLesson] = useState<any>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);

  // Load profile data and subscribe to changes
  useEffect(() => {
    setProfile(performanceTracker.getProfile());
    
    // Subscribe to profile changes
    const unsubscribe = performanceTracker.subscribe(() => {
      setProfile(performanceTracker.getProfile());
    });

    return unsubscribe;
  }, [performanceTracker]);

  // Load scale profile data and subscribe to changes
  useEffect(() => {
    if (scalePerformanceTracker) {
      setScaleProfile(scalePerformanceTracker.getProfile());
      
      // Subscribe to scale profile changes
      const unsubscribe = scalePerformanceTracker.subscribe(() => {
        setScaleProfile(scalePerformanceTracker.getProfile());
      });

      return unsubscribe;
    }
  }, [scalePerformanceTracker]);

  // Load ear training stats
  useEffect(() => {
    setEarTrainingStats(EarTrainingStatsManager.getStats());
    
    // Listen for storage changes (when ear training stats are updated)
    const handleStorageChange = () => {
      setEarTrainingStats(EarTrainingStatsManager.getStats());
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Load lesson planner stats
  useEffect(() => {
    if (lessonPlannerTracker) {
      setLessonStats(lessonPlannerTracker.getStatistics());
      
      const listener = () => {
        setLessonStats(lessonPlannerTracker.getStatistics());
      };
      
      lessonPlannerTracker.addListener(listener);

      return () => lessonPlannerTracker.removeListener(listener);
    }
  }, [lessonPlannerTracker]);

  // Load API key from localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem('openai_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);

  // Get selected piece performance
  const selectedPiecePerformance = useMemo(() => {
    if (!selectedPiece) return null;
    return performanceTracker.getPiecePerformance(selectedPiece);
  }, [selectedPiece, performanceTracker]);

  // Get overall trends - individual sessions as data points
  const overallTrends = useMemo(() => {
    const profile = performanceTracker.getProfile();
    const cutoffDate = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago
    const recentSessions = profile.recentSessions
      .filter(session => session.timestamp >= cutoffDate)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    return {
      dates: recentSessions.map(session => ({ 
        x: new Date(session.timestamp).toLocaleDateString(), 
        y: session.accuracy 
      })),
      sessions: recentSessions.map((session, index) => ({ 
        x: new Date(session.timestamp).toLocaleDateString(), 
        y: index + 1 // Cumulative session count
      }))
    };
  }, [performanceTracker]);

  // Get piece trends - individual sessions
  const pieceTrends = useMemo(() => {
    if (!selectedPiece || !selectedPiecePerformance) return { accuracies: [], streaks: [] };
    
    // Get recent sessions (last 30 days or last 20 sessions, whichever is smaller)
    const cutoffDate = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentSessions = selectedPiecePerformance.sessions
      .filter(session => session.timestamp >= cutoffDate)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-20); // Limit to last 20 sessions for readability
    
    return {
      accuracies: recentSessions.map((session, index) => ({
        x: `Session ${index + 1}`,
        y: session.accuracy
      })),
      streaks: recentSessions.map((session, index) => ({
        x: `Session ${index + 1}`,
        y: session.longestStreak
      }))
    };
  }, [selectedPiece, selectedPiecePerformance]);

  // Handle OpenAI lesson generation
  const handleGenerateLesson = async () => {
    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }

    setIsGeneratingLesson(true);
    setLessonError(null);

    try {
      // Collect performance data
      const performanceData = PerformanceDataCollector.collectAllPerformanceData(
        performanceTracker,
        scalePerformanceTracker,
        lessonPlannerTracker
      );

      // Call OpenAI API through electron
      const result = await (window as any).electronAPI.generateLessonWithOpenAI(performanceData, apiKey);
      
      if (result.success) {
        setGeneratedLesson(result.data);
        
        // Show success toast
        (window as any).showToast?.({
          type: 'success',
          title: 'Lesson Generated!',
          message: 'Your personalized lesson plan has been created.',
          duration: 4000
        });
      } else {
        setLessonError(result.error || 'Failed to generate lesson');
        
        // Show error toast
        (window as any).showToast?.({
          type: 'error',
          title: 'Lesson Generation Failed',
          message: result.error || 'An error occurred while generating your lesson',
          duration: 6000
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setLessonError(errorMessage);
      
      // Show error toast
      (window as any).showToast?.({
        type: 'error',
        title: 'Lesson Generation Failed',
        message: errorMessage,
        duration: 6000
      });
    } finally {
      setIsGeneratingLesson(false);
    }
  };

  const handleSaveGeneratedLesson = () => {
    if (!generatedLesson || !lessonPlannerTracker) return;

    // Create lesson plan from generated data
    const lessonPlan = {
      title: generatedLesson.title,
      description: generatedLesson.description,
      difficulty: generatedLesson.difficulty,
      estimatedDuration: generatedLesson.estimatedDuration,
      activities: generatedLesson.activities.map((activity: any, index: number) => ({
        id: `generated_activity_${Date.now()}_${index}`,
        ...activity
      })),
      tags: ['AI Generated'],
      isTemplate: false,
      createdBy: 'system' as 'system'
    };

    const lessonId = lessonPlannerTracker.createLessonPlan(lessonPlan);
    
    if (lessonId) {
      // Show success toast
      (window as any).showToast?.({
        type: 'success',
        title: 'Lesson Plan Saved!',
        message: 'Your AI-generated lesson has been added to your lesson planner.',
        duration: 4000
      });
      
      // Clear generated lesson
      setGeneratedLesson(null);
    }
  };

  if (!profile) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#6c757d'
      }}>
        Loading profile...
      </div>
    );
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const pieces = Array.from(profile.pieces.values()).sort((a, b) => b.lastPlayed - a.lastPlayed);

  return (
    <div style={{
      padding: '20px',
      background: 'rgba(42, 42, 62, 0.8)',
      border: '1px solid #3a3a4a',
      borderRadius: '16px',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#e4e4f4',
      height: '100%',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h2 style={{ 
          margin: '0 0 8px 0', 
          color: '#ffffff',
          fontSize: '24px',
          fontWeight: '600'
        }}>
          👤 {profile.username}
        </h2>
        <p style={{ 
          margin: '0', 
          color: '#6c757d',
          fontSize: '14px'
        }}>
          Member since {new Date(profile.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px'
      }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'overview' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '8px',
            color: activeTab === 'overview' ? '#ffffff' : '#e4e4f4',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('pieces')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'pieces' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '8px',
            color: activeTab === 'pieces' ? '#ffffff' : '#e4e4f4',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Pieces ({profile.totalPieces})
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'recent' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '8px',
            color: activeTab === 'recent' ? '#ffffff' : '#e4e4f4',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Recent Sessions
        </button>
        <button
          onClick={() => setActiveTab('ear-training')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'ear-training' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '8px',
            color: activeTab === 'ear-training' ? '#ffffff' : '#e4e4f4',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Ear Training ({earTrainingStats.totalSessions})
        </button>
        {scalePerformanceTracker && (
          <button
            onClick={() => setActiveTab('scales')}
            style={{
              padding: '8px 16px',
              background: activeTab === 'scales' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              color: activeTab === 'scales' ? '#ffffff' : '#e4e4f4',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Scale Practice ({scaleProfile?.totalSessions || 0})
          </button>
        )}
        {lessonPlannerTracker && (
          <button
            onClick={() => setActiveTab('lessons')}
            style={{
              padding: '8px 16px',
              background: activeTab === 'lessons' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              color: activeTab === 'lessons' ? '#ffffff' : '#e4e4f4',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Lessons ({lessonStats?.totalLessons || 0})
          </button>
        )}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* Overall Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <StatCard
              title="Total Play Time"
              value={formatDuration(profile.totalPlayTime)}
              color="#22c55e"
            />
            <StatCard
              title="Total Sessions"
              value={profile.totalSessions}
              color="#3b82f6"
            />
            <StatCard
              title="Best Accuracy"
              value={`${profile.bestAccuracy.toFixed(1)}%`}
              color="#f59e0b"
            />
            <StatCard
              title="Best Streak"
              value={profile.bestStreak}
              color="#8b5cf6"
            />
          </div>

          {/* Trends */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '24px'
          }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              color: '#ffffff',
              fontSize: '18px',
              fontWeight: '600'
            }}>
              📈 Performance Trends (30 Days)
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px'
            }}>
              <TrendChart
                data={overallTrends.dates}
                title="Individual Session Accuracy"
                color="#22c55e"
              />
              <TrendChart
                data={overallTrends.sessions}
                title="Cumulative Sessions"
                color="#3b82f6"
              />
            </div>
          </div>

          {/* AI Lesson Generation */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '24px'
          }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              color: '#ffffff',
              fontSize: '18px',
              fontWeight: '600'
            }}>
              🤖 AI Lesson Generation
            </h3>
            <p style={{ 
              color: '#6c757d',
              fontSize: '14px',
              marginBottom: '16px',
              lineHeight: '1.5'
            }}>
              Generate personalized lesson plans based on your performance data using OpenAI. 
              The AI will analyze your strengths and weaknesses to create tailored practice sessions.
            </p>

            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <button
                onClick={handleGenerateLesson}
                disabled={isGeneratingLesson}
                style={{
                  padding: '12px 24px',
                  background: isGeneratingLesson 
                    ? 'rgba(255,255,255,0.1)' 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  cursor: isGeneratingLesson ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: isGeneratingLesson ? 0.6 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {isGeneratingLesson ? '🔄 Generating...' : '✨ Generate AI Lesson'}
              </button>

              {!apiKey && (
                <button
                  onClick={() => setShowApiKeyModal(true)}
                  style={{
                    padding: '12px 24px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#e4e4f4',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  🔑 Set API Key
                </button>
              )}
            </div>

            {lessonError && (
              <div style={{
                padding: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '14px',
                marginBottom: '16px'
              }}>
                ❌ {lessonError}
              </div>
            )}

            {generatedLesson && (
              <div style={{
                padding: '16px',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <h4 style={{ 
                  margin: '0 0 8px 0', 
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  📚 {generatedLesson.title}
                </h4>
                <p style={{ 
                  color: '#6c757d',
                  fontSize: '14px',
                  marginBottom: '12px',
                  lineHeight: '1.5'
                }}>
                  {generatedLesson.description}
                </p>
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  marginBottom: '12px',
                  fontSize: '12px',
                  color: '#6c757d'
                }}>
                  <span>Difficulty: {generatedLesson.difficulty}</span>
                  <span>Duration: {generatedLesson.estimatedDuration} min</span>
                  <span>Activities: {generatedLesson.activities?.length || 0}</span>
                </div>
                <div style={{
                  display: 'flex',
                  gap: '8px'
                }}>
                  <button
                    onClick={handleSaveGeneratedLesson}
                    style={{
                      padding: '8px 16px',
                      background: '#22c55e',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}
                  >
                    💾 Save to Lesson Planner
                  </button>
                  <button
                    onClick={() => setGeneratedLesson(null)}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px',
                      color: '#e4e4f4',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}
                  >
                    ✖️ Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pieces Tab */}
      {activeTab === 'pieces' && (
        <div>
          {pieces.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6c757d'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎹</div>
              <div>No pieces played yet</div>
              <div style={{ fontSize: '12px', marginTop: '8px' }}>
                Start practicing to see your performance data here
              </div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '300px 1fr',
              gap: '20px',
              height: '500px'
            }}>
              {/* Piece List */}
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid rgba(255,255,255,0.1)',
                overflow: 'auto'
              }}>
                <h3 style={{ 
                  margin: '0 0 16px 0', 
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  Your Pieces
                </h3>
                {pieces.map(piece => (
                  <div
                    key={piece.pieceId}
                    onClick={() => setSelectedPiece(piece.pieceId)}
                    style={{
                      padding: '12px',
                      background: selectedPiece === piece.pieceId 
                        ? 'rgba(59, 130, 246, 0.2)' 
                        : 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      border: selectedPiece === piece.pieceId 
                        ? '1px solid rgba(59, 130, 246, 0.3)' 
                        : '1px solid transparent',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ 
                      fontWeight: '500', 
                      color: '#ffffff',
                      marginBottom: '4px'
                    }}>
                      {piece.pieceTitle}
                    </div>
                    {piece.composer && (
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#6c757d',
                        marginBottom: '4px'
                      }}>
                        {piece.composer}
                      </div>
                    )}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: '#6c757d'
                    }}>
                      <span>{piece.totalSessions} sessions</span>
                      <span>{formatDuration(piece.totalPlayTime)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Piece Details */}
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid rgba(255,255,255,0.1)',
                overflow: 'auto'
              }}>
                {selectedPiecePerformance ? (
                  <div>
                    <h3 style={{ 
                      margin: '0 0 16px 0', 
                      color: '#ffffff',
                      fontSize: '18px',
                      fontWeight: '600'
                    }}>
                      {selectedPiecePerformance.pieceTitle}
                    </h3>
                    
                    {/* Piece Stats */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '12px',
                      marginBottom: '20px'
                    }}>
                      <StatCard
                        title="Best Accuracy"
                        value={`${selectedPiecePerformance.bestAccuracy.toFixed(1)}%`}
                        color="#22c55e"
                        gradient={false}
                      />
                      <StatCard
                        title="Best Streak"
                        value={selectedPiecePerformance.bestStreak}
                        color="#3b82f6"
                        gradient={false}
                      />
                      <StatCard
                        title="Average Accuracy"
                        value={`${selectedPiecePerformance.averageAccuracy.toFixed(1)}%`}
                        color="#f59e0b"
                        gradient={false}
                      />
                      <StatCard
                        title="Total Time"
                        value={formatDuration(selectedPiecePerformance.totalPlayTime)}
                        color="#8b5cf6"
                        gradient={false}
                      />
                    </div>

                    {/* Piece Trends */}
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ 
                        margin: '0 0 12px 0', 
                        color: '#e4e4f4',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}>
                        Individual Performance Sessions (30 days)
                      </h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px'
                      }}>
                        <TrendChart
                          data={pieceTrends.accuracies}
                          title="Session Accuracy"
                          color="#22c55e"
                          height={100}
                        />
                        <TrendChart
                          data={pieceTrends.streaks}
                          title="Session Best Streak"
                          color="#3b82f6"
                          height={100}
                        />
                      </div>
                    </div>

                    {/* Recent Sessions */}
                    <div>
                      <h4 style={{ 
                        margin: '0 0 12px 0', 
                        color: '#e4e4f4',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}>
                        Recent Sessions
                      </h4>
                      <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                        {selectedPiecePerformance.sessions
                          .slice(-5)
                          .reverse()
                          .map(session => (
                            <SessionCard key={session.id} session={session} />
                          ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#6c757d'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                    <div>Select a piece to view details</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Sessions Tab */}
      {activeTab === 'recent' && (
        <div>
          <h3 style={{ 
            margin: '0 0 16px 0', 
            color: '#ffffff',
            fontSize: '18px',
            fontWeight: '600'
          }}>
            📝 Recent Practice Sessions
          </h3>
          
          {profile.recentSessions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6c757d'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎵</div>
              <div>No practice sessions yet</div>
              <div style={{ fontSize: '12px', marginTop: '8px' }}>
                Complete a practice session to see it here
              </div>
            </div>
          ) : (
            <div style={{ maxHeight: '500px', overflow: 'auto' }}>
              {profile.recentSessions.map(session => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scales Tab */}
      {activeTab === 'scales' && scaleProfile && (
        <div>
          {/* Scale Practice Overview */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <StatCard 
              title="Total Sessions" 
              value={scaleProfile.totalSessions} 
              subtitle="Scale practice sessions"
              color="#22c55e"
            />
            <StatCard 
              title="Practice Time" 
              value={formatDuration(scaleProfile.totalPlayTime)} 
              subtitle="Total practice duration"
              color="#3b82f6"
            />
            <StatCard 
              title="Scales Practiced" 
              value={scaleProfile.totalScales} 
              subtitle="Different scales practiced"
              color="#f59e0b"
            />
            <StatCard 
              title="Best Accuracy" 
              value={`${scaleProfile.bestAccuracy.toFixed(1)}%`} 
              subtitle="Highest note accuracy"
              color="#8b5cf6"
            />
            {scaleProfile.averageTimingAccuracy > 0 && (
              <StatCard 
                title="Best Timing" 
                value={`${scaleProfile.bestTimingAccuracy.toFixed(1)}%`} 
                subtitle="Best metronome timing"
                color="#06b6d4"
              />
            )}
            <StatCard 
              title="Metronome Usage" 
              value={`${scaleProfile.metronomeUsageRate.toFixed(1)}%`} 
              subtitle="Sessions with metronome"
              color="#10b981"
            />
          </div>

          {/* Scale Types Performance */}
          {scalePerformanceTracker && (() => {
            const scaleTypeStats = scalePerformanceTracker.getScaleTypeStats();
            return scaleTypeStats.length > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid rgba(255,255,255,0.1)',
                marginBottom: '24px'
              }}>
                <h4 style={{ 
                  margin: '0 0 16px 0', 
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  Performance by Scale Type
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '16px'
                }}>
                  {scaleTypeStats.map(stat => (
                    <div key={stat.scaleType} style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      padding: '16px',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <h5 style={{ 
                        margin: '0 0 12px 0', 
                        color: '#ffffff',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}>
                        {stat.scaleType}
                      </h5>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                        <div>
                          <div style={{ color: '#6c757d' }}>Sessions:</div>
                          <div style={{ color: '#ffffff', fontWeight: '500' }}>{stat.totalSessions}</div>
                        </div>
                        <div>
                          <div style={{ color: '#6c757d' }}>Avg Accuracy:</div>
                          <div style={{ color: '#22c55e', fontWeight: '500' }}>{stat.averageAccuracy.toFixed(1)}%</div>
                        </div>
                        <div>
                          <div style={{ color: '#6c757d' }}>Best Accuracy:</div>
                          <div style={{ color: '#3b82f6', fontWeight: '500' }}>{stat.bestAccuracy.toFixed(1)}%</div>
                        </div>
                        {stat.averageTimingAccuracy > 0 && (
                          <div>
                            <div style={{ color: '#6c757d' }}>Avg Timing:</div>
                            <div style={{ color: '#06b6d4', fontWeight: '500' }}>{stat.averageTimingAccuracy.toFixed(1)}%</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Recent Scale Sessions */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '24px'
          }}>
            <h4 style={{ 
              margin: '0 0 16px 0', 
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Recent Scale Practice Sessions
            </h4>
            {scaleProfile.recentSessions.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '20px',
                color: '#6c757d'
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎼</div>
                <div>No scale practice sessions yet</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>Start practicing scales to see your progress here</div>
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                {scaleProfile.recentSessions.slice(0, 10).map(session => (
                  <div key={session.id} style={{
                    padding: '16px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    marginBottom: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#ffffff', fontSize: '14px' }}>
                          {session.scaleName} in {session.rootNote}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
                          {new Date(session.timestamp).toLocaleDateString()} • {formatDuration(session.duration)}
                        </div>
                      </div>
                      <div style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: session.accuracy >= 90 ? 'rgba(34, 197, 94, 0.2)' : 
                                   session.accuracy >= 70 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: session.accuracy >= 90 ? '#22c55e' : 
                               session.accuracy >= 70 ? '#fbbf24' : '#ef4444'
                      }}>
                        {session.accuracy.toFixed(1)}%
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', fontSize: '11px' }}>
                      <div>
                        <span style={{ color: '#6c757d' }}>Direction: </span>
                        <span style={{ color: '#ffffff' }}>{session.direction}</span>
                      </div>
                      <div>
                        <span style={{ color: '#6c757d' }}>Notes: </span>
                        <span style={{ color: '#ffffff' }}>{session.correctNotes}/{session.totalNotes}</span>
                      </div>
                      <div>
                        <span style={{ color: '#6c757d' }}>Streak: </span>
                        <span style={{ color: '#ffffff' }}>{session.longestStreak}</span>
                      </div>
                      {session.metronomeEnabled && (
                        <>
                          <div>
                            <span style={{ color: '#6c757d' }}>BPM: </span>
                            <span style={{ color: '#ffffff' }}>{session.bpm}</span>
                          </div>
                          {session.timingAccuracy !== undefined && (
                            <div>
                              <span style={{ color: '#6c757d' }}>Timing: </span>
                              <span style={{ color: '#06b6d4' }}>{session.timingAccuracy.toFixed(1)}%</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clear Scale Data Button */}
          <div style={{
            textAlign: 'center',
            marginBottom: '24px'
          }}>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear all scale practice data? This cannot be undone.')) {
                  scalePerformanceTracker?.clearAllData();
                  setScaleProfile(scalePerformanceTracker?.getProfile() || null);
                }
              }}
              style={{
                padding: '8px 16px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#fca5a5',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Clear Scale Practice Data
            </button>
          </div>
        </div>
      )}

      {/* Ear Training Tab */}
      {activeTab === 'ear-training' && (
        <div>
          <h3 style={{ 
            margin: '0 0 16px 0', 
            color: '#ffffff',
            fontSize: '18px',
            fontWeight: '600'
          }}>
            🎵 Ear Training Performance
          </h3>
          
          {/* Overall Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <StatCard
              title="Total Exercises"
              value={earTrainingStats.totalSessions}
              color="#22c55e"
            />
            <StatCard
              title="Average Accuracy"
              value={`${earTrainingStats.averageAccuracy.toFixed(1)}%`}
              color="#3b82f6"
            />
            <StatCard
              title="Current Streak"
              value={earTrainingStats.currentStreak}
              color="#f59e0b"
            />
            <StatCard
              title="Best Streak"
              value={earTrainingStats.bestStreak}
              color="#8b5cf6"
            />
          </div>

          {/* Performance by Type */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '24px'
          }}>
            <h4 style={{ 
              margin: '0 0 16px 0', 
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Performance by Exercise Type
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px'
            }}>
              <StatCard
                title="Single Notes"
                value={`${earTrainingStats.sessionsByType['single-note'].accuracy.toFixed(1)}%`}
                subtitle={`${earTrainingStats.sessionsByType['single-note'].correct}/${earTrainingStats.sessionsByType['single-note'].total}`}
                color="#22c55e"
                gradient={false}
              />
              <StatCard
                title="Intervals"
                value={`${earTrainingStats.sessionsByType['interval'].accuracy.toFixed(1)}%`}
                subtitle={`${earTrainingStats.sessionsByType['interval'].correct}/${earTrainingStats.sessionsByType['interval'].total}`}
                color="#3b82f6"
                gradient={false}
              />
              <StatCard
                title="Chords"
                value={`${earTrainingStats.sessionsByType['chord'].accuracy.toFixed(1)}%`}
                subtitle={`${earTrainingStats.sessionsByType['chord'].correct}/${earTrainingStats.sessionsByType['chord'].total}`}
                color="#8b5cf6"
                gradient={false}
              />
            </div>
          </div>

          {/* Performance by Difficulty */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '24px'
          }}>
            <h4 style={{ 
              margin: '0 0 16px 0', 
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Performance by Difficulty
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px'
            }}>
              <StatCard
                title="Easy"
                value={`${earTrainingStats.sessionsByDifficulty['easy'].accuracy.toFixed(1)}%`}
                subtitle={`${earTrainingStats.sessionsByDifficulty['easy'].correct}/${earTrainingStats.sessionsByDifficulty['easy'].total}`}
                color="#22c55e"
                gradient={false}
              />
              <StatCard
                title="Medium"
                value={`${earTrainingStats.sessionsByDifficulty['medium'].accuracy.toFixed(1)}%`}
                subtitle={`${earTrainingStats.sessionsByDifficulty['medium'].correct}/${earTrainingStats.sessionsByDifficulty['medium'].total}`}
                color="#f59e0b"
                gradient={false}
              />
              <StatCard
                title="Hard"
                value={`${earTrainingStats.sessionsByDifficulty['hard'].accuracy.toFixed(1)}%`}
                subtitle={`${earTrainingStats.sessionsByDifficulty['hard'].correct}/${earTrainingStats.sessionsByDifficulty['hard'].total}`}
                color="#ef4444"
                gradient={false}
              />
            </div>
          </div>

          {/* Recent Sessions */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '24px'
          }}>
            <h4 style={{ 
              margin: '0 0 16px 0', 
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Recent Exercises
            </h4>
            {earTrainingStats.recentSessions.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '20px',
                color: '#6c757d'
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎵</div>
                <div>No ear training exercises yet</div>
              </div>
            ) : (
              <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                {earTrainingStats.recentSessions.map(session => (
                  <div key={session.id} style={{
                    padding: '12px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    marginBottom: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: '500', color: '#ffffff' }}>
                        {session.exerciseType.replace('-', ' ').toUpperCase()} - {session.difficulty.toUpperCase()}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6c757d' }}>
                        {EarTrainingStatsManager.formatDate(session.date)}
                      </div>
                    </div>
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: session.correct ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: session.correct ? '#22c55e' : '#ef4444'
                    }}>
                      {session.correct ? '✅ Correct' : '❌ Incorrect'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clear Ear Training Data Button */}
          <div style={{
            textAlign: 'center',
            marginBottom: '24px'
          }}>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear all ear training data? This cannot be undone.')) {
                  EarTrainingStatsManager.resetStats();
                  setEarTrainingStats(EarTrainingStatsManager.getStats());
                }
              }}
              style={{
                padding: '8px 16px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#fca5a5',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Clear Ear Training Data
            </button>
          </div>
        </div>
      )}

      {/* Lessons Tab */}
      {activeTab === 'lessons' && lessonStats && (
        <div>
          {/* Lesson Overview Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <StatCard
              title="Total Lessons"
              value={lessonStats.totalLessons}
              color="#3b82f6"
            />
            <StatCard
              title="Completed Lessons"
              value={lessonStats.completedLessons}
              subtitle={`${((lessonStats.completedLessons / Math.max(lessonStats.totalLessons, 1)) * 100).toFixed(1)}% completion rate`}
              color="#22c55e"
            />
            <StatCard
              title="Total Practice Time"
              value={formatDuration(lessonStats.totalLessonTime)}
              color="#f59e0b"
            />
            <StatCard
              title="Average Rating"
              value={lessonStats.averageRating > 0 ? `${lessonStats.averageRating.toFixed(1)}/5 ⭐` : 'No ratings yet'}
              color="#8b5cf6"
            />
          </div>

          {/* Lesson Streaks and Activity */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <StatCard
              title="Current Streak"
              value={`${lessonStats.currentStreak} days`}
              color="#10b981"
            />
            <StatCard
              title="Longest Streak"
              value={`${lessonStats.longestStreak} days`}
              color="#059669"
            />
            <StatCard
              title="This Week"
              value={`${lessonStats.lessonsThisWeek} lessons`}
              color="#6366f1"
            />
            <StatCard
              title="This Month"
              value={`${lessonStats.lessonsThisMonth} lessons`}
              color="#8b5cf6"
            />
          </div>

          {/* Favorite Activity Type */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '24px'
          }}>
            <h4 style={{ 
              margin: '0 0 16px 0', 
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Practice Insights
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px'
            }}>
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <h5 style={{ 
                  margin: '0 0 8px 0', 
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  Favorite Activity Type
                </h5>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#e4e4f4',
                  fontSize: '16px'
                }}>
                  <span>
                    {lessonStats.favoriteActivityType === 'scale' && '🎹'}
                    {lessonStats.favoriteActivityType === 'piece' && '🎼'}
                    {lessonStats.favoriteActivityType === 'ear-training' && '👂'}
                    {lessonStats.favoriteActivityType === 'custom' && '📝'}
                  </span>
                  <span style={{ textTransform: 'capitalize' }}>
                    {lessonStats.favoriteActivityType.replace('-', ' ')}
                  </span>
                </div>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <h5 style={{ 
                  margin: '0 0 8px 0', 
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  Average Lesson Duration
                </h5>
                <div style={{
                  color: '#e4e4f4',
                  fontSize: '16px'
                }}>
                  {formatDuration(lessonStats.averageLessonDuration)}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Lesson History */}
          {lessonPlannerTracker && (
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid rgba(255,255,255,0.1)',
              marginBottom: '24px'
            }}>
              <h4 style={{ 
                margin: '0 0 16px 0', 
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: '600'
              }}>
                Recent Lessons
              </h4>
              {lessonPlannerTracker.getLessonHistory(5).length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: '#6c757d'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📚</div>
                  <div>No lessons completed yet</div>
                  <div style={{ fontSize: '12px', marginTop: '8px' }}>
                    Start a lesson to see your progress here
                  </div>
                </div>
              ) : (
                <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                  {lessonPlannerTracker.getLessonHistory(5).map(session => (
                    <div key={session.id} style={{
                      padding: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: '500', color: '#ffffff' }}>
                          {session.lessonTitle}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6c757d' }}>
                          {new Date(session.startTime).toLocaleDateString()} • {formatDuration(session.duration)}
                        </div>
                        {session.notes && (
                          <div style={{ fontSize: '12px', color: '#a0a0b0', fontStyle: 'italic', marginTop: '4px' }}>
                            "{session.notes}"
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: session.completed ? 'rgba(34, 197, 94, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                          color: session.completed ? '#22c55e' : '#f97316',
                          marginBottom: '4px'
                        }}>
                          {session.completed ? '✅ Completed' : '⏸️ Partial'}
                        </div>
                        {session.overallRating && (
                          <div style={{ fontSize: '12px', color: '#fbbf24' }}>
                            {'⭐'.repeat(session.overallRating)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Clear Lesson Data Button */}
          <div style={{
            textAlign: 'center',
            marginBottom: '24px'
          }}>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear all lesson data? This cannot be undone.')) {
                  lessonPlannerTracker?.clearAllData();
                  setLessonStats(lessonPlannerTracker?.getStatistics() || null);
                }
              }}
              style={{
                padding: '8px 16px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#fca5a5',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Clear Lesson Data
            </button>
          </div>
        </div>
      )}

      {/* Clear Data Button */}
      <div style={{
        marginTop: '24px',
        paddingTop: '16px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        textAlign: 'center'
      }}>
        <button
          onClick={() => {
            if (confirm('Are you sure you want to clear all performance data? This cannot be undone.')) {
              performanceTracker.clearAllData();
              setProfile(performanceTracker.getProfile());
            }
          }}
          style={{
            padding: '8px 16px',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#fca5a5',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Clear All Data
        </button>
      </div>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'rgba(42, 42, 62, 0.95)',
            border: '1px solid #3a3a4a',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            backdropFilter: 'blur(10px)'
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              color: '#ffffff',
              fontSize: '18px',
              fontWeight: '600'
            }}>
              🔑 OpenAI API Key
            </h3>
            <p style={{
              color: '#6c757d',
              fontSize: '14px',
              marginBottom: '16px',
              lineHeight: '1.5'
            }}>
              Enter your OpenAI API key to generate personalized lesson plans. 
              Your API key is stored locally and only used for generating lessons.
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '14px',
                marginBottom: '16px'
              }}
            />
            <div style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowApiKeyModal(false)}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: '#e4e4f4',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (apiKey.trim()) {
                    setShowApiKeyModal(false);
                    // Optionally save API key to localStorage
                    localStorage.setItem('openai_api_key', apiKey);
                  }
                }}
                disabled={!apiKey.trim()}
                style={{
                  padding: '8px 16px',
                  background: apiKey.trim() ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  cursor: apiKey.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  opacity: apiKey.trim() ? 1 : 0.5
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 