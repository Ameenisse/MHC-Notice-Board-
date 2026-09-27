import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  getStaffList,
  getLeaveRecordsList,
  getCategoriesList,
  getNoticesList,
  getDutyRostersList,
  getSupervisorsList,
  getMemoriesList,
} from '../../services/db';
import { Staff, LeaveRecord, LeaveCategory, Notice, DepartmentRoster, Supervisor, HospitalMemory } from '../../types';
import {
  getTodayString,
  isLeaveActiveToday,
  isLeaveUpcoming,
  isReturningTomorrow,
  formatDate,
} from '../../utils/dateUtils';
import {
  Users,
  CalendarCheck,
  CalendarClock,
  Bell,
  PlusCircle,
  Tv,
  ArrowUpRight,
  Clock,
  Sparkles,
  Layers,
  Database,
  CheckCircle2,
  FileSpreadsheet,
  ShieldCheck,
  Camera,
  Split,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { settings, isDemoMode, currentUser } = useApp();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [categories, setCategories] = useState<LeaveCategory[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dutyRosters, setDutyRosters] = useState<DepartmentRoster[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [memories, setMemories] = useState<HospitalMemory[]>([]);
  const [loading, setLoading] = useState(true);

  const tz = settings.timezone || 'Indian/Maldives';

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [staffList, leaveList, catList, noticeList, rosterList, supList, memList] = await Promise.all([
        getStaffList(isDemoMode),
        getLeaveRecordsList(isDemoMode),
        getCategoriesList(isDemoMode),
        getNoticesList(isDemoMode),
        getDutyRostersList(isDemoMode),
        getSupervisorsList(isDemoMode),
        getMemoriesList(isDemoMode),
      ]);
      setStaff(staffList);
      setLeaves(leaveList);
      setCategories(catList);
      setNotices(noticeList);
      setDutyRosters(rosterList);
      setSupervisors(supList);
      setMemories(memList);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [isDemoMode, tz]);

  // Derived counts according to strict display rules
  const activeStaff = staff.filter((s) => s.active);
  const activeStaffIds = new Set(activeStaff.map((s) => s.id));

  // Current approved leaves active today for active staff
  const currentLeaves = leaves.filter(
    (l) =>
      l.status === 'approved' &&
      activeStaffIds.has(l.staffId) &&
      isLeaveActiveToday(l.startDate, l.endDate, tz)
  );

  // Upcoming approved leaves starting after today for active staff
  const upcomingLeaves = leaves.filter(
    (l) =>
      l.status === 'approved' &&
      activeStaffIds.has(l.staffId) &&
      isLeaveUpcoming(l.startDate, tz)
  );

  // Active published notices
  const now = new Date().toISOString();
  const activeNotices = notices.filter(
    (n) =>
      n.status === 'published' &&
      (!n.publishStart || n.publishStart <= now) &&
      (!n.publishEnd || n.publishEnd >= now)
  );

  // Leave counts per category
  const categoryCounts = categories.map((cat) => {
    const count = currentLeaves.filter((l) => l.categoryId === cat.id).length;
    return { ...cat, count };
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Maduvvari Health Centre &bull; Realtime staff presence, leave calendar & display health
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/admin/staff"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 hover:bg-teal-100 transition flex items-center gap-1.5 border border-teal-200"
          >
            <PlusCircle className="w-4 h-4 text-teal-600" />
            <span>Add Staff</span>
          </Link>
          <Link
            to="/admin/leave"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition flex items-center gap-1.5 shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Leave</span>
          </Link>
          <Link
            to="/admin/notices"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition flex items-center gap-1.5 shadow-xs"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Create Notice</span>
          </Link>
          <Link
            to="/admin/roster"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 hover:bg-teal-100 transition flex items-center gap-1.5 border border-teal-200"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-700" />
            <span>Duty Rosters</span>
          </Link>
          <Link
            to="/admin/supervisors"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 hover:bg-teal-100 transition flex items-center gap-1.5 border border-teal-200"
          >
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <span>Supervisors</span>
          </Link>
          <Link
            to="/admin/memories"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-50 text-purple-800 hover:bg-purple-100 transition flex items-center gap-1.5 border border-purple-200"
          >
            <Camera className="w-4 h-4 text-purple-700" />
            <span>Memories</span>
          </Link>
          <Link
            to="/admin/displays"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition flex items-center gap-1.5 border border-slate-300"
          >
            <Tv className="w-4 h-4 text-teal-600" />
            <span>Paired Displays</span>
          </Link>
          <Link
            to="/display"
            target="_blank"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition flex items-center gap-1.5 shadow-xs"
          >
            <Tv className="w-4 h-4" />
            <span>Open TV Screen</span>
          </Link>
        </div>
      </div>

      {/* Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Active Staff */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Staff</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{activeStaff.length}</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Total registered personnel</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Currently on Leave */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Currently on Leave</p>
            <h3 className="text-3xl font-black text-amber-600 mt-1">{currentLeaves.length}</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Approved active leaves today</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <CalendarCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Upcoming Leave */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Upcoming Leave</p>
            <h3 className="text-3xl font-black text-teal-700 mt-1">{upcomingLeaves.length}</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Scheduled approved leaves</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
            <CalendarClock className="w-6 h-6" />
          </div>
        </div>

        {/* Active Notices */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Notices</p>
            <h3 className="text-3xl font-black text-indigo-600 mt-1">{activeNotices.length}</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Displayed on TV board</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Bell className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Leave Counts by Category Breakdown */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-lg font-black text-slate-900 tracking-tight mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-teal-600" />
          <span>Current Leave Counts by Category</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {categoryCounts.map((cat) => (
            <div
              key={cat.id}
              className="p-4 rounded-xl border bg-slate-50/50 flex flex-col justify-between"
              style={{ borderLeftColor: cat.color, borderLeftWidth: '5px' }}
            >
              <div>
                <p className="text-xs font-bold text-slate-600">{cat.name}</p>
                {cat.nameDhivehi && (
                  <p className="text-[11px] text-slate-400 font-medium">{cat.nameDhivehi}</p>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{cat.count}</span>
                <span className="text-xs text-slate-500">staff on leave</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Layout: Current Leave Table & Upcoming / Notices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Current Leave Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Current Staff on Leave (Today)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Realtime projection actively reflected on TV terminals
              </p>
            </div>
            <Link
              to="/admin/leave"
              className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              <span>Manage Leave</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="p-0 overflow-x-auto flex-1">
            {currentLeaves.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <p className="font-semibold text-base text-slate-600">
                  No staff members currently on leave.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Approved leaves encompassing today will appear here and on the TV board.
                </p>
              </div>
            ) : (
              <div className="w-full">
                <table className="w-full text-left border-collapse table-auto sm:table-fixed">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3 sm:w-[35%]">Staff Member</th>
                      <th className="py-2.5 px-2 sm:w-[15%]">Department</th>
                      <th className="py-2.5 px-2 sm:w-[15%]">Category</th>
                      <th className="py-2.5 px-2 sm:w-[20%]">Period</th>
                      <th className="py-2.5 px-3 sm:w-[15%]">Expected Return</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {currentLeaves.map((record) => {
                      const returnsTomorrow = isReturningTomorrow(
                        record.endDate,
                        record.expectedReturnDate,
                        tz
                      );
                      return (
                        <tr key={record.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            <div className="flex items-center gap-2.5">
                              {record.staffPhotoUrl ? (
                                <img
                                  src={record.staffPhotoUrl}
                                  alt={record.staffName}
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center shrink-0">
                                  {record.staffName.substring(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 leading-tight text-xs sm:text-sm truncate">
                                  {record.staffName}
                                </p>
                                <p className="text-[11px] text-slate-500 font-medium truncate">
                                  {record.staffCustomId} &bull; {record.staffDesignation}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-xs font-semibold text-slate-600 truncate">
                            {record.staffDepartment}
                          </td>
                          <td className="py-2.5 px-2">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 truncate inline-block max-w-[110px]">
                              {record.categoryName}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-xs text-slate-600 font-medium">
                            <span className="text-[11px] leading-tight block">
                              {formatDate(record.startDate)} — {formatDate(record.endDate)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {returnsTomorrow ? (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                Tomorrow
                              </span>
                            ) : record.expectedReturnDate ? (
                              <span className="text-xs font-semibold text-slate-700">
                                {formatDate(record.expectedReturnDate)}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Upcoming Leaves & Notices */}
        <div className="space-y-6">
          {/* Upcoming Leaves */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-teal-600" />
                <span>Upcoming Approved Leaves</span>
              </h3>
              <Link to="/admin/leave" className="text-xs font-bold text-teal-700 hover:text-teal-800">
                View all
              </Link>
            </div>

            <div className="space-y-3">
              {upcomingLeaves.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center italic">
                  No upcoming leaves scheduled.
                </p>
              ) : (
                upcomingLeaves.slice(0, 4).map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{rec.staffName}</p>
                      <p className="text-slate-500 text-[11px]">
                        {rec.categoryName} &bull; {rec.staffDepartment}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-teal-800">{formatDate(rec.startDate)}</p>
                      <p className="text-[10px] text-slate-400">to {formatDate(rec.endDate)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Published Notices */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-600" />
                <span>Recently Published Notices</span>
              </h3>
              <Link to="/admin/notices" className="text-xs font-bold text-indigo-700 hover:text-indigo-800">
                Manage
              </Link>
            </div>

            <div className="space-y-3">
              {activeNotices.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center italic">
                  No active notices published.
                </p>
              ) : (
                activeNotices.slice(0, 3).map((notice) => (
                  <div
                    key={notice.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          notice.priority === 'urgent'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : notice.priority === 'important'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {notice.priority}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Expires {formatDate(notice.publishEnd?.split('T')[0] || '')}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 line-clamp-1">{notice.title}</p>
                    <p className="text-slate-500 text-[11px] line-clamp-2">{notice.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
