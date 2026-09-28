import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Menu,
  Tv,
  Users,
  Sun,
  Moon,
  LogOut,
  ChevronRight,
  Shield,
  Bell,
  Search,
  Home,
} from 'lucide-react';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface AdminHeaderProps {
  onToggleSidebar: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ onToggleSidebar }) => {
  const {
    currentUser,
    adminProfile,
    appUser,
    logout,
    logoutAppUser,
    settings,
    toggleThemeMode,
  } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    logoutAppUser();
    await logout();
    navigate('/admin');
  };

  // Compute page title from path
  const getPageTitle = (pathname: string): { title: string; category?: string } => {
    if (pathname.includes('/admin/super-admin')) return { title: 'Super Admin Governance', category: 'System Security' };
    if (pathname.includes('/admin/dashboard')) return { title: 'Dashboard Overview', category: 'Operations' };
    if (pathname.includes('/admin/roster')) return { title: 'Duty Rosters & Supervisors', category: 'Operations' };
    if (pathname.includes('/admin/supervisors-handover')) return { title: 'Supervisors & Handover', category: 'Operations' };
    if (pathname.includes('/admin/staff')) return { title: 'Staff Directory', category: 'Operations' };
    if (pathname.includes('/admin/leave')) return { title: 'Leave Management', category: 'Operations' };
    if (pathname.includes('/admin/notices')) return { title: 'Notices & Announcements', category: 'Communications' };
    if (pathname.includes('/admin/daily-media')) return { title: 'Media of the Day', category: 'Communications' };
    if (pathname.includes('/admin/memories')) return { title: 'Hospital Memories & Posts', category: 'Communications' };
    if (pathname.includes('/admin/users')) return { title: 'User Management & PINs', category: 'Administration' };
    if (pathname.includes('/admin/audit')) return { title: 'Audit Trail & Event Logs', category: 'Administration' };
    if (pathname.includes('/admin/settings')) return { title: 'System Settings', category: 'Administration' };
    return { title: 'Admin Panel', category: 'Maduvvari Health Centre' };
  };

  const { title, category } = getPageTitle(location.pathname);

  return (
    <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors no-print">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Left: Mobile Menu Toggle + Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger button for mobile/tablet */}
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition cursor-pointer"
              aria-label="Open Navigation Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb & Section Name */}
            <div className="min-w-0">
              {category && (
                <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>{category}</span>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                </div>
              )}
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate leading-tight">
                {title}
              </h2>
            </div>
          </div>

          {/* Right: Quick actions, TV link, Staff portal link, and user profile */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Home Quick Link */}
            <Link
              to="/display"
              className="px-3 py-1.5 rounded-xl text-xs font-black bg-teal-50 hover:bg-teal-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-slate-700 shadow-2xs transition flex items-center gap-1.5 shrink-0"
              title="Return to TV Display / Home"
            >
              <Home className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 stroke-[2.5]" />
              <span>Home</span>
            </Link>

            {/* PWA Install */}
            <PWAInstallButton variant="admin" />

            {/* TV Display Quick Link */}
            <Link
              to="/display"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl text-xs font-black bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition flex items-center gap-1.5 shrink-0"
              title="Open Live TV Display in new tab"
            >
              <Tv className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden md:inline">TV Board</span>
            </Link>

            {/* Staff Portal Quick Link */}
            <Link
              to="/staff"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl text-xs font-black bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 shadow-xs transition flex items-center gap-1.5 shrink-0"
              title="Open Staff Portal"
            >
              <Users className="w-3.5 h-3.5 text-teal-700" />
              <span className="hidden md:inline">Staff Portal</span>
            </Link>

            {/* Day / Night Theme Toggle */}
            <button
              onClick={() => toggleThemeMode()}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 transition cursor-pointer"
              title={`TV Theme: currently ${settings.themeMode === 'day' ? 'Day' : 'Night'}. Click to toggle.`}
            >
              {settings.themeMode === 'day' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-400" />
              )}
            </button>

            {/* User Details & Sign Out */}
            <div className="flex items-center pl-2 border-l border-slate-200 dark:border-slate-800 gap-2">
              <div className="text-right hidden xl:block">
                <p className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[130px]">
                  {appUser ? appUser.fullName : adminProfile?.name || currentUser?.email || 'Admin'}
                </p>
                <p className="text-[10px] text-teal-600 dark:text-teal-400 font-bold uppercase tracking-wider">
                  {appUser ? appUser.role.replace('_', ' ') : adminProfile?.role || 'Administrator'}
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                title="Sign out of Admin session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
