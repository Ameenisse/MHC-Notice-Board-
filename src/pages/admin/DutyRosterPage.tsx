import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  getSupervisorsList,
  saveSupervisor,
  deleteSupervisor,
  getDutyRostersList,
  saveDutyRoster,
  deleteDutyRoster,
  getStaffList,
  getDepartmentsList,
  getWeeklyRostersList,
  getDutyRequestsList,
  reviewDutyRequest,
  deleteDutyRequest,
  getPublicHolidaysList,
  getLeaveRecordsList,
} from '../../services/db';
import {
  exportWeeklyDutyRosterToPdf,
  exportCombinedRosterAndLeavePdf,
} from '../../utils/pdfExport';
import { PrintableWeeklyRosterView } from '../../components/roster/PrintableWeeklyRosterView';
import {
  Supervisor,
  DepartmentRoster,
  DutyRosterEntry,
  ShiftType,
  Staff,
  Department,
  WeeklyDepartmentRoster,
  DutyRequest,
  PublicHoliday,
} from '../../types';
import { getTodayString, getTomorrowString, formatDate } from '../../utils/dateUtils';
import { WeeklyRosterGrid } from '../../components/roster/WeeklyRosterGrid';
import {
  Calendar,
  Clock,
  UserCheck,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  ShieldCheck,
  Building,
  Sparkles,
  Search,
  Filter,
  Users,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  Radio,
  FileSpreadsheet,
  Grid,
  Download,
  Printer,
  Coins,
  FileText,
  Loader2,
} from 'lucide-react';
import { ShiftAllowanceModule } from '../../components/roster/ShiftAllowanceModule';

