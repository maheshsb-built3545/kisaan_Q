import React from 'react';

export const Badge = ({
  status,
  variant = 'default',
  size = 'md',
  dot = true,
  children,
  className = '',
}) => {
  const normalized = (status || children || '').toString().trim().toUpperCase();

  let styles = 'bg-slate-800/80 text-slate-300 border-slate-700/80';
  let dotColor = 'bg-slate-400';
  let label = children || status;

  if (normalized === 'GREEN' || normalized === 'LOW' || normalized === 'OPTIMAL' || normalized === 'CONFIRMED' || normalized === 'COMPLETED') {
    styles = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
    dotColor = 'bg-emerald-400 animate-pulse';
    if (!children && normalized === 'GREEN') label = 'Normal Traffic';
  } else if (normalized === 'AMBER' || normalized === 'MODERATE' || normalized === 'CHECKED_IN' || normalized === 'INSPECTED' || normalized === 'PENDING') {
    styles = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
    dotColor = 'bg-amber-400';
    if (!children && normalized === 'AMBER') label = 'Moderate Rush';
  } else if (normalized === 'RED' || normalized === 'HIGH' || normalized === 'CRITICAL' || normalized === 'CANCELLED' || normalized === 'REJECTED') {
    styles = 'bg-rose-500/10 text-rose-300 border-rose-500/30';
    dotColor = 'bg-rose-400 animate-ping';
    if (!children && normalized === 'RED') label = 'Heavy Congestion';
  } else if (normalized === 'WEIGHED_READY_FOR_AUCTION' || normalized === 'WEIGHED') {
    styles = 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
    dotColor = 'bg-cyan-400';
    label = children || 'Weighed (Ready)';
  } else if (normalized === 'ELIGIBLE_FOR_RELEASE' || normalized === 'RELEASED') {
    styles = 'bg-purple-500/10 text-purple-300 border-purple-500/30';
    dotColor = 'bg-purple-400';
    label = children || (normalized === 'RELEASED' ? 'Slot Released' : 'Eligible for Release');
  } else if (normalized === 'BOOKED') {
    styles = 'bg-blue-500/10 text-blue-300 border-blue-500/30';
    dotColor = 'bg-blue-400';
    label = children || 'Slot Reserved';
  }

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-medium',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-sm ${sizeClasses[size] || sizeClasses.md} ${styles} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />}
      <span className="truncate">{label}</span>
    </span>
  );
};

export default Badge;
