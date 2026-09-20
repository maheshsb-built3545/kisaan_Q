import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { exceptionsApi } from '../api/exceptions.api';
import { staffComplaintsApi } from '../api/complaints.api';
import { auditApi } from '../api/audit.api';
import GovHeader from '../components/common/GovHeader';
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  PlusCircle,
  User,
  History,
  RefreshCw,
  X,
  Scale,
  Filter
} from 'lucide-react';
import {
  DeskCard,
  StatusBadge,
  ActionButton
} from '../components/staff';
import StaffOfficerApprovalsCard from '../components/staff/StaffOfficerApprovalsCard';
import StaffGrievanceResolutionCard from '../components/staff/StaffGrievanceResolutionCard';
import StaffReleasedSlotsCard from '../components/staff/StaffReleasedSlotsCard';

export default function SupervisorExceptions() {
  const { user } = useAuth();

  const [exceptions, setExceptions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | PENDING | RESOLVED
  const [sourceFilter, setSourceFilter] = useState('ALL'); // ALL | farmer | staff
  const [isLoading, setIsLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState(null);

  // Override / Resolution Modal state
  const [selectedExceptionForOverride, setSelectedExceptionForOverride] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideOutcome, setOverrideOutcome] = useState('Admitted with 1.5% moisture deduction');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  // Raise Exception Modal state
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [raiseBookingId, setRaiseBookingId] = useState('65f1a2b3c4d5e6f7a8b9c0e3');
  const [raiseType, setRaiseType] = useState('quality_dispute');
  const [raiseReasonCode, setRaiseReasonCode] = useState('High moisture level above standard band');
  const [isRaising, setIsRaising] = useState(false);

  const fetchExceptionsAndAudit = async () => {
    try {
      setIsLoading(true);

      const exQuery =
        statusFilter === 'PENDING'
          ? { status: 'pending_review' }
          : statusFilter === 'RESOLVED'
          ? { status: 'resolved' }
          : {};

      const compQuery =
        statusFilter === 'PENDING'
          ? { status: 'PENDING' }
          : statusFilter === 'RESOLVED'
          ? { status: 'RESOLVED' }
          : {};

      const exPromise = exceptionsApi.getAllExceptions(exQuery).catch(() => []);
      const compPromise = staffComplaintsApi.getComplaints(compQuery).catch(() => ({ data: { complaints: [] } }));

      const [exRes, compRes] = await Promise.all([exPromise, compPromise]);
      const exList = Array.isArray(exRes.data) ? exRes.data : (Array.isArray(exRes) ? exRes : []);
      const compList = compRes?.data?.complaints || (Array.isArray(compRes?.data) ? compRes.data : []);

      // Normalize staff exceptions
      const normEx = exList.map((ex) => ({
        _id: ex._id,
        id: ex._id,
        source: 'staff',
        sourceLabel: 'Staff Exception',
        tokenNumber: ex.bookingId?.tokenNumber || ex.tokenNumber || 'TKN-000',
        crop: ex.bookingId?.crop || ex.crop || 'Commodity',
        type: ex.type || 'Operational Exception',
        reasonCode: ex.reasonCode || 'Discrepancy logged at operational station',
        raisedBy: ex.raisedBy?.name || ex.raisedBy || 'Station Operator',
        raisedByRole: ex.raisedBy?.role || 'operator',
        status: ex.supervisorOverride ? 'RESOLVED' : 'PENDING',
        supervisorOverride: Boolean(ex.supervisorOverride),
        overrideReason: ex.overrideReason || null,
        outcome: ex.outcome || null,
        createdAt: ex.createdAt || new Date().toISOString(),
      }));

      // Normalize farmer grievances
      const normComp = compList.map((c) => ({
        _id: c._id || c.complaintId,
        id: c._id || c.complaintId,
        complaintId: c.complaintId,
        source: 'farmer',
        sourceLabel: 'Farmer Grievance',
        tokenNumber: c.tokenNumber || 'TKN-000',
        crop: c.crop || 'Commodity',
        type: c.category || c.checkpoint || 'Citizen Grievance',
        reasonCode: c.description || 'Farmer dispute filed at checkpoint',
        raisedBy: c.farmerName || 'Citizen Farmer',
        raisedByRole: 'farmer',
        status: c.status === 'RESOLVED' ? 'RESOLVED' : 'PENDING',
        supervisorOverride: c.status === 'RESOLVED',
        overrideReason: c.resolutionNotes || null,
        outcome: c.resolutionNotes ? `Resolution: ${c.resolutionNotes}` : null,
        createdAt: c.createdAt || new Date().toISOString(),
      }));

      // Merge both models sorted by newest first
      const merged = [...normEx, ...normComp].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

      setExceptions(merged);

      try {
        const auditRes = await auditApi.getAuditLogs();
        const logs = Array.isArray(auditRes.data) ? auditRes.data : (Array.isArray(auditRes) ? auditRes : []);
        setAuditLogs(logs);
      } catch {
        setAuditLogs([]);
      }
    } catch (err) {
      console.warn('[SupervisorDesk] Notice:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptionsAndAudit();
  }, [statusFilter]);

  // Handle Supervisor Override or Farmer Grievance Resolution
  const handleApplyOverride = async (e) => {
    e.preventDefault();
    if (!selectedExceptionForOverride || !overrideReason.trim()) {
      alert('Resolution / override reason is mandatory for supervisor audits.');
      return;
    }

    try {
      setIsSubmittingOverride(true);
      if (selectedExceptionForOverride.source === 'farmer') {
        // Resolve farmer grievance via complaints API
        await staffComplaintsApi.resolveComplaint(
          selectedExceptionForOverride.complaintId || selectedExceptionForOverride._id,
          {
            status: 'RESOLVED',
            resolutionNotes: overrideReason.trim(),
          }
        );
      } else {
        // Apply staff exception override via exceptions API
        await exceptionsApi.supervisorOverride(selectedExceptionForOverride._id, {
          overrideReason: overrideReason.trim(),
          outcome: overrideOutcome,
        });
      }

      setExceptions((prev) =>
        prev.map((ex) =>
          ex._id === selectedExceptionForOverride._id
            ? {
                ...ex,
                status: 'RESOLVED',
                supervisorOverride: true,
                overrideReason: overrideReason.trim(),
                outcome:
                  selectedExceptionForOverride.source === 'farmer'
                    ? `Resolution: ${overrideReason.trim()}`
                    : overrideOutcome,
              }
            : ex
        )
      );

      setActionNotice({
        type: 'success',
        message: `${
          selectedExceptionForOverride.source === 'farmer' ? 'Farmer grievance resolved' : 'Supervisor override applied'
        } for ${selectedExceptionForOverride.tokenNumber || 'token'}. Logged to auditable trail.`,
      });
      setSelectedExceptionForOverride(null);
      setOverrideReason('');
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Action failed');
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Handle Raising an Exception
  const handleRaiseException = async (e) => {
    e.preventDefault();
    try {
      setIsRaising(true);
      await exceptionsApi.raiseException({
        bookingId: raiseBookingId,
        type: raiseType,
        reasonCode: raiseReasonCode,
        raisedBy: user?.id || '65f1a2b3c4d5e6f7a8b9c0d1',
      });

      setActionNotice({
        type: 'success',
        message: 'New exception logged and routed to Supervisor review lane.',
      });
      setShowRaiseModal(false);
      fetchExceptionsAndAudit();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to raise exception');
    } finally {
      setIsRaising(false);
    }
  };

  const isSupervisor = user?.role === 'supervisor' || user?.role === 'admin';
  const pendingCount = exceptions.filter((ex) => !ex.supervisorOverride).length;
  const resolvedCount = exceptions.filter((ex) => ex.supervisorOverride).length;
  const farmerCount = exceptions.filter((ex) => ex.source === 'farmer').length;
  const staffCount = exceptions.filter((ex) => ex.source === 'staff').length;

  const displayedExceptions = exceptions.filter((item) => {
    if (sourceFilter === 'farmer' && item.source !== 'farmer') return false;
    if (sourceFilter === 'staff' && item.source !== 'staff') return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <GovHeader portalType="staff" />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:px-8">
        {/* Banner Alert Notice */}
        {actionNotice && (
          <div
            className={`mb-6 p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm shadow-sm ${
              actionNotice.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-semibold">{actionNotice.message}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-900"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Supervisor Dispute & Exception Desk
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
                Executive Authority
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Unified governance desk for Farmer Grievances and Staff Operational Exceptions with mandatory resolution audit logs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ActionButton
              variant="outline"
              size="sm"
              icon={PlusCircle}
              onClick={() => setShowRaiseModal(true)}
            >
              Raise Exception
            </ActionButton>

            <ActionButton
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              isLoading={isLoading}
              loadingText="Refreshing…"
              onClick={fetchExceptionsAndAudit}
              title="Refresh exception queues"
            />
          </div>
        </div>

        {/* ── Officer Approvals Inbox ── */}
        <StaffOfficerApprovalsCard centreId={user?.assignedMandi || 'KPG-01'} userRole={user?.role} />

        {/* ── Released Slots & Waitlist Reallocations ── */}
        <StaffReleasedSlotsCard centreId={user?.assignedMandi || 'KPG-01'} />

        {/* Filter Controls Bar (Source & Status) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Source Filter */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'ALL', label: `All Sources (${exceptions.length})` },
                { id: 'farmer', label: `🌾 Farmer (${farmerCount})` },
                { id: 'staff', label: `🏛️ Staff (${staffCount})` },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSourceFilter(s.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sourceFilter === s.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              {[
                { id: 'ALL', label: `All Status (${displayedExceptions.length})` },
                { id: 'PENDING', label: `Pending (${displayedExceptions.filter(x => !x.supervisorOverride).length})`, isAlert: true },
                { id: 'RESOLVED', label: `Resolved (${displayedExceptions.filter(x => x.supervisorOverride).length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === f.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-slate-500 font-mono hidden sm:block">
            Active Officer: <strong className="text-slate-900">{user?.name || 'V. Pawar'}</strong> ({user?.role || 'supervisor'})
          </div>
        </div>

        {/* Main Grid: Disputes / Exceptions (2 cols) & Audit Ledger (1 col) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          <div className="lg:col-span-8 space-y-4">
            {isLoading ? (
              <div className="py-16 text-center bg-white border border-slate-200 rounded-2xl shadow-sm">
                <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Loading dispute & exception logs...</p>
              </div>
            ) : displayedExceptions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-100">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900">All Operations Clear — Zero Active Items</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  No grievances or operational exceptions match the selected filter.
                </p>
              </div>
            ) : (
              displayedExceptions.map((ex) => {
                const isOverridden = ex.supervisorOverride;
                const token = ex.tokenNumber || 'TKN-000';
                const crop = ex.crop || 'Commodity';
                const isFarmer = ex.source === 'farmer';

                return (
                  <div
                    key={ex._id}
                    className={`bg-white rounded-2xl border transition-all p-5 shadow-xs ${
                      isOverridden
                        ? 'border-purple-200 bg-purple-50/20'
                        : isFarmer
                        ? 'border-emerald-300/80 bg-emerald-50/15'
                        : 'border-amber-300/80 bg-amber-50/15'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Source Tag */}
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                            isFarmer
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-blue-100 text-blue-800 border-blue-300'
                          }`}
                        >
                          {isFarmer ? '🌾 Farmer Grievance' : '🏛️ Staff Exception'}
                        </span>
                        <span className="font-mono font-bold text-base text-slate-900">{token}</span>
                        <span className="text-xs font-semibold text-slate-600">({crop})</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                          {ex.type ? ex.type.replace(/_/g, ' ') : 'General'}
                        </span>
                      </div>

                      <StatusBadge
                        status={isOverridden ? 'COMPLETED' : 'HIGH'}
                        label={isOverridden ? '✓ Resolved' : 'Pending Review'}
                        size="sm"
                      />
                    </div>

                    <div className="py-3">
                      <div className="text-xs text-slate-500 font-bold uppercase mb-1">
                        {isFarmer ? 'Grievance Description / Disputed Checkpoint:' : 'Discrepancy Detail / Reason Code:'}
                      </div>
                      <p className="text-xs sm:text-sm font-mono text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        {ex.reasonCode}
                      </p>
                    </div>

                    {isOverridden ? (
                      <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs space-y-1 mt-1">
                        <div className="font-bold text-purple-950 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-purple-700" />
                          <span>Executive Resolution Decision:</span>
                        </div>
                        <div className="text-purple-900">
                          <strong>Rationale / Audit Notes:</strong> {ex.overrideReason}
                        </div>
                        {ex.outcome && (
                          <div className="text-purple-800 text-[11px]">
                            <strong>Settlement Outcome:</strong> {ex.outcome}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div className="text-xs text-slate-500 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>
                            Raised by: <strong className="text-slate-700">{ex.raisedBy}</strong>
                          </span>
                        </div>

                        {isSupervisor ? (
                          <ActionButton
                            variant={isFarmer ? 'primary' : 'warning'}
                            size="sm"
                            onClick={() => setSelectedExceptionForOverride(ex)}
                          >
                            {isFarmer ? 'Resolve Grievance' : 'Apply Supervisor Override'}
                          </ActionButton>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                            Read-Only (Supervisor Only)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Audit Ledger Sidebar */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" />
              <span>Auditable Trail</span>
            </h2>

            <div className="space-y-3 text-xs">
              {auditLogs.slice(0, 6).map((log, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-emerald-700 text-[11px]">{log.action}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{log.actorRole}</span>
                  </div>
                  <p className="text-slate-700 text-[11px] line-clamp-2">{log.reason || 'Action recorded'}</p>
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/80">
                    {new Date(log.timestamp || Date.now()).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Supervisor Override / Resolution Modal */}
      {selectedExceptionForOverride && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 text-left">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    selectedExceptionForOverride.source === 'farmer'
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20'
                      : 'bg-amber-50 text-amber-700 ring-1 ring-amber-500/20'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedExceptionForOverride.source === 'farmer'
                      ? `Resolve Farmer Grievance (${selectedExceptionForOverride.complaintId || selectedExceptionForOverride.tokenNumber})`
                      : `Supervisor Dispute Override (${selectedExceptionForOverride.tokenNumber})`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Token #{selectedExceptionForOverride.tokenNumber || 'TKN-000'} • {selectedExceptionForOverride.crop}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExceptionForOverride(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  {selectedExceptionForOverride.source === 'farmer'
                    ? 'Resolution Rationale & Action Taken'
                    : 'Supervisor Override Rationale'}{' '}
                  <span className="text-rose-500">* (Mandatory)</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder={
                    selectedExceptionForOverride.source === 'farmer'
                      ? 'Describe resolution (e.g. secondary quality sample re-graded to Grade A in presence of farmer, weighing calibrated)...'
                      : 'Explain why this exception is overridden (e.g. secondary moisture test within acceptable APMC tolerance band)...'
                  }
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:border-amber-500 focus:outline-none"
                />
              </div>

              {selectedExceptionForOverride.source !== 'farmer' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                    Designated Settlement Outcome
                  </label>
                  <select
                    value={overrideOutcome}
                    onChange={(e) => setOverrideOutcome(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="Admitted with 1.5% moisture deduction">
                      Admitted with 1.5% moisture deduction
                    </option>
                    <option value="Re-graded to Grade B FAQ">Re-graded to Grade B FAQ</option>
                    <option value="Document mismatch resolved on-site via Gov-ID/RC">
                      Document mismatch resolved on-site via Gov-ID/RC
                    </option>
                    <option value="Special district procurement intake sanction">
                      Special district procurement intake sanction
                    </option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedExceptionForOverride(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <ActionButton
                  type="submit"
                  variant={selectedExceptionForOverride.source === 'farmer' ? 'primary' : 'warning'}
                  size="sm"
                  isLoading={isSubmittingOverride}
                  loadingText="Recording…"
                >
                  {selectedExceptionForOverride.source === 'farmer'
                    ? 'Confirm & Resolve Grievance'
                    : 'Confirm & Sign Override'}
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Raise Exception Modal */}
      {showRaiseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Raise Operational Exception</h3>
              <button
                type="button"
                onClick={() => setShowRaiseModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRaiseException} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Booking ID</label>
                <input
                  type="text"
                  required
                  value={raiseBookingId}
                  onChange={(e) => setRaiseBookingId(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Exception Category</label>
                <select
                  value={raiseType}
                  onChange={(e) => setRaiseType(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50"
                >
                  <option value="quality_dispute">Quality Dispute (Moisture / Spoilage)</option>
                  <option value="document_mismatch">Document / Vehicle Mismatch</option>
                  <option value="partial_accept">Partial Acceptance</option>
                  <option value="rejected">Complete Rejection</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason Code Description</label>
                <input
                  type="text"
                  required
                  value={raiseReasonCode}
                  onChange={(e) => setRaiseReasonCode(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                <ActionButton
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setShowRaiseModal(false)}
                  className="flex-1"
                >
                  Cancel
                </ActionButton>
                <ActionButton
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isRaising}
                  loadingText="Logging…"
                  className="flex-1"
                >
                  Log Exception
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
