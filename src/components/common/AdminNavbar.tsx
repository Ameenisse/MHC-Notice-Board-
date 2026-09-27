import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Bell,
  Settings,
  Tv,
  LogOut,
  Menu,
  X,
  Globe,
  Shield,
  FileSpreadsheet,
  Camera,
  Sun,
  Moon,
  KeyRound,
  ClipboardList,
  Film,
} from 'lucide-react';
import { MHCLogo } from './MHCLogo';
import { PWAInstallButton } from './PWAInstallButton';

export const AdminNavbar: React.FC = () => {
  const {
    currentUser,
    adminProfile,
    appUser,
    logout,
    logoutAppUser,
    settings,
    language,
    setLanguage,
    toggleThemeMode,
  } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    logoutAppUser();
    await logout();
    navigate('/admin');
  };

  const navItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/users', label: 'User Management', icon: KeyRound },
    { to: '/admin/supervisors-handover', label: 'Supervisors & Handover', icon: ClipboardList },
    { to: '/admin/roster', label: 'Duty Rosters & Supervisors', icon: FileSpreadsheet },
    { to: '/admin/staff', label: 'Staff Directory', icon: Users },
    { to: '/admin/leave', label: 'Leave', icon: CalendarDays },
    { to: '/admin/notices', label: 'Notices', icon: Bell },
    { to: '/admin/daily-media', label: 'Media of Day', icon: Film },
    { to: '/admin/memories', label: 'Memories & Posts', icon: Camera },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <Link to="/admin/dashboard" className="flex items-center gap-3 group">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.orgName}
                  className="h-10 w-10 object-contain rounded-lg border border-slate-200 bg-white p-0.5"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <MHCLogo className="h-10 w-10 rounded-lg border border-slate-200 bg-white p-0.5" />
              )}
              <div className="flex flex-col">
                <span className="text-slate-900 font-bold text-sm leading-tight group-hover:text-teal-700 transition">
                  {settings.orgName}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Staff Leave & Noticeboard Admin
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
                      isActive
                        ? 'bg-teal-50 text-teal-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          {/* Right Action Items */}
          <div className="hidden lg:flex items-center gap-2.5">
            {/* Install App button if prompt available */}
            <PWAInstallButton variant="admin" />

            {/* Direct Open TV Display link */}
            <Link
              to="/display"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition flex items-center gap-1.5 shadow-xs"
              title="Open the TV board display in a new tab"
            >
              <Tv className="w-3.5 h-3.5 text-teal-400" />
              <span>TV Board</span>
            </Link>

            {/* Staff Portal Link */}
            <Link
              to="/staff"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 transition flex items-center gap-1.5 shadow-xs"
              title="Open Staff Portal (Weekly Roster, My Roster, Duty Requests)"
            >
              <Users className="w-3.5 h-3.5 text-teal-700" />
              <span>Staff Portal</span>
            </Link>

            {/* Day / Night Mode Quick Toggle */}
            <button
              onClick={() => toggleThemeMode()}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-200 transition cursor-pointer"
              title={`TV Mode: currently in ${settings.themeMode === 'day' ? 'Day (Light)' : 'Night (Dark)'} Mode. Click to toggle.`}
            >
              {settings.themeMode === 'day' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[11px] font-bold">Day</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-[11px] font-bold">Night</span>
                </>
              )}
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'dv' : 'en')}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-200"
              title="Switch English / ދިވެހި"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'EN' : 'ދިވެހި'}</span>
            </button>

            {/* User details & Logout */}
            <div className="flex items-center pl-2 border-l border-slate-200 gap-2">
              <div className="text-right hidden xl:block">
                <p className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                  {appUser ? appUser.fullName : (adminProfile?.name || currentUser?.email || 'Admin')}
                </p>
                <p className="text-[10px] text-slate-500 capitalize">
                  {appUser ? `${appUser.role.replace('_', ' ')} (${appUser.departmentName || 'All'})` : (adminProfile?.role || 'Administrator')}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                title="Sign out of Admin panel"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-2">
            <Link
              to="/display"
              className="p-2 text-slate-700 bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Tv className="w-4 h-4 text-teal-600" />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-6 space-y-3">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-lg text-base font-semibold transition ${
                      isActive
                        ? 'bg-teal-50 text-teal-800'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-200 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">TV Theme Mode:</span>
              <button
                onClick={() => toggleThemeMode()}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 flex items-center gap-1.5"
              >
                {settings.themeMode === 'day' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Day Mode (Light)</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-500" />
                    <span>Night Mode (Dark)</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Language:</span>
              <button
                onClick={() => setLanguage(language === 'en' ? 'dv' : 'en')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 flex items-center gap-1.5"
              >
                <Globe className="w-4 h-4 text-slate-600" />
                {language === 'en' ? 'English (LTR)' : 'ދިވެހި (RTL)'}
              </button>
            </div>

            <button
              onClick={handleLogout}
              className="w-full mt-2 py-2.5 px-4 bg-rose-50 text-rose-700 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-rose-100 transition"
            >
              <LogOut className="w-4 h-4" />
              Sign Out ({currentUser?.email})
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
