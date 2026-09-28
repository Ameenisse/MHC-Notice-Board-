import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  getAuditLogsList,
  getSettings,
  uploadFile,
  compressImage,
  resetDatabaseAndSync,
  getStaffList,
  getLeaveRecordsList,
  getNoticesList,
  getCategoriesList,
  getDepartmentsList,
  getPairedDisplaysList,
} from '../../services/db';
import { AuditLog, AppSettings, Staff } from '../../types';
import { MHCLogo } from '../../components/common/MHCLogo';
import {
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  History,
  Database,
  Building,
  Upload,
  FileDown,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Loader2,
  Search,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  LogOut,
  Sliders,
  Check,
  FileText,
  Home,
  RefreshCw,
} from 'lucide-react';

export const SuperAdminPage: React.FC = () => {
  const {
    settings,
    updateAppSettings,
    refreshSettings,
    currentUser,
    adminProfile,
    appUser,
    loginWithUsernameAndPin,
    isDemoMode,
  } = useApp();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'identity' | 'audit' | 'database'>(
    initialTabParam === 'audit'
      ? 'audit'
      : initialTabParam === 'database' || initialTabParam === 'data'
      ? 'database'
      : 'identity'
  );

  // Check if current user is super admin
  const isSuperAdminUser =
    appUser?.username === 'appadmin' ||
    appUser?.roles?.includes('super_admin') ||
    adminProfile?.role === 'super_admin';

  // Super Admin Gate State
  const [gateUsername, setGateUsername] = useState('appadmin');
  const [gatePin, setGatePin] = useState('');
  const [gateShowPin, setGateShowPin] = useState(false);
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  // Identity Form State
  const [orgName, setOrgName] = useState(settings.orgName || 'Maduvvari Health Centre');
  const [orgNameDhivehi, setOrgNameDhivehi] = useState(settings.orgNameDhivehi || 'މަޑުއްވަރީ ސިއްޙީ މަރުކަޒު');
  const [boardTitle, setBoardTitle] = useState(settings.boardTitle || 'Staff on Leave');
  const [boardTitleDhivehi, setBoardTitleDhivehi] = useState(settings.boardTitleDhivehi || 'ޗުއްޓީގައިވާ މުވައްޒަފުން');
  const [timezone, setTimezone] = useState(settings.timezone || 'Indian/Maldives');
  const [clockFormat, setClockFormat] = useState<'12h' | '24h'>(settings.clockFormat || '12h');
  const [dateFormat, setDateFormat] = useState(settings.dateFormat || 'dd/MM/yyyy');
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '/mhc-logo.svg');
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [identitySuccess, setIdentitySuccess] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isDragOverLogo, setIsDragOverLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState('all');
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Database & Backup State
  const [resettingDb, setResettingDb] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [importingBackup, setImportingBackup] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  // Load audit logs and settings
  const loadSuperAdminData = async () => {
    setLoadingAudit(true);
    try {
      const logs = await getAuditLogsList(isDemoMode);
      setAuditLogs(logs);
    } catch (err) {
      console.warn('Error loading audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (isSuperAdminUser) {
      loadSuperAdminData();
    }
  }, [isSuperAdminUser, isDemoMode]);

  useEffect(() => {
    if (settings) {
      setOrgName(settings.orgName || 'Maduvvari Health Centre');
      setOrgNameDhivehi(settings.orgNameDhivehi || 'މަޑުއްވަރީ ސިއްޙީ މަރުކަޒު');
      setBoardTitle(settings.boardTitle || 'Staff on Leave');
      setBoardTitleDhivehi(settings.boardTitleDhivehi || 'ޗުއްޓީގައިވާ މުވައްޒަފުން');
      setTimezone(settings.timezone || 'Indian/Maldives');
      setClockFormat(settings.clockFormat || '12h');
      setDateFormat(settings.dateFormat || 'dd/MM/yyyy');
      setLogoUrl(settings.logoUrl || '/mhc-logo.svg');
    }
  }, [settings]);

  // Handle Tab Select
  const handleTabSelect = (tab: 'identity' | 'audit' | 'database') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Super Admin Gate Verification
  const handleGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateLoading(true);
    setGateError(null);
    try {
      await loginWithUsernameAndPin(gateUsername.trim(), gatePin.trim());
      await loadSuperAdminData();
    } catch (err: any) {
      setGateError(err?.message || 'Invalid Super Admin username or PIN passcode.');
    } finally {
      setGateLoading(false);
    }
  };

  // Save Institutional Identity
  const handleSaveIdentity = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingIdentity(true);
    setIdentityError(null);
    setIdentitySuccess(null);

    try {
      await updateAppSettings({
        orgName: orgName.trim(),
        orgNameDhivehi: orgNameDhivehi.trim(),
        boardTitle: boardTitle.trim(),
        boardTitleDhivehi: boardTitleDhivehi.trim(),
        timezone,
        clockFormat,
        dateFormat,
        logoUrl,
      });
      setIdentitySuccess('Institutional Identity updated successfully.');
      setTimeout(() => setIdentitySuccess(null), 4000);
    } catch (err: any) {
      setIdentityError(err.message || 'Failed to update institutional identity.');
    } finally {
      setSavingIdentity(false);
    }
  };

  // Logo file processor
  const handleLogoFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Logo file size exceeds 5MB limit.');
      return;
    }
    setUploadingLogo(true);
    setLogoError(null);
    try {
      let finalUrl = '';
      if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        finalUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        const compressed = await compressImage(file, 400, 0.9);
        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        const uploadable = new File([compressed], file.name, {
          type: isPng ? 'image/png' : 'image/jpeg',
        });
        finalUrl = await uploadFile(uploadable, 'logos', `logo_${Date.now()}.${isPng ? 'png' : 'jpg'}`, isDemoMode);
      }
      setLogoUrl(finalUrl);
      await updateAppSettings({ logoUrl: finalUrl });
      setIdentitySuccess('Organization logo updated.');
      setTimeout(() => setIdentitySuccess(null), 3500);
    } catch (err: any) {
      setLogoError(err?.message || 'Failed to upload logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Export Complete System Backup
  const handleExportBackup = async () => {
    try {
      const [cats, depts, staffs, leaves, currentNotices, currentSettings, logs, displays] =
        await Promise.all([
          getCategoriesList(isDemoMode),
          getDepartmentsList(isDemoMode),
          getStaffList(isDemoMode),
          getLeaveRecordsList(isDemoMode),
          getNoticesList(isDemoMode),
          getSettings(isDemoMode),
          getAuditLogsList(isDemoMode),
          getPairedDisplaysList(isDemoMode),
        ]);

      const backupData = {
        metadata: {
          system: 'MHC Staff Leave & Noticeboard System',
          exportedAt: new Date().toISOString(),
          exportedBy: appUser?.username || currentUser?.email || 'appadmin',
          version: '2.0.0',
        },
        settings: currentSettings,
        categories: cats,
        departments: depts,
        staff: staffs,
        leaves,
        notices: currentNotices,
        displays,
        auditLogs: logs,
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MHC_Full_System_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Restore from Backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Warning: Restoring backup will overwrite existing application data. Continue?')) {
      e.target.value = '';
      return;
    }

    setImportingBackup(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.metadata || (!data.staff && !data.categories && !data.settings)) {
        throw new Error('Invalid backup file format. Expected MHC System Backup JSON.');
      }

      await resetDatabaseAndSync(
        currentUser?.email || appUser?.email || 'appadmin@mhc.gov.mv',
        isDemoMode
      );

      if (data.settings) {
        await updateAppSettings(data.settings);
      }

      setImportSuccess('System restored successfully from backup!');
      setTimeout(() => setImportSuccess(null), 5000);
      loadSuperAdminData();
    } catch (err: any) {
      setImportError(err.message || 'Failed to restore backup.');
    } finally {
      setImportingBackup(false);
      e.target.value = '';
    }
  };

  // Reset Database
  const handleResetDatabase = async () => {
    const confirmPhrase = prompt(
      'DANGER ZONE: This will wipe all staff records, leaves, rosters, notices, and audit records.\nType "RESET" to confirm:'
    );
    if (confirmPhrase !== 'RESET') {
      return;
    }

    setResettingDb(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      await resetDatabaseAndSync(
        currentUser?.email || appUser?.email || 'appadmin@mhc.gov.mv',
        isDemoMode
      );
      setResetSuccess('Database wiped and reset to clean baseline.');
      setTimeout(() => setResetSuccess(null), 4000);
      loadSuperAdminData();
    } catch (err: any) {
      setResetError(err.message || 'Database reset failed.');
    } finally {
      setResettingDb(false);
    }
  };

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    const term = auditSearch.toLowerCase();
    const matchesSearch =
      !term ||
      log.action.toLowerCase().includes(term) ||
      log.performedBy.toLowerCase().includes(term) ||
      log.details.toLowerCase().includes(term) ||
      (log.targetType && log.targetType.toLowerCase().includes(term));

    const matchesAction = auditFilterAction === 'all' || log.action === auditFilterAction;
    return matchesSearch && matchesAction;
  });

  // Unique actions for filtering
  const uniqueActions = Array.from(new Set(auditLogs.map((l) => l.action))).filter(Boolean);

  // =========================================================================
  // GATE SCREEN (If user is not verified as Super Admin)
  // =========================================================================
  if (!isSuperAdminUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 sm:py-24">
        <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden text-slate-100">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500" />

          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <ShieldAlert className="w-9 h-9" />
            </div>
            <div className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 mb-2">
              Super Admin Authentication Required
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Restricted Super Admin Area
            </h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Institutional Identity, Administrative Audit Trail, and Database Backup/Restore require in-built Super Admin privileges.
            </p>
          </div>

          {gateError && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-semibold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{gateError}</span>
            </div>
          )}

          <form onSubmit={handleGateSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Super Admin Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={gateUsername}
                  onChange={(e) => setGateUsername(e.target.value)}
                  placeholder="e.g. appadmin"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm font-bold focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Super Admin PIN Passcode
                </label>
                <span className="text-[11px] text-slate-500">In-built Passcode</span>
              </div>
              <div className="relative">
                <input
                  type={gateShowPin ? 'text' : 'password'}
                  inputMode="numeric"
                  value={gatePin}
                  onChange={(e) => setGatePin(e.target.value)}
                  placeholder="Enter 4-digit PIN"
                  maxLength={12}
                  required
                  className="w-full pl-4 pr-11 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm font-bold tracking-widest focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                />
                <button
                  type="button"
                  onClick={() => setGateShowPin(!gateShowPin)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                  tabIndex={-1}
                >
                  {gateShowPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={gateLoading}
              className="w-full mt-3 py-3 px-4 rounded-xl text-sm font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {gateLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Super Admin...</span>
                </>
              ) : (
                <>
                  <span>Unlock Super Admin Panel</span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span className="font-bold text-slate-300">In-Built Super Admin:</span>
              <span className="font-mono text-amber-400 font-bold">User: appadmin &bull; PIN: 2026</span>
            </div>
            <Link
              to="/admin/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mt-4 transition"
            >
              <span>&larr; Back to Regular Admin Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN SUPER ADMIN PANEL
  // =========================================================================
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-rose-500 to-teal-400" />

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-500/50 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950">
                Super Admin Panel
              </span>
              <span className="text-xs font-mono text-slate-400 font-bold">
                Logged in as @{appUser?.username || 'appadmin'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
              System Administration &amp; Governance
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5 font-medium">
              Institutional Identity, Administrative Audit Trail, and System Database &amp; Backups
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/display"
            className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
            title="Return to TV Display / Home"
          >
            <Home className="w-3.5 h-3.5 text-teal-400" />
            <span>Home</span>
          </Link>

          <button
            type="button"
            onClick={handleExportBackup}
            className="px-4 py-2.5 rounded-xl text-xs font-black bg-amber-500 text-slate-950 hover:bg-amber-400 transition flex items-center gap-2 shadow-md cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>Export Backup</span>
          </button>

          <Link
            to="/admin/settings"
            className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-teal-400" />
            <span>Regular Settings</span>
          </Link>
        </div>
      </div>

      {/* Super Admin Navigation Tabs (The 3 Moved Sections) */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleTabSelect('identity')}
          className={`flex-1 min-w-[200px] px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2.5 transition cursor-pointer ${
            activeTab === 'identity'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4 shrink-0" />
          <span>Institutional Identity</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSelect('audit')}
          className={`flex-1 min-w-[200px] px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2.5 transition cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4 shrink-0" />
          <span>Audit Logs ({auditLogs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSelect('database')}
          className={`flex-1 min-w-[200px] px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2.5 transition cursor-pointer ${
            activeTab === 'database'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4 shrink-0" />
          <span>Database &amp; Backup</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: INSTITUTIONAL IDENTITY
          ===================================================================== */}
      {activeTab === 'identity' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-amber-600" />
                <span>Institutional Identity &amp; Branding</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure official health centre names, Thaana representations, and television header titles.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleSaveIdentity()}
              disabled={savingIdentity}
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {savingIdentity ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Institutional Identity</span>
                </>
              )}
            </button>
          </div>

          {identitySuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{identitySuccess}</span>
            </div>
          )}

          {identityError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{identityError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Organization Name (English) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-700">
                Official Facility Name (English)
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Maduvvari Health Centre"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
              <span className="text-[11px] text-slate-400">
                Displayed across headers, reports, and paired TV screens.
              </span>
            </div>

            {/* Organization Name (Dhivehi) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-700">
                Official Facility Name (ދިވެހި / Thaana)
              </label>
              <input
                type="text"
                dir="rtl"
                value={orgNameDhivehi}
                onChange={(e) => setOrgNameDhivehi(e.target.value)}
                placeholder="މަޑުއްވަރީ ސިއްޙީ މަރުކަޒު"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-thaana font-bold text-base text-slate-900 focus:bg-white focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-right"
              />
              <span className="text-[11px] text-slate-400">
                Preserved across all television board headers and Dhivehi layouts.
              </span>
            </div>

            {/* Board Title (English) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-700">
                TV Display Board Title (English)
              </label>
              <input
                type="text"
                value={boardTitle}
                onChange={(e) => setBoardTitle(e.target.value)}
                placeholder="e.g. Staff on Leave / Duty Board"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            {/* Board Title (Dhivehi) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-700">
                TV Display Board Title (ދިވެހި / Thaana)
              </label>
              <input
                type="text"
                dir="rtl"
                value={boardTitleDhivehi}
                onChange={(e) => setBoardTitleDhivehi(e.target.value)}
                placeholder="ޗުއްޓީގައިވާ މުވައްޒަފުން"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-thaana font-bold text-base text-slate-900 focus:bg-white focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-right"
              />
            </div>

            {/* Timezone */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-700">
                Facility Operational Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:border-teal-500"
              >
                <option value="Indian/Maldives">Maldives Time (UTC+05:00)</option>
                <option value="Asia/Colombo">Sri Lanka Time (UTC+05:30)</option>
                <option value="UTC">Coordinated Universal Time (UTC)</option>
              </select>
            </div>

            {/* Clock Format */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-700">
                TV Screen Clock Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setClockFormat('12h')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-black transition cursor-pointer ${
                    clockFormat === '12h'
                      ? 'border-teal-500 bg-teal-50 text-teal-900 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  12-Hour (02:45 PM)
                </button>
                <button
                  type="button"
                  onClick={() => setClockFormat('24h')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-black transition cursor-pointer ${
                    clockFormat === '24h'
                      ? 'border-teal-500 bg-teal-50 text-teal-900 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  24-Hour (14:45)
                </button>
              </div>
            </div>
          </div>

          {/* Logo Management Box */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-900 mb-3">
              Institutional Crest &amp; Logo
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 p-2 shadow-xs flex items-center justify-center shrink-0">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <MHCLogo className="w-16 h-16" />
                )}
              </div>

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <p className="text-xs font-bold text-slate-700">
                  Upload Official Emblem (SVG, PNG, WebP or JPEG)
                </p>
                <p className="text-[11px] text-slate-500">
                  Vector SVG or high-resolution PNG with transparent background recommended.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1 justify-center sm:justify-start">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".svg,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleLogoFile(e.target.files[0]);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingLogo ? 'Uploading...' : 'Choose Logo File'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLogoUrl('/mhc-logo.svg');
                      updateAppSettings({ logoUrl: '/mhc-logo.svg' });
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Reset Default Emblem
                  </button>
                </div>
                {logoError && <p className="text-xs text-rose-600 font-bold">{logoError}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: AUDIT LOGS
          ===================================================================== */}
      {activeTab === 'audit' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-teal-600" />
                <span>Administrative Audit Trail &amp; Activity Log</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tracks all modifications made to staff records, leave records, duty rosters, notices, and user accounts.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadSuperAdminData}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                title="Refresh audit logs"
              >
                <RefreshCw className={`w-4 h-4 ${loadingAudit ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-3.5 py-2 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export Logs</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px] relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search by user, action, details..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-teal-500"
              />
            </div>

            <select
              value={auditFilterAction}
              onChange={(e) => setAuditFilterAction(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Action Types ({auditLogs.length})</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          {/* Audit Logs Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-600 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4 w-[20%]">Timestamp</th>
                  <th className="py-3 px-3 w-[20%]">Operator / User</th>
                  <th className="py-3 px-3 w-[15%]">Action</th>
                  <th className="py-3 px-3 w-[15%]">Entity</th>
                  <th className="py-3 px-4 w-[30%]">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAuditLogs.length > 0 ? (
                  filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('en-GB')}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 truncate">
                        {log.performedBy}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-600 truncate">
                        {log.targetType || 'System'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 leading-relaxed truncate max-w-xs" title={log.details}>
                        {log.details}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-bold text-sm">No audit logs matching query</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: DATABASE & BACKUP
          ===================================================================== */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          {resetSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{resetSuccess}</span>
            </div>
          )}

          {resetError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{resetError}</span>
            </div>
          )}

          {importSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{importSuccess}</span>
            </div>
          )}

          {importError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{importError}</span>
            </div>
          )}

          {/* Backup & Restore Card */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                <span>Database Export &amp; Backup Restoration</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Download snapshots of all health centre data or restore previous operational archives.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Export Box */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <FileDown className="w-4 h-4 text-teal-600" />
                    <span>Download Full Database Snapshot</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Exports all staff directory profiles, leave records, duty rosters, active notices, paired screens, and settings into a single encrypted JSON file.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-black bg-slate-900 hover:bg-slate-800 text-white transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <FileDown className="w-4 h-4 text-amber-400" />
                  <span>Export JSON Snapshot</span>
                </button>
              </div>

              {/* Restore Box */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-indigo-600" />
                    <span>Restore from Backup File</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Import an exported JSON backup file to restore complete operational records.
                  </p>
                </div>

                <div>
                  <input
                    ref={backupFileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportBackup}
                  />
                  <button
                    type="button"
                    onClick={() => backupFileInputRef.current?.click()}
                    disabled={importingBackup}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {importingBackup ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Restoring Database...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Select JSON Backup File</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone: Database Wipe */}
          <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-6 sm:p-8 space-y-4">
            <div>
              <h2 className="text-base font-black text-rose-950 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <span>Danger Zone: Database Reset &amp; Clean Baseline</span>
              </h2>
              <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                Clears all custom staff records, leave approvals, duty rosters, and resets the database back to clean institutional state. This action is irreversible.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetDatabase}
                disabled={resettingDb}
                className="py-3 px-5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {resettingDb ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resetting Database...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Wipe Database &amp; Clean Baseline</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
