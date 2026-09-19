import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import Button from '../components/common/Button';

export default function OTPVerify() {
  const location = useLocation();
  const navigate = useNavigate();
  const { farmerOtpVerify, farmerOtpRequest, clearFarmerSession } = useAuth();

  const phone = location.state?.phone || '9876543210';
  const name = location.state?.name;
  const preferredLanguage = location.state?.preferredLanguage || 'mr';
  const isDemoMode = import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true' || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'true');
  const initialDevOtp = location.state?.devOtp || (isDemoMode ? '123456' : '');
  const mode = location.state?.mode || 'login';
  const passcode = location.state?.passcode;

  const [otp, setOtp] = useState(() => (isDemoMode ? ['1', '2', '3', '4', '5', '6'] : ['', '', '', '', '', '']));
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtpNotice, setDevOtpNotice] = useState(() => (isDemoMode ? 'Demo Master OTP: 123456' : ''));

  const inputRefs = useRef([]);

  // Ensure clean slate during OTP verification step
  useEffect(() => {
    clearFarmerSession();
  }, [clearFarmerSession]);

  // Auto-fill devOtp if demo mode is enabled
  useEffect(() => {
    if (isDemoMode && initialDevOtp && initialDevOtp.length === 6) {
      setOtp(initialDevOtp.split(''));
    }
  }, [isDemoMode, initialDevOtp]);

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
      if (interval) clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError('');

    // Auto advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const newOtp = pasted.split('');
      while (newOtp.length < 6) newOtp.push('');
      setOtp(newOtp);
      const nextIndex = Math.min(pasted.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const fullOtp = otp.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter the full 6-digit OTP');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      await farmerOtpVerify({
        phone,
        otp: fullOtp,
        name,
        preferredLanguage,
        registeredVia: 'app',
        passcode,
        mode,
      });

      navigate('/farmer/command-center');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    try {
      setIsLoading(true);
      setError('');
      const res = await farmerOtpRequest({
        phone,
        name,
        preferredLanguage,
        registeredVia: 'app',
        passcode,
        mode,
      });
      const newDevOtp = res?.data?.otp || res?.otp;
      if (newDevOtp) {
        setDevOtpNotice(`New Demo OTP: ${newDevOtp}`);
        setOtp(newDevOtp.split(''));
      }
      setTimer(30);
      setCanResend(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to resend OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900/60 flex items-center justify-center p-0 sm:p-4">
      <div className="max-w-md w-full min-h-screen sm:min-h-0 sm:rounded-3xl bg-slate-950 text-slate-100 shadow-glass-dark border border-slate-800/80 p-6 flex flex-col justify-between relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none" />

        <div>
          {/* Back button */}
          <div className="flex items-center justify-between mb-6">
            <Link
              to="/farmer-login"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>बदला / Change Number</span>
            </Link>
          </div>

          <div className="mb-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">ओटीपी पडताळणी / Verify OTP</h1>
            <p className="text-xs text-slate-400">
              Enter the 6-digit verification code sent to <br />
              <span className="font-semibold text-emerald-400">+91 {phone}</span>
            </p>
          </div>

          {/* Dev OTP Helper Banner */}
          {devOtpNotice && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{devOtpNotice} (Auto-filled for testing)</span>
            </div>
          )}

          {/* 6 Digit OTP Inputs */}
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="flex justify-between gap-2 my-4" onPaste={handlePaste}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl bg-slate-950/80 border ${
                    error ? 'border-rose-500' : digit ? 'border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/20' : 'border-slate-800 text-slate-100'
                  } focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 transition-all`}
                />
              ))}
            </div>

            {error && (
              <p className="text-xs text-rose-400 font-medium text-center flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={isLoading}
              disabled={otp.join('').length !== 6}
            >
              Verify & Enter Mandi / पडताळणी करा
            </Button>
          </form>

          {/* Resend Timer */}
          <div className="mt-6 text-center">
            {canResend ? (
              <button
                type="button"
                onClick={handleResendOtp}
                className="text-xs text-emerald-400 font-semibold hover:underline inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                <span>पुन्हा पाठवा / Resend OTP</span>
              </button>
            ) : (
              <p className="text-xs text-slate-500">
                Resend code in <span className="font-semibold text-slate-300">{timer}s</span>
              </p>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 pt-4 border-t border-slate-900 text-center text-[11px] text-slate-500">
          Having trouble? Ask the mandi gate operator for assisted check-in.
        </div>
      </div>
    </div>
  );
}