export const DutyRosterPage: React.FC<{
  defaultTab?: 'rosters' | 'supervisors' | 'duty_requests' | 'allowance';
  isPrintInitial?: boolean;
}> = ({ defaultTab = 'rosters', isPrintInitial = false }) => {
  const { isDemoMode, currentUser, settings, appUser, adminProfile } = useApp();
  const tz = settings.timezone || 'Indian/Maldives';

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

  const [activeTab, setActiveTab] = useState<'rosters' | 'supervisors' | 'duty_requests' | 'allowance'>(defaultTab);
  const [rosterSubView, setRosterSubView] = useState<'weekly' | 'daily'>('weekly');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString(tz));

  // Data lists
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [rosters, setRosters] = useState<DepartmentRoster[]>([]);
  const [weeklyRosters, setWeeklyRosters] = useState<WeeklyDepartmentRoster[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [dutyRequests, setDutyRequests] = useState<DutyRequest[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const availableDepartments = React.useMemo(() => {
    if (!isRestrictedToDept) return departments;
    const filtered = departments.filter(
      (d) =>
        d.id === appUser?.departmentId ||
        d.name.toLowerCase() === (appUser?.departmentName || '').toLowerCase()
    );
    return filtered.length > 0 ? filtered : departments;
  }, [departments, isRestrictedToDept, appUser]);

  // Dedicated Print View State
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(isPrintInitial);
  const [printDepartmentId, setPrintDepartmentId] = useState<string>('all');

  // Duty Request Supervisor Module State
  const [requestDeptFilter, setRequestDeptFilter] = useState<string>('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [reviewingRequest, setReviewingRequest] = useState<DutyRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [supervisorRemarks, setSupervisorRemarks] = useState<string>('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isProcessingReview, setIsProcessingReview] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // PDF Export Handlers
  const handleExportWeeklyRosterPdf = async () => {
    if (!weeklyRosters || weeklyRosters.length === 0) {
      alert('No weekly duty roster data available to export.');
      return;
    }
    setIsExportingPdf(true);
    try {
      const holidays = await getPublicHolidaysList(isDemoMode);
      await exportWeeklyDutyRosterToPdf({
        rosters: weeklyRosters,
        settings,
        generatedBy: currentUser?.email || 'System Administrator',
        publicHolidays: holidays,
      });
      setActionMessage('Weekly Duty Roster PDF successfully exported.');
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      console.error('Error exporting weekly roster PDF:', err);
      alert('Failed to export Weekly Roster PDF: ' + (err.message || err));
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCombinedPdf = async () => {
    setIsExportingPdf(true);
    try {
      const [holidays, leaves] = await Promise.all([
        getPublicHolidaysList(isDemoMode),
        getLeaveRecordsList(isDemoMode),
      ]);
      await exportCombinedRosterAndLeavePdf({
        rosters: weeklyRosters,
        leaveRecords: leaves,
        settings,
        generatedBy: currentUser?.email || 'System Administrator',
        publicHolidays: holidays,
      });
      setActionMessage('Comprehensive Roster & Leave Schedule PDF exported.');
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      console.error('Error exporting combined package:', err);
      alert('Failed to export schedule package: ' + (err.message || err));
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Supervisor Form Modal
  const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState<Supervisor | null>(null);
  const [supervisorForm, setSupervisorForm] = useState({
    name: '',
    nameDhivehi: '',
    email: '',
    phone: '',
    role: 'Clinical Supervisor',
    departmentId: '',
    departmentName: '',
    staffId: '',
    active: true,
  });

  // Roster Editor Modal
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [editingRoster, setEditingRoster] = useState<DepartmentRoster | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [rosterSupervisorId, setRosterSupervisorId] = useState<string>('');
  const [rosterNotes, setRosterNotes] = useState<string>('');
  const [rosterStatus, setRosterStatus] = useState<'draft' | 'published'>('published');
  const [rosterEntries, setRosterEntries] = useState<DutyRosterEntry[]>([]);

  // Shift Entry Sub-Form inside Roster Editor
  const [shiftStaffId, setShiftStaffId] = useState<string>('');
  const [shiftType, setShiftType] = useState<ShiftType>('morning');
  const [shiftName, setShiftName] = useState<string>('Morning Shift');
  const [shiftStartTime, setShiftStartTime] = useState<string>('08:00');
  const [shiftEndTime, setShiftEndTime] = useState<string>('15:00');
  const [shiftStation, setShiftStation] = useState<string>('OPD Room 1');
  const [shiftIsOnCall, setShiftIsOnCall] = useState<boolean>(false);
  const [shiftRemarks, setShiftRemarks] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [sups, ros, staff, depts, wRosters, requests] = await Promise.all([
        getSupervisorsList(isDemoMode),
        getDutyRostersList(isDemoMode),
        getStaffList(isDemoMode),
        getDepartmentsList(isDemoMode),
        getWeeklyRostersList(isDemoMode),
        getDutyRequestsList(undefined, isDemoMode),
      ]);
      setSupervisors(sups);
      setRosters(ros);
      setStaffList(staff);
      setDepartments(depts);
      setWeeklyRosters(wRosters);
      setDutyRequests(requests);
      if (depts.length > 0 && !selectedDeptId) {
        setSelectedDeptId(depts[0].id);
      }
    } catch (err) {
      console.error('Error loading roster data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReviewModal = (req: DutyRequest, action: 'approved' | 'rejected') => {
    setReviewingRequest(req);
    setReviewAction(action);
    setSupervisorRemarks(
      action === 'approved'
        ? 'Approved by Supervisor. Roster updated with red text highlight.'
        : 'Request declined due to minimum staffing requirements.'
    );
    setIsReviewModalOpen(true);
  };

  const handleProcessReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingRequest) return;

    setIsProcessingReview(true);
    try {
      const supervisorName =
        currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Clinical Supervisor';
      await reviewDutyRequest(
        reviewingRequest.id,
        reviewAction,
        supervisorRemarks,
        supervisorName,
        isDemoMode
      );

      setIsReviewModalOpen(false);
      setReviewingRequest(null);

      // Refresh all rosters and requests to immediately display cell in RED text!
      await loadData();

      if (reviewAction === 'approved') {
        showFeedback(
          `Duty request for ${reviewingRequest.staffName} APPROVED! The weekly roster cell has been updated with RED text.`
        );
      } else {
        showFeedback(`Duty request for ${reviewingRequest.staffName} rejected.`);
      }
    } catch (err: any) {
      console.error('Error processing duty request review:', err);
      showFeedback(`Failed to update duty request: ${err?.message || err}`);
    } finally {
      setIsProcessingReview(false);
    }
  };

  const handleDeleteRequest = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the duty request for ${name}?`)) return;
    try {
      await deleteDutyRequest(id, currentUser?.email || 'Supervisor', isDemoMode);
      await loadData();
      showFeedback(`Deleted duty request for ${name}.`);
    } catch (err: any) {
      console.error('Error deleting request:', err);
      showFeedback(`Failed to delete request: ${err?.message || err}`);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemoMode]);

  const showFeedback = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Filter rosters for the chosen date
  const filteredRosters = rosters.filter((r) => r.date === selectedDate);

  // Preset shift times helper
  const handleShiftTypeChange = (type: ShiftType) => {
    setShiftType(type);
    if (type === 'morning') {
      setShiftName('Morning OPD & Clinic');
      setShiftStartTime('08:00');
      setShiftEndTime('15:00');
      setShiftIsOnCall(false);
    } else if (type === 'evening') {
      setShiftName('Evening ER & Ward');
      setShiftStartTime('15:00');
      setShiftEndTime('22:00');
      setShiftIsOnCall(false);
    } else if (type === 'night') {
      setShiftName('Night Emergency Duty');
      setShiftStartTime('22:00');
      setShiftEndTime('08:00');
      setShiftIsOnCall(false);
    } else if (type === 'on_call') {
      setShiftName('24-Hour Emergency On-Call');
      setShiftStartTime('00:00');
      setShiftEndTime('23:59');
      setShiftIsOnCall(true);
    } else {
      setShiftName('General Hospital Duty');
      setShiftStartTime('08:00');
      setShiftEndTime('16:00');
      setShiftIsOnCall(false);
    }
  };

  // Supervisor Form Handlers
  const handleOpenSupervisorModal = (sup?: Supervisor) => {
    if (sup) {
      setEditingSupervisor(sup);
      setSupervisorForm({
        name: sup.name,
        nameDhivehi: sup.nameDhivehi || '',
        email: sup.email,
        phone: sup.phone || '',
        role: sup.role,
        departmentId: sup.departmentId,
        departmentName: sup.departmentName,
        staffId: sup.staffId || '',
        active: sup.active,
      });
    } else {
      setEditingSupervisor(null);
      const defaultDept = departments[0];
      setSupervisorForm({
        name: '',
        nameDhivehi: '',
        email: '',
        phone: '',
        role: 'Clinical Supervisor',
        departmentId: defaultDept ? defaultDept.id : '',
        departmentName: defaultDept ? defaultDept.name : '',
        staffId: '',
        active: true,
      });
    }
    setIsSupervisorModalOpen(true);
  };

  const handleSelectStaffForSupervisor = (staffId: string) => {
    const selectedStaff = staffList.find((s) => s.id === staffId);
    if (selectedStaff) {
      const dept = departments.find((d) => d.id === selectedStaff.department);
      setSupervisorForm((prev) => ({
        ...prev,
        staffId: selectedStaff.id,
        name: selectedStaff.fullName,
        nameDhivehi: selectedStaff.fullNameDhivehi || prev.nameDhivehi,
        departmentId: selectedStaff.department,
        departmentName: dept ? dept.name : selectedStaff.department,
        role: selectedStaff.designation || prev.role,
      }));
    }
  };

  const handleSaveSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorForm.name.trim()) return;

    try {
      const dept = departments.find((d) => d.id === supervisorForm.departmentId);
      await saveSupervisor(
        {
          ...(editingSupervisor ? { id: editingSupervisor.id } : {}),
          ...supervisorForm,
          departmentName: dept ? dept.name : supervisorForm.departmentName,
        },
        currentUser?.email || 'admin@mhc.gov.mv',
        isDemoMode
      );
      setIsSupervisorModalOpen(false);
      await loadData();
      showFeedback(
        editingSupervisor
          ? `Updated supervisor: ${supervisorForm.name}`
          : `Added new supervisor: ${supervisorForm.name}`
      );
    } catch (err) {
      console.error('Error saving supervisor:', err);
    }
  };

  const handleDeleteSupervisor = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove supervisor ${name}?`)) return;
    try {
      await deleteSupervisor(id, currentUser?.email || 'admin@mhc.gov.mv', isDemoMode);
      await loadData();
      showFeedback(`Removed supervisor: ${name}`);
    } catch (err) {
      console.error('Error deleting supervisor:', err);
    }
  };

  // Roster Editor Handlers
  const handleOpenRosterModal = (roster?: DepartmentRoster) => {
    if (roster) {
      if (isRestrictedToDept && availableDepartments.length > 0 && roster.departmentId !== availableDepartments[0]?.id) {
        alert(`You are only authorized to edit rosters for your assigned department (${availableDepartments[0]?.name}).`);
        return;
      }
      setEditingRoster(roster);
      setSelectedDeptId(roster.departmentId);
      setRosterSupervisorId(roster.supervisorId || '');
      setRosterNotes(roster.notes || '');
      setRosterStatus(roster.status);
      setRosterEntries([...roster.entries]);
    } else {
      setEditingRoster(null);
      const defaultDept = isRestrictedToDept && availableDepartments.length > 0 ? availableDepartments[0] : departments[0];
      const deptId = defaultDept ? defaultDept.id : '';
      setSelectedDeptId(deptId);

      // Find matching supervisor for this dept
      const matchingSup = supervisors.find((s) => s.departmentId === deptId && s.active);
      setRosterSupervisorId(matchingSup ? matchingSup.id : '');
      setRosterNotes('');
      setRosterStatus('published');
      setRosterEntries([]);
    }
    setIsRosterModalOpen(true);
  };

  const handleAddShiftEntry = () => {
    if (!shiftStaffId) return;
    const staff = staffList.find((s) => s.id === shiftStaffId);
    if (!staff) return;

    const dept = departments.find((d) => d.id === selectedDeptId);

    const newEntry: DutyRosterEntry = {
      id: `shift_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      staffId: staff.id,
      staffName: staff.fullName,
      staffCustomId: staff.staffId,
      staffDesignation: staff.designation,
      staffPhotoUrl: staff.photoUrl,
      departmentId: selectedDeptId,
      departmentName: dept ? dept.name : '',
      shiftType,
      shiftName,
      startTime: shiftStartTime,
      endTime: shiftEndTime,
      station: shiftStation,
      isOnCall: shiftIsOnCall,
      supervisorRemarks: shiftRemarks,
      order: rosterEntries.length + 1,
    };

    setRosterEntries([...rosterEntries, newEntry]);
    setShiftStaffId('');
    setShiftRemarks('');
  };

  const handleRemoveShiftEntry = (entryId: string) => {
    setRosterEntries(rosterEntries.filter((e) => e.id !== entryId));
  };

  const handleSaveRoster = async () => {
    if (!selectedDeptId) return;

    const dept = departments.find((d) => d.id === selectedDeptId);
    const sup = supervisors.find((s) => s.id === rosterSupervisorId);

    const rosterId = editingRoster ? editingRoster.id : `${selectedDate}_${selectedDeptId}`;

    const rosterPayload: Partial<DepartmentRoster> = {
      id: rosterId,
      date: selectedDate,
      departmentId: selectedDeptId,
      departmentName: dept ? dept.name : 'Clinical Department',
      departmentNameDhivehi: dept ? dept.nameDhivehi : '',
      supervisorId: sup?.id,
      supervisorName: sup ? sup.name : 'Duty Supervisor',
      supervisorRole: sup ? sup.role : 'Clinical In-Charge',
      status: rosterStatus,
      notes: rosterNotes,
      entries: rosterEntries,
    };

    if (isRestrictedToDept && availableDepartments.length > 0 && selectedDeptId !== availableDepartments[0]?.id) {
      alert(`You are only authorized to save duty roster for your assigned department (${availableDepartments[0]?.name}).`);
      return;
    }

    try {
      await saveDutyRoster(rosterPayload, currentUser?.email || 'admin@mhc.gov.mv', isDemoMode);
      setIsRosterModalOpen(false);
      await loadData();
      showFeedback(`Successfully saved duty roster for ${dept?.name || 'Department'}`);
    } catch (err) {
      console.error('Error saving roster:', err);
    }
  };

  const handleDeleteRoster = async (rosterId: string, deptName: string) => {
    if (!window.confirm(`Delete the duty roster for ${deptName} on ${selectedDate}?`)) return;
    try {
      await deleteDutyRoster(rosterId, currentUser?.email || 'admin@mhc.gov.mv', isDemoMode);
      await loadData();
      showFeedback(`Deleted roster for ${deptName}`);
    } catch (err) {
      console.error('Error deleting roster:', err);
    }
  };

  // Dedicated Printable View for Weekly Duty Roster
  if (isPrintViewOpen) {
    return (
      <PrintableWeeklyRosterView
        rosters={weeklyRosters}
        currentDateStr={getTodayString(tz)}
        settings={settings}
        publicHolidays={publicHolidays}
        onClose={() => setIsPrintViewOpen(false)}
        initialDepartmentId={printDepartmentId}
        generatedBy={currentUser?.displayName || currentUser?.email || 'System Administrator'}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Department Duty Rosters & Supervisors
              </h1>
              <p className="text-sm font-medium text-slate-500">
                Manage clinical shifts, emergency on-call schedules, and department supervisors for the TV display.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'rosters' ? (
            <button
              type="button"
              onClick={() => handleOpenRosterModal()}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Duty Roster</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenSupervisorModal()}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supervisor</span>
            </button>
          )}
        </div>
      </div>

      {/* Supervisor Department Restriction Notification Banner */}
      {isRestrictedToDept && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 rounded-2xl flex items-center gap-3 text-xs font-bold">
          <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0" />
          <span>
            Supervisor Role Restriction Active: You are authorized to create, edit rosters, and review duty requests for your assigned department (<strong>{availableDepartments[0]?.name || appUser?.departmentName}</strong>) only.
          </span>
        </div>
      )}

      {/* Action Notification */}
      {actionMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-semibold shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('rosters')}
          className={`px-5 py-3 text-sm font-extrabold flex items-center gap-2.5 border-b-2 transition ${
            activeTab === 'rosters'
              ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-xl'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-xl'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Duty Rosters ({filteredRosters.length} on {selectedDate})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('supervisors')}
          className={`px-5 py-3 text-sm font-extrabold flex items-center gap-2.5 border-b-2 transition ${
            activeTab === 'supervisors'
              ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-xl'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-xl'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Supervisors Panel ({supervisors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('duty_requests')}
          className={`px-5 py-3 text-sm font-extrabold flex items-center gap-2.5 border-b-2 transition ${
            activeTab === 'duty_requests'
              ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-xl'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-xl'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Staff Duty Requests</span>
          {dutyRequests.filter((r) => r.status === 'pending').length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white animate-pulse">
              {dutyRequests.filter((r) => r.status === 'pending').length} Pending
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('allowance')}
          className={`px-5 py-3 text-sm font-extrabold flex items-center gap-2.5 border-b-2 transition ${
            activeTab === 'allowance'
              ? 'border-teal-600 text-teal-700 bg-teal-50/50 rounded-t-xl'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-xl'
          }`}
        >
          <Coins className="w-4 h-4 text-teal-600" />
          <span>Shift Duty Allowance &amp; Rates</span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: DUTY ROSTERS LIST (WEEKLY GRID & DAILY EDITOR)
          ======================================================== */}
      {activeTab === 'rosters' && (
        <div className="space-y-6">
          {/* Sub-view switcher between Weekly Spreadsheet View and Daily Shift View */}
          <div className="bg-white rounded-2xl p-2.5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRosterSubView('weekly')}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition ${
                  rosterSubView === 'weekly'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>Weekly Grid Schedule (Official Format)</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                  rosterSubView === 'weekly' ? 'bg-teal-700 text-teal-100' : 'bg-slate-200 text-slate-700'
                }`}>
                  {weeklyRosters.length} Depts
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRosterSubView('daily')}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition ${
                  rosterSubView === 'daily'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Daily Shift Editor ({filteredRosters.length} on {selectedDate})</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportWeeklyRosterPdf}
                disabled={isExportingPdf}
                className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                title="Export official Weekly Duty Roster as PDF file for printing or official records"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span>Export Roster PDF</span>
              </button>

              <button
                type="button"
                onClick={handleExportCombinedPdf}
                disabled={isExportingPdf}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer disabled:opacity-50"
                title="Export combined official package (Weekly Duty Rosters + Staff Leave Schedule) to PDF"
              >
                <Download className="w-3.5 h-3.5 text-teal-400" />
                <span className="hidden sm:inline">Roster + Leaves PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPrintDepartmentId('all');
                  setIsPrintViewOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold flex items-center gap-1.5 border border-teal-300 shadow-xs transition cursor-pointer"
                title="Open dedicated printable view with optimal landscape A4 page breaks, official Ministry header, and clean formatting"
              >
                <Printer className="w-3.5 h-3.5 text-teal-700" />
                <span>Dedicated Print View</span>
              </button>
            </div>
          </div>

          {/* WEEKLY GRID VIEW */}
          {rosterSubView === 'weekly' && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white">
                      Maduvvari Health Centre - Official Weekly Department Duty Rosters
                    </h2>
                    <p className="text-xs text-slate-400">
                      Standard schedule from 20-Sep-2026 to 26-Sep-2026 covering Morning (M/1), Evening (E/2), Night (N), Off-Duty (OFF), and Night On-Call rotations.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-950 text-teal-300 border border-teal-800">
                    Today: {formatDate(getTodayString(tz), tz, 'medium')}
                  </span>
                </div>
              </div>

              {/* Roster Spreadsheet Grid Component */}
              <WeeklyRosterGrid
                rosters={weeklyRosters}
                currentDateStr={getTodayString(tz)}
                onPrint={(deptId) => {
                  setPrintDepartmentId(deptId || 'all');
                  setIsPrintViewOpen(true);
                }}
              />
            </div>
          )}

          {/* DAILY SHIFT EDITOR VIEW */}
          {rosterSubView === 'daily' && (
            <div className="space-y-6">
              {/* Date Selector Strip */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
                Select Duty Date:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDate(getTodayString(tz))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    selectedDate === getTodayString(tz)
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(getTomorrowString(tz))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    selectedDate === getTomorrowString(tz)
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Tomorrow
                </button>
              </div>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div className="text-sm font-bold text-slate-600 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <span>Showing rosters for: <strong className="text-slate-900">{formatDate(selectedDate, tz, 'medium')}</strong></span>
            </div>
          </div>

          {/* Roster Cards Grid */}
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <div className="h-10 w-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-sm font-bold text-slate-600">Loading duty rosters...</p>
            </div>
          ) : filteredRosters.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border-2 border-dashed border-slate-300 text-center shadow-xs flex flex-col items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900">
                No Duty Rosters Created for {selectedDate}
              </h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md">
                Create shift schedules for clinical departments by clicking below.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleOpenRosterModal()}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Duty Roster</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredRosters.map((roster) => (
                <div
                  key={roster.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md transition"
                >
                  {/* Department & Supervisor Header */}
                  <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-teal-400" />
                        <h3 className="text-lg font-black tracking-tight">{roster.departmentName}</h3>
                        {roster.departmentNameDhivehi && (
                          <span className="text-xs text-slate-300 font-medium font-thaana">
                            {roster.departmentNameDhivehi}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-teal-200">
                        <UserCheck className="w-3.5 h-3.5 text-teal-300" />
                        <span>Supervisor: <strong>{roster.supervisorName}</strong> ({roster.supervisorRole || 'In-Charge'})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          roster.status === 'published'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {roster.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenRosterModal(roster)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition"
                        title="Edit Roster"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRoster(roster.id, roster.departmentName)}
                        className="p-1.5 hover:bg-red-500/20 rounded-lg text-rose-300 hover:text-rose-200 transition"
                        title="Delete Roster"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Shift Entries List */}
                  <div className="p-5 space-y-3 flex-1">
                    {roster.entries.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4 text-center">
                        No shift entries added yet.
                      </p>
                    ) : (
                      roster.entries.map((shift) => {
                        const isMorning = shift.shiftType === 'morning';
                        const isEvening = shift.shiftType === 'evening';
                        const isNight = shift.shiftType === 'night';
                        const isOnCall = shift.isOnCall || shift.shiftType === 'on_call';

                        return (
                          <div
                            key={shift.id}
                            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                              isOnCall
                                ? 'bg-rose-50/60 border-rose-200'
                                : isNight
                                ? 'bg-indigo-50/60 border-indigo-200'
                                : isEvening
                                ? 'bg-blue-50/60 border-blue-200'
                                : 'bg-amber-50/60 border-amber-200'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {shift.staffPhotoUrl ? (
                                <img
                                  src={shift.staffPhotoUrl}
                                  alt={shift.staffName}
                                  className="w-11 h-11 rounded-lg object-cover border border-white shadow-xs shrink-0"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-lg bg-teal-700 text-white font-black text-sm flex items-center justify-center shrink-0">
                                  {shift.staffName.slice(0, 2).toUpperCase()}
                                </div>
                              )}

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-extrabold text-slate-900 truncate">
                                    {shift.staffName}
                                  </h4>
                                  {isOnCall && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white flex items-center gap-1 shadow-xs">
                                      <Radio className="w-2.5 h-2.5" />
                                      <span>On-Call</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 font-medium truncate">
                                  {shift.staffDesignation}
                                </p>
                                {shift.station && (
                                  <p className="text-[11px] font-bold text-teal-800">
                                    Station: {shift.station}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black ${
                                  isOnCall
                                    ? 'bg-rose-100 text-rose-800'
                                    : isNight
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : isEvening
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {isMorning && <Sun className="w-3 h-3" />}
                                {isEvening && <Sunset className="w-3 h-3" />}
                                {isNight && <Moon className="w-3 h-3" />}
                                {isOnCall && <Phone className="w-3 h-3" />}
                                <span>{shift.startTime} - {shift.endTime}</span>
                              </span>
                              <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                {shift.shiftName}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {roster.notes && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                        <strong className="text-slate-800">Handover Notes:</strong> {roster.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 2: SUPERVISORS PANEL
          ======================================================== */}
      {activeTab === 'supervisors' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Department Clinical & Administrative Supervisors
              </h2>
              <p className="text-xs font-medium text-slate-500">
                Designate supervisors in charge of shift operations, escalation points, and handover reports.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/admin/users"
                className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
              >
                <Users className="w-3.5 h-3.5" />
                <span>User Management & PINs</span>
              </Link>
              <Link
                to="/admin/supervisors-handover"
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Shift Handover Panel</span>
              </Link>
              <button
                type="button"
                onClick={() => handleOpenSupervisorModal()}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 shadow-xs transition self-start md:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add Supervisor</span>
              </button>
            </div>
          </div>

          {/* Sync Notice Banner */}
          <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-transparent border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-extrabold text-emerald-950">Live User Management Auto-Sync Active:</span>
                <span className="text-emerald-800 ml-1">
                  Whenever an administrator creates a user account with the <strong>Supervisor</strong> role in User Management, their profile is automatically synced to this directory and immediately reflected on the TV display board!
                </span>
              </div>
            </div>
            <Link
              to="/admin/users"
              className="text-xs font-bold text-blue-700 hover:text-blue-900 underline whitespace-nowrap self-end sm:self-auto"
            >
              Manage Users & PINs &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {supervisors.map((sup) => (
              <div
                key={sup.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 font-black text-base flex items-center justify-center shadow-xs">
                        {sup.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                          {sup.name}
                        </h3>
                        {sup.nameDhivehi && (
                          <p className="text-xs text-slate-500 font-thaana font-medium">
                            {sup.nameDhivehi}
                          </p>
                        )}
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-black">
                          {sup.role}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenSupervisorModal(sup)}
                        className="p-1 text-slate-400 hover:text-teal-600 transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSupervisor(sup.id, sup.name)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-semibold text-slate-400">Department:</span>
                      <span className="font-bold text-slate-800">{sup.departmentName}</span>
                    </div>
                    {sup.phone && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="font-semibold text-slate-400">Direct Phone:</span>
                        <a
                          href={`tel:${sup.phone}`}
                          className="font-bold text-teal-700 hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{sup.phone}</span>
                        </a>
                      </div>
                    )}
                    {sup.email && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="font-semibold text-slate-400">Email:</span>
                        <span className="font-medium text-slate-700 truncate max-w-[180px]">{sup.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      sup.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {sup.active ? 'Active Supervisor' : 'Inactive'}
                  </span>

                  <span className="text-[11px] text-slate-400 font-semibold">
                    In-Charge
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: STAFF DUTY REQUESTS (SUPERVISOR APPROVE / REJECT)
          ======================================================== */}
      {activeTab === 'duty_requests' && (
        <div className="space-y-6">
          {/* Top Controls Strip */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-black text-slate-900">
                  Staff Duty Requests Review Module
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Review, approve, or reject staff requests for shifts or off-duty days. When approved, the roster cell updates with <strong className="text-rose-600 font-bold">RED text</strong>.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Department Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-500">Dept:</span>
                <select
                  value={requestDeptFilter}
                  onChange={(e) => setRequestDeptFilter(e.target.value)}
                  className="bg-transparent font-bold text-xs text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setRequestStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg font-extrabold transition ${
                    requestStatusFilter === 'pending'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pending ({dutyRequests.filter((r) => r.status === 'pending').length})
                </button>
                <button
                  type="button"
                  onClick={() => setRequestStatusFilter('approved')}
                  className={`px-3 py-1.5 rounded-lg font-extrabold transition ${
                    requestStatusFilter === 'approved'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Approved ({dutyRequests.filter((r) => r.status === 'approved').length})
                </button>
                <button
                  type="button"
                  onClick={() => setRequestStatusFilter('rejected')}
                  className={`px-3 py-1.5 rounded-lg font-extrabold transition ${
                    requestStatusFilter === 'rejected'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rejected ({dutyRequests.filter((r) => r.status === 'rejected').length})
                </button>
                <button
                  type="button"
                  onClick={() => setRequestStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-extrabold transition ${
                    requestStatusFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({dutyRequests.length})
                </button>
              </div>

              <Link
                to="/staff"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl text-xs font-black bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 transition flex items-center gap-1"
                title="Preview Staff Portal as staff member"
              >
                <span>Staff Portal</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Duty Requests Cards */}
          {dutyRequests.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs">
              <UserCheck className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800">No Duty Requests Submitted</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Staff have not submitted any duty change requests yet. When staff submit requests via the Staff Portal, they will appear here for review.
              </p>
              <Link
                to="/staff"
                className="mt-4 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition"
              >
                <span>Open Staff Portal to Test Request</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {dutyRequests
                .filter((r) => {
                  if (requestDeptFilter !== 'all' && r.departmentName !== requestDeptFilter && r.departmentId !== requestDeptFilter) {
                    return false;
                  }
                  if (requestStatusFilter !== 'all' && r.status !== requestStatusFilter) {
                    return false;
                  }
                  return true;
                })
                .map((req) => {
                  const isApproved = req.status === 'approved';
                  const isRejected = req.status === 'rejected';
                  const isPending = req.status === 'pending';

                  return (
                    <div
                      key={req.id}
                      className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition ${
                        isApproved
                          ? 'border-emerald-300 ring-1 ring-emerald-200'
                          : isRejected
                          ? 'border-rose-300 ring-1 ring-rose-200'
                          : 'border-amber-300 ring-1 ring-amber-200'
                      }`}
                    >
                      <div>
                        {/* Header: Staff details & Status */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-10 w-10 rounded-xl bg-teal-100 text-teal-800 font-black flex items-center justify-center text-sm shrink-0">
                              {req.staffName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-900 leading-tight">
                                {req.staffName}
                              </h4>
                              <p className="text-[11px] text-slate-500 font-medium">
                                {req.staffDesignation || 'Staff'} &bull; {req.departmentName}
                              </p>
                            </div>
                          </div>

                          {isPending && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                              Pending
                            </span>
                          )}
                          {isApproved && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                              Approved
                            </span>
                          )}
                          {isRejected && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300 shrink-0">
                              Rejected
                            </span>
                          )}
                        </div>

                        {/* Request Summary Box */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-semibold">Requested Date:</span>
                            <span className="font-extrabold text-slate-900">
                              {formatDate(req.date, tz, 'medium')} ({new Date(req.date).toLocaleDateString('en-US', { weekday: 'short' })})
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-semibold">Requested Shift:</span>
                            <span className="font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              {req.shiftLabel || req.shiftChoice.toUpperCase()}
                            </span>
                          </div>

                          {isApproved && (
                            <div className="pt-1 border-t border-slate-200 flex items-center justify-between text-[11px]">
                              <span className="text-slate-500">Roster Highlight:</span>
                              <span className="font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                Red Text Applied
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Reason Callout */}
                        <div className="mb-3 space-y-1">
                          <span className="text-[11px] font-bold text-slate-500">Staff Reason:</span>
                          <p className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 leading-relaxed font-medium">
                            "{req.reason}"
                          </p>
                        </div>

                        {req.notes && (
                          <div className="mb-3 text-xs text-slate-600">
                            <span className="font-bold text-slate-500">Coverage Note: </span>
                            <span className="italic">{req.notes}</span>
                          </div>
                        )}

                        {/* Supervisor Remarks */}
                        {req.supervisorRemarks && (
                          <div className={`p-2.5 rounded-xl text-xs mb-3 border ${
                            isApproved
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                              : 'bg-rose-50/70 border-rose-200 text-rose-900'
                          }`}>
                            <span className="font-bold block mb-0.5">
                              Supervisor Note ({req.reviewedBy || 'Supervisor'}):
                            </span>
                            <span>{req.supervisorRemarks}</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isPending ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenReviewModal(req, 'approved')}
                                className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                                <span>Approve</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenReviewModal(req, 'rejected')}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 transition flex items-center gap-1 cursor-pointer"
                              >
                                <AlertCircle className="w-3.5 h-3.5 stroke-[3]" />
                                <span>Reject</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenReviewModal(req, isApproved ? 'rejected' : 'approved')}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                            >
                              Change Decision
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteRequest(req.id, req.staffName)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded-lg"
                            title="Delete Request"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 4: SHIFT DUTY ALLOWANCE SHEET & STAFF RATES (CRUD)
          ======================================================== */}
      {activeTab === 'allowance' && (
        <ShiftAllowanceModule staffList={staffList} departments={departments} />
      )}

      {/* ========================================================
          MODAL: SUPERVISOR APPROVE / REJECT DUTY REQUEST
          ======================================================== */}
      {isReviewModalOpen && reviewingRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center font-black ${
                reviewAction === 'approved'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-100 text-rose-700 border border-rose-200'
              }`}>
                {reviewAction === 'approved' ? (
                  <CheckCircle2 className="w-6 h-6 stroke-[3]" />
                ) : (
                  <AlertCircle className="w-6 h-6 stroke-[3]" />
                )}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {reviewAction === 'approved' ? 'Approve Staff Duty Request' : 'Reject Staff Duty Request'}
                </h3>
                <p className="text-xs text-slate-500">
                  {reviewingRequest.staffName} &bull; {reviewingRequest.departmentName}
                </p>
              </div>
            </div>

            {/* Request Summary details */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Request Date:</span>
                <span className="font-extrabold text-slate-900">
                  {formatDate(reviewingRequest.date, tz, 'medium')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Requested Duty / Shift:</span>
                <span className="font-extrabold text-teal-800">
                  {reviewingRequest.shiftLabel}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 font-semibold block mb-0.5">Staff Reason:</span>
                <p className="text-slate-800 italic font-medium bg-white p-2 rounded-lg border border-slate-200">
                  "{reviewingRequest.reason}"
                </p>
              </div>
            </div>

            {reviewAction === 'approved' && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 mb-4 text-xs text-rose-900">
                <strong className="block font-black mb-0.5">Important Roster Update Notice:</strong>
                Approving this request will automatically replace the staff member's shift in the weekly roster, and render the cell in <strong className="text-rose-700 font-black">RED text</strong> so supervisors and staff instantly recognize the change.
              </div>
            )}

            <form onSubmit={handleProcessReview} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                  Supervisor Remarks / Note
                </label>
                <textarea
                  value={supervisorRemarks}
                  onChange={(e) => setSupervisorRemarks(e.target.value)}
                  rows={2}
                  required
                  placeholder="e.g. Approved. Coverage confirmed with Nurse In-charge."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingReview}
                  className={`px-5 py-2 rounded-xl text-xs font-black text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer ${
                    reviewAction === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isProcessingReview ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Updating Roster...</span>
                    </>
                  ) : reviewAction === 'approved' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                      <span>Approve &amp; Update Roster in Red</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 stroke-[3]" />
                      <span>Confirm Rejection</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADD/EDIT SUPERVISOR
          ======================================================== */}
      {isSupervisorModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-xl font-black text-slate-900">
              {editingSupervisor ? 'Edit Supervisor Profile' : 'Add New Department Supervisor'}
            </h2>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Supervisors oversee clinical duty rosters and serve as key contacts on the TV dashboard.
            </p>

            <form onSubmit={handleSaveSupervisor} className="space-y-4">
              {/* Optional: Link to Existing Staff Directory */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                  Link to Staff Directory Member (Optional)
                </label>
                <select
                  value={supervisorForm.staffId}
                  onChange={(e) => handleSelectStaffForSupervisor(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">-- Choose from existing staff directory --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Supervisor Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={supervisorForm.name}
                    onChange={(e) => setSupervisorForm({ ...supervisorForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g. Dr. Ibrahim Rasheed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Name in Dhivehi (Thaana)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={supervisorForm.nameDhivehi}
                    onChange={(e) => setSupervisorForm({ ...supervisorForm, nameDhivehi: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 font-thaana focus:ring-2 focus:ring-teal-500"
                    placeholder="ޑރ. އިބްރާހީމް ރަޝީދު"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Supervisor Role / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={supervisorForm.role}
                    onChange={(e) => setSupervisorForm({ ...supervisorForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g. Chief Medical Officer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Department *
                  </label>
                  <select
                    value={supervisorForm.departmentId}
                    onChange={(e) => {
                      const dept = departments.find((d) => d.id === e.target.value);
                      setSupervisorForm({
                        ...supervisorForm,
                        departmentId: e.target.value,
                        departmentName: dept ? dept.name : '',
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={supervisorForm.phone}
                    onChange={(e) => setSupervisorForm({ ...supervisorForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g. 7789011"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={supervisorForm.email}
                    onChange={(e) => setSupervisorForm({ ...supervisorForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500"
                    placeholder="supervisor@mhc.gov.mv"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeSupCheck"
                  checked={supervisorForm.active}
                  onChange={(e) => setSupervisorForm({ ...supervisorForm, active: e.target.checked })}
                  className="h-4 w-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                />
                <label htmlFor="activeSupCheck" className="text-xs font-bold text-slate-700">
                  Supervisor is currently active and available for roster duty
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSupervisorModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-xs transition"
                >
                  Save Supervisor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CREATE / EDIT DUTY ROSTER
          ======================================================== */}
      {isRosterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-slate-900">
              {editingRoster ? 'Edit Department Duty Roster' : 'Create Department Duty Roster'}
            </h2>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Assign staff to morning, evening, night, and emergency on-call shifts for <strong>{selectedDate}</strong>.
            </p>

            <div className="space-y-6">
              {/* Department & Supervisor Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Department * {isRestrictedToDept && '(Locked)'}
                  </label>
                  <select
                    value={selectedDeptId}
                    disabled={isRestrictedToDept}
                    onChange={(e) => {
                      setSelectedDeptId(e.target.value);
                      const matching = supervisors.find((s) => s.departmentId === e.target.value && s.active);
                      if (matching) setRosterSupervisorId(matching.id);
                    }}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 ${
                      isRestrictedToDept ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white'
                    }`}
                  >
                    {availableDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {isRestrictedToDept ? '(Assigned)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    In-Charge Supervisor *
                  </label>
                  <select
                    value={rosterSupervisorId}
                    onChange={(e) => setRosterSupervisorId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 bg-white"
                  >
                    <option value="">-- Select Supervisor --</option>
                    {supervisors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.departmentName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Publication Status
                  </label>
                  <select
                    value={rosterStatus}
                    onChange={(e) => setRosterStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 bg-white"
                  >
                    <option value="published">Published (Visible on TV)</option>
                    <option value="draft">Draft (Hidden)</option>
                  </select>
                </div>
              </div>

              {/* Add Shift Entry Sub-Form */}
              <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-200/80 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Shift Assignment to Roster</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Staff Member *
                    </label>
                    <select
                      value={shiftStaffId}
                      onChange={(e) => setShiftStaffId(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                    >
                      <option value="">-- Choose staff --</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName} ({s.designation})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Shift Type
                    </label>
                    <select
                      value={shiftType}
                      onChange={(e) => handleShiftTypeChange(e.target.value as ShiftType)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                    >
                      <option value="morning">Morning Duty</option>
                      <option value="evening">Evening Duty</option>
                      <option value="night">Night Duty</option>
                      <option value="on_call">Emergency On-Call</option>
                      <option value="general">General Duty</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Shift Name / Description
                    </label>
                    <input
                      type="text"
                      value={shiftName}
                      onChange={(e) => setShiftName(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                      placeholder="e.g. Morning OPD Duty"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={shiftStartTime}
                        onChange={(e) => setShiftStartTime(e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">End Time</label>
                      <input
                        type="time"
                        value={shiftEndTime}
                        onChange={(e) => setShiftEndTime(e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Station / Room
                    </label>
                    <input
                      type="text"
                      value={shiftStation}
                      onChange={(e) => setShiftStation(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                      placeholder="e.g. OPD Room 1, Triage Desk"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Supervisor Remarks
                    </label>
                    <input
                      type="text"
                      value={shiftRemarks}
                      onChange={(e) => setShiftRemarks(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                      placeholder="e.g. Routine consultations"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shiftIsOnCall}
                      onChange={(e) => setShiftIsOnCall(e.target.checked)}
                      className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                    />
                    <span>Flag as 24/7 Urgent On-Call Duty (Displays Emergency Badge on TV)</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleAddShiftEntry}
                    disabled={!shiftStaffId}
                    className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition"
                  >
                    + Add Shift
                  </button>
                </div>
              </div>

              {/* Roster Current Entries Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Assigned Shifts ({rosterEntries.length})
                </h4>

                {rosterEntries.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-3 text-center border border-dashed border-slate-200 rounded-xl">
                    No shift assignments added yet. Use the form above to add staff shifts.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {rosterEntries.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900">{e.staffName}</span>
                          <span className="text-slate-400 font-medium">({e.staffDesignation})</span>
                          <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 font-bold text-[10px]">
                            {e.shiftName} ({e.startTime} - {e.endTime})
                          </span>
                          {e.station && (
                            <span className="text-slate-500 text-[11px]">@{e.station}</span>
                          )}
                          {e.isOnCall && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-black text-[9px]">
                              ON-CALL
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveShiftEntry(e.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Handover & Supervisor Notes */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                  Supervisor Handover & Department Remarks
                </label>
                <textarea
                  rows={2}
                  value={rosterNotes}
                  onChange={(e) => setRosterNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g. Ambulance fueled and ready. Reagents stocked. Island speed dial active."
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRosterModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRoster}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-xs transition"
                >
                  Save & Publish Roster
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
