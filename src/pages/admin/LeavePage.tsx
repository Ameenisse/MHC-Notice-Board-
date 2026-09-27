import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  getStaffList,
  getLeaveRecordsList,
  getCategoriesList,
  getDepartmentsList,
  saveLeaveRecord,
  updateLeaveStatus,
  deleteLeaveRecord,
} from '../../services/db';
import { Staff, LeaveRecord, LeaveCategory, Department, LeaveStatus } from '../../types';
import {
  getTodayString,
  isLeaveActiveToday,
  isLeaveUpcoming,
  formatDate,
} from '../../utils/dateUtils';
import {
  CalendarDays,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  User,
  AlertCircle,
  X,
  FileText,
  Check,
  Ban,
  Lock,
  Trash2,
  Sparkles,
  Loader2,
  Printer,
  Download,
} from 'lucide-react';
import { exportStaffLeaveScheduleToPdf } from '../../utils/pdfExport';

export const LeavePage: React.FC = () => {
  const { currentUser, isDemoMode, settings } = useApp();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [categories, setCategories] = useState<LeaveCategory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Cancellation confirm modal
  const [cancelTarget, setCancelTarget] = useState<LeaveRecord | null>(null);
  // Permanent delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState<LeaveRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Tabs: 'current' | 'upcoming' | 'history'
  const [activeTab, setActiveTab] = useState<'current' | 'upcoming' | 'history'>('current');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LeaveStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LeaveRecord | null>(null);

  // Form Fields
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [status, setStatus] = useState<LeaveStatus>('approved');
  const [privateRemarks, setPrivateRemarks] = useState('');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const tz = settings.timezone || 'Indian/Maldives';
  const today = getTodayString(tz);

  const handleExportLeavePdf = async () => {
    if (!leaveRecords || leaveRecords.length === 0) {
      alert('No leave records found to export.');
      return;
    }
    setIsExportingPdf(true);
    try {
      await exportStaffLeaveScheduleToPdf({
        leaveRecords: filteredRecords,
        settings,
        generatedBy: currentUser?.email || 'HR Department',
        activeTab,
        departmentFilter,
        categoryFilter,
      });
    } catch (err: any) {
      console.error('Error exporting leave schedule PDF:', err);
      alert('Failed to export leave schedule PDF: ' + (err.message || err));
    } finally {
      setIsExportingPdf(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [staffData, leavesData, catsData, deptsData] = await Promise.all([
        getStaffList(isDemoMode),
        getLeaveRecordsList(isDemoMode),
        getCategoriesList(isDemoMode),
        getDepartmentsList(isDemoMode),
      ]);
      setStaffList(staffData);
      setLeaveRecords(leavesData);
      setCategories(catsData);
      setDepartments(deptsData);
    } catch (err) {
      console.error('Error fetching leave data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemoMode, tz]);

  const openAddModal = () => {
    setEditingRecord(null);
    setSelectedStaffId(staffList.find((s) => s.active)?.id || '');
    setSelectedCategoryId(categories[0]?.id || '');
    setStartDate(today);
    setEndDate(today);
    setExpectedReturnDate('');
    setStatus('approved');
    setPrivateRemarks('');
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const openEditModal = (record: LeaveRecord) => {
    setEditingRecord(record);
    setSelectedStaffId(record.staffId);
    setSelectedCategoryId(record.categoryId);
    setStartDate(record.startDate);
    setEndDate(record.endDate);
    setExpectedReturnDate(record.expectedReturnDate || '');
    setStatus(record.status);
    setPrivateRemarks(record.privateRemarks || '');
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId || !selectedCategoryId || !startDate || !endDate) {
      setFormError('Staff member, Category, Start date, and End date are required.');
      return;
    }

    if (endDate < startDate) {
      setFormError('Leave End Date cannot be earlier than Start Date.');
      return;
    }

    if (expectedReturnDate && expectedReturnDate <= endDate) {
      setFormError('Expected Return Date must be strictly after the Leave End Date.');
      return;
    }

    setSaving(true);
    setFormError(null);
    setFormSuccess(null);

    const targetStaff = staffList.find((s) => s.id === selectedStaffId);
    const targetCategory = categories.find((c) => c.id === selectedCategoryId);

    try {
      await saveLeaveRecord(
        {
          id: editingRecord ? editingRecord.id : undefined,
          staffId: selectedStaffId,
          staffName: targetStaff?.fullName || 'Staff Member',
          staffCustomId: targetStaff?.staffId || 'MHC',
          staffDesignation: targetStaff?.designation || '',
          staffDepartment: targetStaff?.department || '',
          staffPhotoUrl: targetStaff?.photoUrl || '',
          categoryId: selectedCategoryId,
          categoryName: targetCategory?.name || 'Leave',
          startDate,
          endDate,
          expectedReturnDate: expectedReturnDate || undefined,
          status,
          privateRemarks: privateRemarks.trim() || undefined,
          approvedBy: status === 'approved' ? currentUser?.email || 'Admin' : undefined,
        },
        currentUser?.email || 'Administrator',
        isDemoMode
      );

      setFormSuccess(
        editingRecord
          ? 'Leave record successfully updated.'
          : 'New leave record successfully logged.'
      );

      // Refresh list
      await loadData();

      if (!editingRecord) {
        // Reset fields for another entry when adding a new record
        setStartDate(today);
        setEndDate(today);
        setExpectedReturnDate('');
        setPrivateRemarks('');
      }
      // If editing, keep edited values visible as requested in prompt!
    } catch (err: any) {
      setFormError(err.message || 'Failed to save leave record.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickApprove = async (record: LeaveRecord) => {
    try {
      await updateLeaveStatus(
        record.id,
        'approved',
        currentUser?.email || 'Administrator',
        isDemoMode
      );
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve leave record.');
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;

    try {
      await updateLeaveStatus(
        cancelTarget.id,
        'cancelled',
        currentUser?.email || 'Administrator',
        isDemoMode
      );
      setCancelTarget(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel leave record.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteLeaveRecord(
        deleteTarget.id,
        currentUser?.email || 'Administrator',
        isDemoMode
      );
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete leave record.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered records by tab & criteria
  const filteredRecords = useMemo(() => {
    return leaveRecords.filter((rec) => {
      // Tab separation
      if (activeTab === 'current') {
        if (rec.status !== 'approved') return false;
        if (!isLeaveActiveToday(rec.startDate, rec.endDate, tz)) return false;
      } else if (activeTab === 'upcoming') {
        if (rec.status !== 'approved') return false;
        if (!isLeaveUpcoming(rec.startDate, tz)) return false;
      }
      // 'history' shows all past, cancelled, draft, or any records

      // Status filter
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;

      // Category filter
      if (categoryFilter !== 'all' && rec.categoryId !== categoryFilter) return false;

      // Department filter
      if (departmentFilter !== 'all' && rec.staffDepartment !== departmentFilter) return false;

      // Staff search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = rec.staffName.toLowerCase().includes(q);
        const matchId = rec.staffCustomId.toLowerCase().includes(q);
        const matchDesig = rec.staffDesignation.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchDesig) return false;
      }

      // Date range filter
      if (dateFilterStart && rec.endDate < dateFilterStart) return false;
      if (dateFilterEnd && rec.startDate > dateFilterEnd) return false;

      return true;
    });
  }, [
    leaveRecords,
    activeTab,
    statusFilter,
    categoryFilter,
    departmentFilter,
    searchQuery,
    dateFilterStart,
    dateFilterEnd,
    tz,
  ]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & New Leave Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-teal-600" />
            <span>Leave Management</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Schedule staff absences, approve applications, and review historical logs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportLeavePdf}
            disabled={isExportingPdf}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            title="Export official staff leave schedule to PDF file for printing or official records"
          >
            {isExportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
            ) : (
              <FileText className="w-4 h-4 text-teal-400" />
            )}
            <span>Export Leave PDF</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition border border-slate-300 cursor-pointer"
            title="Print leave table"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-teal-600 text-white hover:bg-teal-700 transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Record New Leave</span>
          </button>
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-bold">
        <button
          onClick={() => setActiveTab('current')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'current'
              ? 'border-teal-600 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Current Leave (Today)</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-teal-100 text-teal-900 font-bold">
            {
              leaveRecords.filter(
                (r) => r.status === 'approved' && isLeaveActiveToday(r.startDate, r.endDate, tz)
              ).length
            }
          </span>
        </button>

        <button
          onClick={() => setActiveTab('upcoming')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'upcoming'
              ? 'border-teal-600 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Upcoming Leave</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-bold">
            {
              leaveRecords.filter(
                (r) => r.status === 'approved' && isLeaveUpcoming(r.startDate, tz)
              ).length
            }
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'history'
              ? 'border-teal-600 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Complete Leave History</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-bold">
            {leaveRecords.length}
          </span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff name, ID..."
              className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 rounded-xl text-sm focus:outline-none transition"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Status Filter (especially useful in history tab) */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Date Range Sub-filter */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-bold text-slate-500">Date Range Filter:</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFilterStart}
              onChange={(e) => setDateFilterStart(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateFilterEnd}
              onChange={(e) => setDateFilterEnd(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            />
            {(dateFilterStart || dateFilterEnd) && (
              <button
                onClick={() => {
                  setDateFilterStart('');
                  setDateFilterEnd('');
                }}
                className="text-xs text-rose-600 hover:underline font-medium"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Leave Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <div className="h-10 w-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-3 text-sm font-semibold text-slate-600">Loading leave records...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <p className="font-bold text-lg text-slate-700">No leave records match this view.</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {leaveRecords.length === 0
                ? 'No leave records exist in the system yet. Click below to record an employee leave.'
                : 'Select another tab or adjust your filters above.'}
            </p>
            {leaveRecords.length === 0 && (
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={openAddModal}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Record New Leave</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Staff Member</th>
                  <th className="py-2.5 px-2">Dept</th>
                  <th className="py-2.5 px-2">Category</th>
                  <th className="py-2.5 px-2">Leave Duration</th>
                  <th className="py-2.5 px-2">Return</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2">Remarks</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRecords.map((record) => {
                  const isCurrent = isLeaveActiveToday(record.startDate, record.endDate, tz);
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          {record.staffPhotoUrl ? (
                            <img
                              src={record.staffPhotoUrl}
                              alt={record.staffName}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 font-extrabold text-xs flex items-center justify-center shrink-0">
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
                      <td className="py-2.5 px-2 text-xs font-semibold text-slate-700 truncate">
                        {record.staffDepartment}
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 whitespace-nowrap">
                          {record.categoryName}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-xs text-slate-700">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-800 text-[11px] leading-tight">
                            {formatDate(record.startDate)} - {formatDate(record.endDate)}
                          </span>
                          {isCurrent && record.status === 'approved' && (
                            <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 w-fit">
                              Active Today
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-xs">
                        {record.expectedReturnDate ? (
                          <span className="font-semibold text-slate-700 text-[11px]">
                            {formatDate(record.expectedReturnDate)}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        {record.status === 'approved' ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        ) : record.status === 'draft' ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Draft
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Cancelled
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-xs text-slate-500 max-w-[120px] truncate">
                        {record.privateRemarks ? (
                          <span className="flex items-center gap-1 text-slate-700 text-[11px]" title={record.privateRemarks}>
                            <Lock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span className="truncate">{record.privateRemarks}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {record.status === 'draft' && (
                            <button
                              onClick={() => handleQuickApprove(record)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                              title="Approve leave"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(record)}
                            className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition"
                            title="Edit leave record"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {record.status !== 'cancelled' && (
                            <button
                              onClick={() => setCancelTarget(record)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                              title="Cancel leave (keeps in history, removes from TV)"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(record)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Permanently Delete Leave Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Leave Modal */}
      {isModalOpen && (
        <div
          id="leave-modal-overlay"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-900">
                {editingRecord ? 'Edit Leave Record' : 'Record Staff Leave'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveRecord} className="mt-5 space-y-4">
              {/* Staff Selector */}
              <div>
                <label htmlFor="leave-staff-select" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Select Staff Member <span className="text-rose-500">*</span>
                </label>
                <select
                  id="leave-staff-select"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none cursor-pointer"
                >
                  <option value="" disabled>
                    Choose a staff member...
                  </option>
                  {staffList
                    .filter((s) => s.active || s.id === selectedStaffId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.staffId}) — {s.department}
                      </option>
                    ))}
                </select>
              </div>

              {/* Category Selector */}
              <div>
                <label htmlFor="leave-category-select" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Leave Category <span className="text-rose-500">*</span>
                </label>
                <select
                  id="leave-category-select"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none cursor-pointer"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} {cat.nameDhivehi ? `(${cat.nameDhivehi})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start & End Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="leave-start-date" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="leave-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="leave-end-date" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    End Date (Inclusive) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="leave-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Expected Return Date */}
              <div>
                <label htmlFor="leave-return-date" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Expected Return Date (Optional)
                </label>
                <input
                  id="leave-return-date"
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  If left blank, staff are marked as "Returns Tomorrow" on their last leave day.
                </p>
              </div>

              {/* Status Selector */}
              <div>
                <label htmlFor="leave-status-select" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Approval Status <span className="text-rose-500">*</span>
                </label>
                <select
                  id="leave-status-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LeaveStatus)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none cursor-pointer"
                >
                  <option value="approved">Approved (Will show on TV board if active)</option>
                  <option value="draft">Draft (Saved for review, not visible on TV)</option>
                  <option value="cancelled">Cancelled (Archived in history)</option>
                </select>
              </div>

              {/* Private Remarks (Internal Only) */}
              <div>
                <label htmlFor="leave-remarks" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Private Administrative Remarks (Internal Only)</span>
                </label>
                <textarea
                  id="leave-remarks"
                  rows={2}
                  value={privateRemarks}
                  onChange={(e) => setPrivateRemarks(e.target.value)}
                  placeholder="e.g. Relief staff arranged. Medical certificate on file."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none transition"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Protected: This field is strictly excluded from TV board projections.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  {saving ? 'Validating...' : editingRecord ? 'Update Leave Record' : 'Save Leave Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900">Cancel Approved Leave?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Cancelling leave for <span className="font-bold">{cancelTarget.staffName}</span> will immediately remove this entry from the current TV display board while keeping the record safely archived in the history tab.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Keep Active
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-5 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-2">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-black text-slate-900">
                Permanently Delete Leave Record?
              </h3>
            </div>
            <p className="text-sm text-slate-600 mt-2">
              Are you sure you want to permanently delete the leave record for <strong className="text-slate-900">{deleteTarget.staffName}</strong> ({deleteTarget.categoryName}, {formatDate(deleteTarget.startDate)} to {formatDate(deleteTarget.endDate)})?
            </p>
            <p className="text-xs text-rose-600 font-semibold mt-2 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
              Notice: If you only wish to cancel this leave while preserving audit logs and history, choose "Cancel Leave" instead. Permanent deletion purges this entry entirely.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Keep Record
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
