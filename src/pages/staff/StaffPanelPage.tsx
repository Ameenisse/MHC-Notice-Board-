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
  saveWeeklyRoster,
} from '../../services/db';
import {
  Staff,
  Department,
  WeeklyDepartmentRoster,
  WeeklyRosterRow,
  WeeklyRosterShiftCell,
  Notice,
  DutyRequest,
  DutyRequestShiftChoice,
  PublicHoliday,
  RosterDepartmentCategory,
  ShiftHandover,
  ShiftType,
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
  Menu,
  ChevronRight,
  ExternalLink,
  Home,
  ClipboardList,
  Save,
  Edit3,
  SlidersHorizontal,
  UserCheck,
  Activity,
  ShieldCheck,
  CheckSquare,
  Search,
  Filter,
  Trash2,
} from 'lucide-react';
import { StaffLoginGate } from '../../components/staff/StaffLoginGate';

export const StaffPanelPage: React.FC = () => {
  const {
    settings,
    isDemoMode,
    toggleThemeMode,
    appUser,
    logoutAppUser,
    saveShiftHandover,
    handovers,
    refreshHandovers,
    currentUser,
  } = useApp();
  const tz = settings.timezone || 'Indian/Maldives';
  const isNight = settings.themeMode !== 'day';

  // Navigation Tabs in Staff Portal
  const [activeTab, setActiveTab] = useState<
    'dept_roster' | 'my_roster' | 'my_requests' | 'notices' | 'handover' | 'manage_roster'
  >('dept_roster');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Master Data
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [weeklyRosters, setWeeklyRosters] = useState<WeeklyDepartmentRoster[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [myRequests, setMyRequests] = useState<DutyRequest[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Selected Staff Identity (locked to logged in user)
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
        refreshHandovers(),
      ]);

      setStaffList(allStaff);
      setDepartments(allDepts);
      setWeeklyRosters(wRosters);
      setNotices(allNotices);
      setPublicHolidays(holidays);

      // Strict staff member identity locking (NO SWITCHING)
      let defaultStaffId = '';
      if (appUser?.staffId) {
        defaultStaffId = appUser.staffId;
      } else if (appUser?.fullName) {
        const found = allStaff.find(
          (s) => s.fullName.toLowerCase() === appUser.fullName.toLowerCase()
        );
        if (found) defaultStaffId = found.id;
      } else if (appUser?.username) {
        const found = allStaff.find(
          (s) => (s as any).username?.toLowerCase() === appUser.username.toLowerCase() ||
                 s.staffId?.toLowerCase() === appUser.username.toLowerCase()
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

  // Current selected staff object (locked strictly to logged-in user)
  const currentStaff = useMemo(() => {
    const found = staffList.find((s) => s.id === selectedStaffId);
    if (found) return found;
    if (appUser) {
      return {
        id: appUser.staffId || appUser.id,
        fullName: appUser.fullName,
        fullNameDhivehi: appUser.fullNameDhivehi,
        staffId: appUser.staffId || appUser.username.toUpperCase(),
        department: appUser.departmentName || 'General',
        designation: appUser.designation || (appUser.role === 'supervisor' ? 'Duty Supervisor' : appUser.role === 'roster_manager' ? 'Roster Manager' : 'Staff Member'),
        phone: appUser.phone || '',
        email: appUser.email || '',
        active: true,
        roles: appUser.roles || [appUser.role],
        createdAt: appUser.createdAt,
        updatedAt: appUser.updatedAt,
      } as Staff;
    }
    return null;
  }, [staffList, selectedStaffId, appUser]);

  // Role permissions checking
  const isSupervisor = useMemo(() => {
    if (!appUser) return false;
    const role = (appUser.role || '').toLowerCase();
    const roles = (appUser.roles || []).map((r) => r.toLowerCase());
    const desig = (currentStaff?.designation || appUser.designation || '').toLowerCase();
    const staffRoles = (((currentStaff as any)?.roles || []) as string[]).map((r) => r.toLowerCase());
    return (
      role === 'supervisor' ||
      roles.includes('supervisor') ||
      staffRoles.includes('supervisor') ||
      desig.includes('supervisor') ||
      desig.includes('in-charge') ||
      desig.includes('incharge') ||
      role === 'admin' ||
      roles.includes('admin')
    );
  }, [appUser, currentStaff]);

  const isRosterManager = useMemo(() => {
    if (!appUser) return false;
    const role = (appUser.role || '').toLowerCase();
    const roles = (appUser.roles || []).map((r) => r.toLowerCase());
    const desig = (currentStaff?.designation || appUser.designation || '').toLowerCase();
    const staffRoles = (((currentStaff as any)?.roles || []) as string[]).map((r) => r.toLowerCase());
    return (
      role === 'roster_manager' ||
      roles.includes('roster_manager') ||
      staffRoles.includes('roster_manager') ||
      desig.includes('roster manager') ||
      desig.includes('manager') ||
      role === 'admin' ||
      roles.includes('admin')
    );
  }, [appUser, currentStaff]);

  const isSupervisorOrRosterManager = isSupervisor || isRosterManager;
  const isSupervisorOrAdmin = isSupervisorOrRosterManager || appUser?.role === 'admin' || appUser?.roles?.includes('admin');
  const isFullAdmin = appUser?.role === 'admin' || appUser?.roles?.includes('admin');

  // Assigned Department (Supervisor / Roster Manager is strictly restricted to this department)
  const assignedDept = useMemo(() => {
    return appUser?.departmentName || currentStaff?.department || appUser?.departmentId || 'General';
  }, [appUser, currentStaff]);

  const assignedRosterCategory = useMemo<RosterDepartmentCategory>(() => {
    const lower = assignedDept.toLowerCase();
    const desig = (currentStaff?.designation || appUser?.designation || '').toLowerCase();
    if (lower.includes('attend')) return 'attended';
    if (lower.includes('nurse') || desig.includes('nurse')) return 'nurses';
    if (lower.includes('driver') || lower.includes('transport') || desig.includes('driver')) return 'drivers';
    if (lower.includes('customer') || lower.includes('reception') || lower.includes('admin') || desig.includes('customer') || desig.includes('reception')) return 'customer_service';
    return 'nurses';
  }, [assignedDept, currentStaff, appUser]);

  const editableWeeklyRoster = useMemo(() => {
    if (isFullAdmin && selectedDeptFilter !== 'all') {
      return weeklyRosters.find((r) => r.category === selectedDeptFilter) || weeklyRosters[0] || null;
    }
    return weeklyRosters.find((r) => r.category === assignedRosterCategory) || weeklyRosters[0] || null;
  }, [weeklyRosters, isFullAdmin, selectedDeptFilter, assignedRosterCategory]);

  // Shift Handover State (for supervisor / roster manager)
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);
  const [handoverShiftType, setHandoverShiftType] = useState<ShiftType>('morning');
  const [handoverDate, setHandoverDate] = useState<string>(todayStr);
  const [handoverIncomingSupervisor, setHandoverIncomingSupervisor] = useState<string>('');
  const [handoverClinicalSummary, setHandoverClinicalSummary] = useState<string>('');
  const [handoverCriticalPatients, setHandoverCriticalPatients] = useState<number>(0);
  const [handoverBedOccupancy, setHandoverBedOccupancy] = useState<number>(2);
  const [handoverEquipmentChecked, setHandoverEquipmentChecked] = useState<boolean>(true);
  const [handoverPendingLabs, setHandoverPendingLabs] = useState<string>('');
  const [handoverPendingTasks, setHandoverPendingTasks] = useState<string>('');
  const [handoverFilterShift, setHandoverFilterShift] = useState<string>('all');
  const [handoverSearchTerm, setHandoverSearchTerm] = useState<string>('');

  // Roster Management State (for supervisor / roster manager)
  const [isEditingRoster, setIsEditingRoster] = useState(false);
  const [editingRosterData, setEditingRosterData] = useState<WeeklyDepartmentRoster | null>(null);
  const [isSavingRoster, setIsSavingRoster] = useState(false);
  const [selectedCellEdit, setSelectedCellEdit] = useState<{ rowIndex: number; dateStr: string } | null>(null);
  const [addStaffModalOpen, setAddStaffModalOpen] = useState(false);
  const [selectedStaffToAdd, setSelectedStaffToAdd] = useState('');

  // Department handovers filtered strictly to assigned department
  const departmentHandovers = useMemo(() => {
    const deptId = appUser?.departmentId || currentStaff?.department || '';
    const deptName = appUser?.departmentName || currentStaff?.department || '';
    return handovers.filter((h) => {
      const matchDept =
        isFullAdmin ||
        !deptId ||
        h.departmentId === deptId ||
        h.departmentName?.toLowerCase() === deptName.toLowerCase() ||
        h.departmentName?.toLowerCase() === deptId.toLowerCase();
      const matchShift = handoverFilterShift === 'all' || h.shiftType === handoverFilterShift;
      const matchSearch =
        !handoverSearchTerm.trim() ||
        h.clinicalSummary.toLowerCase().includes(handoverSearchTerm.toLowerCase()) ||
        h.supervisorName.toLowerCase().includes(handoverSearchTerm.toLowerCase()) ||
        h.pendingTasks.toLowerCase().includes(handoverSearchTerm.toLowerCase());
      return matchDept && matchShift && matchSearch;
    });
  }, [handovers, appUser, currentStaff, isFullAdmin, handoverFilterShift, handoverSearchTerm]);

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

  // Handover Submission Handler
  const handleSaveHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverClinicalSummary.trim()) {
      showToast('Please provide a clinical / shift summary.', 'error');
      return;
    }
    setIsSubmittingHandover(true);
    try {
      const targetDeptId = appUser?.departmentId || currentStaff?.department || 'General';
      const targetDeptName = appUser?.departmentName || currentStaff?.department || 'General';

      await saveShiftHandover({
        departmentId: targetDeptId,
        departmentName: targetDeptName,
        date: handoverDate,
        shiftType: handoverShiftType,
        supervisorName: appUser?.fullName || currentStaff?.fullName || 'Shift Supervisor',
        supervisorUsername: appUser?.username,
        outgoingSupervisor: appUser?.fullName || currentStaff?.fullName || 'Shift Supervisor',
        incomingSupervisor: handoverIncomingSupervisor.trim(),
        clinicalSummary: handoverClinicalSummary.trim(),
        criticalPatientsCount: Number(handoverCriticalPatients) || 0,
        bedOccupancy: Number(handoverBedOccupancy) || 0,
        emergencyEquipmentChecked: handoverEquipmentChecked,
        pendingLabInvestigations: handoverPendingLabs.trim(),
        pendingTasks: handoverPendingTasks.trim(),
        acknowledged: false,
        timestamp: Date.now(),
      });

      await refreshHandovers(targetDeptId);
      setIsHandoverModalOpen(false);
      setHandoverClinicalSummary('');
      setHandoverPendingTasks('');
      setHandoverPendingLabs('');
      showToast(`Shift Handover logged successfully for ${targetDeptName}! TV Display updated.`);
    } catch (err: any) {
      console.error('Error logging handover:', err);
      showToast(err?.message || 'Failed to save shift handover.', 'error');
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  // Handover Acknowledgment Handler
  const handleAcknowledgeHandover = async (item: ShiftHandover) => {
    try {
      await saveShiftHandover({
        ...item,
        acknowledged: true,
        acknowledgedAt: Date.now(),
        incomingSupervisor: appUser?.fullName || item.incomingSupervisor || 'Incoming Supervisor',
      });
      const targetDeptId = appUser?.departmentId || currentStaff?.department;
      await refreshHandovers(targetDeptId);
      showToast('Shift handover acknowledged.');
    } catch (err: any) {
      showToast('Failed to acknowledge handover.', 'error');
    }
  };

  // Open Roster Editor for Assigned Department Only
  const handleOpenRosterEditor = (roster?: WeeklyDepartmentRoster) => {
    const target = roster || editableWeeklyRoster;
    if (target) {
      setEditingRosterData(JSON.parse(JSON.stringify(target)));
    } else {
      const newDays = [0, 1, 2, 3, 4, 5, 6].map((offset) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        const dateStr = d.toISOString().split('T')[0];
        const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        return {
          dateStr,
          dayName: dayNames[d.getDay()],
          formattedDate: `${d.getDate()}-${d.toLocaleString('en', { month: 'short' })}-${d.getFullYear().toString().slice(2)}`,
        };
      });

      const deptStaff = staffList.filter((s) => {
        const dept = (s.department || '').toLowerCase();
        const desig = (s.designation || '').toLowerCase();
        const cat = assignedRosterCategory;
        if (cat === 'nurses') return dept.includes('nurse') || desig.includes('nurse');
        if (cat === 'attended') return dept.includes('attend') || desig.includes('attend');
        if (cat === 'drivers') return dept.includes('driver') || desig.includes('driver');
        if (cat === 'customer_service') return dept.includes('customer') || dept.includes('reception') || desig.includes('customer');
        return true;
      });

      const initialRows: WeeklyRosterRow[] = (deptStaff.length > 0 ? deptStaff : [currentStaff!]).map((s) => ({
        id: s.id,
        staffName: s.fullName,
        designation: s.designation || 'Staff',
        staffPhotoUrl: s.photoUrl,
        days: newDays.reduce((acc, day) => {
          acc[day.dateStr] = { code: 'M' };
          return acc;
        }, {} as any),
      }));

      const newRoster: WeeklyDepartmentRoster = {
        id: `weekly_${assignedRosterCategory}_${Date.now()}`,
        category: assignedRosterCategory,
        categoryName:
          assignedRosterCategory === 'nurses'
            ? 'Nurses'
            : assignedRosterCategory === 'attended'
            ? 'Attendants'
            : assignedRosterCategory === 'drivers'
            ? 'Drivers'
            : 'Customer Service',
        title: `Weekly Duty Roster - ${assignedDept}`,
        weekRangeText: `${newDays[0].formattedDate} To ${newDays[6].formattedDate}`,
        startDate: newDays[0].dateStr,
        endDate: newDays[6].dateStr,
        days: newDays,
        nightOnCallByDay: {},
        rows: initialRows,
        updatedAt: Date.now(),
      };
      setEditingRosterData(newRoster);
    }
    setIsEditingRoster(true);
    setActiveTab('manage_roster');
  };

  const handleUpdateCellCode = (rowIndex: number, dateStr: string, code: string, subText?: string) => {
    if (!editingRosterData) return;
    const updated = { ...editingRosterData };
    const row = updated.rows[rowIndex];
    if (!row) return;

    row.days = {
      ...row.days,
      [dateStr]: {
        ...row.days[dateStr],
        code,
        subText: subText !== undefined ? subText : row.days[dateStr]?.subText || '',
      },
    };

    setEditingRosterData(updated);
  };

  const handleQuickFillRow = (rowIndex: number, code: string) => {
    if (!editingRosterData) return;
    const updated = { ...editingRosterData };
    const row = updated.rows[rowIndex];
    if (!row) return;

    updated.days.forEach((day) => {
      row.days[day.dateStr] = {
        ...row.days[day.dateStr],
        code,
      };
    });

    setEditingRosterData(updated);
  };

  const handleAddStaffToRoster = (staffId: string) => {
    if (!editingRosterData) return;
    const staff = staffList.find((s) => s.id === staffId);
    if (!staff) return;

    if (editingRosterData.rows.some((r) => r.id === staff.id || r.staffName.toLowerCase() === staff.fullName.toLowerCase())) {
      showToast('This staff member is already on the roster.', 'error');
      return;
    }

    const newRow: WeeklyRosterRow = {
      id: staff.id,
      staffName: staff.fullName,
      designation: staff.designation || 'Staff',
      staffPhotoUrl: staff.photoUrl,
      days: editingRosterData.days.reduce((acc, day) => {
        acc[day.dateStr] = { code: 'M' };
        return acc;
      }, {} as any),
    };

    setEditingRosterData({
      ...editingRosterData,
      rows: [...editingRosterData.rows, newRow],
    });
    setAddStaffModalOpen(false);
    showToast(`Added ${staff.fullName} to roster.`);
  };

  const handleRemoveStaffFromRoster = (rowIndex: number) => {
    if (!editingRosterData) return;
    const row = editingRosterData.rows[rowIndex];
    if (!window.confirm(`Remove ${row?.staffName} from this week's roster?`)) return;

    const updatedRows = editingRosterData.rows.filter((_, idx) => idx !== rowIndex);
    setEditingRosterData({
      ...editingRosterData,
      rows: updatedRows,
    });
  };

  const handleSaveWeeklyRoster = async () => {
    if (!editingRosterData) return;
    setIsSavingRoster(true);
    try {
      const operatorEmail = currentUser?.email || appUser?.username || 'supervisor@mhc.gov.mv';
      const saved = await saveWeeklyRoster(editingRosterData, operatorEmail, isDemoMode);

      setWeeklyRosters((prev) => {
        const idx = prev.findIndex((r) => r.id === saved.id || r.category === saved.category);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = saved;
          return clone;
        }
        return [...prev, saved];
      });

      setIsEditingRoster(false);
      showToast(`Weekly Roster for ${saved.categoryName} saved and published! TV Display updated.`);
    } catch (err: any) {
      console.error('Error saving weekly roster:', err);
      showToast(err?.message || 'Failed to save weekly roster.', 'error');
    } finally {
      setIsSavingRoster(false);
    }
  };

  // Security Gate: Do not let open staff portal without user/pin
  if (!appUser) {
    return <StaffLoginGate onSuccess={loadPortalData} />;
  }

  // Sidebar navigation panel buttons
  const panelNavItems: Array<{
    id: 'dept_roster' | 'my_roster' | 'my_requests' | 'notices' | 'handover' | 'manage_roster';
    label: string;
    icon: any;
    badge: string | null;
    badgeColor?: string;
  }> = [
    {
      id: 'dept_roster',
      label: 'Department Weekly Roster',
      icon: FileSpreadsheet,
      badge: null,
    },
    {
      id: 'my_roster',
      label: 'My Individual Week Roster',
      icon: CalendarDays,
      badge: currentStaff ? currentStaff.fullName.split(' ')[0] : null,
    },
    {
      id: 'my_requests',
      label: 'My Duty Requests',
      icon: FileCheck2,
      badge: pendingCount > 0 ? `${pendingCount} pending` : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'notices',
      label: 'Staff Notices',
      icon: Bell,
      badge: notices.length > 0 ? `${notices.length}` : null,
      badgeColor: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
    },
  ];

  // Supervisor & Roster Manager capabilities restricted strictly to assigned department
  if (isSupervisorOrRosterManager) {
    panelNavItems.push({
      id: 'handover',
      label: 'Log Shift Handover',
      icon: ClipboardList,
      badge: assignedDept.length > 12 ? `${assignedDept.slice(0, 10)}...` : assignedDept,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    });
    panelNavItems.push({
      id: 'manage_roster',
      label: 'Manage Dept Roster',
      icon: FileSpreadsheet,
      badge: 'Roster Manager',
      badgeColor: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    });
  }

  const sidebarContent = (
    <div className={`flex flex-col h-full ${isNight ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'} select-none`}>
      {/* Brand Header */}
      <div className={`p-4 sm:p-5 border-b ${isNight ? 'border-slate-800' : 'border-slate-200'} flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-3 min-w-0">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.orgName}
              className="h-10 w-10 object-contain rounded-xl bg-white p-1 border border-slate-200 dark:border-slate-700 shadow-sm shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <MHCLogo className="h-10 w-10 rounded-xl bg-white p-1 border border-slate-200 dark:border-slate-700 shadow-sm shrink-0" />
          )}
          <div className="flex flex-col min-w-0">
            <span className="font-black text-sm tracking-tight truncate">
              {settings.orgName}
            </span>
            <span className="text-[11px] text-teal-500 font-bold uppercase tracking-wider">
              Staff Portal
            </span>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Staff Identity Card (Fixed & strictly bound to user - NO SWITCHING) */}
      <div className={`px-4 py-3.5 border-b ${isNight ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-400 font-black text-sm flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
            {currentStaff?.photoUrl ? (
              <img
                src={currentStaff.photoUrl}
                alt={currentStaff.fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{(currentStaff?.fullName || appUser.fullName).slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black truncate">
                {currentStaff?.fullName || appUser.fullName}
              </span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Active Staff Session" />
            </div>
            <p className="text-[10px] font-bold text-teal-500 dark:text-teal-400 uppercase tracking-wider truncate">
              {currentStaff?.designation || appUser.designation || 'Staff'} &bull; {currentStaff?.department || appUser.departmentName || 'General'}
            </p>
            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {currentStaff?.staffId || appUser.username}
            </span>
          </div>
        </div>

        {/* Supervisor / Roster Manager Role Badge (Strictly scoped to assigned department) */}
        {isSupervisorOrRosterManager && (
          <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {isSupervisor && isRosterManager
                  ? 'Supervisor & Roster Mgr'
                  : isSupervisor
                  ? 'Duty Supervisor'
                  : 'Roster Manager'}
              </span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 truncate max-w-[110px]" title={assignedDept}>
              {assignedDept}
            </span>
          </div>
        )}
      </div>

      {/* Panel Navigation Buttons in Sidebar */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
        <div className="space-y-1">
          <h3 className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Portal Panels
          </h3>
          <div className="space-y-1 pt-1">
            {panelNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer text-left group ${
                    isActive
                      ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                      : isNight
                      ? 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition ${
                        isActive
                          ? 'text-slate-950 stroke-[2.5]'
                          : isNight
                          ? 'text-slate-400 group-hover:text-teal-300'
                          : 'text-slate-500 group-hover:text-teal-600'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                        isActive
                          ? 'bg-slate-950 text-teal-300'
                          : item.badgeColor || (isNight ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700')
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Duty Request Button */}
        <div className="px-1 pt-1">
          <button
            type="button"
            onClick={() => {
              handleOpenRequestModal();
              setMobileMenuOpen(false);
            }}
            className="w-full py-2.5 px-3 rounded-xl text-xs font-black bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-slate-950 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Submit Duty Request</span>
          </button>
        </div>

        {/* External Links */}
        <div className={`space-y-1 pt-3 border-t ${isNight ? 'border-slate-800' : 'border-slate-200'}`}>
          <h3 className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Terminals &amp; Admin
          </h3>
          <div className="space-y-1 pt-1">
            <Link
              to="/display"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition group ${
                isNight ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Tv className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Live TV Display Board</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-400" />
            </Link>

            {isSupervisorOrAdmin && (
              <Link
                to="/admin/roster"
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition group ${
                  isNight ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Admin Panel</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className={`p-3 border-t ${isNight ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'} space-y-2`}>
        <div className="grid grid-cols-2 gap-2">
          {/* Day / Night switch */}
          <button
            onClick={() => toggleThemeMode()}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              isNight
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
            title="Toggle theme mode"
          >
            {isNight ? (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Night</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Day</span>
              </>
            )}
          </button>

          {/* Return Home */}
          <Link
            to="/display"
            className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              isNight
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
            title="Return to TV Display / Home"
          >
            <Home className="w-3.5 h-3.5 text-teal-400" />
            <span>Home</span>
          </Link>
        </div>

        {/* Lock / Sign Out button */}
        <button
          onClick={() => logoutAppUser()}
          className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
          title="Lock portal and sign out of this session"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Lock / Sign Out ({appUser.username})</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${isNight ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex font-sans transition-colors duration-200`}>
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

      {/* Desktop Persistent Sidebar for Panels Navigation */}
      <aside className={`hidden lg:flex flex-col w-64 xl:w-72 shrink-0 border-r ${isNight ? 'border-slate-800' : 'border-slate-200'} sticky top-0 h-screen z-30 shadow-sm`}>
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex flex-col w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Mobile Header */}
        <header className={`lg:hidden border-b ${isNight ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-slate-200'} sticky top-0 z-20 shadow-xs backdrop-blur-md`}>
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Open staff navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="truncate">
                <h1 className="font-extrabold text-sm leading-tight truncate">
                  {settings.orgName}
                </h1>
                <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">
                  Staff Portal
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Return Home */}
              <Link
                to="/display"
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition"
                title="Return to Home Display"
              >
                <Home className="w-4 h-4 text-teal-400" />
              </Link>

              <button
                type="button"
                onClick={() => handleOpenRequestModal()}
                className="px-3 py-1.5 rounded-xl text-xs font-black bg-teal-600 hover:bg-teal-500 text-white flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Request</span>
              </button>

              <Link
                to="/display"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition"
                title="TV Board"
              >
                <Tv className="w-4 h-4 text-teal-400" />
              </Link>

              <button
                onClick={() => logoutAppUser()}
                className="p-2 text-rose-400 hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Panel Tab Pills */}
          <div className={`px-3 py-2 border-t ${isNight ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50'} overflow-x-auto flex gap-1.5 no-scrollbar`}>
            {panelNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
                    isActive
                      ? 'bg-teal-500 text-slate-950 shadow-xs font-black'
                      : isNight
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        {/* Page Content Body */}
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

              {/* Department quick switch & Supervisor Roster Action */}
              <div className="flex flex-wrap items-center gap-2">
                {isSupervisorOrRosterManager && (
                  <button
                    type="button"
                    onClick={() => handleOpenRosterEditor()}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Manage / Edit {assignedDept} Roster</span>
                  </button>
                )}

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

        {/* ========================================================
            TAB 5: SHIFT HANDOVER (SUPERVISORS / ROSTER MANAGERS ONLY)
            ======================================================== */}
        {activeTab === 'handover' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Department Restrict Banner */}
            <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <span>Shift Handover Management</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                        {assignedDept}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Record clinical shift handovers, patient status, crash cart readiness, and pending tasks for <strong className="text-emerald-300">{assignedDept}</strong> only.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setHandoverDate(todayStr);
                    setHandoverClinicalSummary('');
                    setHandoverPendingTasks('');
                    setHandoverPendingLabs('');
                    setIsHandoverModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md flex items-center gap-2 transition cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Log Shift Handover</span>
                </button>
              </div>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder={`Search ${assignedDept} handover notes, supervisors, tasks...`}
                  value={handoverSearchTerm}
                  onChange={(e) => setHandoverSearchTerm(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-white placeholder-slate-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Shift:</span>
                <select
                  value={handoverFilterShift}
                  onChange={(e) => setHandoverFilterShift(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Shifts</option>
                  <option value="morning">Morning Shift</option>
                  <option value="evening">Evening Shift</option>
                  <option value="night">Night Shift</option>
                  <option value="on_call">On-Call</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>

            {/* Handover List */}
            {departmentHandovers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {departmentHandovers.map((h) => {
                  const isAck = h.acknowledged;
                  return (
                    <div
                      key={h.id}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-sm space-y-4 transition flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Top Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-xl text-xs font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              {h.shiftType.toUpperCase()} SHIFT
                            </span>
                            <span className="text-xs font-bold text-slate-300">
                              {h.date}
                            </span>
                          </div>

                          {isAck ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>Acknowledged</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-950 text-amber-300 border border-amber-700 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Pending Ack</span>
                            </span>
                          )}
                        </div>

                        {/* Supervisor Info */}
                        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Outgoing Supervisor:
                            </span>
                            <span className="font-extrabold text-white">
                              {h.outgoingSupervisor || h.supervisorName}
                            </span>
                          </div>
                          {h.incomingSupervisor && (
                            <div className="text-right">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Incoming:
                              </span>
                              <span className="font-extrabold text-teal-300">
                                {h.incomingSupervisor}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Ward Vitals & Equipment */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-bold">Critical Cases</span>
                            <span className="text-base font-black text-rose-400">
                              {h.criticalPatientsCount ?? 0}
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-bold">Bed Occupancy</span>
                            <span className="text-base font-black text-white">
                              {h.bedOccupancy ?? 0}
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-bold">Crash Cart</span>
                            <span className={`text-xs font-black mt-1 inline-block ${
                              h.emergencyEquipmentChecked ? 'text-emerald-400' : 'text-amber-400'
                            }`}>
                              {h.emergencyEquipmentChecked ? '✓ Checked' : 'Pending'}
                            </span>
                          </div>
                        </div>

                        {/* Clinical Summary */}
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-slate-400">Clinical & Operational Summary:</span>
                          <p className="text-xs text-slate-200 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 leading-relaxed font-medium whitespace-pre-line">
                            {h.clinicalSummary}
                          </p>
                        </div>

                        {/* Pending Tasks */}
                        {h.pendingTasks && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-amber-400">Pending Tasks & Follow-up:</span>
                            <p className="text-xs text-slate-300 bg-amber-950/20 p-2.5 rounded-xl border border-amber-800/30 font-medium">
                              {h.pendingTasks}
                            </p>
                          </div>
                        )}

                        {/* Pending Labs */}
                        {h.pendingLabInvestigations && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-teal-400">Pending Lab & Diagnostics:</span>
                            <p className="text-xs text-slate-300 bg-teal-950/20 p-2.5 rounded-xl border border-teal-800/30 font-medium">
                              {h.pendingLabInvestigations}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatDate(h.date, tz, 'medium')}
                        </span>
                        {!isAck && (
                          <button
                            type="button"
                            onClick={() => handleAcknowledgeHandover(h)}
                            className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Acknowledge Handover</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/60">
                <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-300">No Shift Handovers Logged</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  No handover reports found for <strong className="text-slate-400">{assignedDept}</strong>. Click "Log Shift Handover" to create the first handover report.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setHandoverDate(todayStr);
                    setHandoverClinicalSummary('');
                    setHandoverPendingTasks('');
                    setHandoverPendingLabs('');
                    setIsHandoverModalOpen(true);
                  }}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log Shift Handover</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 6: MANAGE DEPT ROSTER (SUPERVISOR / ROSTER MANAGERS ONLY)
            ======================================================== */}
        {activeTab === 'manage_roster' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Department Restrict Banner */}
            <div className="bg-gradient-to-r from-blue-950/70 via-slate-900 to-slate-900 border border-blue-500/40 rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <span>Roster Manager: Weekly Schedule Editor</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-950 text-blue-300 border border-blue-800">
                        {assignedDept} ({editableWeeklyRoster?.categoryName || 'Roster'})
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Create and edit staff shifts for <strong className="text-blue-300">{assignedDept}</strong>. Click any shift code to edit, or use quick-fill buttons. Changes synchronize to the Live TV Display Board instantly.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setAddStaffModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-black bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Staff to Roster</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveWeeklyRoster}
                  disabled={isSavingRoster}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white flex items-center gap-2 shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isSavingRoster ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 stroke-[2.5]" />
                  )}
                  <span>Save &amp; Publish Roster</span>
                </button>
              </div>
            </div>

            {/* Roster Editor Table */}
            {editingRosterData ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                {/* Table Header Controls */}
                <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                      Week Range:
                    </span>
                    <span className="text-xs font-bold text-white bg-slate-800 px-3 py-1 rounded-lg">
                      {editingRosterData.weekRangeText}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-semibold">Shift Codes:</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-800">M: 08-15</span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 font-bold border border-sky-800">E: 15-23</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold border border-indigo-800">N: 23-08</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">OFF</span>
                  </div>
                </div>

                {/* Grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-black uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4 min-w-[180px]">Staff Member</th>
                        {editingRosterData.days.map((day) => (
                          <th key={day.dateStr} className="py-3 px-2 text-center min-w-[90px]">
                            <div className="text-slate-300 font-extrabold">{day.dayName.slice(0, 3)}</div>
                            <div className="text-[10px] text-slate-500 font-normal">{day.formattedDate.split('-')[0]}</div>
                          </th>
                        ))}
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {editingRosterData.rows.map((row, rIdx) => (
                        <tr key={row.id || rIdx} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 font-black text-xs flex items-center justify-center shrink-0">
                                {row.staffName.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-black text-slate-100">{row.staffName}</div>
                                <div className="text-[10px] text-slate-400 font-medium truncate">{row.designation}</div>
                              </div>
                            </div>
                          </td>

                          {editingRosterData.days.map((day) => {
                            const cell = row.days[day.dateStr];
                            const code = cell?.code || 'OFF';
                            const isM = code === 'M' || code === '1';
                            const isE = code === 'E' || code === '2';
                            const isN = code === 'N';
                            const isOff = code === 'OFF';

                            return (
                              <td key={day.dateStr} className="py-2 px-1 text-center">
                                <select
                                  value={code}
                                  onChange={(e) => handleUpdateCellCode(rIdx, day.dateStr, e.target.value)}
                                  className={`w-full py-1.5 px-1 rounded-lg text-center font-black text-xs cursor-pointer focus:outline-hidden transition border ${
                                    isM
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                      : isE
                                      ? 'bg-sky-950 text-sky-300 border-sky-600'
                                      : isN
                                      ? 'bg-indigo-950 text-indigo-300 border-indigo-600'
                                      : isOff
                                      ? 'bg-slate-800/80 text-slate-400 border-slate-700'
                                      : 'bg-teal-950 text-teal-300 border-teal-600'
                                  }`}
                                >
                                  <option value="M" className="bg-slate-900 text-emerald-300">M (Morning)</option>
                                  <option value="E" className="bg-slate-900 text-sky-300">E (Evening)</option>
                                  <option value="N" className="bg-slate-900 text-indigo-300">N (Night)</option>
                                  <option value="OFF" className="bg-slate-900 text-slate-400">OFF</option>
                                  <option value="1" className="bg-slate-900 text-emerald-300">1 (Shift 1)</option>
                                  <option value="2" className="bg-slate-900 text-sky-300">2 (Shift 2)</option>
                                  <option value="ONCALL" className="bg-slate-900 text-rose-300">ONCALL</option>
                                  <option value="ANNUAL LEAVE" className="bg-slate-900 text-teal-300">Annual Leave</option>
                                  <option value="SICK LEAVE" className="bg-slate-900 text-rose-300">Sick Leave</option>
                                </select>
                              </td>
                            );
                          })}

                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleQuickFillRow(rIdx, 'M')}
                                title="Set all days to Morning"
                                className="px-1.5 py-1 rounded bg-slate-800 hover:bg-emerald-950 text-slate-400 hover:text-emerald-300 text-[10px] font-black transition cursor-pointer"
                              >
                                All M
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickFillRow(rIdx, 'OFF')}
                                title="Set all days to OFF"
                                className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-black transition cursor-pointer"
                              >
                                All OFF
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveStaffFromRoster(rIdx)}
                                title="Remove staff from roster"
                                className="p-1 rounded text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Save Bar */}
                <div className="p-4 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Showing {editingRosterData.rows.length} staff members for {assignedDept}
                  </span>

                  <button
                    type="button"
                    onClick={handleSaveWeeklyRoster}
                    disabled={isSavingRoster}
                    className="px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white flex items-center gap-2 shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isSavingRoster ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Save &amp; Publish Roster Changes</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/60">
                <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-300">Ready to Edit Roster</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Click below to load or create the weekly roster for <strong className="text-slate-400">{assignedDept}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenRosterEditor()}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Start Editing Roster</span>
                </button>
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

      {/* ========================================================
          POPUP MODAL: LOG SHIFT HANDOVER (ASSIGNED DEPARTMENT ONLY)
          ======================================================== */}
      {isHandoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200 text-slate-100 custom-scrollbar">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Log Shift Handover Report
                  </h3>
                  <p className="text-xs text-slate-400">
                    Restricted to your assigned department: <strong className="text-emerald-300">{assignedDept}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHandoverModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveHandover} className="p-6 space-y-4">
              {/* Department Locked Banner */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Target Department (Locked):
                    </span>
                    <span className="text-sm font-black text-white">
                      {assignedDept}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Authorized Dept
                </span>
              </div>

              {/* Shift Type & Date Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Shift Type:
                  </label>
                  <select
                    value={handoverShiftType}
                    onChange={(e) => setHandoverShiftType(e.target.value as ShiftType)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="morning">Morning Shift (08:00 - 16:00)</option>
                    <option value="evening">Evening Shift (16:00 - 00:00)</option>
                    <option value="night">Night Shift (00:00 - 08:00)</option>
                    <option value="on_call">On-Call Coverage (24 Hours)</option>
                    <option value="general">General / Administrative</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Handover Date:
                  </label>
                  <input
                    type="date"
                    value={handoverDate}
                    onChange={(e) => setHandoverDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Supervisors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Outgoing Supervisor (You):
                  </label>
                  <input
                    type="text"
                    value={appUser.fullName}
                    readOnly
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-bold text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Incoming Supervisor:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Aishath Niuma (RN)"
                    value={handoverIncomingSupervisor}
                    onChange={(e) => setHandoverIncomingSupervisor(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Equipment Check & Ward Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Critical Patients:</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={handoverCriticalPatients}
                    onChange={(e) => setHandoverCriticalPatients(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-black text-rose-400 text-center"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Bed Occupancy:</label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={handoverBedOccupancy}
                    onChange={(e) => setHandoverBedOccupancy(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-black text-white text-center"
                  />
                </div>

                <div className="flex flex-col justify-center">
                  <label className="text-[11px] font-bold text-slate-400 mb-1">Crash Cart / ER Equip:</label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={handoverEquipmentChecked}
                      onChange={(e) => setHandoverEquipmentChecked(e.target.checked)}
                      className="w-4 h-4 text-emerald-500 rounded-sm bg-slate-900 border-slate-700"
                    />
                    <span>Verified Ready</span>
                  </label>
                </div>
              </div>

              {/* Clinical Summary */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Clinical &amp; Operational Shift Summary <span className="text-rose-400">*</span>:
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder={`Summary of shift events, patient admissions, procedures, and notable clinical occurrences in ${assignedDept}...`}
                  value={handoverClinicalSummary}
                  onChange={(e) => setHandoverClinicalSummary(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 resize-none leading-relaxed"
                />
              </div>

              {/* Pending Tasks */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Pending Tasks &amp; Clinical Follow-up:
                </label>
                <textarea
                  rows={2}
                  placeholder="Orders pending, discharge summaries, IV fluids titration, patient monitor review..."
                  value={handoverPendingTasks}
                  onChange={(e) => setHandoverPendingTasks(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 resize-none leading-relaxed"
                />
              </div>

              {/* Pending Lab Investigations */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Pending Lab &amp; Diagnostic Investigations:
                </label>
                <textarea
                  rows={2}
                  placeholder="Blood culture results, urgent electrolytes, ECG review, X-Ray reports pending..."
                  value={handoverPendingLabs}
                  onChange={(e) => setHandoverPendingLabs(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 resize-none leading-relaxed"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsHandoverModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingHandover}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingHandover ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Handover...</span>
                    </>
                  ) : (
                    <>
                      <ClipboardList className="w-4 h-4" />
                      <span>Log &amp; Sync Handover</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          POPUP MODAL: ADD STAFF TO ROSTER
          ======================================================== */}
      {addStaffModalOpen && editingRosterData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-black text-white">
                  Add Staff to {assignedDept} Roster
                </h3>
                <p className="text-xs text-slate-400">
                  Select a staff member from your department to add
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddStaffModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {staffList
                .filter((s) => !editingRosterData.rows.some((r) => r.id === s.id || r.staffName.toLowerCase() === s.fullName.toLowerCase()))
                .map((staff) => (
                  <div
                    key={staff.id}
                    onClick={() => handleAddStaffToRoster(staff.id)}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-teal-500/50 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between transition"
                  >
                    <div>
                      <span className="text-xs font-bold text-white block">{staff.fullName}</span>
                      <span className="text-[10px] text-teal-400 font-medium">
                        {staff.designation || 'Staff'} &bull; {staff.department || 'General'}
                      </span>
                    </div>
                    <span className="text-[10px] font-black uppercase text-teal-400 bg-teal-500/10 px-2 py-1 rounded-lg">
                      + Add
                    </span>
                  </div>
                ))}
              {staffList.filter((s) => !editingRosterData.rows.some((r) => r.id === s.id)).length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400">
                  All available staff members are already on this weekly roster.
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setAddStaffModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
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
    </div>
  );
};
