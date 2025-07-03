import { useState, useEffect, useMemo } from 'react';
import { PerformanceTracker } from '../utils/PerformanceTracker';
import type { UserProfile, PiecePerformance, PerformanceSession } from '../utils/PerformanceTracker';

interface ProfileProps {
  performanceTracker: PerformanceTracker;
}

// Simple chart component for trends
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
        height: height - 30,
        display: 'flex',
        alignItems: 'end',
        gap: '2px',
        padding: '8px 0'
      }}>
        {data.map((point, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              backgroundColor: color,
              height: `${((point.y - minValue) / (maxValue - minValue)) * 100}%`,
              minHeight: '4px',
              borderRadius: '2px',
              opacity: 0.8,
              transition: 'opacity 0.2s ease'
            }}
            title={`${point.x}: ${point.y.toFixed(1)}`}
          />
        ))}
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

export default function Profile({ performanceTracker }: ProfileProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'pieces' | 'recent'>('overview');

  // Load profile data and subscribe to changes
  useEffect(() => {
    setProfile(performanceTracker.getProfile());
    
    // Subscribe to profile changes
    const unsubscribe = performanceTracker.subscribe(() => {
      setProfile(performanceTracker.getProfile());
    });

    return unsubscribe;
  }, [performanceTracker]);

  // Get selected piece performance
  const selectedPiecePerformance = useMemo(() => {
    if (!selectedPiece) return null;
    return performanceTracker.getPiecePerformance(selectedPiece);
  }, [selectedPiece, performanceTracker]);

  // Get overall trends
  const overallTrends = useMemo(() => {
    const trends = performanceTracker.getOverallTrends(30);
    return {
      dates: trends.dates.map(date => ({ x: date, y: trends.averageAccuracies[trends.dates.indexOf(date)] || 0 })),
      sessions: trends.dates.map(date => ({ x: date, y: trends.totalSessions[trends.dates.indexOf(date)] || 0 }))
    };
  }, [performanceTracker]);

  // Get piece trends
  const pieceTrends = useMemo(() => {
    if (!selectedPiece) return { accuracies: [], streaks: [] };
    const trends = performanceTracker.getPieceTrends(selectedPiece, 30);
    return {
      accuracies: trends.dates.map(date => ({ x: date, y: trends.accuracies[trends.dates.indexOf(date)] || 0 })),
      streaks: trends.dates.map(date => ({ x: date, y: trends.streaks[trends.dates.indexOf(date)] || 0 }))
    };
  }, [selectedPiece, performanceTracker]);

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
              📈 30-Day Trends
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px'
            }}>
              <TrendChart
                data={overallTrends.dates}
                title="Average Accuracy"
                color="#22c55e"
              />
              <TrendChart
                data={overallTrends.sessions}
                title="Sessions per Day"
                color="#3b82f6"
              />
            </div>
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
                        Performance Trends (30 days)
                      </h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px'
                      }}>
                        <TrendChart
                          data={pieceTrends.accuracies}
                          title="Accuracy"
                          color="#22c55e"
                          height={100}
                        />
                        <TrendChart
                          data={pieceTrends.streaks}
                          title="Best Streak"
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
    </div>
  );
} 