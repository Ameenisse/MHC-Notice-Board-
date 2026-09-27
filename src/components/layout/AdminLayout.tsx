import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { AdminNavbar } from '../common/AdminNavbar';
import { ErrorBoundary } from '../common/ErrorBoundary';

export const AdminLayout: React.FC = () => {
  const { currentUser, isAdmin, isAuthLoading } = useApp();
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
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Admin Top Navigation */}
      <AdminNavbar />

      {/* Content Area */}
      <main className="flex-1">
        <ErrorBoundary fallbackTitle="Admin Section Encountered an Error">
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Institutional Admin Footer */}
      <footer className="py-6 border-t border-slate-200 bg-white text-center text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            Maduvvari Health Centre &bull; Staff Leave & Noticeboard System
          </p>
          <p className="text-slate-400">
            Powered by Cloud Firestore & Firebase Auth &bull; Maldives Time (UTC+05:00)
          </p>
        </div>
      </footer>
    </div>
  );
};
