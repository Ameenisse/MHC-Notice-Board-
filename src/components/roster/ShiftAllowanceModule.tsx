import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Staff,
  Department,
  StaffAllowanceRate,
  DutyAllowanceSheet,
  StaffAllowanceSummary,
  DutyAllowanceCalculationEntry,
} from '../../types';
import {
  getStaffAllowanceRatesList,
  saveStaffAllowanceRate,
  saveStaffAllowanceRatesBatch,
  deleteStaffAllowanceRate,
  getDutyAllowanceSheetsList,
  saveDutyAllowanceSheet,
  deleteDutyAllowanceSheet,
  calculateShiftDutyAllowance,
} from '../../services/db';
import { getTodayString } from '../../utils/dateUtils';
import {
  FileSpreadsheet,
  Coins,
  Settings,
  Calendar,
  Filter,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Download,
  Printer,
  Save,
  Users,
  Building,
  Sparkles,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Clock,
  Eye,
  ArrowUpDown,
  History,
  FileCheck,
} from 'lucide-react';

interface ShiftAllowanceModuleProps {
  staffList: Staff[];
  departments: Department[];
  defaultView?: 'sheet' | 'rates';
}

export const ShiftAllowanceModule: React.FC<ShiftAllowanceModuleProps> = ({
  staffList,
  departments,
  defaultView = 'sheet',
}) => {
  const { isDemoMode, currentUser, settings } = useApp();
  const tz = settings.timezone || 'Indian/Maldives';

  // Navigation tab inside allowance module
  const [activeTab, setActiveTab] = useState<'sheet' | 'rates' | 'saved_sheets'>(defaultView);

  // Allowance Rates state
  const [rates, setRates] = useState<StaffAllowanceRate[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [rateSearch, setRateSearch] = useState('');
  const [rateDeptFilter, setRateDeptFilter] = useState('all');

  // Edit / Add Rate Modal
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<StaffAllowanceRate | null>(null);
  const [rateForm, setRateForm] = useState({
    staffId: '',
    normalDayRate: 150,
    weekendDayRate: 200,
    holidayRate: 250,
    nightShiftAllowance: 50,
    onCallRate: 100,
    currency: 'MVR',
    notes: '',
  });

  // Batch rates modal
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchDeptId, setBatchDeptId] = useState('all');
  const [batchForm, setBatchForm] = useState({
    normalDayRate: 150,
    weekendDayRate: 200,
    holidayRate: 250,
    nightShiftAllowance: 50,
    onCallRate: 100,
  });

  // Report Generator State
  const today = getTodayString(tz);
  // Default range: First day of current month to today (or end of month)
  const [yearStr, monthStr] = today.split('-');
  const firstOfMonth = `${yearStr}-${monthStr}-01`;
  const [fromDate, setFromDate] = useState<string>(firstOfMonth);
  const [toDate, setToDate] = useState<string>(today);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [generatingReport, setGeneratingReport] = useState(false);

  // Generated Report Result
  const [reportResult, setReportResult] = useState<{
    fromDate: string;
    toDate: string;
    departmentId: string;
    departmentName: string;
    staffSummaries: StaffAllowanceSummary[];
    allEntries: DutyAllowanceCalculationEntry[];
    totalDutiesCount: number;
    totalAllowanceAmount: number;
    currency: string;
  } | null>(null);

  // Expanded staff rows in summary table
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [reportSubTab, setReportSubTab] = useState<'summary' | 'itemized'>('summary');
  const [itemizedSearch, setItemizedSearch] = useState('');

  // Saved sheets history
  const [savedSheets, setSavedSheets] = useState<DutyAllowanceSheet[]>([]);
  const [sheetTitle, setSheetTitle] = useState('');
  const [sheetNotes, setSheetNotes] = useState('');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Load Rates and Saved Sheets
  const loadRatesAndHistory = async () => {
    setLoadingRates(true);
    try {
      const [rList, sList] = await Promise.all([
        getStaffAllowanceRatesList(isDemoMode),
        getDutyAllowanceSheetsList(isDemoMode),
      ]);
      setRates(rList);
      setSavedSheets(sList);
    } catch (err) {
      console.warn('Error loading rates/sheets:', err);
    } finally {
      setLoadingRates(false);
    }
  };

  useEffect(() => {
    loadRatesAndHistory();
  }, [isDemoMode]);

  // Handle Preset Date Ranges
  const handleSetPreset = (preset: 'today' | 'this_week' | 'this_month' | 'last_month') => {
    const now = new Date();
    if (preset === 'today') {
      setFromDate(today);
      setToDate(today);
    } else if (preset === 'this_week') {
      const current = new Date();
      const first = current.getDate() - current.getDay(); // Sunday
      const last = first + 6; // Saturday
      const firstDay = new Date(current.setDate(first));
      const lastDay = new Date(current.setDate(last));
      const format = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setFromDate(format(firstDay));
      setToDate(format(lastDay));
    } else if (preset === 'this_month') {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      setFromDate(`${y}-${m}-01`);
      setToDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'last_month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const y = prev.getFullYear();
      const m = String(prev.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, prev.getMonth() + 1, 0).getDate();
      setFromDate(`${y}-${m}-01`);
      setToDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
    }
  };

  // Generate Report
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await calculateShiftDutyAllowance({
        fromDate,
        toDate,
        departmentId: selectedDeptId,
        staffId: selectedStaffId,
        isDemoMode,
      });
      setReportResult(res);
      setSheetTitle(`Shift Allowance Sheet (${fromDate} to ${toDate})`);
      setActionSuccess(`Generated shift duty allowance report for ${res.totalDutiesCount} shifts.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      console.error('Error generating shift allowance report:', err);
    } finally {
      setGeneratingReport(false);
    }
  };

  // Initial auto-generation on load
  useEffect(() => {
    handleGenerateReport();
  }, []);

  // Open Edit Rate Modal
  const handleOpenRateModal = (rate?: StaffAllowanceRate, preSelectedStaffId?: string) => {
    if (rate) {
      setEditingRate(rate);
      setRateForm({
        staffId: rate.staffId,
        normalDayRate: rate.normalDayRate,
        weekendDayRate: rate.weekendDayRate,
        holidayRate: rate.holidayRate,
        nightShiftAllowance: rate.nightShiftAllowance,
        onCallRate: rate.onCallRate,
        currency: rate.currency || 'MVR',
        notes: rate.notes || '',
      });
    } else {
      const targetStaff = staffList.find((s) => s.id === preSelectedStaffId) || staffList[0];
      setEditingRate(null);
      setRateForm({
        staffId: targetStaff ? targetStaff.id : '',
        normalDayRate: 150,
        weekendDayRate: 200,
        holidayRate: 250,
        nightShiftAllowance: 50,
        onCallRate: 100,
        currency: 'MVR',
        notes: '',
      });
    }
    setIsRateModalOpen(true);
  };

  // Save Rate
  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const staff = staffList.find((s) => s.id === rateForm.staffId);
    if (!staff) return;

    const record: StaffAllowanceRate = {
      id: editingRate ? editingRate.id : `rate_${staff.id}`,
      staffId: staff.id,
      staffName: staff.fullName,
      staffCustomId: staff.staffId,
      departmentId: staff.department,
      departmentName: staff.department,
      designation: staff.designation,
      normalDayRate: Number(rateForm.normalDayRate) || 0,
      weekendDayRate: Number(rateForm.weekendDayRate) || 0,
      holidayRate: Number(rateForm.holidayRate) || 0,
      nightShiftAllowance: Number(rateForm.nightShiftAllowance) || 0,
      onCallRate: Number(rateForm.onCallRate) || 0,
      currency: rateForm.currency || 'MVR',
      notes: rateForm.notes,
      active: true,
      createdAt: editingRate?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    await saveStaffAllowanceRate(record, isDemoMode, currentUser?.displayName || 'Administrator');
    setIsRateModalOpen(false);
    setActionSuccess(`Allowance rates updated for ${staff.fullName}`);
    setTimeout(() => setActionSuccess(null), 4000);
    await loadRatesAndHistory();
    // Refresh current report calculation if displayed
    if (reportResult) {
      handleGenerateReport();
    }
  };

  // Delete Rate
  const handleDeleteRate = async (id: string, staffName: string) => {
    if (window.confirm(`Are you sure you want to reset custom rates for ${staffName}?`)) {
      await deleteStaffAllowanceRate(id, currentUser?.displayName || 'Administrator', isDemoMode);
      setActionSuccess(`Allowance rates deleted for ${staffName}`);
      setTimeout(() => setActionSuccess(null), 4000);
      await loadRatesAndHistory();
      if (reportResult) handleGenerateReport();
    }
  };

  // Batch Update Rates
  const handleBatchUpdateRates = async (e: React.FormEvent) => {
    e.preventDefault();
    let targets = staffList.filter((s) => s.active !== false);
    if (batchDeptId !== 'all') {
      const targetDeptObj = departments.find((d) => d.id === batchDeptId);
      const targetDeptName = targetDeptObj ? targetDeptObj.name.toLowerCase() : batchDeptId.toLowerCase();
      targets = targets.filter((s) => s.department && s.department.toLowerCase() === targetDeptName);
    }

    const newRates: StaffAllowanceRate[] = targets.map((s) => ({
      id: `rate_${s.id}`,
      staffId: s.id,
      staffName: s.fullName,
      staffCustomId: s.staffId,
      departmentId: s.department,
      departmentName: s.department,
      designation: s.designation,
      normalDayRate: Number(batchForm.normalDayRate) || 0,
      weekendDayRate: Number(batchForm.weekendDayRate) || 0,
      holidayRate: Number(batchForm.holidayRate) || 0,
      nightShiftAllowance: Number(batchForm.nightShiftAllowance) || 0,
      onCallRate: Number(batchForm.onCallRate) || 0,
      currency: 'MVR',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    await saveStaffAllowanceRatesBatch(newRates, isDemoMode, currentUser?.displayName || 'Administrator');
    setIsBatchModalOpen(false);
    setActionSuccess(`Standard allowance rates applied to ${newRates.length} staff.`);
    setTimeout(() => setActionSuccess(null), 4000);
    await loadRatesAndHistory();
    if (reportResult) handleGenerateReport();
  };

  // Save Generated Allowance Sheet to Archive
  const handleSaveReportSheet = async () => {
    if (!reportResult) return;
    const sheet: DutyAllowanceSheet = {
      id: `sheet_${Date.now()}`,
      title: sheetTitle.trim() || `Shift Allowance (${reportResult.fromDate} to ${reportResult.toDate})`,
      fromDate: reportResult.fromDate,
      toDate: reportResult.toDate,
      departmentId: reportResult.departmentId,
      departmentName: reportResult.departmentName,
      staffSummaries: reportResult.staffSummaries,
      totalDutiesCount: reportResult.totalDutiesCount,
      totalAllowanceAmount: reportResult.totalAllowanceAmount,
      currency: reportResult.currency,
      generatedBy: currentUser?.displayName || 'Duty Supervisor',
      status: 'verified',
      notes: sheetNotes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveDutyAllowanceSheet(sheet, isDemoMode, currentUser?.displayName || 'Supervisor');
    setIsSaveModalOpen(false);
    setActionSuccess('Allowance Sheet successfully saved to archive.');
    setTimeout(() => setActionSuccess(null), 4000);
    await loadRatesAndHistory();
  };

  // Delete Saved Sheet
  const handleDeleteSavedSheet = async (sheetId: string, title: string) => {
    if (window.confirm(`Delete saved allowance sheet "${title}"?`)) {
      await deleteDutyAllowanceSheet(sheetId, currentUser?.displayName || 'Supervisor', isDemoMode);
      setActionSuccess('Archived allowance sheet deleted.');
      setTimeout(() => setActionSuccess(null), 4000);
      await loadRatesAndHistory();
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!reportResult || reportResult.allEntries.length === 0) return;

    const headers = [
      'Date',
      'Day',
      'Staff ID',
      'Staff Name',
      'Department',
      'Shift Code',
      'Shift Description',
      'Day Type',
      'Base Rate (MVR)',
      'Night Allowance (MVR)',
      'Total Payable (MVR)',
      'Approved Duty Request',
    ];

    const rows = reportResult.allEntries.map((e) => [
      `"${e.date}"`,
      `"${e.dayName}"`,
      `"${e.staffCustomId || ''}"`,
      `"${e.staffName.replace(/"/g, '""')}"`,
      `"${e.departmentName || ''}"`,
      `"${e.shiftCode}"`,
      `"${(e.shiftLabel || '').replace(/"/g, '""')}"`,
      `"${e.dayTypeLabel}"`,
      e.rateApplied,
      e.nightAllowanceApplied,
      e.totalForShift,
      e.isDutyRequestApproved ? 'YES' : 'NO',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `shift_duty_allowance_${reportResult.fromDate}_to_${reportResult.toDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Sheet
  const handlePrintSheet = () => {
    window.print();
  };

  // Filtered Rates for Tab 2
  const filteredRates = useMemo(() => {
    return rates.filter((r) => {
      const matchSearch =
        r.staffName.toLowerCase().includes(rateSearch.toLowerCase()) ||
        (r.staffCustomId && r.staffCustomId.toLowerCase().includes(rateSearch.toLowerCase())) ||
        (r.designation && r.designation.toLowerCase().includes(rateSearch.toLowerCase()));
      const matchDept = rateDeptFilter === 'all' || r.departmentId === rateDeptFilter;
      return matchSearch && matchDept;
    });
  }, [rates, rateSearch, rateDeptFilter]);

  // Filtered Itemized Entries for Tab 1
  const filteredItemizedEntries = useMemo(() => {
    if (!reportResult) return [];
    if (!itemizedSearch.trim()) return reportResult.allEntries;
    const q = itemizedSearch.toLowerCase();
    return reportResult.allEntries.filter(
      (e) =>
        e.staffName.toLowerCase().includes(q) ||
        (e.staffCustomId && e.staffCustomId.toLowerCase().includes(q)) ||
        e.shiftCode.toLowerCase().includes(q) ||
        e.date.includes(q) ||
        e.dayTypeLabel.toLowerCase().includes(q)
    );
  }, [reportResult, itemizedSearch]);

  return (
    <div className="space-y-6">
      {/* Action Notification */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-semibold shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Sub-Navigation Bar */}
      <div className="bg-white rounded-2xl p-2.5 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('sheet')}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${
              activeTab === 'sheet'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Generate Allowance Sheet</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rates')}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${
              activeTab === 'rates'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Staff Allowance Rates Settings ({rates.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('saved_sheets')}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${
              activeTab === 'saved_sheets'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Archived Allowance Sheets ({savedSheets.length})</span>
          </button>
        </div>

        {activeTab === 'rates' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBatchModalOpen(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
              title="Apply uniform rate set to entire department"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Batch Set Default Rates</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenRateModal()}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Staff Rate</span>
            </button>
          </div>
        )}
      </div>

      {/* =========================================================================
          TAB 1: SHIFT DUTY ALLOWANCE REPORT GENERATOR
          ========================================================================= */}
      {activeTab === 'sheet' && (
        <div className="space-y-6">
          {/* Filter & Generator Panel */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-teal-600" />
                  <span>Supervisor Shift Duty Allowance Generator</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a date range to automatically scan duty rosters, evaluate working days, Fridays/weekends, and public holidays, and compute allowance payable.
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-700">
                <button
                  type="button"
                  onClick={() => handleSetPreset('this_week')}
                  className="px-2.5 py-1 rounded-lg hover:bg-white transition"
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPreset('this_month')}
                  className="px-2.5 py-1 rounded-lg hover:bg-white transition"
                >
                  Current Month
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPreset('last_month')}
                  className="px-2.5 py-1 rounded-lg hover:bg-white transition"
                >
                  Last Month
                </button>
              </div>
            </div>

            {/* Controls Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden bg-white"
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Staff Member</label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden bg-white"
                >
                  <option value="all">All Staff Members</option>
                  {staffList
                    .filter((s) => {
                      if (selectedDeptId === 'all') return true;
                      const dept = departments.find((d) => d.id === selectedDeptId);
                      return s.department && dept && s.department.toLowerCase() === dept.name.toLowerCase();
                    })
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} {s.staffId ? `(${s.staffId})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={generatingReport}
                  className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${generatingReport ? 'animate-spin' : ''}`} />
                  <span>{generatingReport ? 'Calculating...' : 'Generate Sheet'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Report Results */}
          {reportResult && (
            <div className="space-y-6">
              {/* Executive KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-teal-500 to-teal-700 text-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-teal-100 text-xs font-extrabold uppercase tracking-wider">
                      Total Allowance Payable
                    </span>
                    <Coins className="w-5 h-5 text-teal-200" />
                  </div>
                  <div className="mt-2 text-2xl font-black">
                    {reportResult.currency} {reportResult.totalAllowanceAmount.toLocaleString()}
                  </div>
                  <div className="mt-1 text-teal-100 text-xs font-medium">
                    Calculated for {reportResult.staffSummaries.length} eligible staff members
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs font-extrabold uppercase tracking-wider">
                      Total Duties Worked
                    </span>
                    <Clock className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-900">
                    {reportResult.totalDutiesCount} <span className="text-sm font-semibold text-slate-500">Shifts</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 font-medium">
                    Between {reportResult.fromDate} and {reportResult.toDate}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs font-extrabold uppercase tracking-wider">
                      Friday & Weekend Shifts
                    </span>
                    <Calendar className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-900">
                    {reportResult.staffSummaries.reduce((sum, s) => sum + s.weekendDuties, 0)}{' '}
                    <span className="text-sm font-semibold text-slate-500">Weekend Duties</span>
                  </div>
                  <div className="mt-1 text-xs text-indigo-600 font-bold">
                    {reportResult.currency}{' '}
                    {reportResult.staffSummaries
                      .reduce((sum, s) => sum + s.weekendTotal, 0)
                      .toLocaleString()}{' '}
                    at special weekend rate
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs font-extrabold uppercase tracking-wider">
                      Public Holiday Duties
                    </span>
                    <Sparkles className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-900">
                    {reportResult.staffSummaries.reduce((sum, s) => sum + s.holidayDuties, 0)}{' '}
                    <span className="text-sm font-semibold text-slate-500">Holiday Duties</span>
                  </div>
                  <div className="mt-1 text-xs text-amber-700 font-bold">
                    {reportResult.currency}{' '}
                    {reportResult.staffSummaries
                      .reduce((sum, s) => sum + s.holidayTotal, 0)
                      .toLocaleString()}{' '}
                    premium holiday rate
                  </div>
                </div>
              </div>

              {/* Action Toolbar (Export, Print, Save Archive) */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReportSubTab('summary')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                      reportSubTab === 'summary'
                        ? 'bg-teal-100 text-teal-800'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Staff Summary Breakdown
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportSubTab('itemized')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                      reportSubTab === 'itemized'
                        ? 'bg-teal-100 text-teal-800'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Itemized Shift Log ({reportResult.allEntries.length})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
                    title="Export itemized data to CSV spreadsheet"
                  >
                    <Download className="w-3.5 h-3.5 text-teal-700" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintSheet}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
                    title="Print or Save as PDF"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-700" />
                    <span>Print Official Sheet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSaveModalOpen(true)}
                    className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save & Archive Sheet</span>
                  </button>
                </div>
              </div>

              {/* Printable Official Header */}
              <div className="hidden print:block mb-6 p-4 border-b-2 border-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">
                      {settings.orgName || 'MANDHOO HEALTH CENTRE'}
                    </h1>
                    <p className="text-xs font-semibold text-slate-600">
                      DEPARTMENT SHIFT DUTY ALLOWANCE STATEMENT
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-bold">Period: {reportResult.fromDate} to {reportResult.toDate}</p>
                    <p className="text-slate-500">Department: {reportResult.departmentName}</p>
                    <p className="text-slate-500">Date Generated: {today}</p>
                  </div>
                </div>
              </div>

              {/* SUB-VIEW 1: STAFF SUMMARY TABLE */}
              {reportSubTab === 'summary' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Staff Shift Duty Allowance Summary</h4>
                      <p className="text-xs text-slate-500">
                        Detailed breakdown per employee based on weekday, weekend, holiday, and night duty rates.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                      {reportResult.staffSummaries.length} Staff Members
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                          <th className="py-3 px-4">Staff Member</th>
                          <th className="py-3 px-3">Dept & Designation</th>
                          <th className="py-3 px-3 text-center">Normal Duties</th>
                          <th className="py-3 px-3 text-center">Weekend Duties</th>
                          <th className="py-3 px-3 text-center">Holiday Duties</th>
                          <th className="py-3 px-3 text-center">Night Shifts</th>
                          <th className="py-3 px-3 text-center">Total Duties</th>
                          <th className="py-3 px-4 text-right">Total Allowance</th>
                          <th className="py-3 px-3 text-center print:hidden">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {reportResult.staffSummaries.map((staffSummary) => {
                          const isExpanded = expandedStaffId === staffSummary.staffId;
                          return (
                            <React.Fragment key={staffSummary.staffId}>
                              <tr className="hover:bg-teal-50/30 transition">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-900">{staffSummary.staffName}</div>
                                  {staffSummary.staffCustomId && (
                                    <div className="text-[11px] text-teal-700 font-mono">
                                      ID: {staffSummary.staffCustomId}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="font-semibold text-slate-700">
                                    {staffSummary.departmentName || 'General'}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {staffSummary.designation || 'Staff'}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className="font-bold">{staffSummary.normalDayDuties}</span>
                                  <div className="text-[10px] text-slate-500">
                                    {staffSummary.currency} {staffSummary.normalDayTotal}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className="font-bold text-indigo-700">
                                    {staffSummary.weekendDuties}
                                  </span>
                                  <div className="text-[10px] text-indigo-600">
                                    {staffSummary.currency} {staffSummary.weekendTotal}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className="font-bold text-amber-700">
                                    {staffSummary.holidayDuties}
                                  </span>
                                  <div className="text-[10px] text-amber-600">
                                    {staffSummary.currency} {staffSummary.holidayTotal}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className="font-bold text-purple-700">
                                    {staffSummary.nightShiftDuties}
                                  </span>
                                  <div className="text-[10px] text-purple-600">
                                    +{staffSummary.currency} {staffSummary.nightShiftTotal}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center font-extrabold text-slate-900">
                                  {staffSummary.totalDuties}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="font-black text-sm text-teal-700">
                                    {staffSummary.currency}{' '}
                                    {staffSummary.grandTotalAllowance.toLocaleString()}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center print:hidden">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedStaffId(isExpanded ? null : staffSummary.staffId)
                                    }
                                    className="px-2.5 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100 rounded-lg transition inline-flex items-center gap-1"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{isExpanded ? 'Hide' : 'View'}</span>
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded Itemized Shifts for this Staff */}
                              {isExpanded && (
                                <tr className="bg-slate-50/70 border-y border-slate-200 print:hidden">
                                  <td colSpan={9} className="p-4">
                                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
                                      <div className="flex items-center justify-between">
                                        <h5 className="font-bold text-xs text-slate-800 flex items-center gap-2">
                                          <span>Itemized Duties for {staffSummary.staffName}</span>
                                          <span className="text-[10px] text-slate-500 font-normal">
                                            ({staffSummary.entries.length} shifts recorded in period)
                                          </span>
                                        </h5>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenRateModal(undefined, staffSummary.staffId)}
                                          className="text-[11px] font-bold text-teal-700 hover:underline flex items-center gap-1"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                          <span>Adjust Rate Settings</span>
                                        </button>
                                      </div>

                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                          <thead>
                                            <tr className="border-b border-slate-200 text-slate-500 text-[10px] font-bold">
                                              <th className="py-1.5 px-2">Date & Day</th>
                                              <th className="py-1.5 px-2">Shift Code & Name</th>
                                              <th className="py-1.5 px-2">Day Type</th>
                                              <th className="py-1.5 px-2 text-right">Base Rate</th>
                                              <th className="py-1.5 px-2 text-right">Night Extra</th>
                                              <th className="py-1.5 px-2 text-right">Day Total</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 text-[11px]">
                                            {staffSummary.entries.map((entry) => (
                                              <tr key={entry.id} className="hover:bg-slate-50">
                                                <td className="py-2 px-2 font-mono font-medium">
                                                  {entry.date} ({entry.dayName})
                                                </td>
                                                <td className="py-2 px-2">
                                                  <span
                                                    className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                                      entry.isDutyRequestApproved
                                                        ? 'bg-rose-100 text-red-600 border border-red-300'
                                                        : 'bg-slate-100 text-slate-800'
                                                    }`}
                                                  >
                                                    {entry.shiftCode}
                                                  </span>
                                                  <span className="ml-1.5 text-slate-600">
                                                    {entry.shiftLabel}
                                                  </span>
                                                  {entry.isDutyRequestApproved && (
                                                    <span className="ml-1.5 text-[10px] font-bold text-red-600">
                                                      (Approved Request)
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-2 px-2">
                                                  <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                      entry.dayType === 'holiday'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : entry.dayType === 'weekend'
                                                        ? 'bg-indigo-100 text-indigo-800'
                                                        : 'bg-slate-100 text-slate-700'
                                                    }`}
                                                  >
                                                    {entry.dayTypeLabel}
                                                  </span>
                                                </td>
                                                <td className="py-2 px-2 text-right font-medium">
                                                  {staffSummary.currency} {entry.rateApplied}
                                                </td>
                                                <td className="py-2 px-2 text-right font-medium text-purple-700">
                                                  {entry.nightAllowanceApplied > 0
                                                    ? `+${staffSummary.currency} ${entry.nightAllowanceApplied}`
                                                    : '-'}
                                                </td>
                                                <td className="py-2 px-2 text-right font-bold text-teal-800">
                                                  {staffSummary.currency} {entry.totalForShift}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300">
                          <td colSpan={2} className="py-3 px-4 uppercase tracking-wider text-xs">
                            Grand Totals
                          </td>
                          <td className="py-3 px-3 text-center">
                            {reportResult.staffSummaries.reduce((sum, s) => sum + s.normalDayDuties, 0)}
                          </td>
                          <td className="py-3 px-3 text-center text-indigo-800">
                            {reportResult.staffSummaries.reduce((sum, s) => sum + s.weekendDuties, 0)}
                          </td>
                          <td className="py-3 px-3 text-center text-amber-800">
                            {reportResult.staffSummaries.reduce((sum, s) => sum + s.holidayDuties, 0)}
                          </td>
                          <td className="py-3 px-3 text-center text-purple-800">
                            {reportResult.staffSummaries.reduce((sum, s) => sum + s.nightShiftDuties, 0)}
                          </td>
                          <td className="py-3 px-3 text-center text-sm font-black">
                            {reportResult.totalDutiesCount}
                          </td>
                          <td className="py-3 px-4 text-right text-base font-black text-teal-800">
                            {reportResult.currency} {reportResult.totalAllowanceAmount.toLocaleString()}
                          </td>
                          <td className="print:hidden"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 2: FULL ITEMIZED LOG */}
              {reportSubTab === 'itemized' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-3">
                  <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search shift by staff name, ID, code, or date..."
                        value={itemizedSearch}
                        onChange={(e) => setItemizedSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <span className="text-xs text-slate-500 font-bold">
                      Showing {filteredItemizedEntries.length} of {reportResult.allEntries.length} shifts
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Staff Name</th>
                          <th className="py-2.5 px-3">Department</th>
                          <th className="py-2.5 px-3">Shift</th>
                          <th className="py-2.5 px-3">Day Type</th>
                          <th className="py-2.5 px-3 text-right">Base Rate</th>
                          <th className="py-2.5 px-3 text-right">Night Extra</th>
                          <th className="py-2.5 px-3 text-right">Total Payable</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800 text-[11px]">
                        {filteredItemizedEntries.map((e) => (
                          <tr key={e.id} className="hover:bg-slate-50/60">
                            <td className="py-2 px-3 font-mono font-medium">
                              {e.date} ({e.dayName})
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {e.staffName}
                              {e.staffCustomId && (
                                <span className="ml-1 text-[10px] text-teal-700 font-mono font-normal">
                                  [{e.staffCustomId}]
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{e.departmentName || 'General'}</td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                                  e.isDutyRequestApproved
                                    ? 'bg-rose-100 text-red-600 border border-red-300'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {e.shiftCode}
                              </span>
                              <span className="ml-1.5 text-slate-700">{e.shiftLabel}</span>
                              {e.isDutyRequestApproved && (
                                <span className="ml-1 text-[9px] font-bold text-red-600">
                                  (Approved)
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  e.dayType === 'holiday'
                                    ? 'bg-amber-100 text-amber-800'
                                    : e.dayType === 'weekend'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {e.dayTypeLabel}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-slate-700">
                              {reportResult.currency} {e.rateApplied}
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-purple-700">
                              {e.nightAllowanceApplied > 0
                                ? `+${reportResult.currency} ${e.nightAllowanceApplied}`
                                : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-extrabold text-teal-800">
                              {reportResult.currency} {e.totalForShift}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Official Signature Verification Footer (Visible on Print and Screen) */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-xs text-slate-600">
                  <div className="space-y-8 border-t border-dashed border-slate-300 pt-4">
                    <p className="font-bold text-slate-900">1. Prepared By (Duty Supervisor):</p>
                    <div className="h-10 border-b border-slate-400"></div>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {currentUser?.displayName || 'Supervisor in Charge'}
                      </p>
                      <p className="text-[11px] text-slate-500">Date: {today}</p>
                    </div>
                  </div>

                  <div className="space-y-8 border-t border-dashed border-slate-300 pt-4">
                    <p className="font-bold text-slate-900">2. Verified By (Head of Section):</p>
                    <div className="h-10 border-b border-slate-400"></div>
                    <div>
                      <p className="font-semibold text-slate-800">Clinical Administrator</p>
                      <p className="text-[11px] text-slate-500">Signature & Official Stamp</p>
                    </div>
                  </div>

                  <div className="space-y-8 border-t border-dashed border-slate-300 pt-4">
                    <p className="font-bold text-slate-900">3. Approved For Payment (Finance):</p>
                    <div className="h-10 border-b border-slate-400"></div>
                    <div>
                      <p className="font-semibold text-slate-800">
                        Total Approved: {reportResult.currency}{' '}
                        {reportResult.totalAllowanceAmount.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-500">Finance & HR Section</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: ADMIN PANEL DUTY ROSTER SETTINGS (STAFF ALLOWANCE RATES CRUD)
          ========================================================================= */}
      {activeTab === 'rates' && (
        <div className="space-y-6">
          {/* Header Explanation */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-teal-600" />
                <span>Duty Roster Settings: Staff Allowance Rates (CRUD)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure rates for each staff member: Normal Weekday rate, Weekend/Friday rate, Public Holiday rate, Night Shift extra allowance, and On-Call duty allowance.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={rateSearch}
                  onChange={(e) => setRateSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <select
                value={rateDeptFilter}
                onChange={(e) => setRateDeptFilter(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-300 bg-white"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Rates Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Designation</th>
                    <th className="py-3 px-3 text-right">Normal Day (MVR)</th>
                    <th className="py-3 px-3 text-right">Weekend/Friday (MVR)</th>
                    <th className="py-3 px-3 text-right">Public Holiday (MVR)</th>
                    <th className="py-3 px-3 text-right">Night Extra (MVR)</th>
                    <th className="py-3 px-3 text-right">On-Call (MVR)</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredRates.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 font-medium">
                        No staff allowance rates found. Click "Batch Set Default Rates" or "Add Staff Rate" to configure.
                      </td>
                    </tr>
                  ) : (
                    filteredRates.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{r.staffName}</div>
                          {r.staffCustomId && (
                            <div className="text-[11px] text-teal-700 font-mono">
                              ID: {r.staffCustomId}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-600">
                          {r.departmentName || 'General'}
                        </td>
                        <td className="py-3 px-3 text-slate-600">{r.designation || 'Staff'}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {r.normalDayRate}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-indigo-700">
                          {r.weekendDayRate}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-amber-700">
                          {r.holidayRate}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-purple-700">
                          +{r.nightShiftAllowance}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-teal-700">
                          {r.onCallRate}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenRateModal(r)}
                              className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition"
                              title="Edit Rate"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRate(r.id, r.staffName)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                              title="Reset/Delete custom rate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: ARCHIVED SAVED ALLOWANCE SHEETS
          ========================================================================= */}
      {activeTab === 'saved_sheets' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-teal-600" />
                <span>Archived Shift Duty Allowance Sheets</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Past generated and verified allowance sheets saved by supervisors for audit, finance, and record keeping.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedSheets.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl p-10 border border-slate-200 text-center text-slate-500">
                <FileCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="font-bold text-sm">No saved allowance sheets in archive.</p>
                <p className="text-xs mt-1">
                  Generate a sheet in Tab 1 and click "Save & Archive Sheet" to keep official records.
                </p>
              </div>
            ) : (
              savedSheets.map((s) => (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 hover:border-teal-300 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{s.title}</h4>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        {s.fromDate} to {s.toDate}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-emerald-100 text-emerald-800">
                      {s.status}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Department:</span>
                      <span className="font-bold">{s.departmentName || 'All Departments'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Duties:</span>
                      <span className="font-bold">{s.totalDutiesCount} Shifts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Payable:</span>
                      <span className="font-black text-teal-700">
                        {s.currency} {s.totalAllowanceAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                      <span>Saved by:</span>
                      <span className="font-medium">{s.generatedBy}</span>
                    </div>
                  </div>

                  {s.notes && (
                    <p className="text-xs text-slate-600 bg-teal-50/50 p-2.5 rounded-lg border border-teal-100 italic">
                      "{s.notes}"
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFromDate(s.fromDate);
                        setToDate(s.toDate);
                        setSelectedDeptId(s.departmentId || 'all');
                        setActiveTab('sheet');
                        handleGenerateReport();
                      }}
                      className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Re-open / View</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteSavedSheet(s.id, s.title)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                      title="Delete saved sheet"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: EDIT STAFF ALLOWANCE RATE
          ========================================================================= */}
      {isRateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-5 bg-gradient-to-r from-teal-700 to-teal-800 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Coins className="w-5 h-5 text-teal-300" />
                  <span>{editingRate ? 'Edit Staff Allowance Rate' : 'Set Staff Allowance Rate'}</span>
                </h3>
                <p className="text-xs text-teal-100 mt-0.5">
                  Configure shift allowance and day type rates in MVR
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRateModalOpen(false)}
                className="text-white/80 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Staff Member</label>
                <select
                  disabled={!!editingRate}
                  value={rateForm.staffId}
                  onChange={(e) => setRateForm({ ...rateForm, staffId: e.target.value })}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden bg-white disabled:bg-slate-100"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} {s.staffId ? `(${s.staffId})` : ''} - {s.designation || 'Staff'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Normal Weekday (MVR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={rateForm.normalDayRate}
                    onChange={(e) =>
                      setRateForm({ ...rateForm, normalDayRate: Number(e.target.value) })
                    }
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Sun-Thu duties</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Weekend / Friday (MVR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={rateForm.weekendDayRate}
                    onChange={(e) =>
                      setRateForm({ ...rateForm, weekendDayRate: Number(e.target.value) })
                    }
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Friday & Saturday duties</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Public Holiday (MVR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={rateForm.holidayRate}
                    onChange={(e) =>
                      setRateForm({ ...rateForm, holidayRate: Number(e.target.value) })
                    }
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Official public holidays</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Night Shift Extra (MVR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={rateForm.nightShiftAllowance}
                    onChange={(e) =>
                      setRateForm({ ...rateForm, nightShiftAllowance: Number(e.target.value) })
                    }
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Added for night duties</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  On-Call / Standby Duty Rate (MVR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  required
                  value={rateForm.onCallRate}
                  onChange={(e) => setRateForm({ ...rateForm, onCallRate: Number(e.target.value) })}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="Optional internal remarks..."
                  value={rateForm.notes}
                  onChange={(e) => setRateForm({ ...rateForm, notes: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  Save Rate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: BATCH SET DEFAULT RATES
          ========================================================================= */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-5 bg-gradient-to-r from-teal-700 to-teal-800 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>Batch Set Default Allowance Rates</span>
                </h3>
                <p className="text-xs text-teal-100 mt-0.5">
                  Apply standard duty rates across multiple staff members
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="text-white/80 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBatchUpdateRates} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Department</label>
                <select
                  value={batchDeptId}
                  onChange={(e) => setBatchDeptId(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-hidden bg-white"
                >
                  <option value="all">All Departments ({staffList.length} staff)</option>
                  {departments.map((d) => {
                    const count = staffList.filter((s) => s.department && s.department.toLowerCase() === d.name.toLowerCase()).length;
                    return (
                      <option key={d.id} value={d.id}>
                        {d.name} ({count} staff)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Normal Weekday (MVR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={batchForm.normalDayRate}
                    onChange={(e) =>
                      setBatchForm({ ...batchForm, normalDayRate: Number(e.target.value) })
                    }
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Weekend / Friday (MVR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={batchForm.weekendDayRate}
                    onChange={(e) =>
                      setBatchForm({ ...batchForm, weekendDayRate: Number(e.target.value) })
                    }
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Public Holiday (MVR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={batchForm.holidayRate}
                    onChange={(e) =>
                      setBatchForm({ ...batchForm, holidayRate: Number(e.target.value) })
                    }
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Night Shift Extra (MVR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={batchForm.nightShiftAllowance}
                    onChange={(e) =>
                      setBatchForm({ ...batchForm, nightShiftAllowance: Number(e.target.value) })
                    }
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  On-Call Allowance (MVR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  required
                  value={batchForm.onCallRate}
                  onChange={(e) => setBatchForm({ ...batchForm, onCallRate: Number(e.target.value) })}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  Apply Standard Rates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: SAVE & ARCHIVE SHEET
          ========================================================================= */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-5 bg-gradient-to-r from-teal-700 to-teal-800 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Save className="w-5 h-5 text-teal-300" />
                  <span>Archive Allowance Sheet</span>
                </h3>
                <p className="text-xs text-teal-100 mt-0.5">
                  Save current calculation as an official statement
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="text-white/80 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sheet Title</label>
                <input
                  type="text"
                  value={sheetTitle}
                  onChange={(e) => setSheetTitle(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Supervisor Notes / Verification Remarks
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Verified by Clinical Supervisor. Approved for finance payroll processing."
                  value={sheetNotes}
                  onChange={(e) => setSheetNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1 text-slate-600">
                <p>
                  <strong>Total Shifts:</strong> {reportResult?.totalDutiesCount}
                </p>
                <p>
                  <strong>Total Payable:</strong> {reportResult?.currency}{' '}
                  {reportResult?.totalAllowanceAmount.toLocaleString()}
                </p>
                <p>
                  <strong>Period:</strong> {reportResult?.fromDate} to {reportResult?.toDate}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReportSheet}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  Confirm & Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
