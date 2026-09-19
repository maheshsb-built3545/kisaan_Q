import React from 'react';
import DeskPrerequisiteBanner from './DeskPrerequisiteBanner';

/**
 * DeskCard - Standardized card container used across all 5 procurement desks.
 * Enforces unified visual hierarchy, header layout, prerequisite gating, and footer alignment.
 */
export const DeskCard = ({
  title,
  stationCode,
  subtitle,
  icon: Icon = null,
  badge = null,
  actions = null,
  isLocked = false,
  lockedMessage = '',
  requiredStage = '',
  children,
  footer = null,
  className = '',
  bodyClassName = 'p-5 sm:p-6',
  variant = 'default',
}) => {
  const variantStyles = {
    default: 'bg-white border border-slate-200/90 shadow-sm rounded-2xl',
    elevated: 'bg-white border border-slate-200 shadow-md rounded-2xl',
    glass: 'glass-card rounded-2xl',
    subtle: 'bg-slate-50/70 border border-slate-200/80 rounded-2xl',
  };

  return (
    <section
      className={`relative overflow-hidden transition-all duration-200 ${variantStyles[variant] || variantStyles.default} ${className}`}
    >
      {/* Top Header */}
      {(title || subtitle || Icon || badge || actions) && (
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3.5 min-w-0">
            {Icon && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20 shadow-sm">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {title && (
                  <h3 className="text-base font-bold text-slate-900 tracking-tight truncate">
                    {title}
                  </h3>
                )}
                {stationCode && (
                  <span className="inline-flex items-center rounded-md bg-slate-200/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    {stationCode}
                  </span>
                )}
                {badge}
              </div>
              {subtitle && (
                <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {actions && (
            <div className="flex items-center gap-2 shrink-0 sm:self-center">
              {actions}
            </div>
          )}
        </header>
      )}

      {/* Main Content or Prerequisite Locked State */}
      <div className={bodyClassName}>
        {isLocked ? (
          <DeskPrerequisiteBanner
            title="Station Prerequisite Incomplete"
            message={lockedMessage || 'Complete the previous workflow stage before taking action here.'}
            requiredStage={requiredStage}
          />
        ) : (
          children
        )}
      </div>

      {/* Optional Card Footer */}
      {footer && (
        <footer className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-600">
          {footer}
        </footer>
      )}
    </section>
  );
};

export default DeskCard;
