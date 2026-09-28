import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  UserCheck,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Activity,
  FileText,
  Users,
  ShieldCheck,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Check,
  Building,
  Printer,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { ShiftHandover, ShiftType, Department, Supervisor, DepartmentRoster } from '../../types';
import { getDepartmentsList, getSupervisorsList, getDutyRostersList, saveDutyRoster } from '../../services/db';
import { getTodayString } from '../../utils/dateUtils';

const SHIFT_OPTIONS: { id: ShiftType; label: string; time: string; color: string }[] = [
  { id: 'morning', label: 'Morning Shift', time: '08:00 - 16:00', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700' },
  { id: 'evening', label: 'Evening Shift', time: '16:00 - 00:00', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700' },
  { id: 'night', label: 'Night Shift', time: '00:00 - 08:00', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700' },
  { id: 'on_call', label: 'On-Call Coverage', time: '24 Hours', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700' },
  { id: 'general', label: 'General / Administrative', time: '08:00 - 15:00', color: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-700' },
];

export const SupervisorHandoverPage: React.FC = () => {
  const {
    appUser,
    handovers,
    refreshHandovers,
    saveShiftHandover,
    isDemoMode,
    currentUser,
    adminProfile,
  } = useApp();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'handover' | 'roster_quick'>('handover');
  const [todayRosters, setTodayRosters] = useState<DepartmentRoster[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterShift, setFilterShift] = useState<string>('all');

  const todayStr = getTodayString('Indian/Maldives');

  const isGlobalAdmin =
    adminProfile?.role === 'super_admin' ||
    (appUser?.role === 'admin' && !appUser?.departmentId) ||
    appUser?.username === 'admin' ||
    appUser?.username === 'appadmin';

  const isSupervisorOrManager =
    appUser?.role === 'supervisor' ||
    appUser?.role === 'roster_manager' ||
    appUser?.roles?.some((r) => r === 'supervisor' || r === 'roster_manager');

  const isRestrictedToDept = !isGlobalAdmin && isSupervisorOrManager && !!(appUser?.departmentId || appUser?.departmentName);

  const availableDepartments = React.useMemo(() => {
    if (!isRestrictedToDept) return departments;
    const filtered = departments.filter(
      (d) =>
        d.id === appUser?.departmentId ||
        d.name.toLowerCase() === (appUser?.departmentName || '').toLowerCase()
    );
    return filtered.length > 0 ? filtered : departments;
  }, [departments, isRestrictedToDept, appUser]);

  // Handover form state
  const [formData, setFormData] = useState<{
    id?: string;
    departmentId: string;
    departmentName: string;
    date: string;
    shiftType: ShiftType;
    supervisorName: string;
    outgoingSupervisor: string;
    incomingSupervisor: string;
    clinicalSummary: string;
    criticalPatientsCount: number;
    bedOccupancy: number;
    emergencyEquipmentChecked: boolean;
    pendingLabInvestigations: string;
    pendingTasks: string;
    acknowledged: boolean;
  }>({
    departmentId: '',
    departmentName: '',
    date: todayStr,
    shiftType: 'morning',
    supervisorName: appUser?.fullName || 'Shift Supervisor',
    outgoingSupervisor: appUser?.fullName || 'Shift Supervisor',
    incomingSupervisor: '',
    clinicalSummary: '',
    criticalPatientsCount: 0,
    bedOccupancy: 2,
    emergencyEquipmentChecked: true,
    pendingLabInvestigations: '',
    pendingTasks: '',
    acknowledged: false,
  });

  useEffect(() => {
    loadInitialData();
  }, [isDemoMode]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [depts, sups, allRosters] = await Promise.all([
        getDepartmentsList(isDemoMode),
        getSupervisorsList(isDemoMode),
        getDutyRostersList(isDemoMode),
        refreshHandovers(),
      ]);

      setDepartments(depts);
      setSupervisors(sups);

      const activeSups = sups.filter((s) => s.active);
      const userDept = appUser?.departmentId;
      const initialDept = isRestrictedToDept
        ? depts.find((d) => d.id === userDept || d.name.toLowerCase() === (appUser?.departmentName || '').toLowerCase()) || depts[0]
        : depts.find((d) => d.id === userDept) || depts[0];

      if (initialDept) {
        setSelectedDeptId(initialDept.id);
        const incomingDefault = activeSups.find((s) => s.departmentId === initialDept.id)?.name || '';
        setFormData((prev) => ({
          ...prev,
          departmentId: initialDept.id,
          departmentName: initialDept.name,
          incomingSupervisor: incomingDefault,
          supervisorName: appUser?.fullName || prev.supervisorName,
          outgoingSupervisor: appUser?.fullName || prev.outgoingSupervisor,
        }));
      }

      // Filter today's rosters
      setTodayRosters(allRosters.filter((r) => r.date === todayStr));
    } catch (err) {
      console.error('Error loading handover data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeptChange = (deptId: string) => {
    if (isRestrictedToDept && availableDepartments.length > 0 && deptId !== availableDepartments[0]?.id) {
      alert(`As a supervisor, you can only log handovers for your assigned department (${availableDepartments[0]?.name}).`);
      return;
    }
    setSelectedDeptId(deptId);
    const found = departments.find((d) => d.id === deptId);
    const deptSups = supervisors.filter((s) => s.departmentId === deptId && s.active);
    const defaultIncoming = deptSups[0]?.name || '';

    setFormData((prev) => ({
      ...prev,
      departmentId: deptId,
      departmentName: found ? found.name : '',
      incomingSupervisor: defaultIncoming,
    }));
  };

  const handleSubmitHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clinicalSummary.trim()) {
      alert('Please provide a clinical / operational shift summary.');
      return;
    }

    if (isRestrictedToDept && availableDepartments.length > 0 && formData.departmentId !== availableDepartments[0]?.id) {
      alert(`You are only authorized to log shift handover for your assigned department (${availableDepartments[0]?.name}).`);
      return;
    }

    setLoading(true);
    try {
      const saved = await saveShiftHandover(formData);
      setSaveSuccess(
        `Shift Handover saved for ${formData.departmentName} (${formData.shiftType.toUpperCase()})! TV Display Roster notes updated automatically.`
      );
      setTimeout(() => setSaveSuccess(null), 6000);

      // Reset form clinical summary & pending tasks while preserving supervisor identity
      setFormData((prev) => ({
        ...prev,
        clinicalSummary: '',
        pendingLabInvestigations: '',
        pendingTasks: '',
      }));
    } catch (err: any) {
      alert(`Error saving handover: ${err.message || 'Please try again'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (item: ShiftHandover) => {
    setLoading(true);
    try {
      await saveShiftHandover({
        ...item,
        acknowledged: true,
        acknowledgedAt: Date.now(),
        incomingSupervisor: appUser?.fullName || item.incomingSupervisor || 'Incoming Supervisor',
      });
    } catch (err: any) {
      alert(`Error acknowledging handover: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintHandover = () => {
    window.print();
  };

  const filteredHandovers = handovers.filter((h) => {
    const matchesDept = selectedDeptId === 'all' || h.departmentId === selectedDeptId;
    const matchesShift = filterShift === 'all' || h.shiftType === filterShift;
    const matchesSearch =
      h.clinicalSummary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.supervisorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.outgoingSupervisor && h.outgoingSupervisor.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (h.incomingSupervisor && h.incomingSupervisor.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesDept && matchesShift && matchesSearch;
  });

  const selectedDepartment = departments.find((d) => d.id === selectedDeptId);
  const currentRoster = todayRosters.find((r) => r.departmentId === selectedDeptId);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/10 text-emerald-600 rounded-xl">
              <ClipboardList className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Supervisors Panel: Rosters & Shift Handover
              </h1>
              <p className="text-sm font-thaana text-slate-500 dark:text-slate-400 mt-0.5" dir="rtl">
                ޑިއުޓީ ސުޕަވައިޒަރުންގެ ރޯސްޓަރ އަދި ހޭންޑްއޯވަރ ޕެނަލް
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Record clinical shift handovers, critical patient status, crash cart readiness, and pending tasks. Updates are instantly synchronized to the TV Display Department Rosters!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/roster"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 transition"
          >
            <span>Weekly Roster Grid</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={handlePrintHandover}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center gap-3 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Supervisor Department Restriction Banner */}
      {isRestrictedToDept && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Supervisor Role Restriction: You are authorized to log shift handovers for your assigned department (<strong>{availableDepartments[0]?.name || appUser?.departmentName}</strong>) only.
          </span>
        </div>
      )}

      {/* Department Selector Pills */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Select Active Department {isRestrictedToDept && '(Locked to Assigned)'}
          </span>
          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            Today: {todayStr}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableDepartments.map((dept) => {
            const isSelected = selectedDeptId === dept.id;
            return (
              <button
                key={dept.id}
                onClick={() => handleDeptChange(dept.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>{dept.name}</span>
                {dept.nameDhivehi && (
                  <span className="font-thaana text-[10px] opacity-80" dir="rtl">
                    ({dept.nameDhivehi})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Handover Form & Recent Handover Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Create Shift Handover Note (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                  <span>Log Shift Handover</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Record ward status, urgent cases, and handover notes for {selectedDepartment?.name}
                </p>
              </div>

              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-semibold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Auto-sync to TV
              </span>
            </div>

            <form onSubmit={handleSubmitHandover} className="space-y-4">
              {/* Shift Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Duty Shift *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SHIFT_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, shiftType: s.id })}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        formData.shiftType === s.id
                          ? `${s.color} ring-2 ring-blue-500 font-semibold shadow-sm`
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold">{s.label}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{s.time}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Supervisors Handing Over */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Outgoing Supervisor (On-Duty) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.outgoingSupervisor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        outgoingSupervisor: e.target.value,
                        supervisorName: e.target.value,
                      })
                    }
                    placeholder="e.g. Dr. Ibrahim Rasheed"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Incoming Supervisor (Receiving)
                  </label>
                  <select
                    value={formData.incomingSupervisor}
                    onChange={(e) => setFormData({ ...formData, incomingSupervisor: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Supervisor...</option>
                    {supervisors
                      .filter((s) => s.active)
                      .map((sup) => (
                        <option key={sup.id} value={sup.name}>
                          {sup.name} ({sup.departmentName})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Critical Clinical Indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl">
                  <label className="block text-xs font-semibold text-rose-800 dark:text-rose-300 mb-1">
                    Critical Patients
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.criticalPatientsCount}
                    onChange={(e) =>
                      setFormData({ ...formData, criticalPatientsCount: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-lg text-sm font-bold text-rose-900 dark:text-rose-200 focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl">
                  <label className="block text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">
                    Bed Occupancy
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.bedOccupancy}
                    onChange={(e) =>
                      setFormData({ ...formData, bedOccupancy: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded-lg text-sm font-bold text-blue-900 dark:text-blue-200 focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl flex flex-col justify-between">
                  <label className="block text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                    Crash Cart & Readiness
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={formData.emergencyEquipmentChecked}
                      onChange={(e) =>
                        setFormData({ ...formData, emergencyEquipmentChecked: e.target.checked })
                      }
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                      Fully Checked
                    </span>
                  </label>
                </div>
              </div>

              {/* Clinical Summary & Patient Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Clinical & Operational Summary *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.clinicalSummary}
                  onChange={(e) => setFormData({ ...formData, clinicalSummary: e.target.value })}
                  placeholder="Summarize ward status, emergency admissions, vital stability, and patient handovers..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Pending Tasks & Action Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pending Lab & Diagnostics
                  </label>
                  <textarea
                    rows={2}
                    value={formData.pendingLabInvestigations}
                    onChange={(e) =>
                      setFormData({ ...formData, pendingLabInvestigations: e.target.value })
                    }
                    placeholder="e.g. CBC / Dengue antigen result pending for Bed 1..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pending Tasks for Incoming Shift
                  </label>
                  <textarea
                    rows={2}
                    value={formData.pendingTasks}
                    onChange={(e) => setFormData({ ...formData, pendingTasks: e.target.value })}
                    placeholder="e.g. Sea-ambulance referral checklist, medication review at 18:00..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Transfers directly to Duty Roster notes & TV display
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md hover:shadow-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                  {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <Sparkles className="w-4 h-4" />
                  <span>Publish Shift Handover</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Handover History & Duty Status (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Duty Status for Department */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Today's Active Roster Status</span>
              </h3>
              <span className="text-xs font-mono text-slate-500">{todayStr}</span>
            </div>

            {currentRoster ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <span className="text-slate-500 dark:text-slate-400">Supervisor on Record:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {currentRoster.supervisorName}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <span className="text-slate-500 dark:text-slate-400">Staff Assigned:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {currentRoster.entries?.length || 0} Members
                  </span>
                </div>
                {currentRoster.notes && (
                  <div className="p-2.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-lg">
                    <div className="font-semibold text-blue-900 dark:text-blue-300 text-[11px] mb-1">
                      Current TV Handover Note:
                    </div>
                    <div className="text-slate-700 dark:text-slate-300 text-[11px]">
                      {currentRoster.notes}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center text-xs text-slate-400">
                No custom duty roster filed for today yet. Default shift rotations apply.
              </div>
            )}
          </div>

          {/* Handover Log Feed */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Handover Log Feed</span>
                </h3>
                <p className="text-[11px] text-slate-400">Chronological clinical shift notes</p>
              </div>
              <button
                onClick={() => refreshHandovers(selectedDeptId)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                title="Refresh Feed"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2">
              <select
                value={filterShift}
                onChange={(e) => setFilterShift(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">All Shifts</option>
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
                <option value="on_call">On-Call</option>
              </select>
            </div>

            {/* Items list */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredHandovers.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No handovers found for this filter.
                </div>
              ) : (
                filteredHandovers.map((h) => {
                  const shiftConfig = SHIFT_OPTIONS.find((s) => s.id === h.shiftType);

                  return (
                    <div
                      key={h.id}
                      className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              shiftConfig?.color || 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {h.shiftType}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {h.date}
                          </span>
                        </div>

                        {h.acknowledged ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <Check className="w-3 h-3" /> Acknowledged
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAcknowledge(h)}
                            className="text-[10px] px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-sm transition"
                          >
                            Acknowledge
                          </button>
                        )}
                      </div>

                      {/* Clinical Summary */}
                      <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                        {h.clinicalSummary}
                      </p>

                      {/* Pending tasks tag if any */}
                      {h.pendingTasks && (
                        <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded text-[11px] text-amber-800 dark:text-amber-300">
                          <strong>Pending:</strong> {h.pendingTasks}
                        </div>
                      )}

                      {/* Supervisors info */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        <span>Handover by: <strong>{h.outgoingSupervisor}</strong></span>
                        {h.incomingSupervisor && (
                          <span>To: <strong>{h.incomingSupervisor}</strong></span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
