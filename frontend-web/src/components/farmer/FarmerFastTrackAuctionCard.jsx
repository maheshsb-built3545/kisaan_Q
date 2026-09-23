import React, { useState, useEffect } from 'react';
import { Zap, Clock, Users, ArrowUpRight, ShieldCheck, AlertCircle, Loader2, CheckCircle2, Trophy } from 'lucide-react';
import { fastTrackApi } from '../../api';
import { getCentreDisplayName } from '../../config/centreDisplayNames';

function formatRemainingTime(seconds) {
  if (seconds <= 0) return '0s (Expired)';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export default function FarmerFastTrackAuctionCard({ token, onRoundUpdated }) {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bidAmount, setBidAmount] = useState(160);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [now, setNow] = useState(Date.now());

  // 1-second interval for smooth countdown ticking
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchRounds = async () => {
    const centreId = token?.mandiId || token?.centreId;
    if (!centreId) return;
    try {
      setLoading(true);
      const res = await fastTrackApi.getRounds({
        centreId,
        slotDate: token.slotDate
      });
      if (res?.success) {
        setRounds(res.data?.rounds || []);
      }
    } catch (err) {
      console.warn('FastTrack fetch:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRounds();
    const interval = setInterval(fetchRounds, 6000);
    return () => clearInterval(interval);
  }, [token?.mandiId, token?.centreId, token?.slotDate]);

  // 1. Priority 1: Check if this specific token is an enrolled participant in any active round
  let activeRound = rounds.find(
    (r) =>
      ['JOINING', 'LIVE', 'START_REQUESTED', 'AWAITING_APPROVAL', 'APPROVED'].includes(r.status) &&
      r.participants?.some(
        (p) => p.tokenNumber === token.tokenNumber || (token.id && p.tokenNumber === token.id)
      )
  );

  // 2. Priority 2: If token is not an enrolled participant, look for an open JOINING / START_REQUESTED round
  // that matches this token's centre, slotDate, and slot window where room remains (< 5).
  if (!activeRound) {
    activeRound = rounds.find((r) => {
      if (r.status !== 'JOINING' && r.status !== 'START_REQUESTED') return false;
      if ((r.participants?.length || 0) >= 5) return false;
      // If round specifies a slotHour and token has slotTime, ensure matching slot window
      if (r.slotHour && token.slotTime && r.slotHour.trim() !== token.slotTime.trim()) {
        return false;
      }
      return true;
    });
  }

  const isParticipant = Boolean(
    activeRound?.participants?.some(
      (p) => p.tokenNumber === token.tokenNumber || (token.id && p.tokenNumber === token.id)
    )
  );

  const isLeader = Boolean(
    activeRound?.currentLeader?.tokenNumber === token.tokenNumber ||
    (token.id && activeRound?.currentLeader?.tokenNumber === token.id)
  );

  // Deadline calculation:
  // For AWAITING_APPROVAL: countdown to officerDecisionExpiresAt
  // For LIVE: countdown to endsAt
  const targetDeadline = activeRound
    ? activeRound.status === 'AWAITING_APPROVAL'
      ? activeRound.officerDecisionExpiresAt || activeRound.endsAt
      : activeRound.status === 'LIVE'
      ? activeRound.endsAt
      : activeRound.officerDecisionExpiresAt || activeRound.endsAt
    : null;

  const remainingSeconds = targetDeadline
    ? Math.max(0, Math.floor((new Date(targetDeadline).getTime() - now) / 1000))
    : null;

  const handleJoin = async (roundId) => {
    try {
      setActionLoading(true);
      const res = await fastTrackApi.joinRound(roundId, {
        tokenNumber: token.tokenNumber
      });
      if (res?.success) {
        setMsg({ type: 'success', text: 'Joined Fast-Track auction round!' });
        fetchRounds();
        if (onRoundUpdated) onRoundUpdated();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestStart = async (roundId) => {
    try {
      setActionLoading(true);
      const res = await fastTrackApi.requestStart(roundId);
      if (res?.success) {
        setMsg({ type: 'info', text: 'Start requested! Sent to Mandi Resource Planning Officer for quorum approval.' });
        fetchRounds();
        if (onRoundUpdated) onRoundUpdated();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlaceBid = async (roundId) => {
    try {
      setActionLoading(true);
      const res = await fastTrackApi.placeBid(roundId, {
        amount: Number(bidAmount),
        tokenNumber: token.tokenNumber
      });
      if (res?.success) {
        setMsg({ type: 'success', text: `Bid placed! You are leading at ₹${bidAmount} commitment.` });
        fetchRounds();
        if (onRoundUpdated) onRoundUpdated();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setActionLoading(false);
    }
  };

  if (!token || token.status === 'CANCELLED' || token.status === 'COMPLETED') {
    return null;
  }

  return (
    <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-4 shadow-xl mb-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-white">Fast-Track Gate Priority</h3>
        </div>
        <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
          rule-based auction with human approval
        </span>
      </div>

      {msg && (
        <div className={`mt-3 p-3 rounded-lg text-sm flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
          msg.type === 'error' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
          'bg-blue-500/20 text-blue-300 border border-blue-500/30'
        }`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{msg.text}</span>
        </div>
      )}

      {activeRound ? (
        <div className="mt-4 bg-slate-800/80 border border-slate-700/80 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-amber-400 font-bold">{activeRound.roundId}</span>
                <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                  activeRound.status === 'LIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse' :
                  activeRound.status === 'JOINING' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  activeRound.status === 'START_REQUESTED' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                  activeRound.status === 'AWAITING_APPROVAL' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                  activeRound.status === 'APPROVED' ? 'bg-emerald-600 text-white' :
                  'bg-slate-700 text-slate-300'
                }`}>
                  {activeRound.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Centre: <strong>{getCentreDisplayName(activeRound.centreId)} ({activeRound.centreId})</strong> • Slot: <strong>{activeRound.slotHour}</strong>
              </p>
            </div>

            {/* Countdown timer */}
            {targetDeadline && (
              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-300">
                  {activeRound.status === 'AWAITING_APPROVAL' ? 'Decision Window:' : 'Countdown:'}
                </span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {formatRemainingTime(remainingSeconds)}
                </span>
              </div>
            )}
          </div>

          {/* Current Leader & Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 text-xs">
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">Participants</span>
              <span className="font-bold text-white text-sm flex items-center gap-1 mt-0.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                {activeRound.participants?.length || 0} / 5
              </span>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">Current Leader</span>
              <span className="font-bold text-amber-300 text-sm flex items-center gap-1 mt-0.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                {activeRound.currentLeader ? `₹${activeRound.currentLeader.amount}` : 'No bids yet'}
              </span>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">Reserve Price</span>
              <span className="font-bold text-slate-200 text-sm mt-0.5 block">₹{activeRound.reservePrice || activeRound.reserveFee || 150}</span>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">Step & Ceiling</span>
              <span className="font-bold text-slate-200 text-sm mt-0.5 block">+₹{activeRound.stepSize || activeRound.bidStep || 10} (Max ₹{activeRound.ceilingPrice || activeRound.bidCeiling || 500})</span>
            </div>
          </div>

          {/* Actions depending on round status and farmer state */}
          <div className="pt-2">
            {activeRound.status === 'JOINING' && (
              <div className="flex flex-wrap items-center gap-3">
                {isParticipant ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>You have joined this round ({activeRound.participants?.length || 0}/5 participants enrolled)</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleJoin(activeRound.roundId)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    <span>Join Round with Booking {token.tokenNumber}</span>
                  </button>
                )}

                {(activeRound.participants?.length || 0) < 5 && (
                  <button
                    onClick={() => handleRequestStart(activeRound.roundId)}
                    disabled={actionLoading}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg transition-all"
                  >
                    Request Start Anyway (&lt;5 Quorum)
                  </button>
                )}
              </div>
            )}

            {activeRound.status === 'START_REQUESTED' && (
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-xs text-purple-300 flex items-center gap-2">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>
                  {isParticipant
                    ? 'Start requested! Awaiting Mandi Resource Planning Officer approval to commence live bidding.'
                    : 'Start requested for this round. Awaiting Officer approval.'}
                </span>
              </div>
            )}

            {activeRound.status === 'LIVE' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-300">Commitment Amount (₹):</label>
                  <input
                    type="number"
                    min={activeRound.currentLeader ? activeRound.currentLeader.amount + (activeRound.stepSize || activeRound.bidStep || 10) : (activeRound.reservePrice || activeRound.reserveFee || 150)}
                    max={activeRound.ceilingPrice || activeRound.bidCeiling || 500}
                    step={activeRound.stepSize || activeRound.bidStep || 10}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="w-28 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm"
                  />
                </div>

                <button
                  onClick={() => handlePlaceBid(activeRound.roundId)}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                  <span>Place Bid ₹{bidAmount}</span>
                </button>
              </div>
            )}

            {activeRound.status === 'AWAITING_APPROVAL' && (
              <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                remainingSeconds > 0
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              }`}>
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>
                  {remainingSeconds <= 0
                    ? 'Officer decision window has expired. Awaiting administrative round resolution.'
                    : isLeader
                    ? `Bidding concluded! You hold the winning commitment (₹${activeRound.currentLeader?.amount}). Awaiting Mandi Resource Planning Officer confirmation.`
                    : isParticipant
                    ? `Bidding concluded. Winner commitment (₹${activeRound.currentLeader?.amount}) is awaiting Mandi Resource Planning Officer confirmation.`
                    : 'Bidding concluded. Winner commitment is awaiting Mandi Resource Planning Officer confirmation.'}
                </span>
              </div>
            )}

            {activeRound.status === 'APPROVED' && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>
                  {isLeader
                    ? 'Fast-track priority approved by Resource Officer! Priority applied to your queue position.'
                    : 'Fast-track priority approved by Resource Officer! Priority applied to queue position.'}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 text-xs text-slate-400 bg-slate-800/40 p-3 rounded-lg flex items-center justify-between">
          <span>No live Fast-Track auction open right now for {getCentreDisplayName(token.mandiId || token.centreId || token.mandiName)}.</span>
          <span className="text-[11px] text-slate-500">Opens 30 min prior to slot hour (Cap 2/hr)</span>
        </div>
      )}
    </div>
  );
}

