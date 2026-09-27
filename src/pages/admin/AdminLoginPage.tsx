import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Lock, User, KeyRound, Eye, EyeOff, ShieldAlert, CheckCircle2, Tv, Mail } from 'lucide-react';
import { MHCLogo } from '../../components/common/MHCLogo';

export const AdminLoginPage: React.FC = () => {
  const { login, loginWithUsernameAndPin, resetPassword, settings } = useApp();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Optional email login & reset modes
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEmailMode) {
      if (!email.trim() || !password.trim()) {
        setError('Please enter your email and password.');
        return;
      }
    } else {
      if (!username.trim() || !pin.trim()) {
        setError('Please enter your user name and PIN.');
        return;
      }
    }

    const finalUser = isEmailMode ? email.trim() : username.trim();
    const finalSecret = isEmailMode ? password.trim() : pin.trim();

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!isEmailMode) {
        try {
          const userRec = await loginWithUsernameAndPin(finalUser, finalSecret);
          const hasAdminOrSupervisorRole =
            userRec.role !== 'staff' ||
            userRec.roles?.some((r) => r === 'supervisor' || r === 'admin' || r === 'roster_manager');

          if (hasAdminOrSupervisorRole) {
            navigate('/admin/dashboard');
          } else {
            navigate('/staff');
          }
          return;
        } catch (pinErr: any) {
          try {
            await login(finalUser, finalSecret);
            navigate('/admin/dashboard');
            return;
          } catch {
            setError(pinErr.message || 'Invalid username or PIN passcode.');
            return;
          }
        }
      }

      await login(finalUser, finalSecret);
      navigate('/admin/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.message) {
        setError(err.message);
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Invalid credentials. Please verify your login credentials.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please wait a moment before retrying.');
      } else {
        setError('Authentication failed. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your administrator email address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await resetPassword(email.trim());
      setSuccessMessage('Password reset link has been dispatched to your email address.');
      setIsResetMode(false);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 sm:p-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
        <Link to="/display" className="flex items-center gap-3">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.orgName}
              className="h-10 w-10 object-contain rounded-lg bg-white p-0.5 border border-slate-800 shadow-xs"
              referrerPolicy="no-referrer"
            />
          ) : (
            <MHCLogo className="h-10 w-10 rounded-lg bg-white p-0.5 border border-slate-800 shadow-xs" />
          )}
          <div>
            <h1 className="font-bold text-sm text-white">{settings.orgName}</h1>
            <p className="text-[11px] text-slate-400">Staff Leave &amp; Noticeboard System</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/staff"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 transition flex items-center gap-1.5 border border-teal-500/30"
          >
            <span>Staff Portal &rarr;</span>
          </Link>

          <Link
            to="/display"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition flex items-center gap-1.5 border border-slate-800"
          >
            <Tv className="w-3.5 h-3.5 text-teal-400" />
            <span>Open TV Display</span>
          </Link>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md mx-auto w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm my-8">
        <div className="text-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            {isResetMode ? 'Reset Administrator Password' : 'Administrator Portal'}
          </h2>
          <p className="text-xs text-slate-400 mt-1.5">
            {isResetMode
              ? 'Enter your registered email to receive a recovery link.'
              : 'Sign in with your User Name and PIN to access the administrative console.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Username & PIN Login Form (Primary) */}
        {!isResetMode && !isEmailMode && (
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username Input */}
            <div>
              <label htmlFor="admin-username" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                User Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  id="admin-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter user name"
                  autoFocus
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl text-sm font-medium text-white focus:outline-none transition"
                />
              </div>
            </div>

            {/* PIN Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="admin-pin" className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  PIN
                </label>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-[11px] text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1 cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPin ? 'Hide PIN' : 'Show PIN'}</span>
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  id="admin-pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl text-sm font-mono tracking-widest text-white focus:outline-none transition"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-lg shadow-teal-900/40 transition flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {loading ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Email & Password Fallback Form */}
        {!isResetMode && isEmailMode && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl text-sm text-white focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="login-password" className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(true);
                    setError(null);
                  }}
                  className="text-[11px] text-teal-400 hover:text-teal-300 font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl text-sm text-white focus:outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-lg shadow-teal-900/40 transition flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Sign In with Email</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Toggle between PIN and Email */}
        {!isResetMode && (
          <div className="mt-4 flex items-center justify-center text-xs text-slate-400">
            <button
              type="button"
              onClick={() => {
                setIsEmailMode(!isEmailMode);
                setError(null);
              }}
              className="text-slate-400 hover:text-teal-300 transition text-[11px] cursor-pointer"
            >
              {isEmailMode ? '← Use User Name & PIN instead' : 'Use Email & Password instead →'}
            </button>
          </div>
        )}

        {/* Reset Password Form */}
        {isResetMode && (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Registered Administrator Email
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mhc.gov.mv"
                required
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl text-sm text-white focus:outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-lg transition"
            >
              Send Password Reset Link
            </button>

            <button
              type="button"
              onClick={() => {
                setIsResetMode(false);
                setError(null);
              }}
              className="w-full text-xs text-slate-400 hover:text-white py-1 transition text-center"
            >
              Back to Login
            </button>
          </form>
        )}
      </div>

      {/* Footer text */}
      <div className="max-w-4xl mx-auto w-full text-center text-xs text-slate-500">
        <p>
          Maduvvari Health Centre &bull; Secure Administrative Console &bull; Cloud Firestore &amp; Firebase Authentication
        </p>
      </div>
    </div>
  );
};
