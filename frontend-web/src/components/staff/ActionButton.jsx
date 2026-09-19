import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * ActionButton - Standardized action button for APMC staff terminal actions.
 * Provides explicit loading, disabled, icon, and semantic color variant styling.
 */
export const ActionButton = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText = 'Processing...',
  disabled = false,
  icon: Icon = null,
  rightIcon: RightIcon = null,
  onClick,
  className = '',
  fullWidth = false,
  ...props
}) => {
  const baseStyles =
    'relative inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 select-none active:scale-[0.99] disabled:opacity-55 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 shadow-sm';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-6 py-3.5 gap-2.5',
  };

  const variantStyles = {
    // Standard APMC Emerald Action
    primary:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-emerald-500 shadow-emerald-700/20 border border-emerald-500/30',
    // Secondary / Muted Action
    secondary:
      'bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 focus-visible:ring-slate-400 border border-slate-200',
    // Destructive / Dispute / Rejection
    destructive:
      'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 focus-visible:ring-rose-500 shadow-rose-700/20 border border-rose-500/30',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 focus-visible:ring-rose-500 shadow-rose-700/20 border border-rose-500/30',
    // Warning / Exception Action
    warning:
      'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 focus-visible:ring-amber-500 shadow-amber-700/20 border border-amber-500/30',
    // Outlined
    outline:
      'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 active:bg-slate-100 focus-visible:ring-slate-400',
    // Ghost / Header buttons
    ghost:
      'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-transparent shadow-none active:bg-slate-200',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`
        ${baseStyles}
        ${sizeStyles[size] || sizeStyles.md}
        ${variantStyles[variant] || variantStyles.primary}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {Icon && <Icon className="w-4 h-4 shrink-0" />}
          <span>{children}</span>
          {RightIcon && <RightIcon className="w-4 h-4 shrink-0" />}
        </>
      )}
    </button>
  );
};

export default ActionButton;
