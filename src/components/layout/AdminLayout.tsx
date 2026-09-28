import React, { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { ErrorBoundary } from '../common/ErrorBoundary';

export const AdminLayout: React.FC = () => {
  const { currentUser, isAdmin, isAuthLoading, settings } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Verifying administrator session...</p>
        </div>
      </div>
    );
  }

  // If not logged in as admin, redirect to login page
  if (!currentUser && !isAdmin) {
    return <Navigate to="/admin" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex font-sans text-slate-900 dark:text-slate-100">
      {/* Sidebar Navigation */}
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Top Header */}
        <AdminHeader onToggleSidebar={() => setSidebarOpen(true)} />

        {/* Dynamic Route Content */}
        <main className="flex-1">
          <ErrorBoundary fallbackTitle="Admin Section Encountered an Error">
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* Institutional Admin Footer */}
        <footer className="py-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs text-slate-500 no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>
              {settings.orgName} &bull; Staff Leave &amp; Noticeboard System
            </p>
            <p className="text-slate-400">
              Powered by Cloud Firestore &amp; Firebase Auth &bull; Maldives Time (UTC+05:00)
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

