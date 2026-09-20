import React, { useState, useEffect } from 'react';
import { Zap, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import { fastTrackApi } from '../../api';

export default function StaffOfficerApprovalsCard({ centreId, userRole }) {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [declineModal, setDeclineModal] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const fetchRounds = async () => {
    if (!centreId) return;
    try {
      setLoading(true);
      const res = await fastTrackApi.getRounds({ centreId });
      if (res?.success) {
        setRounds(res.data?.rounds || []);
      }
    } catch (err) {
      console.warn('Staff rounds fetch:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRounds();
    const interval = setInterval(fetchRounds, 8000);
    return () => clearInterval(interval);
  }, [centreId]);

  const awaitingApprovalRounds = rounds.filter((r) => r.status === 'AWAITING_APPROVAL' || r.status === 'START_REQUESTED');

  const handleStartDecision = async (roundId, approved) => {
    try {
      setActionLoading(true);
      const res = await fastTrackApi.officerStartDecision(roundId, {
        approved
      });
      if (res?.success) {
        setMsg({ type: 'success', text: `Start request ${approved ? 'approved' : 'declined'} successfully.` });
        fetchRounds();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecision = async (roundId, approved) => {
    if (!approved && !declineReason.trim()) {
      setMsg({ type: 'error', text: 'Decline reason is MANDATORY for rejecting Fast-Track auctions.' });
      return;
    }

    try {
      setActionLoading(true);
      const res = await fastTrackApi.officerDecision(roundId, {
        approved,
        declineReason: approved ? null : declineReason.trim()
      });
      if (res?.success) {
        setMsg({ type: 'success', text: `Auction winner ${approved ? 'approved' : 'declined'}.` });
        setDeclineModal(null);
        setDeclineReason('');
        fetchRounds();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const isReadOnly = userRole === 'district_admin' || userRole === 'auditor';

  return (
    <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5 shadow-xl mb-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-white text-base">Resource Planning Officer — Fast-Track Approvals Inbox (B5)</h3>
        </div>
        <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded border border-slate-700">
          Centre: <strong className="text-amber-400">{centreId}</strong>
        </span>
      </div>

      {msg && (
        <div className={`mt-3 p-3 rounded-lg text-xs flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
          'bg-rose-500/20 text-rose-300 border border-rose-500/30'
        }`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{msg.text}</span>
        </div>
      )}

      {awaitingApprovalRounds.length === 0 ? (
        <div className="mt-4 p-4 bg-slate-800/40 rounded-lg text-slate-400 text-xs flex items-center justify-between">
          <span>No Fast-Track rounds currently awaiting officer approval for this centre.</span>
          {loading && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {awaitingApprovalRounds.map((round) => (
            <div key={round._id} className="bg-slate-800 border border-amber-500/40 rounded-lg p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-700">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-sm">{round.roundId}</span>
                    <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded font-bold uppercase">
                      {round.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Slot: <strong>{round.slotHour}</strong> • Participants: <strong>{round.participants?.length || 0}</strong>
                  </p>
                </div>

                {round.status === 'AWAITING_APPROVAL' && round.currentLeader && (
                  <div className="bg-slate-900 px-3 py-2 rounded-lg border border-slate-700 text-xs">
                    <span className="text-slate-400 block">Winning Bid Leader:</span>
                    <span className="font-bold text-emerald-400 text-sm">
                      ₹{round.currentLeader.amount} • Token {round.currentLeader.tokenNumber}
                    </span>
                  </div>
                )}
              </div>

              {!isReadOnly ? (
                <div className="pt-3 flex items-center justify-end gap-2">
                  {round.status === 'START_REQUESTED' && (
                    <>
                      <button
                        onClick={() => handleStartDecision(round.roundId, true)}
                        disabled={actionLoading}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-md"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve Start</span>
                      </button>
                      <button
                        onClick={() => handleStartDecision(round.roundId, false)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg"
                      >
                        Decline
                      </button>
                    </>
                  )}

                  {round.status === 'AWAITING_APPROVAL' && (
                    <>
                      <button
                        onClick={() => handleDecision(round.roundId, true)}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve Winner (₹{round.currentLeader?.amount})</span>
                      </button>
                      <button
                        onClick={() => setDeclineModal(round.roundId)}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Decline (Reason Mandatory)</span>
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="pt-2 text-right text-xs text-slate-400 italic">
                  District Admin / Auditor view (Read-only)
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Decline Reason Modal */}
      {declineModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full">
            <h4 className="text-white font-bold text-sm mb-2">Mandatory Reason for Decline</h4>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Provide reason for rejecting the fast-track winner..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-xs outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => { setDeclineModal(null); setDeclineReason(''); }}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDecision(declineModal, false)}
                disabled={actionLoading || !declineReason.trim()}
                className="px-4 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg disabled:opacity-50"
              >
                Submit Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
