import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Zap, ShieldCheck, ArrowUpRight } from 'lucide-react';

/**
 * StatusBadge - Standardized APMC status pill component with government-grade semantic styling.
 */
export const StatusBadge = ({
  status = 'DEFAULT',
  label,
  size = 'md',
  dot = true,
  icon: CustomIcon = null,
  pulse = false,
  className = '',
  children,
}) => {
  const normalized = (status || children || '').toString().trim().toUpperCase();

  let styles = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';
  let IconComponent = CustomIcon;
  let displayText = label || children || status;

  switch (normalized) {
    // Green / Success states
    case 'COMPLETED':
    case 'CONFIRMED':
    case 'APPROVED':
    case 'DISBURSED':
    case 'PAID':
    case 'RELEASED':
    case 'SUCCESS':
    case 'ONLINE':
      styles = 'bg-emerald-50 text-emerald-800 border-emerald-300/80 ring-1 ring-emerald-500/20';
      dotColor = 'bg-emerald-500';
      if (!IconComponent) IconComponent = CheckCircle2;
      break;

    // Amber / Pending / In-progress states
    case 'CHECKED_IN':
    case 'AT_GATE':
    case 'INSPECTED':
    case 'IN_PROGRESS':
    case 'PROCESSING':
    case 'PENDING':
    case 'MODERATE':
    case 'AMBER':
      styles = 'bg-amber-50 text-amber-900 border-amber-300/80 ring-1 ring-amber-500/20';
      dotColor = 'bg-amber-500';
      if (!IconComponent) IconComponent = Clock;
      break;

    // Cyan / Weighed / Ready states
    case 'WEIGHED':
    case 'WEIGHED_READY_FOR_AUCTION':
    case 'SCALED':
      styles = 'bg-cyan-50 text-cyan-900 border-cyan-300/80 ring-1 ring-cyan-500/20';
      dotColor = 'bg-cyan-500';
      if (!IconComponent) IconComponent = ShieldCheck;
      if (!label && !children) displayText = 'Weighed (Ready)';
      break;

    // Blue / Booked states
    case 'BOOKED':
    case 'SLOT_RESERVED':
      styles = 'bg-blue-50 text-blue-800 border-blue-300/80 ring-1 ring-blue-500/20';
      dotColor = 'bg-blue-500';
      if (!label && !children) displayText = 'Slot Reserved';
      break;

    // Purple / Fast Track / Priority
    case 'FAST_TRACK':
    case 'PRIORITY':
    case 'EMERGENCY':
      styles = 'bg-purple-50 text-purple-900 border-purple-300/80 ring-1 ring-purple-500/20';
      dotColor = 'bg-purple-500';
      if (!IconComponent) IconComponent = Zap;
      if (!label && !children) displayText = 'Fast Track Priority';
      break;

    // Orange / Gate Exit Requested
    case 'GATE_EXIT_REQUESTED':
    case 'EXIT_REQUESTED':
    case 'EXIT_REQ':
      styles = 'bg-orange-50 text-orange-900 border-orange-300/80 ring-1 ring-orange-500/20';
      dotColor = 'bg-orange-500 animate-pulse';
      if (!IconComponent) IconComponent = ArrowUpRight;
      if (!label && !children) displayText = 'Exit Authorization Required';
      break;

    // Red / Destructive / Overdue / Disputed
    case 'CANCELLED':
    case 'REJECTED':
    case 'DISPUTED':
    case 'CRITICAL':
    case 'HIGH':
    case 'OVERDUE':
    case 'RED':
      styles = 'bg-rose-50 text-rose-900 border-rose-300/80 ring-1 ring-rose-500/20';
      dotColor = 'bg-rose-500';
      if (!IconComponent) IconComponent = (normalized === 'OVERDUE' ? AlertTriangle : XCircle);
      break;

    // Inactive / Offline
    case 'OFFLINE':
    case 'INACTIVE':
      styles = 'bg-slate-100 text-slate-500 border-slate-200';
      dotColor = 'bg-slate-400';
      break;

    default:
      styles = 'bg-slate-100 text-slate-700 border-slate-200';
      dotColor = 'bg-slate-400';
      break;
  }

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-1 font-semibold',
    sm: 'text-xs px-2.5 py-0.5 gap-1.5 font-medium',
    md: 'text-xs px-3 py-1 gap-1.5 font-semibold',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-semibold',
  };

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border shadow-sm transition-colors ${sizeClasses[size] || sizeClasses.md} ${styles} ${className}`}
    >
      {IconComponent ? (
        <IconComponent className={`${iconSizes[size] || iconSizes.md} shrink-0 ${pulse ? 'animate-bounce' : ''}`} />
      ) : dot ? (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor} ${pulse ? 'animate-ping' : ''}`}
        />
      ) : null}
      <span className="truncate tracking-tight">{displayText}</span>
    </span>
  );
};

export default StatusBadge;
