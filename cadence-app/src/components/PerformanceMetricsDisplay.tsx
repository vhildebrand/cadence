import { useState, useEffect } from 'react';

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

interface NoteEvaluation {
  expectedNote: any;
  playedNote?: any;
  evaluation: 'perfect' | 'good' | 'early' | 'late' | 'wrong' | 'missed';
  timingError: number;
  accuracyScore: number;
  feedback: string;
}

interface PerformanceMetricsDisplayProps {
  metrics: PerformanceMetrics | null;
  recentEvaluations: NoteEvaluation[];
  isActive: boolean;
  expectedTempo: number;
}

export default function PerformanceMetricsDisplay({ 
  metrics, 
  recentEvaluations, 
  isActive,
  expectedTempo 
}: PerformanceMetricsDisplayProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  
  // Animate score changes
  useEffect(() => {
    if (metrics) {
      const targetScore = metrics.overallScore;
      const duration = 500; // ms
      const steps = 20;
      const stepSize = (targetScore - animatedScore) / steps;
      const stepDuration = duration / steps;
      
      let currentStep = 0;
      const timer = setInterval(() => {
        currentStep++;
        setAnimatedScore(prev => prev + stepSize);
        
        if (currentStep >= steps) {
          clearInterval(timer);
          setAnimatedScore(targetScore);
        }
      }, stepDuration);
      
      return () => clearInterval(timer);
    }
  }, [metrics?.overallScore]);
  
  const getScoreColor = (score: number): string => {
    if (score >= 90) return '#28a745'; // Green
    if (score >= 75) return '#17a2b8'; // Blue
    if (score >= 60) return '#ffc107'; // Yellow
    if (score >= 40) return '#fd7e14'; // Orange
    return '#dc3545'; // Red
  };
  
  const getEvaluationColor = (evaluation: string): string => {
    switch (evaluation) {
      case 'perfect': return '#28a745';
      case 'good': return '#17a2b8';
      case 'early': return '#ffc107';
      case 'late': return '#fd7e14';
      case 'wrong': return '#dc3545';
      case 'missed': return '#6c757d';
      default: return '#6c757d';
    }
  };
  
  const getEvaluationIcon = (evaluation: string): string => {
    switch (evaluation) {
      case 'perfect': return '🎯';
      case 'good': return '✅';
      case 'early': return '⏰';
      case 'late': return '⏱️';
      case 'wrong': return '❌';
      case 'missed': return '⭕';
      default: return '❓';
    }
  };
  
  if (!isActive) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        color: '#6c757d'
      }}>
        <h3>🎵 Performance Evaluation</h3>
        <p>Start playing to see your performance metrics!</p>
      </div>
    );
  }
  
  if (!metrics) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '8px',
        color: '#856404'
      }}>
        <h3>⏳ Warming Up...</h3>
        <p>Play a few notes to start seeing your performance analysis!</p>
      </div>
    );
  }
  
  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'white',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header with Overall Score */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '2px solid #e9ecef'
      }}>
        <h3 style={{ margin: 0, color: '#495057' }}>🎵 Performance Analysis</h3>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            border: `6px solid ${getScoreColor(animatedScore)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8f9fa',
            position: 'relative'
          }}>
            <span style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: getScoreColor(animatedScore)
            }}>
              {Math.round(animatedScore)}
            </span>
            <div style={{
              position: 'absolute',
              bottom: '-25px',
              fontSize: '12px',
              color: '#6c757d',
              whiteSpace: 'nowrap'
            }}>
              Overall Score
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '20px'
      }}>
        <MetricCard
          title="Note Accuracy"
          value={metrics.noteAccuracy}
          unit="%"
          icon="🎯"
          color={getScoreColor(metrics.noteAccuracy)}
        />
        <MetricCard
          title="Rhythm Accuracy"
          value={metrics.rhythmAccuracy}
          unit="%"
          icon="⏱️"
          color={getScoreColor(metrics.rhythmAccuracy)}
        />
        <MetricCard
          title="Tempo Consistency"
          value={metrics.tempoConsistency}
          unit="%"
          icon="🥁"
          color={getScoreColor(metrics.tempoConsistency)}
        />
        <MetricCard
          title="Current Tempo"
          value={metrics.currentTempo}
          unit="BPM"
          icon="🎼"
          color={Math.abs(metrics.currentTempo - expectedTempo) <= 10 ? '#28a745' : '#ffc107'}
          subtitle={`Target: ${expectedTempo} BPM`}
        />
      </div>
      
      {/* Note Statistics */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '15px',
        borderRadius: '6px',
        marginBottom: '20px'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>📊 Note Statistics</h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '10px',
          fontSize: '14px'
        }}>
          <StatItem label="Perfect" value={metrics.perfectTiming} color="#28a745" />
          <StatItem label="Good" value={metrics.goodTiming} color="#17a2b8" />
          <StatItem label="Early" value={metrics.earlyNotes} color="#ffc107" />
          <StatItem label="Late" value={metrics.lateNotes} color="#fd7e14" />
          <StatItem label="Wrong" value={metrics.wrongNotes} color="#dc3545" />
          <StatItem label="Missed" value={metrics.missedNotes} color="#6c757d" />
        </div>
      </div>
      
      {/* Recent Note Feedback */}
      <div>
        <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>🎹 Recent Notes</h4>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          minHeight: '40px',
          padding: '10px',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px'
        }}>
          {recentEvaluations.length > 0 ? (
            recentEvaluations.slice(-8).map((evaluation, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '15px',
                  backgroundColor: 'white',
                  border: `2px solid ${getEvaluationColor(evaluation.evaluation)}`,
                  fontSize: '12px',
                  color: getEvaluationColor(evaluation.evaluation),
                  fontWeight: 'bold'
                }}
                title={evaluation.feedback}
              >
                <span>{getEvaluationIcon(evaluation.evaluation)}</span>
                <span>{evaluation.evaluation.toUpperCase()}</span>
                {evaluation.timingError !== 0 && (
                  <span style={{ fontSize: '10px', opacity: 0.8 }}>
                    {evaluation.timingError > 0 ? '+' : ''}{Math.round(evaluation.timingError)}ms
                  </span>
                )}
              </div>
            ))
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              color: '#6c757d',
              fontStyle: 'italic'
            }}>
              Play some notes to see feedback...
            </div>
          )}
        </div>
      </div>
      
      {/* Timing Analysis */}
      {metrics.avgTimingError !== 0 && (
        <div style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#e3f2fd',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#1565c0'
        }}>
          <strong>⏰ Timing Analysis:</strong> {' '}
          Average {metrics.avgTimingError > 0 ? 'late' : 'early'} by {' '}
          {Math.abs(metrics.avgTimingError).toFixed(0)}ms
          {metrics.timingStdDev > 50 && (
            <span> • Consistency needs improvement (±{metrics.timingStdDev.toFixed(0)}ms variation)</span>
          )}
        </div>
      )}
    </div>
  );
}

// Helper component for metric cards
function MetricCard({ 
  title, 
  value, 
  unit, 
  icon, 
  color, 
  subtitle 
}: {
  title: string;
  value: number;
  unit: string;
  icon: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <div style={{
      padding: '15px',
      border: `2px solid ${color}`,
      borderRadius: '8px',
      textAlign: 'center',
      backgroundColor: 'white'
    }}>
      <div style={{ fontSize: '24px', marginBottom: '5px' }}>{icon}</div>
      <div style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: color,
        marginBottom: '2px'
      }}>
        {Math.round(value)}<span style={{ fontSize: '16px' }}>{unit}</span>
      </div>
      <div style={{
        fontSize: '12px',
        color: '#495057',
        fontWeight: '500'
      }}>
        {title}
      </div>
      {subtitle && (
        <div style={{
          fontSize: '10px',
          color: '#6c757d',
          marginTop: '2px'
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

// Helper component for statistics
function StatItem({ 
  label, 
  value, 
  color 
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <span style={{ color: '#495057' }}>{label}:</span>
      <span style={{ 
        fontWeight: 'bold', 
        color: color,
        backgroundColor: 'white',
        padding: '2px 6px',
        borderRadius: '3px'
      }}>
        {value}
      </span>
    </div>
  );
} 