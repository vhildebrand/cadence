import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'music' | 'pulse' | 'bars';
  text?: string;
  fullscreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  variant = 'default',
  text,
  fullscreen = false
}) => {
  const renderSpinner = () => {
    switch (variant) {
      case 'music':
        return (
          <div className={`music-spinner ${size}`}>
            <div className="music-note">♪</div>
            <div className="music-note">♫</div>
            <div className="music-note">♪</div>
            <div className="music-note">♬</div>
          </div>
        );
      
      case 'pulse':
        return (
          <div className={`pulse-spinner ${size}`}>
            <div className="pulse-dot"></div>
            <div className="pulse-dot"></div>
            <div className="pulse-dot"></div>
          </div>
        );
      
      case 'bars':
        return (
          <div className={`bars-spinner ${size}`}>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
          </div>
        );
      
      default:
        return (
          <div className={`default-spinner ${size}`}>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
        );
    }
  };

  const content = (
    <div className={`loading-container ${fullscreen ? 'fullscreen' : ''}`}>
      {renderSpinner()}
      {text && <p className="loading-text">{text}</p>}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="loading-overlay">
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingSpinner; 