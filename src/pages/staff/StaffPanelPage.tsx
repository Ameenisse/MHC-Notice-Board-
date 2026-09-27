import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  getStaffList,
  getDepartmentsList,
  getWeeklyRostersList,
  getActiveNoticesList,
  getStaffDutyRequests,
  submitDutyRequest,
  getPublicHolidaysList,
} from '../../services/db';
import {
  Staff,
  Department,
  WeeklyDepartmentRoster,
  Notice,
  DutyRequest,
  DutyRequestShiftChoice,
  PublicHoliday,
  RosterDepartmentCategory,
} from '../../types';
import { getTodayString, getTomorrowString, formatDate } from '../../utils/dateUtils';
import { WeeklyRosterGrid } from '../../components/roster/WeeklyRosterGrid';
import { MHCLogo } from '../../components/common/MHCLogo';
import {
  Calendar,
  Clock,
  User,
  Users,
  FileSpreadsheet,
  Bell,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  Sparkles,
  Sun,
  Sunset,
  Moon,
  Phone,
  Building,
  Tv,
  Globe,
  ArrowRight,
  Shield,
  Palmtree,
  FileText,
  ChevronDown,
  RefreshCw,
  LogOut,
  CalendarDays,
  FileCheck2,
  Check,
  X,
  Lock,
} from 'lucide-react';

