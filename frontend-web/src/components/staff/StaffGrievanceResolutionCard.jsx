import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, Clock, AlertCircle, Loader2, MessageSquare, Filter, XCircle } from 'lucide-react';
import { complaintsApi } from '../../api';

export default function StaffGrievanceResolutionCard({ centreId, userRole }) {
  const [complaints, setComplaints] = useState([]);
  const [sourceFilter, setSourceFilter] = useState('ALL'); // ALL | farmer | staff
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const params = {};
      if (centreId && centreId !== 'ALL') params.centreId = centreId;
      if (sourceFilter !== 'ALL') params.source = sourceFilter;
      const res = await complaintsApi.getComplaints(params);
      if (res?.success) {
        setComplaints(res.data?.complaints || []);
      }
    } catch (err) {
      console.warn('Complaints fetch:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
    const interval = setInterval(fetchComplaints, 10000);
    return () => clearInterval(interval);
  }, [centreId, sourceFilter]);

  const handleResolve = async (id, status = 'RESOLVED') => {
    if (!notes.trim()) {
      setMsg({ type: 'error', text: 'Resolution reason / notes is mandatory to resolve or reject a grievance.' });
      return;
    }

    try {
      setActionLoading(true);
      const res = await complaintsApi.resolveComplaint(id, {
        status,
        resolutionNotes: notes.trim()
      });
      if (res?.success) {
        setMsg({ type: 'success', text: `Grievance ${id} marked as ${status} successfully.` });
        setResolvingId(null);
        setNotes('');
        fetchComplaints();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const isSupervisorOrAdmin = ['supervisor', 'admin'].includes(userRole);
  const openComplaintsCount = complaints.filter(c => ['PENDING', 'IN_INVESTIGATION', 'OPEN'].includes(c.status)).length;

  return (
    <div className="bg-slate-900 border border-rose-500/30 rounded-xl p-5 shadow-xl mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-500" />
          <h3 className="font-bold text-white text-base">Farmer Desk Disputes & Grievance Inbox (B6)</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Source Filter */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
            {['ALL', 'farmer', 'staff'].map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setSourceFilter(src)}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  sourceFilter === src
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {src === 'ALL' ? 'All Sources' : src === 'farmer' ? 'Farmer Raised' : 'Staff Raised'}
              </button>
            ))}
          </div>

          <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded border border-slate-700">
            Open Disputes: <strong className="text-rose-400">{openComplaintsCount}</strong>
          </span>
        </div>
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

      {complaints.length === 0 ? (
        <div className="mt-4 p-4 bg-slate-800/40 rounded-lg text-slate-400 text-xs flex items-center justify-between">
          <span>No grievances filed matching current filter.</span>
          {loading && <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {complaints.map((c) => {
            const isOpen = ['PENDING', 'IN_INVESTIGATION', 'OPEN'].includes(c.status);
            return (
              <div key={c._id || c.complaintId} className="bg-slate-800/80 border border-slate-700 rounded-lg p-4 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-700/60">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-white text-sm">{c.complaintId}</span>
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                      c.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      c.status === 'REJECTED' ? 'bg-slate-700 text-slate-400 border border-slate-600' :
                      'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {c.status}
                    </span>
                    <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                      {c.checkpoint}
                    </span>
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[10px]">
                      {c.category}
                    </span>
                    <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded text-[10px]">
                      Source: {c.source || 'farmer'}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    Farmer: <strong className="text-white">{c.farmerName}</strong> ({c.farmerPhone}) • Token: <strong className="text-amber-400 font-mono">{c.tokenNumber}</strong>
                  </div>
                </div>

                <div className="py-2.5">
                  <p className="text-slate-300 text-xs leading-relaxed"><strong className="text-slate-400">Description:</strong> {c.description}</p>
                  {c.resolutionNotes && (
                    <p className="text-emerald-400 text-xs mt-1.5"><strong className="text-emerald-300">Resolution:</strong> {c.resolutionNotes} (by {c.resolvedBy})</p>
                  )}
                </div>

                {isOpen && isSupervisorOrAdmin && (
                  <div className="pt-2 border-t border-slate-700/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      placeholder="Enter mandatory resolution notes / reason..."
                      value={resolvingId === c.complaintId ? notes : ''}
                      onFocus={() => setResolvingId(c.complaintId)}
                      onChange={(e) => { setResolvingId(c.complaintId); setNotes(e.target.value); }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      onClick={() => handleResolve(c.complaintId, 'RESOLVED')}
                      disabled={actionLoading}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow-md disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>Resolve</span>
                    </button>
                    <button
                      onClick={() => handleResolve(c.complaintId, 'REJECTED')}
                      disabled={actionLoading}
                      className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow-md disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
