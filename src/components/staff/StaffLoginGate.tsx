import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { MHCLogo } from '../common/MHCLogo';
import {
  Lock,
  User,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  Tv,
  Shield,
  AlertCircle,
  CheckCircle2,
  Building,
  Sparkles,
  Home,
} from 'lucide-react';

interface StaffLoginGateProps {
  onSuccess?: () => void;
}

export const StaffLoginGate: React.FC<StaffLoginGateProps> = ({ onSuccess }) => {
  const { loginWithUsernameAndPin, settings } = useApp();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanPin = pin.trim();

    if (!cleanUser) {
      setErrorMessage('Please enter your Staff Username or Staff ID.');
      return;
    }

    if (!cleanPin) {
      setErrorMessage('Please enter your Security PIN.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await loginWithUsernameAndPin(cleanUser, cleanPin);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.warn('Staff login failed:', err);
      setErrorMessage(
        err?.message ||
          'Invalid Username or PIN passcode. Please verify with your duty supervisor.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      {/* Top Bar with Language and TV display quick link */}
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.orgName}
              className="h-9 w-9 object-contain rounded-xl bg-white p-1 border border-slate-700 shadow-xs"
            />
          ) : (
            <MHCLogo className="h-9 w-9 rounded-xl bg-white p-1 border border-slate-700 shadow-xs" />
          )}
          <span className="text-xs sm:text-sm font-black tracking-tight text-white hidden xs:inline">
            {settings.orgName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/display"
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-teal-300 hover:text-white bg-teal-950/60 hover:bg-teal-900/80 border border-teal-700/60 transition flex items-center gap-1.5 shadow-2xs"
            title="Return to TV Display / Home"
          >
            <Home className="w-3.5 h-3.5 text-teal-400" />
            <span>Home</span>
          </Link>

          <Link
            to="/display"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition flex items-center gap-1.5"
            title="Open Live TV Display in new tab"
          >
            <Tv className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden sm:inline">TV Display</span>
          </Link>

          <Link
            to="/admin"
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 transition flex items-center gap-1.5"
            title="Administrator Login"
          >
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Admin Login</span>
          </Link>
        </div>
      </div>

      {/* Center Auth Card */}
      <div className="max-w-md mx-auto w-full my-auto py-8">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Subtle Decorative Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-2 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500 rounded-full blur-xs opacity-80" />

          {/* Header Icon & Title */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Lock className="w-8 h-8" />
            </div>
            <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/40 mb-2">
              Protected Portal Access
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Staff Portal Sign-In
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              Enter your Staff Username or Staff ID and your Security PIN to view duty schedules, department rosters, and submit duty requests.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username or Staff ID */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Staff Username or Staff ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. MHC-001, admin, or username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm font-semibold focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition"
                />
              </div>
            </div>

            {/* Security PIN */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Security PIN Passcode
                </label>
                <span className="text-[11px] text-slate-500 font-medium">4 to 6 digits</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter security PIN"
                  maxLength={12}
                  required
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm font-mono font-bold tracking-widest focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-black bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-slate-950 shadow-lg hover:shadow-teal-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying PIN...</span>
                </>
              ) : (
                <>
                  <span>Unlock Staff Portal</span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </>
              )}
            </button>
          </form>

          {/* Quick Helper / Demo Credentials */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-300">Quick Access:</span>
              <span className="font-mono text-teal-300 font-bold">User: admin &bull; PIN: 2026</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Contact your department supervisor or health centre administration if you forgot your credentials.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-3 text-xs text-slate-500">
        <p>
          {settings.orgName} &bull; Staff Leave &amp; Noticeboard System &bull; Maldives Time (UTC+05:00)
        </p>
      </footer>
    </div>
  );
};
