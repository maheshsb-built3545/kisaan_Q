import React from 'react';
import Spinner from './Spinner';

export const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon: Icon = null,
  rightIcon: RightIcon = null,
  onClick,
  className = '',
  ...props
}) => {
  const baseStyles = 'relative inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-6 py-3.5 gap-2.5 font-semibold',
  };

  const variantStyles = {
    primary: 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-950/50 hover:from-emerald-500 hover:to-emerald-400 focus:ring-emerald-500 border border-emerald-400/20',
    secondary: 'bg-slate-800/90 border border-slate-700/80 text-slate-200 hover:bg-slate-700/90 hover:text-white focus:ring-slate-500 shadow-sm',
    outline: 'bg-transparent border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500 focus:ring-emerald-500',
    danger: 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-lg shadow-rose-950/50 hover:from-rose-500 hover:to-rose-400 focus:ring-rose-500 border border-rose-400/20',
    ghost: 'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 focus:ring-slate-600',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size] || sizeStyles.md} ${variantStyles[variant] || variantStyles.primary} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Spinner size="sm" color={variant === 'primary' || variant === 'danger' ? 'white' : 'emerald'} />
          <span>Processing...</span>
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

export default Button;
