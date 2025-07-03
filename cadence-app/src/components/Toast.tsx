import React, { useState, useEffect } from 'react';
import './Toast.css';

interface ToastProps {
  id?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  onClose?: (id?: string) => void;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
}

const Toast: React.FC<ToastProps> = ({
  id,
  type = 'info',
  title,
  message,
  duration = 5000,
  persistent = false,
  onClose,
  actions
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto-dismiss unless persistent
    if (!persistent && duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, persistent]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose?.(id);
    }, 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const toastClasses = [
    'toast',
    `toast--${type}`,
    isVisible ? 'toast--visible' : '',
    isExiting ? 'toast--exiting' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={toastClasses}>
      {/* Progress bar for duration */}
      {!persistent && duration > 0 && (
        <div className="toast__progress">
          <div 
            className="toast__progress-bar"
            style={{
              animationDuration: `${duration}ms`
            }}
          />
        </div>
      )}

      {/* Close button */}
      <button
        className="toast__close"
        onClick={handleClose}
        aria-label="Close notification"
      >
        ✕
      </button>

      {/* Content */}
      <div className="toast__content">
        {/* Icon */}
        <div className="toast__icon">
          {getIcon()}
        </div>

        {/* Text content */}
        <div className="toast__text">
          {title && <div className="toast__title">{title}</div>}
          <div className="toast__message">{message}</div>
        </div>
      </div>

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="toast__actions">
          {actions.map((action, index) => (
            <button
              key={index}
              className={`toast__action toast__action--${action.variant || 'secondary'}`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Toast Container Component
interface ToastContainerProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  maxToasts?: number;
}

interface ToastData extends ToastProps {
  id: string;
  timestamp: number;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  position = 'top-right',
  maxToasts = 3
}) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = (toast: Omit<ToastData, 'id' | 'timestamp'>) => {
    const newToast: ToastData = {
      ...toast,
      id: Date.now().toString(),
      timestamp: Date.now()
    };

    setToasts(prev => {
      const updated = [newToast, ...prev];
      return updated.slice(0, maxToasts);
    });
  };

  const removeToast = (id?: string) => {
    if (!id) return;
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Expose addToast globally for easy access
  useEffect(() => {
    (window as any).showToast = addToast;
    return () => {
      delete (window as any).showToast;
    };
  }, []);

  const containerClasses = [
    'toast-container',
    `toast-container--${position}`
  ].join(' ');

  return (
    <div className={containerClasses}>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={removeToast}
        />
      ))}
    </div>
  );
};

export default Toast; 