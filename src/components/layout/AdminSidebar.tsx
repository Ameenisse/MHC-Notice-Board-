import React from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Bell,
  Settings,
  Tv,
  LogOut,
  X,
  Shield,
  FileSpreadsheet,
  Camera,
  Sun,
  Moon,
  KeyRound,
  ClipboardList,
  Film,
  History,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Home,
  Database,
} from 'lucide-react';
import { MHCLogo } from '../common/MHCLogo';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    adminProfile,
    appUser,
    logout,
    logoutAppUser,
    settings,
    toggleThemeMode,
  } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    logoutAppUser();
    await logout();
    navigate('/admin');
  };

  const navGroups = [
    {
      group: 'Operations',
      items: [
        { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/admin/roster', label: 'Duty Rosters & Supervisors', icon: FileSpreadsheet },
        { to: '/admin/supervisors-handover', label: 'Supervisors & Handover', icon: ClipboardList },
        { to: '/admin/staff', label: 'Staff Directory', icon: Users },
        { to: '/admin/leave', label: 'Leave Records', icon: CalendarDays },
      ],
    },
    {
      group: 'Notices & Media',
      items: [
        { to: '/admin/notices', label: 'Notices & Announcements', icon: Bell },
        { to: '/admin/daily-media', label: 'Media of the Day', icon: Film },
        { to: '/admin/memories', label: 'Memories & Posts', icon: Camera },
      ],
    },
    {
      group: 'Governance & Administration',
      items: [
        {
          to: '/admin/super-admin',
          label: 'Super Admin Panel',
          icon: ShieldAlert,
          badge: 'appadmin',
          highlight: true,
        },
        { to: '/admin/users', label: 'User & PIN Management', icon: KeyRound },
        { to: '/admin/settings', label: 'Operational Settings', icon: Settings },
      ],
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 select-none">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3">
        <Link
          to="/admin/dashboard"
          onClick={onClose}
          className="flex items-center gap-3 group min-w-0"
        >
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.orgName}
              className="h-10 w-10 object-contain rounded-xl bg-white p-1 border border-slate-700 shadow-sm shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <MHCLogo className="h-10 w-10 rounded-xl bg-white p-1 border border-slate-700 shadow-sm shrink-0" />
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-white font-black text-sm tracking-tight truncate group-hover:text-teal-400 transition">
              {settings.orgName}
            </span>
            <span className="text-[11px] text-teal-400 font-bold uppercase tracking-wider">
              Admin Portal
            </span>
          </div>
        </Link>

        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* User Session Info Card */}
      <div className="px-4 py-3.5 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-slate-950 font-black text-sm flex items-center justify-center shrink-0 shadow-md">
            {(appUser?.fullName || adminProfile?.name || currentUser?.email || 'A')
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-white truncate">
                {appUser ? appUser.fullName : adminProfile?.name || currentUser?.email || 'Admin'}
              </span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Session Active" />
            </div>
            <p className="text-[10px] font-bold text-teal-300 uppercase tracking-wider truncate">
              {appUser
                ? `${appUser.role.replace('_', ' ')} (${appUser.departmentName || 'All'})`
                : adminProfile?.role || 'Administrator'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
        {navGroups.map((group) => (
          <div key={group.group} className="space-y-1">
            <h3 className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
              {group.group}
            </h3>
            <div className="space-y-0.5 pt-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 group ${
                      isActive
                        ? (item as any).highlight
                          ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                          : 'bg-teal-500 text-slate-950 shadow-md font-black'
                        : (item as any).highlight
                        ? 'text-amber-300 hover:text-amber-200 hover:bg-amber-950/30 border border-amber-500/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition ${
                          isActive
                            ? 'text-slate-950 stroke-[2.5]'
                            : (item as any).highlight
                            ? 'text-amber-400'
                            : 'text-slate-400 group-hover:text-teal-300'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {(item as any).badge && !isActive && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {(item as any).badge}
                      </span>
                    )}
                    {isActive && (
                      <ChevronRight className="w-3.5 h-3.5 stroke-[3] text-slate-950 shrink-0" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}

        {/* External Portals & Live Displays */}
        <div className="space-y-1 pt-2 border-t border-slate-800/80">
          <h3 className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Portals &amp; Navigation
          </h3>
          <div className="space-y-1 pt-1">
            <Link
              to="/display"
              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition group"
            >
              <div className="flex items-center gap-2.5">
                <Home className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Return to Home / Display</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400" />
            </Link>

            <Link
              to="/display"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition group"
            >
              <div className="flex items-center gap-2.5">
                <Tv className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Live TV Display Screen</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400" />
            </Link>

            <Link
              to="/staff"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition group"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Staff Portal</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {/* Day/Night Quick Switch */}
          <button
            onClick={() => toggleThemeMode()}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
            title={`Toggle TV Theme Mode (Currently ${settings.themeMode === 'day' ? 'Day' : 'Night'})`}
          >
            {settings.themeMode === 'day' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Day Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Night Mode</span>
              </>
            )}
          </button>

          {/* Quick Home Link */}
          <Link
            to="/display"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Return to Home Display"
          >
            <Home className="w-3.5 h-3.5 text-teal-400" />
            <span>Home</span>
          </Link>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out Session</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 border-r border-slate-800 sticky top-0 h-screen z-30 shadow-lg">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Container */}
          <div className="relative flex flex-col w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
