import React from 'react';

export const Spinner = ({ size = 'md', color = 'emerald', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-3',
    xl: 'w-14 h-14 border-4',
  };

  const colorClasses = {
    emerald: 'border-emerald-500/20 border-t-emerald-500',
    white: 'border-white/20 border-t-white',
    slate: 'border-slate-700 border-t-slate-300',
    amber: 'border-amber-500/20 border-t-amber-500',
  };

  return (
    <div
      className={`inline-block rounded-full animate-spin ${sizeClasses[size] || sizeClasses.md} ${colorClasses[color] || colorClasses.emerald} ${className}`}
      role="status"
      aria-label="loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default Spinner;
