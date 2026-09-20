import React, { useState } from 'react';
import { AlertTriangle, X, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { complaintsApi } from '../../api';

export default function FarmerGrievanceModal({ token, isOpen, onClose, onGrievanceFiled }) {
  const [checkpoint, setCheckpoint] = useState('GATE_CHECKIN');
  const [category, setCategory] = useState('QUALITY_DISPUTE');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  if (!isOpen || !token) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description || description.trim().length < 5) {
      setError('Please provide a detailed description (at least 5 characters)');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await complaintsApi.createComplaint({
        tokenNumber: token.tokenNumber,
        checkpoint,
        category,
        description: description.trim(),
        phone: token.farmerPhone || token.phone,
        farmerName: token.farmerName
      });

      if (res?.success) {
        setSuccess(`Grievance registered successfully! Case ID: ${res.data?.complaintId}. Mandi Supervisor has been alerted.`);
        if (onGrievanceFiled) onGrievanceFiled(res.data);
        setTimeout(() => {
          setSuccess(null);
          onClose();
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-6 h-6 text-rose-500" />
          <div>
            <h3 className="text-lg font-bold text-white">Report Desk Dispute / Grievance</h3>
            <p className="text-xs text-slate-400">Token: <span className="font-mono text-amber-400">{token.tokenNumber}</span> • {token.mandiName}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-lg text-rose-300 text-xs">
            {error}
          </div>
        )}

        {success ? (
          <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-300 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Operational Desk / Checkpoint</label>
              <select
                value={checkpoint}
                onChange={(e) => setCheckpoint(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="GATE_CHECKIN">Gate Check-in & Security Desk</option>
                <option value="QUALITY_GRADING">Quality Assaying & Moisture Grading</option>
                <option value="WEIGHBRIDGE">Digital Weighbridge Station</option>
                <option value="PROCUREMENT">Procurement Deed & Sale Agreement</option>
                <option value="PAYOUT">DBT & Accounts Settlement Desk</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Dispute Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="QUALITY_DISPUTE">Quality Grading / Moisture Deduction Dispute</option>
                <option value="WEIGHT_DISPUTE">Weighbridge Scale Discrepancy</option>
                <option value="EXCESS_WAIT">Unreasonable Queue Delay / Desk Congestion</option>
                <option value="STAFF_CONDUCT">Staff Conduct / Improper Guidance</option>
                <option value="PAYOUT_DELAY">Payment / Settlement Inquiry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Describe Problem</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Explain what happened at the desk..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                <span>Submit Grievance</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
