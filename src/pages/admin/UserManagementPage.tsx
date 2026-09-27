import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Eye,
  EyeOff,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Copy,
  Edit2,
  Trash2,
  RefreshCw,
  Sparkles,
  Building,
  Phone,
  Mail,
  UserCheck,
  Check,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AppUser, UserRole, Department, Staff } from '../../types';
import { getDepartmentsList, getStaffList } from '../../services/db';

export const UserManagementPage: React.FC = () => {
  const {
    users,
    refreshUsers,
    saveAppUser,
    deleteAppUser,
    isDemoMode,
    settings,
  } = useApp();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [copiedPinId, setCopiedPinId] = useState<string | null>(null);
  const [showPinsMap, setShowPinsMap] = useState<Record<string, boolean>>({});
  const [showModalPin, setShowModalPin] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    id?: string;
    username: string;
    pin: string;
    fullName: string;
    fullNameDhivehi: string;
    role: UserRole;
    roles: string[];
    departmentId: string;
    departmentName: string;
    designation: string;
    phone: string;
    email: string;
    staffId?: string;
    active: boolean;
  }>({
    username: '',
    pin: '',
    fullName: '',
    fullNameDhivehi: '',
    role: 'supervisor',
    roles: ['supervisor', 'staff'],
    departmentId: '',
    departmentName: '',
    designation: '',
    phone: '',
    email: '',
    staffId: '',
    active: true,
  });

  useEffect(() => {
    loadDepartments();
    refreshUsers();
  }, [isDemoMode]);

  const loadDepartments = async () => {
    try {
      const [depts, staffs] = await Promise.all([
        getDepartmentsList(isDemoMode),
        getStaffList(isDemoMode),
      ]);
      setDepartments(depts);
      setStaffList(staffs);
      if (depts.length > 0 && !formData.departmentId) {
        setFormData((prev) => ({
          ...prev,
          departmentId: depts[0].id,
          departmentName: depts[0].name,
        }));
      }
    } catch (err) {
      console.error('Failed to load departments and staff:', err);
    }
  };

  const handleOpenAddModal = () => {
    setEditingUser(null);
    const defaultDept = departments[0];
    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData({
      username: '',
      pin: generatedPin,
      fullName: '',
      fullNameDhivehi: '',
      role: 'supervisor',
      roles: ['supervisor', 'staff'],
      departmentId: defaultDept ? defaultDept.id : '',
      departmentName: defaultDept ? defaultDept.name : '',
      designation: 'Department Shift Supervisor',
      phone: '',
      email: '',
      staffId: '',
      active: true,
    });
    setShowModalPin(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (u: AppUser) => {
    setEditingUser(u);
    setFormData({
      id: u.id,
      username: u.username,
      pin: u.pin,
      fullName: u.fullName,
      fullNameDhivehi: u.fullNameDhivehi || '',
      role: u.role,
      roles: u.roles && u.roles.length > 0 ? u.roles : [u.role],
      departmentId: u.departmentId || (departments[0]?.id ?? ''),
      departmentName: u.departmentName || (departments[0]?.name ?? ''),
      designation: u.designation || '',
      phone: u.phone || '',
      email: u.email || '',
      staffId: u.staffId || '',
      active: u.active,
    });
    setShowModalPin(false);
    setIsModalOpen(true);
  };

  const handleSelectStaffLink = (selectedStaffId: string) => {
    const s = staffList.find((st) => st.id === selectedStaffId || st.staffId === selectedStaffId);
    if (!s) return;
    const dept = departments.find((d) => d.name === s.department);
    const suggestedUser = s.username || s.fullName.toLowerCase().replace(/^dr\.\s*/i, 'dr_').replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    const assignedRoles = s.roles && s.roles.length > 0 ? s.roles : ['staff'];

    setFormData((prev) => ({
      ...prev,
      staffId: s.staffId,
      fullName: s.fullName,
      fullNameDhivehi: s.fullNameDhivehi || '',
      designation: s.designation,
      phone: s.phone || prev.phone,
      email: s.email || prev.email,
      departmentId: dept ? dept.id : prev.departmentId,
      departmentName: s.department,
      username: prev.username || suggestedUser,
      roles: assignedRoles,
      role: assignedRoles.includes('admin') ? 'admin' : assignedRoles.includes('supervisor') ? 'supervisor' : assignedRoles.includes('roster_manager') ? 'roster_manager' : 'staff',
    }));
  };

  const handleGeneratePin = () => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData((prev) => ({ ...prev, pin }));
  };

  const handleDeptSelect = (deptId: string) => {
    const found = departments.find((d) => d.id === deptId);
    setFormData((prev) => ({
      ...prev,
      departmentId: deptId,
      departmentName: found ? found.name : '',
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.pin.trim() || !formData.fullName.trim()) {
      alert('Please fill in required fields: Username, PIN, and Full Name.');
      return;
    }

    setLoading(true);
    try {
      const saved = await saveAppUser(formData);
      setIsModalOpen(false);
      setSaveSuccessMsg(
        formData.role === 'supervisor'
          ? `User @${saved.username} saved! Supervisor profile was automatically updated in Department Duty Rosters & Supervisors directory.`
          : `User @${saved.username} saved successfully.`
      );
      setTimeout(() => setSaveSuccessMsg(null), 6000);
    } catch (err: any) {
      alert(`Error saving user: ${err.message || 'Please try again'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete user "${name}"? If they are a supervisor, their roster profile will also be deactivated.`)) {
      setLoading(true);
      try {
        await deleteAppUser(id);
      } catch (err: any) {
        alert(`Error deleting user: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCopyCredentials = (u: AppUser) => {
    const text = `Manadhoo Hospital Portal Credentials\nUsername: ${u.username}\nSecurity PIN: ${u.pin}\nRole: ${u.role}\nName: ${u.fullName}`;
    navigator.clipboard.writeText(text);
    setCopiedPinId(u.id);
    setTimeout(() => setCopiedPinId(null), 2500);
  };

  const togglePinReveal = (id: string) => {
    setShowPinsMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.fullNameDhivehi && u.fullNameDhivehi.includes(searchTerm)) ||
      (u.designation && u.designation.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesDept = deptFilter === 'all' || u.departmentId === deptFilter;
    return matchesSearch && matchesRole && matchesDept;
  });

  const totalSupervisors = users.filter((u) => u.role === 'supervisor').length;
  const totalAdmins = users.filter((u) => u.role === 'admin').length;
  const totalActive = users.filter((u) => u.active).length;

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-600 rounded-xl">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                User Management & Access Control
              </h1>
              <p className="text-sm font-thaana text-slate-500 dark:text-slate-400 mt-0.5" dir="rtl">
                ޔޫޒަރ އެކައުންޓްތަކާއި ޕިން ކޯޑް ބެލެހެއްޓުން އަދި ސުޕަވައިޒަރުން ސިންކްކުރުން
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Administrators control login usernames and secret PINs. Creating a <strong>Supervisor</strong> user automatically synchronizes with the <strong>Department Duty Rosters & Supervisors</strong> directory and TV display!
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshUsers()}
            className="p-2.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition"
            title="Refresh Users"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm hover:shadow transition"
          >
            <UserPlus className="w-5 h-5" />
            <span>Create New User</span>
          </button>
        </div>
      </div>

      {/* Auto-Sync Announcement Banner */}
      <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-transparent border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500 text-white rounded-lg shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">
              Live Supervisor Auto-Sync Active
            </h3>
            <p className="text-xs text-emerald-800 dark:text-emerald-400/90 mt-0.5">
              Users created with the <span className="font-bold underline">Supervisor</span> role automatically appear in the <strong>Department Duty Rosters & Supervisors</strong> directory, on weekly rosters, and in the shift handover portal.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/20 px-3 py-1.5 rounded-lg whitespace-nowrap">
          <CheckCircle className="w-4 h-4" />
          <span>Real-time Sync</span>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center gap-3 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Stats Counter */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Users
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {users.length}
          </div>
          <div className="text-xs text-slate-400 mt-1 font-thaana" dir="rtl">
            ޖުމްލަ ޔޫޒަރުން
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/20">
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
            <span>Supervisors</span>
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            {totalSupervisors}
          </div>
          <div className="text-xs text-emerald-600/80 mt-1 font-thaana" dir="rtl">
            ޑިއުޓީ ސުޕަވައިޒަރުން
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-200 dark:border-blue-900/40">
          <div className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center justify-between">
            <span>Administrators</span>
            <Shield className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
            {totalAdmins}
          </div>
          <div className="text-xs text-blue-600/80 mt-1 font-thaana" dir="rtl">
            އެޑްމިނިސްޓްރޭޓަރުން
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Active Accounts</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {totalActive}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            PIN authentication ready
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, username, Thaana name, or designation..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="supervisor">Supervisors Only</option>
            <option value="admin">Administrators</option>
            <option value="roster_manager">Roster Managers</option>
            <option value="staff">Staff Members</option>
          </select>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">User & Identity</th>
                <th className="py-3 px-4">Role & Sync Status</th>
                <th className="py-3 px-4">Admin Username</th>
                <th className="py-3 px-4">Security PIN</th>
                <th className="py-3 px-4">Department & Designation</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No users found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isRevealed = showPinsMap[u.id];
                  const isSupervisor = u.role === 'supervisor';

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Name & Thaana */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                              isSupervisor
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                                : u.role === 'admin'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {u.fullName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {u.fullName}
                            </div>
                            {u.fullNameDhivehi && (
                              <div className="text-xs font-thaana text-slate-500 dark:text-slate-400" dir="rtl">
                                {u.fullNameDhivehi}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex flex-wrap items-center gap-1">
                            {(u.roles && u.roles.length > 0 ? u.roles : [u.role]).map((r) => {
                              const isSup = r === 'supervisor';
                              const isAdmin = r === 'admin';
                              const isRoster = r === 'roster_manager';
                              return (
                                <span
                                  key={r}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                    isSup
                                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                      : isAdmin
                                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                      : isRoster
                                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {isSup && <UserCheck className="w-2.5 h-2.5" />}
                                  {isAdmin && <Shield className="w-2.5 h-2.5" />}
                                  <span className="capitalize">{r.replace('_', ' ')}</span>
                                </span>
                              );
                            })}
                          </div>

                          {(u.role === 'supervisor' || u.roles?.includes('supervisor')) && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                              <Sparkles className="w-2.5 h-2.5" /> Auto-synced to Duty Rosters
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Username */}
                      <td className="py-3.5 px-4">
                        <code className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded font-mono text-xs font-semibold">
                          @{u.username}
                        </code>
                      </td>

                      {/* PIN */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md font-mono text-xs tracking-widest text-slate-800 dark:text-slate-200 font-bold min-w-[70px] text-center">
                            {isRevealed ? u.pin : '••••'}
                          </div>
                          <button
                            type="button"
                            onClick={() => togglePinReveal(u.id)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                            title={isRevealed ? 'Hide PIN' : 'Show PIN'}
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Department & Designation */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                          {u.departmentName || 'General'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {u.designation || 'Staff'}
                        </div>
                      </td>

                      {/* Active Status */}
                      <td className="py-3.5 px-4">
                        {u.active ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyCredentials(u)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition"
                            title="Copy Login Credentials (Username & PIN)"
                          >
                            {copiedPinId === u.id ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                            title="Edit User & Credentials"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(u.id, u.fullName)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create / Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/10 text-blue-600 rounded-xl">
                  {editingUser ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingUser ? 'Edit User Credentials & Profile' : 'Create User Account'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Set admin-controlled username, secret PIN, and department role
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Optional: Link from Existing Staff Member */}
              {!editingUser && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Link from Existing Staff Member (Optional)
                  </label>
                  <select
                    onChange={(e) => handleSelectStaffLink(e.target.value)}
                    defaultValue=""
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">-- Select Staff to Auto-Fill Profile & Link --</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.staffId}) - {s.department}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Auto-populates full name, department, designation, phone, email, and suggests @username
                  </p>
                </div>
              )}

              {/* Role Selection with Supervisor Auto-Sync notice */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Primary System Role *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'supervisor', label: 'Supervisor', desc: 'Roster In-Charge' },
                    { id: 'admin', label: 'Admin', desc: 'Full System' },
                    { id: 'roster_manager', label: 'Roster Mgr', desc: 'Duty Schedules' },
                    { id: 'staff', label: 'Staff', desc: 'Duty Member' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        const newRole = r.id as UserRole;
                        const currentRoles = formData.roles || [];
                        const updatedRoles = currentRoles.includes(newRole)
                          ? currentRoles
                          : [...currentRoles, newRole];
                        setFormData({ ...formData, role: newRole, roles: updatedRoles });
                      }}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        formData.role === r.id
                          ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold ring-1 ring-blue-600'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold">{r.label}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{r.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Multiple Role Checkboxes */}
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                    Assigned Multiple Roles (Grant Multi-Role Permissions)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'supervisor', label: 'Shift Supervisor' },
                      { id: 'roster_manager', label: 'Roster In-Charge' },
                      { id: 'staff', label: 'Staff Member' },
                      { id: 'admin', label: 'Administrator' },
                      { id: 'Clinical In-Charge', label: 'Clinical In-Charge' },
                      { id: 'On-Call Officer', label: 'On-Call Officer' },
                    ].map((role) => {
                      const isChecked = (formData.roles || []).includes(role.id);
                      return (
                        <label
                          key={role.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                            isChecked
                              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 text-blue-900 dark:text-blue-200 font-semibold'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const curr = formData.roles || [];
                              const next = isChecked
                                ? curr.length > 1
                                  ? curr.filter((x) => x !== role.id)
                                  : curr
                                : [...curr, role.id];
                              setFormData({ ...formData, roles: next });
                            }}
                            className="rounded text-blue-600"
                          />
                          <span>{role.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {(formData.role === 'supervisor' || formData.roles?.includes('supervisor')) && (
                  <div className="mt-2.5 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Auto-Syncs as Active Supervisor:</strong> When saved, this user will automatically be linked to the <strong>Department Duty Rosters & Supervisors</strong> directory, appear on the TV display board, and have access to the Supervisor Handover Panel!
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Controlled Credentials: Username & PIN */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Key className="w-3.5 h-3.5 text-blue-600" />
                  <span>Admin Controlled Credentials</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Username *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 font-bold">@</span>
                      <input
                        type="text"
                        required
                        value={formData.username}
                        onChange={(e) =>
                          setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })
                        }
                        placeholder="e.g. sup_doctor"
                        className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">Letters, numbers, underscores only</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Security PIN *
                      </label>
                      <button
                        type="button"
                        onClick={handleGeneratePin}
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="w-2.5 h-2.5" /> Generate PIN
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showModalPin ? 'text' : 'password'}
                        required
                        value={formData.pin}
                        onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                        placeholder="e.g. 2026 or 4-digit code"
                        className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowModalPin(!showModalPin)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showModalPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400">Used for quick terminal login</span>
                  </div>
                </div>
              </div>

              {/* Identity & Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Full Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Dr. Ibrahim Rasheed"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Full Name (Thaana / ދިވެހި)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={formData.fullNameDhivehi}
                    onChange={(e) => setFormData({ ...formData, fullNameDhivehi: e.target.value })}
                    placeholder="ޑރ. އިބްރާހީމް ރަޝީދު"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-thaana focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Department & Designation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Hospital Department *
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => handleDeptSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Chief Medical Officer / Clinical Supervisor"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 7789011 or 6580043"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. doctor.sup@mhc.gov.mv"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Account Active Status
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Inactive users cannot log in with their PIN or appear on duty rosters
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{editingUser ? 'Update User' : 'Save & Sync User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