export const StaffPanelPage: React.FC = () => {
  const { settings, isDemoMode, language, setLanguage, toggleThemeMode, appUser, logoutAppUser } = useApp();
  const tz = settings.timezone || 'Indian/Maldives';
  const isNight = settings.themeMode !== 'day';

  // Navigation Tabs in Staff Portal
  const [activeTab, setActiveTab] = useState<'dept_roster' | 'my_roster' | 'my_requests' | 'notices'>('dept_roster');

  // Master Data
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [weeklyRosters, setWeeklyRosters] = useState<WeeklyDepartmentRoster[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [myRequests, setMyRequests] = useState<DutyRequest[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Selected Staff Identity
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  // Request Filter
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Duty Request Modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [reqDate, setReqDate] = useState<string>(getTomorrowString(tz));
  const [reqShiftChoice, setReqShiftChoice] = useState<DutyRequestShiftChoice>('off');
  const [reqReason, setReqReason] = useState<string>('');
  const [reqNotes, setReqNotes] = useState<string>('');

  const todayStr = getTodayString(tz);

  // Load portal data
  const loadPortalData = async () => {
    setLoading(true);
    try {
      const [allStaff, allDepts, wRosters, allNotices, holidays] = await Promise.all([
        getStaffList(isDemoMode),
        getDepartmentsList(isDemoMode),
        getWeeklyRostersList(isDemoMode),
        getActiveNoticesList(isDemoMode),
        getPublicHolidaysList(isDemoMode),
      ]);

      setStaffList(allStaff);
      setDepartments(allDepts);
      setWeeklyRosters(wRosters);
      setNotices(allNotices);
      setPublicHolidays(holidays);

      // Auto-select staff member
      let defaultStaffId = '';
      if (appUser?.staffId) {
        defaultStaffId = appUser.staffId;
      } else if (appUser?.fullName) {
        const found = allStaff.find(
          (s) => s.fullName.toLowerCase() === appUser.fullName.toLowerCase()
        );
        if (found) defaultStaffId = found.id;
      }

      if (!defaultStaffId && allStaff.length > 0) {
        defaultStaffId = allStaff[0].id;
      }

      setSelectedStaffId(defaultStaffId);

      // Fetch duty requests for this staff
      if (defaultStaffId) {
        const reqs = await getStaffDutyRequests(defaultStaffId, isDemoMode);
        setMyRequests(reqs);
      }
    } catch (err) {
      console.error('Error loading staff portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, [isDemoMode]);

  // When staff selection changes, refresh requests
  useEffect(() => {
    if (!selectedStaffId) return;
    const fetchRequests = async () => {
      try {
        const reqs = await getStaffDutyRequests(selectedStaffId, isDemoMode);
        setMyRequests(reqs);
      } catch (err) {
        console.error('Error loading requests:', err);
      }
    };
    fetchRequests();
  }, [selectedStaffId, isDemoMode]);

  // Current selected staff object
  const currentStaff = useMemo(() => {
    return staffList.find((s) => s.id === selectedStaffId) || null;
  }, [staffList, selectedStaffId]);

  // Current staff's department weekly roster
  const staffWeeklyRoster = useMemo(() => {
    if (!currentStaff) return weeklyRosters[0] || null;

    const deptLower = (currentStaff.department || '').toLowerCase();
    const desigLower = (currentStaff.designation || '').toLowerCase();

    // Try matching by category
    let matched = weeklyRosters.find((r) => {
      const cat = r.category.toLowerCase();
      if (deptLower.includes('nurse') || desigLower.includes('nurse')) return cat === 'nurses';
      if (deptLower.includes('attend') || desigLower.includes('attend')) return cat === 'attended';
      if (deptLower.includes('driver') || desigLower.includes('driver')) return cat === 'drivers';
      if (deptLower.includes('customer') || desigLower.includes('reception') || desigLower.includes('admin')) return cat === 'customer_service';
      return false;
    });

    // Or check if this staff's name is in any roster's rows
    if (!matched) {
      matched = weeklyRosters.find((r) =>
        r.rows.some((row) => row.staffName.toLowerCase() === currentStaff.fullName.toLowerCase())
      );
    }

    return matched || weeklyRosters[0] || null;
  }, [currentStaff, weeklyRosters]);

  // Individual Week Roster Schedule for this staff
  const individualWeekSchedule = useMemo(() => {
    if (!staffWeeklyRoster || !currentStaff) return [];

    // Find row for this staff member
    const row = staffWeeklyRoster.rows.find(
      (r) =>
        r.staffName.toLowerCase() === currentStaff.fullName.toLowerCase() ||
        (r.id && r.id === currentStaff.id)
    );

    return staffWeeklyRoster.days.map((day) => {
      const cell = row?.days[day.dateStr];
      const isToday = day.dateStr === todayStr;
      const holiday = publicHolidays.find(
        (h) => h.active && (h.date === day.dateStr || (h.isRecurring && h.date.slice(5) === day.dateStr.slice(5)))
      );

      return {
        dateStr: day.dateStr,
        dayName: day.dayName,
        formattedDate: day.formattedDate,
        isToday,
        holiday,
        cell,
      };
    });
  }, [staffWeeklyRoster, currentStaff, todayStr, publicHolidays]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    if (requestStatusFilter === 'all') return myRequests;
    return myRequests.filter((r) => r.status === requestStatusFilter);
  }, [myRequests, requestStatusFilter]);

  // Pending count
  const pendingCount = useMemo(() => {
    return myRequests.filter((r) => r.status === 'pending').length;
  }, [myRequests]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Open modal with preselected date
  const handleOpenRequestModal = (preselectedDate?: string) => {
    if (preselectedDate) {
      setReqDate(preselectedDate);
    } else {
      setReqDate(getTomorrowString(tz));
    }
    setReqShiftChoice('off');
    setReqReason('');
    setReqNotes('');
    setIsRequestModalOpen(true);
  };

  // Submit Duty Request
  const handleSubmitDutyRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStaff) {
      showToast('Please select a staff member profile first.', 'error');
      return;
    }

    if (!reqDate) {
      showToast('Please select a duty request date.', 'error');
      return;
    }

    if (!reqReason.trim()) {
      showToast('Please specify a reason for your duty request.', 'error');
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const shiftLabels: Record<DutyRequestShiftChoice, string> = {
        off: 'Day Off (OFF)',
        morning: 'Morning Duty (M / 08:00 - 15:00)',
        evening: 'Evening Duty (E / 15:00 - 23:00)',
        night: 'Night Duty (N / 23:00 - 08:00)',
        on_call: 'On-Call / Standby Duty',
      };

      const newReq = await submitDutyRequest(
        {
          staffId: currentStaff.id,
          staffName: currentStaff.fullName,
          staffCustomId: currentStaff.staffId,
          staffDesignation: currentStaff.designation,
          departmentId: currentStaff.department,
          departmentName: currentStaff.department,
          date: reqDate,
          shiftChoice: reqShiftChoice,
          shiftLabel: shiftLabels[reqShiftChoice],
          reason: reqReason.trim(),
          notes: reqNotes.trim(),
        },
        isDemoMode
      );

      // Refresh requests list
      const updated = await getStaffDutyRequests(currentStaff.id, isDemoMode);
      setMyRequests(updated);

      setIsRequestModalOpen(false);
      setActiveTab('my_requests');
      showToast('Duty request submitted successfully! Awaiting supervisor review.');
    } catch (err: any) {
      console.error('Error submitting duty request:', err);
      showToast(err?.message || 'Failed to submit duty request.', 'error');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  return (
    <div className={`min-h-screen ${isNight ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex flex-col font-sans transition-colors duration-200`}>
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 text-sm font-bold ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/80 text-emerald-200'
              : 'bg-rose-950/95 border-rose-500/80 text-rose-200'
          }`}>
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Staff Header */}
      <header className={`border-b ${isNight ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-slate-200'} sticky top-0 z-30 shadow-xs backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
            {/* Logo & Portal Brand */}
            <div className="flex items-center gap-3 min-w-0">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.orgName}
                  className="h-10 w-10 sm:h-12 sm:w-12 object-contain rounded-xl bg-white p-1 border border-slate-200 shadow-xs shrink-0"
                />
              ) : (
                <MHCLogo className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white p-1 border border-slate-200 shadow-xs shrink-0" />
              )}
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-sm sm:text-base leading-tight truncate">
                    {settings.orgName}
                  </h1>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-400 border border-teal-500/40">
                    Staff Portal
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate">
                  Duty Rosters, Noticeboard &amp; Duty Requests
                </p>
              </div>
            </div>

            {/* Quick Actions & Profile Bar */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Staff Switcher / Selector */}
              <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/60 rounded-xl px-2.5 py-1.5 text-xs">
                <User className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span className="text-[11px] text-slate-400 font-bold hidden md:inline">Staff:</span>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="bg-transparent font-bold text-xs text-white focus:outline-hidden cursor-pointer max-w-[150px] sm:max-w-[200px] truncate"
                  title="Select staff member identity"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                      {s.fullName} ({s.department || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Request Duty CTA Button */}
              <button
                type="button"
                onClick={() => handleOpenRequestModal()}
                className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span className="hidden sm:inline">Request Duty</span>
                <span className="sm:hidden">Request</span>
              </button>

              {/* TV Board Link */}
              <Link
                to="/display"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition"
                title="Open Live TV Display"
              >
                <Tv className="w-4 h-4 text-teal-400" />
              </Link>

              {/* Supervisor / Admin portal link */}
              <Link
                to="/admin/roster"
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition hidden lg:flex items-center gap-1"
                title="Switch to Supervisor / Admin Management"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t ${isNight ? 'border-slate-800/80' : 'border-slate-200'}`}>
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('dept_roster')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'dept_roster'
                  ? 'bg-teal-500 text-slate-950 shadow-sm'
                  : isNight
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Department Weekly Roster</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('my_roster')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'my_roster'
                  ? 'bg-teal-500 text-slate-950 shadow-sm'
                  : isNight
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>My Individual Week Roster</span>
              {currentStaff && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                  activeTab === 'my_roster' ? 'bg-slate-950 text-teal-300' : 'bg-slate-800 text-slate-300'
                }`}>
                  {currentStaff.fullName.split(' ')[0]}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('my_requests')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'my_requests'
                  ? 'bg-teal-500 text-slate-950 shadow-sm'
                  : isNight
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Duty Requests</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('notices')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'notices'
                  ? 'bg-teal-500 text-slate-950 shadow-sm'
                  : isNight
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Notices ({notices.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Active Staff Banner Card */}
        {currentStaff && (
          <div className={`${isNight ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border-slate-800' : 'bg-white border-slate-200'} rounded-2xl p-4 sm:p-5 border shadow-sm flex flex-wrap items-center justify-between gap-4`}>
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-teal-500/20 border-2 border-teal-500/40 text-teal-400 flex items-center justify-center font-black text-lg overflow-hidden shrink-0 shadow-inner">
                {currentStaff.photoUrl ? (
                  <img
                    src={currentStaff.photoUrl}
                    alt={currentStaff.fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{currentStaff.fullName.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                    {currentStaff.fullName}
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-teal-950 text-teal-300 border border-teal-800">
                    {currentStaff.staffId || 'STAFF'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5 font-semibold">
                  <span className="text-teal-400">{currentStaff.designation || 'Healthcare Professional'}</span>
                  <span>&bull;</span>
                  <span>{currentStaff.department || 'Clinical Services'}</span>
                  {currentStaff.fullNameDhivehi && (
                    <>
                      <span>&bull;</span>
                      <span className="font-thaana text-slate-300">{currentStaff.fullNameDhivehi}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleOpenRequestModal()}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-black bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Submit Duty Request</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 1: DEPARTMENT WEEKLY ROSTER VIEW
            ======================================================== */}
        {activeTab === 'dept_roster' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-teal-400" />
                  <span>Department Weekly Schedule Grid</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Full official weekly roster for all departments. Cells with <strong className="text-red-400">red text</strong> indicate supervisor-approved duty request adjustments.
                </p>
              </div>

              {/* Department quick switch */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Jump to Department:</span>
                <select
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Departments</option>
                  <option value="attended">Attendants</option>
                  <option value="nurses">Nurses</option>
                  <option value="drivers">Drivers</option>
                  <option value="customer_service">Customer Service</option>
                </select>
              </div>
            </div>

            {/* Weekly Roster Grid Component */}
            {weeklyRosters.length > 0 ? (
              <WeeklyRosterGrid
                rosters={
                  selectedDeptFilter === 'all'
                    ? weeklyRosters
                    : weeklyRosters.filter((r) => r.category === selectedDeptFilter)
                }
                currentDateStr={todayStr}
                publicHolidays={publicHolidays}
              />
            ) : (
              <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/60">
                <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-300">No Weekly Rosters Available</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Weekly department rosters have not been published yet by the duty supervisors.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 2: INDIVIDUAL WEEK ROSTER (MY PERSONAL SCHEDULE)
            ======================================================== */}
        {activeTab === 'my_roster' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-teal-400" />
                  <span>My Individual Week Roster</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Day-by-day personal schedule for <strong className="text-teal-300">{currentStaff?.fullName}</strong>. Click any day to submit a duty change or swap request.
                </p>
              </div>

              {staffWeeklyRoster && (
                <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  <span>Week: {staffWeeklyRoster.weekRangeText}</span>
                </div>
              )}
            </div>

            {/* 7 Days Grid Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
              {individualWeekSchedule.map((day) => {
                const cell = day.cell;
                const code = cell?.code?.trim() || 'OFF';
                const isApprovedChange = !!cell?.isDutyRequestApproved;

                const isMorning = code === 'M' || code === '1' || code.startsWith('1');
                const isEvening = code === 'E' || code === '2' || code.startsWith('2') || code.includes('FRL');
                const isNight = code === 'N';
                const isOff = code === 'OFF';
                const isOnCall = cell?.isOnCall || code.includes('ONCALL');
                const isAnnual = code === 'ANNUAL LEAVE' || code === 'AL';
                const isSick = code === 'SICK LEAVE' || code === 'SL';

                return (
                  <div
                    key={day.dateStr}
                    className={`rounded-2xl border p-4 flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${
                      day.isToday
                        ? 'border-teal-500 bg-gradient-to-b from-teal-950/40 via-slate-900 to-slate-900 ring-2 ring-teal-500/40 shadow-lg'
                        : day.holiday
                        ? 'border-amber-600/70 bg-gradient-to-b from-amber-950/30 via-slate-900 to-slate-900'
                        : isNight
                        ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Top Date Header */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-black uppercase tracking-wider ${
                          day.holiday ? 'text-amber-400' : day.isToday ? 'text-teal-400' : 'text-slate-400'
                        }`}>
                          {day.dayName.slice(0, 3)}
                        </span>
                        {day.isToday && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-teal-500 text-slate-950">
                            Today
                          </span>
                        )}
                        {day.holiday && !day.isToday && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500 text-slate-950">
                            Holiday
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-extrabold text-white mb-2">
                        {day.formattedDate.split(' ')[0]}
                      </div>

                      {day.holiday && (
                        <p className="text-[10px] font-bold text-amber-300 truncate mb-2" title={day.holiday.name}>
                          🌴 {day.holiday.name}
                        </p>
                      )}

                      {/* Shift Badge & Timing */}
                      <div className="my-3 text-center">
                        <div className={`inline-block px-3 py-1.5 rounded-xl border text-sm font-black shadow-xs ${
                          isApprovedChange
                            ? 'text-red-500 bg-red-950/60 border-red-500 ring-1 ring-red-500/80 font-black'
                            : isOff
                            ? 'text-slate-400 bg-slate-800/80 border-slate-700'
                            : isAnnual
                            ? 'text-teal-300 bg-teal-950/70 border-teal-500/70'
                            : isSick
                            ? 'text-rose-300 bg-rose-950/70 border-rose-500/70'
                            : isOnCall
                            ? 'text-rose-300 bg-rose-950 border-rose-600'
                            : isNight
                            ? 'text-indigo-300 bg-indigo-950 border-indigo-600'
                            : isEvening
                            ? 'text-sky-300 bg-sky-950 border-sky-600'
                            : 'text-emerald-300 bg-emerald-950 border-emerald-600'
                        }`}>
                          <span className={isApprovedChange ? 'text-red-500 font-black' : ''}>{code}</span>
                        </div>

                        {/* Approved Duty Request Callout */}
                        {isApprovedChange && (
                          <div className="mt-1.5">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-red-500/20 text-red-400 border border-red-500/40">
                              Approved Duty Change
                            </span>
                          </div>
                        )}

                        {cell?.subText && !isApprovedChange && (
                          <p className="text-[10px] text-amber-300 font-bold mt-1">
                            {cell.subText}
                          </p>
                        )}

                        {/* Shift Timing description */}
                        <p className="text-[11px] font-semibold text-slate-400 mt-1.5">
                          {isOff
                            ? 'Rest / Off-Duty'
                            : isAnnual
                            ? 'Approved Annual Leave'
                            : isSick
                            ? 'Medical Sick Leave'
                            : isMorning
                            ? '08:00 - 15:00'
                            : isEvening
                            ? '15:00 - 23:00'
                            : isNight
                            ? '23:00 - 08:00'
                            : isOnCall
                            ? 'On-Call Coverage'
                            : 'Standard Shift'}
                        </p>
                      </div>
                    </div>

                    {/* Action: Request Change for this Day */}
                    <button
                      type="button"
                      onClick={() => handleOpenRequestModal(day.dateStr)}
                      className="w-full mt-3 py-1.5 px-2 rounded-lg text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-teal-400" />
                      <span>Request Change</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Individual Roster Summary Stats */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
              <h4 className="text-sm font-black text-white uppercase tracking-wider mb-3">
                Weekly Shift Breakdown for {currentStaff?.fullName}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-400 mb-1">
                    <Sun className="w-4 h-4" />
                    <span className="text-xs font-bold">Morning (M)</span>
                  </div>
                  <span className="text-xl font-black text-white">
                    {individualWeekSchedule.filter((d) => d.cell?.code === 'M' || d.cell?.code === '1').length}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center justify-center gap-1.5 text-sky-400 mb-1">
                    <Sunset className="w-4 h-4" />
                    <span className="text-xs font-bold">Evening (E)</span>
                  </div>
                  <span className="text-xl font-black text-white">
                    {individualWeekSchedule.filter((d) => d.cell?.code === 'E' || d.cell?.code === '2').length}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center justify-center gap-1.5 text-indigo-400 mb-1">
                    <Moon className="w-4 h-4" />
                    <span className="text-xs font-bold">Night (N)</span>
                  </div>
                  <span className="text-xl font-black text-white">
                    {individualWeekSchedule.filter((d) => d.cell?.code === 'N').length}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-bold">Off-Duty (OFF)</span>
                  </div>
                  <span className="text-xl font-black text-white">
                    {individualWeekSchedule.filter((d) => d.cell?.code === 'OFF' || !d.cell?.code).length}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center justify-center gap-1.5 text-rose-400 mb-1">
                    <Phone className="w-4 h-4" />
                    <span className="text-xs font-bold">On-Call</span>
                  </div>
                  <span className="text-xl font-black text-white">
                    {individualWeekSchedule.filter((d) => d.cell?.isOnCall || d.cell?.code?.includes('ONCALL')).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: MY DUTY REQUESTS (PENDING / APPROVED / REJECTED)
            ======================================================== */}
        {activeTab === 'my_requests' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-teal-400" />
                  <span>My Submitted Duty Requests</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Track status of your submitted shift and off requests. Once approved, the shift changes in the weekly roster in <strong className="text-red-400">red text</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Status Filter Buttons */}
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setRequestStatusFilter('all')}
                    className={`px-3 py-1 rounded-lg font-bold transition ${
                      requestStatusFilter === 'all'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({myRequests.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestStatusFilter('pending')}
                    className={`px-3 py-1 rounded-lg font-bold transition ${
                      requestStatusFilter === 'pending'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Pending ({myRequests.filter((r) => r.status === 'pending').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestStatusFilter('approved')}
                    className={`px-3 py-1 rounded-lg font-bold transition ${
                      requestStatusFilter === 'approved'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Approved ({myRequests.filter((r) => r.status === 'approved').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestStatusFilter('rejected')}
                    className={`px-3 py-1 rounded-lg font-bold transition ${
                      requestStatusFilter === 'rejected'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Rejected ({myRequests.filter((r) => r.status === 'rejected').length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenRequestModal()}
                  className="px-3.5 py-2 rounded-xl text-xs font-black bg-teal-600 hover:bg-teal-500 text-white flex items-center gap-1.5 shadow-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Request</span>
                </button>
              </div>
            </div>

            {/* Duty Requests List */}
            {filteredRequests.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRequests.map((req) => {
                  const isApproved = req.status === 'approved';
                  const isRejected = req.status === 'rejected';
                  const isPending = req.status === 'pending';

                  return (
                    <div
                      key={req.id}
                      className={`rounded-2xl border p-5 shadow-sm transition flex flex-col justify-between ${
                        isApproved
                          ? 'bg-slate-900/90 border-emerald-500/50 ring-1 ring-emerald-500/20'
                          : isRejected
                          ? 'bg-slate-900/90 border-rose-500/40 ring-1 ring-rose-500/10'
                          : 'bg-slate-900/90 border-amber-500/40 ring-1 ring-amber-500/10'
                      }`}
                    >
                      <div>
                        {/* Top Status & Date */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white">
                              {formatDate(req.date, tz, 'medium')}
                            </span>
                            <span className="text-xs text-slate-400 font-semibold">
                              ({new Date(req.date).toLocaleDateString('en-US', { weekday: 'long' })})
                            </span>
                          </div>

                          {/* Status Badge */}
                          {isPending && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-950 text-amber-300 border border-amber-500/60 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 animate-spin" />
                              <span>Pending Supervisor Review</span>
                            </span>
                          )}
                          {isApproved && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-950 text-emerald-300 border border-emerald-500/80 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Approved &bull; Roster Updated</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-950 text-rose-300 border border-rose-500/80 flex items-center gap-1">
                              <X className="w-3.5 h-3.5" />
                              <span>Request Declined</span>
                            </span>
                          )}
                        </div>

                        {/* Requested Choice Card */}
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 mb-3 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                              Requested Shift / Off:
                            </span>
                            <p className="text-sm font-extrabold text-teal-300">
                              {req.shiftLabel || req.shiftChoice.toUpperCase()}
                            </p>
                          </div>
                          {isApproved && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold text-red-500 bg-red-950/60 border border-red-500/80">
                              Red Text in Roster
                            </span>
                          )}
                        </div>

                        {/* Staff Reason */}
                        <div className="space-y-1 mb-3">
                          <span className="text-[11px] font-bold text-slate-400">Reason for Request:</span>
                          <p className="text-xs text-slate-200 bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/50 leading-relaxed font-medium">
                            {req.reason}
                          </p>
                        </div>

                        {req.notes && (
                          <div className="space-y-1 mb-3">
                            <span className="text-[11px] font-bold text-slate-400">Coverage / Notes:</span>
                            <p className="text-xs text-slate-300 italic font-medium">
                              {req.notes}
                            </p>
                          </div>
                        )}

                        {/* Supervisor Feedback (if reviewed) */}
                        {req.supervisorRemarks && (
                          <div className={`p-3 rounded-xl text-xs font-medium border ${
                            isApproved
                              ? 'bg-emerald-950/30 border-emerald-600/40 text-emerald-200'
                              : 'bg-rose-950/30 border-rose-600/40 text-rose-200'
                          }`}>
                            <div className="flex items-center gap-1.5 font-bold mb-0.5">
                              <Shield className="w-3.5 h-3.5" />
                              <span>Supervisor Remarks ({req.reviewedBy || 'Duty Supervisor'}):</span>
                            </div>
                            <p>{req.supervisorRemarks}</p>
                          </div>
                        )}
                      </div>

                      {/* Footer Timestamps */}
                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Submitted: {new Date(req.createdAt).toLocaleDateString()}</span>
                        {req.reviewedAt && (
                          <span>Reviewed: {new Date(req.reviewedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/60">
                <FileCheck2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-300">No Duty Requests Found</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {requestStatusFilter === 'all'
                    ? 'You have not submitted any duty requests yet. Click "+ New Request" to submit a shift or off request.'
                    : `No ${requestStatusFilter} duty requests match this filter.`}
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenRequestModal()}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Submit Duty Request</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 4: NOTICES & ANNOUNCEMENTS
            ======================================================== */}
        {activeTab === 'notices' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                <Bell className="w-5 h-5 text-teal-400" />
                <span>Hospital Bulletins &amp; Staff Notices</span>
              </h3>
              <p className="text-xs text-slate-400">
                Official circulars, memos, and clinical updates published by Maduvvari Health Centre administration.
              </p>
            </div>

            {notices.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {notices.map((notice) => {
                  const isUrgent = notice.priority === 'urgent';
                  const isImportant = notice.priority === 'important';

                  return (
                    <div
                      key={notice.id}
                      className={`rounded-2xl border p-5 shadow-sm transition flex flex-col justify-between ${
                        isUrgent
                          ? 'bg-slate-900/95 border-rose-500/80 ring-1 ring-rose-500/30'
                          : isImportant
                          ? 'bg-slate-900/95 border-amber-500/80 ring-1 ring-amber-500/30'
                          : 'bg-slate-900/90 border-slate-800'
                      }`}
                    >
                      <div>
                        {/* Priority Badge & Date */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isUrgent
                              ? 'bg-rose-950 text-rose-300 border border-rose-600 animate-pulse'
                              : isImportant
                              ? 'bg-amber-950 text-amber-300 border border-amber-600'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}>
                            {notice.priority} Notice
                          </span>

                          <span className="text-xs text-slate-400 font-semibold">
                            {formatDate(notice.publishStart.split('T')[0], tz, 'medium')}
                          </span>
                        </div>

                        {/* Title English & Dhivehi */}
                        <h4 className="text-base font-extrabold text-white mb-1">
                          {notice.title}
                        </h4>
                        {notice.titleDhivehi && (
                          <h5 className="text-sm font-thaana text-teal-300 mb-2">
                            {notice.titleDhivehi}
                          </h5>
                        )}

                        {/* Message Body */}
                        <p className="text-xs text-slate-300 leading-relaxed font-normal whitespace-pre-line mb-3">
                          {notice.message}
                        </p>
                        {notice.messageDhivehi && (
                          <p className="text-xs font-thaana text-slate-400 leading-relaxed whitespace-pre-line mb-3 text-right">
                            {notice.messageDhivehi}
                          </p>
                        )}

                        {/* Optional Attachment */}
                        {notice.attachmentUrl && (
                          <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
                              <FileText className="w-4 h-4 text-teal-400" />
                              <span className="truncate max-w-[200px]">
                                {notice.attachmentFileName || 'Official Document Attachment'}
                              </span>
                            </div>
                            <a
                              href={notice.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-600 text-white hover:bg-teal-500 transition"
                            >
                              View / Open
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Maduvvari Health Centre</span>
                        <span>Active Bulletin</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/60">
                <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-300">No Active Notices</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  There are currently no circulars or announcements posted for hospital staff.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================================
          POPUP MODAL: REQUEST DUTY
          ======================================================== */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Submit Staff Duty Request
                  </h3>
                  <p className="text-xs text-slate-400">
                    Request a shift change, night duty swap, or off day
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitDutyRequest} className="p-6 space-y-4">
              {/* Staff Member Info Banner */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Staff Requestor:
                  </span>
                  <p className="text-sm font-black text-white">
                    {currentStaff?.fullName}
                  </p>
                  <p className="text-xs text-teal-400 font-semibold">
                    {currentStaff?.department} &bull; {currentStaff?.designation}
                  </p>
                </div>
                <span className="px-2 py-1 rounded text-xs font-black bg-teal-950 text-teal-300 border border-teal-800">
                  {currentStaff?.staffId}
                </span>
              </div>

              {/* Duty Request Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Duty Request Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={reqDate}
                  min={todayStr}
                  onChange={(e) => setReqDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-semibold text-white focus:outline-hidden focus:border-teal-500 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Selected date: <strong className="text-teal-300">{formatDate(reqDate, tz, 'medium')}</strong>
                </p>
              </div>

              {/* Shift or Off Choice */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Requested Shift or Off <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReqShiftChoice('off')}
                    className={`p-3 rounded-xl border text-left font-bold transition flex flex-col justify-between ${
                      reqShiftChoice === 'off'
                        ? 'bg-teal-500/20 border-teal-500 text-white ring-1 ring-teal-500'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-black">Day Off (OFF)</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Off duty / Rest day</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReqShiftChoice('morning')}
                    className={`p-3 rounded-xl border text-left font-bold transition flex flex-col justify-between ${
                      reqShiftChoice === 'morning'
                        ? 'bg-teal-500/20 border-teal-500 text-white ring-1 ring-teal-500'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-black">Morning (M)</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">08:00 - 15:00</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReqShiftChoice('evening')}
                    className={`p-3 rounded-xl border text-left font-bold transition flex flex-col justify-between ${
                      reqShiftChoice === 'evening'
                        ? 'bg-teal-500/20 border-teal-500 text-white ring-1 ring-teal-500'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-black">Evening (E)</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">15:00 - 23:00</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReqShiftChoice('night')}
                    className={`p-3 rounded-xl border text-left font-bold transition flex flex-col justify-between ${
                      reqShiftChoice === 'night'
                        ? 'bg-teal-500/20 border-teal-500 text-white ring-1 ring-teal-500'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-black">Night (N)</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">23:00 - 08:00</span>
                  </button>
                </div>
              </div>

              {/* Reason Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Reason for Request <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="Explain why you are requesting this duty or off change (e.g., family emergency, shift swap with colleague, personal medical appointment)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-medium text-white focus:outline-hidden focus:border-teal-500 transition resize-none"
                />
              </div>

              {/* Notes / Coverage */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Coverage Colleague / Additional Info (Optional)
                </label>
                <input
                  type="text"
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  placeholder="e.g. Swapping shift with Nurse Aminath / Coverage confirmed"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-white focus:outline-hidden focus:border-teal-500 transition"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-teal-600 hover:bg-teal-500 text-white shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingRequest ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-6 border-t border-slate-800 bg-slate-950 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            {settings.orgName} &bull; Staff Duty &amp; Noticeboard Portal
          </p>
          <p className="text-slate-400">
            Maldives Time (UTC+05:00) &bull; Cloud Firestore
          </p>
        </div>
      </footer>
    </div>
  );
};
