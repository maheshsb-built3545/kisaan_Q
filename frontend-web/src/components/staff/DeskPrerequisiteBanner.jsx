import React from 'react';
import { Lock, ShieldAlert } from 'lucide-react';

/**
 * DeskPrerequisiteBanner - Consistent banner shown when a desk is locked due to an unmet workflow prerequisite.
 */
export const DeskPrerequisiteBanner = ({
  title = 'Prerequisite Stage Incomplete',
  message = 'This stage is locked until the previous station certifies the transaction.',
  requiredStage = '',
  className = '',
}) => {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 text-slate-800 ${className}`}
    >
      <div className="flex items-start gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 ring-1 ring-amber-500/30">
          <Lock className="h-5 w-5 animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold tracking-tight text-amber-950">
              {title}
            </h4>
            {requiredStage && (
              <span className="inline-flex items-center rounded-md bg-amber-200/60 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-500/20">
                Required: {requiredStage}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-amber-900/80 leading-relaxed">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeskPrerequisiteBanner;
