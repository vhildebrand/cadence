import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import './Button.css';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'gradient';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  onClick?: () => void | Promise<void>;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  animated?: boolean;
  ripple?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  loadingText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  onClick,
  type = 'button',
  className = '',
  animated = true,
  ripple = true,
}) => {
  const [isClicked, setIsClicked] = useState(false);
  const [rippleEffect, setRippleEffect] = useState<{ x: number; y: number; id: number } | null>(null);

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;

    // Ripple effect
    if (ripple) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setRippleEffect({ x, y, id: Date.now() });
      setTimeout(() => setRippleEffect(null), 600);
    }

    // Click animation
    if (animated) {
      setIsClicked(true);
      setTimeout(() => setIsClicked(false), 150);
    }

    // Handle click
    if (onClick) {
      try {
        await onClick();
      } catch (error) {
        console.error('Button click error:', error);
      }
    }
  };

  const baseClasses = [
    'modern-button',
    `modern-button--${variant}`,
    `modern-button--${size}`,
    fullWidth ? 'modern-button--full-width' : '',
    disabled ? 'modern-button--disabled' : '',
    loading ? 'modern-button--loading' : '',
    isClicked ? 'modern-button--clicked' : '',
    animated ? 'modern-button--animated' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={baseClasses}
      onClick={handleClick}
      disabled={disabled || loading}
    >
      {/* Ripple effect */}
      {rippleEffect && (
        <span
          className="modern-button__ripple"
          style={{
            left: rippleEffect.x,
            top: rippleEffect.y,
          }}
        />
      )}

      {/* Button content */}
      <span className="modern-button__content">
        {/* Left icon or loading spinner */}
        {loading ? (
          <LoadingSpinner size="small" variant="pulse" />
        ) : leftIcon ? (
          <span className="modern-button__icon modern-button__icon--left">
            {leftIcon}
          </span>
        ) : null}

        {/* Button text */}
        <span className="modern-button__text">
          {loading && loadingText ? loadingText : children}
        </span>

        {/* Right icon */}
        {rightIcon && !loading && (
          <span className="modern-button__icon modern-button__icon--right">
            {rightIcon}
          </span>
        )}
      </span>

      {/* Shine effect */}
      <span className="modern-button__shine"></span>
    </button>
  );
};

export default Button; 