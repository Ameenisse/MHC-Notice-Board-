import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { verifyPairingCodeAndRegisterDisplay } from '../../services/db';
import { Tv, KeyRound, ShieldCheck, ArrowRight, Lock, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MHCLogo } from '../../components/common/MHCLogo';

interface PairingScreenProps {
  onPairedSuccess: () => void;
}

export const PairingScreen: React.FC<PairingScreenProps> = ({ onPairedSuccess }) => {
  const { setTvSession, settings } = useApp();
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('Main TV Display');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter the 6-character pairing code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const deviceInfo = `${navigator.userAgent} (${window.innerWidth}x${window.innerHeight})`;
      const result = await verifyPairingCodeAndRegisterDisplay(
        code.trim().toUpperCase(),
        displayName.trim() || 'Health Centre Display',
        deviceInfo,
        false
      );
      setTvSession(result.token);
      onPairedSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to verify pairing code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-6 sm:p-12">
      {/* Top Header */}
      <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-3">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.orgName}
              className="h-12 w-12 object-contain rounded-xl bg-white p-0.5 border border-slate-700 shadow-sm"
              referrerPolicy="no-referrer"
            />
          ) : (
            <MHCLogo className="h-12 w-12 rounded-xl bg-white p-0.5 border border-slate-700 shadow-sm" />
          )}
          <div>
            <h1 className="font-bold text-lg text-white">{settings.orgName}</h1>
            <p className="text-xs text-slate-400">TV Display Terminal Setup</p>
          </div>
        </div>

        <Link
          to="/admin"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5"
        >
          <Lock className="w-3.5 h-3.5 text-teal-400" />
          Admin Login
        </Link>
      </div>

      {/* Main Pairing Card */}
      <div className="max-w-md mx-auto w-full bg-slate-800/80 border border-slate-700/80 rounded-2xl p-8 shadow-2xl backdrop-blur-sm my-8">
        <div className="text-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-4">
            <Tv className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Pair This TV Screen</h2>
          <p className="text-sm text-slate-300 mt-2">
            Enter the 6-character pairing code generated from the Admin Panel Settings.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pairing-code" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Pairing Code
            </label>
            <input
              id="pairing-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. MHC742"
              maxLength={8}
              autoFocus
              className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 focus:border-teal-500 rounded-xl text-center text-2xl font-mono font-bold tracking-widest text-amber-400 focus:outline-none uppercase transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Admin &rarr; Settings &rarr; Paired Displays &rarr; "Generate Pairing Code"
            </p>
          </div>

          <div>
            <label htmlFor="display-name" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Screen Name / Location
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Reception TV, OPD Waiting Hall"
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 focus:border-teal-500 rounded-xl text-sm text-white focus:outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-lg shadow-teal-900/40 transition flex items-center justify-center gap-2 mt-6 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">Connecting display...</span>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                <span>Authorize & Activate Display</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer Info */}
      <div className="max-w-4xl mx-auto w-full text-center text-xs text-slate-400">
        <p>
          Secure Read-Only Terminal &bull; Displays only approved public leave and notice information.
          No private health or administrative notes are transmitted to this monitor.
        </p>
      </div>
    </div>
  );
};
