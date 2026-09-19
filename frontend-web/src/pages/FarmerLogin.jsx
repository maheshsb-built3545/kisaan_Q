import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sprout, Phone, User, Lock, Globe, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import Input from '../components/common/Input';
import Button from '../components/common/Button';

export default function FarmerLogin() {
  const navigate = useNavigate();
  const { farmerOtpRequest, clearFarmerSession } = useAuth();

  const [phone, setPhone] = useState('');
  const [passcode, setPasscode] = useState('');
  const [name, setName] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('mr');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Clear any existing stale farmer session on mount
  React.useEffect(() => {
    clearFarmerSession();
  }, [clearFarmerSession]);

  const validatePhone = (num) => {
    return /^[6-9]\d{9}$/.test(num.trim());
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setError('Please enter your 10-digit mobile number');
      return;
    }

    if (!validatePhone(cleanPhone)) {
      setError('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210)');
      return;
    }

    const cleanPasscode = passcode.trim();
    if (!cleanPasscode) {
      setError('Please enter your Passcode / PIN');
      return;
    }

    try {
      setIsLoading(true);
      const res = await farmerOtpRequest({
        phone: cleanPhone,
        name: name.trim() || undefined,
        preferredLanguage,
        registeredVia: 'app',
        passcode: cleanPasscode,
        mode: 'login',
      });

      const devOtp = res?.data?.devOtp || res?.devOtp || res?.data?.otp || res?.otp;

      navigate('/otp-verify', {
        state: {
          phone: cleanPhone,
          name: name.trim() || undefined,
          preferredLanguage,
          devOtp,
          passcode: cleanPasscode,
          mode: 'login',
        },
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to send OTP. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const quickFill = (demoPhone, demoName, demoPasscode = '123456') => {
    setPhone(demoPhone);
    setName(demoName);
    setPasscode(demoPasscode);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-900/60 flex items-center justify-center p-0 sm:p-4">
      <div className="max-w-md w-full min-h-screen sm:min-h-0 sm:rounded-3xl bg-slate-950 text-slate-100 shadow-glass-dark border border-slate-800/80 p-6 flex flex-col justify-between relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none" />

        {/* Header */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <Link to="/" className="inline-flex items-center gap-2 text-white">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center">
                <Sprout className="w-5 h-5 text-slate-950" />
              </div>
              <span className="font-bold text-lg">Kisan<span className="text-emerald-400">Q</span></span>
            </Link>

            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
              <Globe className="w-3 h-3 text-slate-400 ml-1" />
              <button
                type="button"
                onClick={() => setPreferredLanguage('mr')}
                className={`px-1.5 py-0.5 rounded ${preferredLanguage === 'mr' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400'}`}
              >
                मराठी
              </button>
              <button
                type="button"
                onClick={() => setPreferredLanguage('hi')}
                className={`px-1.5 py-0.5 rounded ${preferredLanguage === 'hi' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400'}`}
              >
                हिंदी
              </button>
              <button
                type="button"
                onClick={() => setPreferredLanguage('en')}
                className={`px-1.5 py-0.5 rounded ${preferredLanguage === 'en' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400'}`}
              >
                EN
              </button>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">शेतकरी लॉगिन / Farmer Login</h1>
            <p className="text-xs text-slate-400">
              Enter your mobile number to get a verification code for booking and tracking slots.
            </p>
          </div>

          {/* Unregistered or General Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1.5">
              <p className="font-medium">{error}</p>
              {(error.toLowerCase().includes('not registered') || error.toLowerCase().includes('register')) && (
                <Link
                  to="/?tab=register"
                  className="inline-flex items-center gap-1 font-bold text-emerald-400 hover:text-emerald-300 hover:underline"
                >
                  <span>→ नवीन नोंदणी करा / Register New Farmer</span>
                </Link>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSendOtp} className="space-y-4">
            <Input
              label="मोबाईल नंबर / Mobile Number"
              type="tel"
              required
              placeholder="e.g. 9876543210"
              icon={Phone}
              value={phone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setPhone(val);
                if (error) setError('');
              }}
              error={error && !error.toLowerCase().includes('not registered') && !error.toLowerCase().includes('passcode') && !error.toLowerCase().includes('pin') ? error : ''}
              helperText="10-digit mobile number linked to your slot booking"
            />

            <Input
              label="पासवर्ड / पिन / Passcode / PIN"
              type="password"
              required
              placeholder="••••••"
              icon={Lock}
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                if (error) setError('');
              }}
              helperText="Enter your 4-6 digit account passcode"
            />

            <Input
              label="शेतकऱ्याचे नाव / Full Name (Optional)"
              type="text"
              placeholder="e.g. Ramesh Patil"
              icon={User}
              value={name}
              onChange={(e) => setName(e.target.value)}
              helperText="Optional for identification"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
              rightIcon={ArrowRight}
            >
              Get OTP / ओटीपी मिळवा
            </Button>
          </form>

          {/* Quick Demo Fill Buttons (Gated for Judge Demos) */}
          {(import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true' || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'true')) && (
            <div className="mt-6 pt-4 border-t border-slate-900">
              <div className="text-[11px] font-medium text-slate-400 mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Quick Demo Farmers:</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => quickFill('9876543210', 'Ramesh Patil', '123456')}
                  className="text-left p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 text-xs transition-colors"
                >
                  <div className="font-semibold text-slate-200">Ramesh Patil</div>
                  <div className="text-[10px] text-slate-500">9876543210 (Nashik)</div>
                </button>
                <button
                  type="button"
                  onClick={() => quickFill('9823012345', 'Suresh Jadhav', '123456')}
                  className="text-left p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 text-xs transition-colors"
                >
                  <div className="font-semibold text-slate-200">Suresh Jadhav</div>
                  <div className="text-[10px] text-slate-500">9823012345 (Lasalgaon)</div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 pt-4 border-t border-slate-900 text-center">
          <p className="text-[11px] text-slate-500">
            Are you a mandi official?{' '}
            <Link to="/staff-login" className="text-emerald-400 font-medium hover:underline inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Staff Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
