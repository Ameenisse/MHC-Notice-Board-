import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { DisplayPage } from './pages/display/DisplayPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { StaffPage } from './pages/admin/StaffPage';
import { LeavePage } from './pages/admin/LeavePage';
import { DutyRosterPage } from './pages/admin/DutyRosterPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { SupervisorHandoverPage } from './pages/admin/SupervisorHandoverPage';
import { NoticesPage } from './pages/admin/NoticesPage';
import { MemoriesPage } from './pages/admin/MemoriesPage';
import { DailyMediaPage } from './pages/admin/DailyMediaPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { StaffPanelPage } from './pages/staff/StaffPanelPage';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Default entry goes directly to TV Display */}
          <Route path="/" element={<Navigate to="/display" replace />} />

          {/* TV Display Terminal */}
          <Route path="/display" element={<DisplayPage />} />

          {/* Staffs Portal (Weekly Roster, Individual Roster, Duty Requests, Notices) */}
          <Route path="/staff" element={<StaffPanelPage />} />
          <Route path="/staff-portal" element={<StaffPanelPage />} />
          <Route path="/duty-requests" element={<StaffPanelPage />} />

          {/* Admin Login & Recovery */}
          <Route path="/admin" element={<AdminLoginPage />} />

          {/* Protected Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="daily-media" element={<DailyMediaPage />} />
            <Route path="movements" element={<DailyMediaPage />} />
            <Route path="users" element={<UserManagementPage />} />
            <Route path="supervisors-handover" element={<SupervisorHandoverPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="leave" element={<LeavePage />} />
            <Route path="roster" element={<DutyRosterPage />} />
            <Route path="roster-print" element={<DutyRosterPage isPrintInitial={true} />} />
            <Route path="supervisors" element={<DutyRosterPage defaultTab="supervisors" />} />
            <Route path="duty-requests" element={<DutyRosterPage defaultTab="duty_requests" />} />
            <Route path="duty-allowance" element={<DutyRosterPage defaultTab="allowance" />} />
            <Route path="allowance-rates" element={<DutyRosterPage defaultTab="allowance" />} />
            <Route path="notices" element={<NoticesPage />} />
            <Route path="memories" element={<MemoriesPage />} />
            <Route path="displays" element={<SettingsPage defaultTab="pairing" />} />
            <Route path="pairing" element={<SettingsPage defaultTab="pairing" />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/display" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
