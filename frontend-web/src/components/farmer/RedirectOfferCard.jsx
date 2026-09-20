import React, { useState } from 'react';
import { ArrowRight, MapPin, CheckCircle, XCircle, Clock, Zap, AlertCircle } from 'lucide-react';
import { redirectApi } from '../../api/redirect.api';

export default function RedirectOfferCard({ offer, onActionComplete }) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (!offer) return null;

  const { _id, fromCentre, toCentre, date, timeWindow, distanceKm = 14, status = 'pending', expiresAt } = offer;

  const isPending = status === 'pending';
  const isAccepted = status === 'accepted';
  const isDeclined = status === 'declined';
  const isExpired = status === 'expired';

  const handleAccept = async () => {
    try {
      setIsAccepting(true);
      setActionError(null);
      await redirectApi.acceptOffer(_id);
      if (onActionComplete) onActionComplete(_id, 'accepted');
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to accept redirect offer');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    try {
      setIsDeclining(true);
      setActionError(null);
      await redirectApi.declineOffer(_id);
      if (onActionComplete) onActionComplete(_id, 'declined');
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to decline redirect offer');
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <div className={`p-5 rounded-2xl border transition-all ${
      isAccepted
        ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-100'
        : isDeclined
        ? 'bg-slate-900/40 border-slate-800 text-slate-400 opacity-60'
        : isExpired
        ? 'bg-rose-950/20 border-rose-500/30 text-slate-400'
        : 'bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 border-amber-500/40 shadow-lg shadow-amber-950/20'
    }`}>
      {/* Header Badge */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Recommended Mandi Redirect
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
          Status: {status.toUpperCase()}
        </span>
      </div>

      {/* Origin -> Destination flow */}
      <div className="mt-4 flex items-center justify-between gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold text-slate-500">Current Mandi</span>
          <span className="text-sm font-bold text-slate-200">{fromCentre || 'Kopargaon'}</span>
        </div>
        <div className="flex flex-col items-center">
          <ArrowRight className="w-5 h-5 text-amber-400" />
          <span className="text-[10px] font-mono text-amber-400/80 font-bold">{distanceKm} km away</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-[10px] uppercase font-bold text-emerald-400">Fast-Track Destination</span>
          <span className="text-sm font-bold text-white">{toCentre || 'Rahata'}</span>
        </div>
      </div>

      {/* Perks / Timing Info */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 flex items-center gap-2 text-slate-300">
          <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="truncate">
            <div className="text-[10px] text-slate-500 font-bold">DATE & WINDOW</div>
            <div className="font-semibold text-white">{date || 'Tomorrow'} {timeWindow ? `(${timeWindow})` : ''}</div>
          </div>
        </div>
        <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 flex items-center gap-2 text-slate-300">
          <Zap className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="truncate">
            <div className="text-[10px] text-slate-500 font-bold">BENEFIT</div>
            <div className="font-semibold text-emerald-300">Zero Wait Priority</div>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Action Buttons */}
      {isPending && (
        <div className="mt-4 flex items-center justify-end gap-2.5">
          <button
            onClick={handleDecline}
            disabled={isDeclining || isAccepting}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all disabled:opacity-50"
          >
            {isDeclining ? 'Declining...' : 'Stay at Current Mandi'}
          </button>
          <button
            onClick={handleAccept}
            disabled={isDeclining || isAccepting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{isAccepting ? 'Accepting...' : 'Accept & Switch Mandi'}</span>
          </button>
        </div>
      )}

      {isAccepted && (
        <div className="mt-3 text-xs text-emerald-400 font-bold flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4" />
          <span>Redirect accepted! Your booking is transferred to {toCentre}.</span>
        </div>
      )}

      {isDeclined && (
        <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
          <XCircle className="w-4 h-4" />
          <span>You opted to remain at {fromCentre}.</span>
        </div>
      )}
    </div>
  );
}
