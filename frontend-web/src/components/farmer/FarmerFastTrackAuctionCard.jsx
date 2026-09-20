import React, { useState, useEffect } from 'react';
import { Zap, Clock, Users, ArrowUpRight, ShieldCheck, AlertCircle, Loader2, CheckCircle2, Trophy } from 'lucide-react';
import { fastTrackApi } from '../../api';

export default function FarmerFastTrackAuctionCard({ token, onRoundUpdated }) {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bidAmount, setBidAmount] = useState(160);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const fetchRounds = async () => {
    if (!token?.mandiId) return;
    try {
      setLoading(true);
      const res = await fastTrackApi.getRounds({
        centreId: token.mandiId,
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
  }, [token?.mandiId, token?.slotDate]);

  const activeRound = rounds.find((r) => ['JOINING', 'LIVE', 'START_REQUESTED', 'AWAITING_APPROVAL', 'APPROVED'].includes(r.status));

  const handleJoin = async (roundId) => {
    try {
      setActionLoading(true);
      const res = await fastTrackApi.joinRound(roundId, {
        tokenNumber: token.tokenNumber
      });
      if (res?.success) {
        setMsg({ type: 'success', text: 'Joined Fast-Track auction round!' });
        fetchRounds();
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
          <h3 className="font-semibold text-white">Fast-Track Gate Priority (B5)</h3>
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
                  activeRound.status === 'AWAITING_APPROVAL' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                  activeRound.status === 'APPROVED' ? 'bg-emerald-600 text-white' :
                  'bg-slate-700 text-slate-300'
                }`}>
                  {activeRound.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Centre: <strong>{activeRound.centreId}</strong> • Slot: <strong>{activeRound.slotHour}</strong>
              </p>
            </div>

            {/* Countdown timer */}
            {activeRound.endsAt && (
              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-300">Countdown:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {Math.max(0, Math.floor((new Date(activeRound.endsAt).getTime() - Date.now()) / 1000))}s
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
              <span className="font-bold text-slate-200 text-sm mt-0.5 block">₹{activeRound.reservePrice || 150}</span>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">Step & Ceiling</span>
              <span className="font-bold text-slate-200 text-sm mt-0.5 block">+₹{activeRound.stepSize || 10} (Max ₹{activeRound.ceilingPrice || 500})</span>
            </div>
          </div>

          {/* Actions depending on round status and farmer state */}
          <div className="pt-2">
            {activeRound.status === 'JOINING' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleJoin(activeRound.roundId)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  <span>Join Round with Booking {token.tokenNumber}</span>
                </button>

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

            {activeRound.status === 'LIVE' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-300">Commitment Amount (₹):</label>
                  <input
                    type="number"
                    min={activeRound.currentLeader ? activeRound.currentLeader.amount + (activeRound.stepSize || 10) : (activeRound.reservePrice || 150)}
                    max={activeRound.ceilingPrice || 500}
                    step={activeRound.stepSize || 10}
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
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-center gap-2">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>Round ended! Winner commitment is awaiting official confirmation from the Mandi Resource Planning Officer.</span>
              </div>
            )}

            {activeRound.status === 'APPROVED' && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Fast-track priority approved by Resource Officer! Priority applied to queue position.</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 text-xs text-slate-400 bg-slate-800/40 p-3 rounded-lg flex items-center justify-between">
          <span>No live Fast-Track auction open right now for {token.mandiName}.</span>
          <span className="text-[11px] text-slate-500">Opens 30 min prior to slot hour (Cap 2/hr)</span>
        </div>
      )}
    </div>
  );
}
