import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  getStaffList,
  saveStaff,
  toggleStaffActiveStatus,
  deleteStaff,
  getDepartmentsList,
  compressImage,
  uploadFile,
  saveAndSyncUserForStaff,
  assignStaffRoles,
} from '../../services/db';
import { Staff, Department, UserRole } from '../../types';
import {
  Users,
  Search,
  Plus,
  Edit2,
  UserCheck,
  UserX,
  Upload,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Sparkles,
  Shield,
  Key,
  UserPlus,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Phone,
  Mail,
  SlidersHorizontal,
  Building2,
  Filter,
  RotateCcw,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { StaffCsvImportModal } from '../../components/staff/StaffCsvImportModal';
import { exportStaffListToCsv } from '../../utils/staffCsv';

interface RoleOption {
  id: string;
  name: string;
  category: 'system' | 'clinical';
  desc: string;
  badgeClass: string;
}

const AVAILABLE_ROLES: RoleOption[] = [
  {
    id: 'supervisor',
    name: 'Shift Supervisor',
    category: 'system',
    desc: 'Supervises daily shifts, conducts clinical handover, and appears in Duty Rosters & Supervisors.',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  {
    id: 'roster_manager',
    name: 'Roster In-Charge',
    category: 'system',
    desc: 'Can create, edit, and publish weekly department rosters and manage station allocations.',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  },
  {
    id: 'staff',
    name: 'Staff Member',
    category: 'system',
    desc: 'Standard duty member with access to department weekly rosters and shift swap/off requests.',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  {
    id: 'admin',
    name: 'System Admin',
    category: 'system',
    desc: 'Full administrative access to manage staff, rosters, displays, and global settings.',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  {
    id: 'Clinical In-Charge',
    name: 'Clinical In-Charge',
    category: 'clinical',
    desc: 'Lead clinical officer for wards, triage, and doctor consultations.',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  {
    id: 'On-Call Officer',
    name: 'On-Call Officer',
    category: 'clinical',
    desc: 'Designated emergency response personnel for night and emergency on-call duties.',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
  {
    id: 'Pharmacy In-Charge',
    name: 'Pharmacy In-Charge',
    category: 'clinical',
    desc: 'Leads pharmacy stock, dispensing shifts, and medication protocols.',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
  },
  {
    id: 'Lab Lead',
    name: 'Laboratory Lead',
    category: 'clinical',
    desc: 'Senior technologist in charge of diagnostic testing and emergency lab services.',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  },
];

// Helper to visually highlight matched substrings in global search results
function highlightMatch(text: string, query: string) {
  if (!query || !query.trim() || !text) return <>{text}</>;
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return <>{text}</>;

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-teal-100 text-teal-900 dark:bg-teal-900/70 dark:text-teal-200 px-0.5 rounded-xs font-black"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export const StaffPage: React.FC = () => {
  const { currentUser, isDemoMode, refreshUsers } = useApp();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState<'all' | 'has_account' | 'no_account'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Main Add / Edit Staff Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  // Form Fields
  const [staffId, setStaffId] = useState('');
  const [fullName, setFullName] = useState('');
  const [fullNameDhivehi, setFullNameDhivehi] = useState('');
  const [designation, setDesignation] = useState('');
  const [designationDhivehi, setDesignationDhivehi] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['staff']);

  // Add form: Create User Account option
  const [createAccountToggle, setCreateAccountToggle] = useState(true);
  const [accountUsername, setAccountUsername] = useState('');
  const [accountPin, setAccountPin] = useState('');
  const [showAccountPin, setShowAccountPin] = useState(false);

  // Upload & File handling state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Dedicated "Create User Account (Save & Sync User)" Modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [targetStaffForUser, setTargetStaffForUser] = useState<Staff | null>(null);
  const [userFormUsername, setUserFormUsername] = useState('');
  const [userFormPin, setUserFormPin] = useState('');
  const [userFormRoles, setUserFormRoles] = useState<string[]>(['staff']);
  const [showUserFormPin, setShowUserFormPin] = useState(false);
  const [syncingUser, setSyncingUser] = useState(false);
  const [userModalError, setUserModalError] = useState<string | null>(null);

  // Dedicated "Assign Staff Roles (Multiple Role)" Modal
  const [assignRolesModalOpen, setAssignRolesModalOpen] = useState(false);
  const [targetStaffForRoles, setTargetStaffForRoles] = useState<Staff | null>(null);
  const [staffRolesToAssign, setStaffRolesToAssign] = useState<string[]>([]);
  const [syncRolesToUserAccount, setSyncRolesToUserAccount] = useState(true);
  const [savingRoles, setSavingRoles] = useState(false);
  const [rolesModalError, setRolesModalError] = useState<string | null>(null);

  // Credentials Success Box
  const [credentialsModal, setCredentialsModal] = useState<{
    staffName: string;
    username: string;
    pin: string;
    roles: string[];
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Deactivate confirm modal
  const [deactivateStaffTarget, setDeactivateStaffTarget] = useState<Staff | null>(null);
  // Permanent delete confirm modal
  const [deleteStaffTarget, setDeleteStaffTarget] = useState<Staff | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [staffData, deptsData] = await Promise.all([
        getStaffList(isDemoMode),
        getDepartmentsList(isDemoMode),
      ]);
      setStaffList(staffData);
      setDepartments(deptsData);
      if (deptsData.length > 0 && !department) {
        setDepartment(deptsData[0].name);
      }
    } catch (err) {
      console.error('Error fetching staff data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemoMode]);

  // Global hotkey: press '/' or 'Ctrl+K' / 'Cmd+K' to quickly focus the global search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      if ((e.key === '/' && !isInput) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Generate next Staff ID suggestion
  const generateNextStaffId = (): string => {
    const numbers = staffList
      .map((s) => {
        const match = s.staffId.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter((n) => !isNaN(n) && n > 0);

    const max = numbers.length > 0 ? Math.max(...numbers) : 100;
    const nextNum = max >= 100 ? max + 1 : 101;
    return `MHC-${nextNum}`;
  };

  // Generate username suggestion from name or staff ID
  const generateUsernameFromName = (name: string, idStr: string): string => {
    const cleanName = name
      .toLowerCase()
      .replace(/^dr\.\s*/i, 'dr_')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    if (cleanName.length >= 3) return cleanName;
    return idStr ? idStr.toLowerCase().replace(/[^a-z0-9_]/g, '_') : 'mhc_staff';
  };

  const generateRandomPin = (): string => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  // Handle Clipboard Paste of Images
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processAndSetImage(file);
          break;
        }
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processAndSetImage(e.target.files[0]);
    }
  };

  const processAndSetImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setFormError('Only image files (JPG, PNG, WebP) are allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFormError('Image file is too large. Please select an image under 10MB.');
      return;
    }

    setIsCompressing(true);
    setFormError(null);

    try {
      const compressedBlob = await compressImage(file, 400, 0.75);
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
      setSelectedFile(compressedFile);

      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setPhotoPreview(dataUrl);
        setPhotoUrl(dataUrl);
        setIsCompressing(false);
      };
      reader.readAsDataURL(compressedBlob);
    } catch (err) {
      console.error('Error compressing image:', err);
      setFormError('Failed to process image. Please try another file.');
      setIsCompressing(false);
    }
  };

  // Open Add Modal with smart defaults
  const openAddModal = () => {
    setEditingStaff(null);
    const nextId = generateNextStaffId();
    setStaffId(nextId);
    setFullName('');
    setFullNameDhivehi('');
    setDesignation('');
    setDesignationDhivehi('');
    setDepartment(departments[0]?.name || 'Medical & Clinical');
    setPhone('');
    setEmail('');
    setPhotoUrl('');
    setPhotoPreview('');
    setSelectedFile(null);
    setSelectedRoles(['staff']);
    setCreateAccountToggle(true);
    setAccountUsername(nextId.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    setAccountPin(generateRandomPin());
    setShowAccountPin(false);
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (staff: Staff) => {
    setEditingStaff(staff);
    setStaffId(staff.staffId);
    setFullName(staff.fullName);
    setFullNameDhivehi(staff.fullNameDhivehi || '');
    setDesignation(staff.designation);
    setDesignationDhivehi(staff.designationDhivehi || '');
    setDepartment(staff.department);
    setPhone(staff.phone || '');
    setEmail(staff.email || '');
    setPhotoUrl(staff.photoUrl || '');
    setPhotoPreview(staff.photoUrl || '');
    setSelectedFile(null);
    setSelectedRoles(staff.roles && staff.roles.length > 0 ? staff.roles : ['staff']);
    setCreateAccountToggle(!staff.hasUserAccount);
    setAccountUsername(staff.username || generateUsernameFromName(staff.fullName, staff.staffId));
    setAccountPin(generateRandomPin());
    setShowAccountPin(false);
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  // Save Staff (Add / Edit) with option to atomically Create & Sync User Account
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId.trim() || !fullName.trim() || !designation.trim() || !department.trim()) {
      setFormError('Please fill in required fields: Staff ID, Full Name, Designation, and Department.');
      return;
    }

    setSaving(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      // Prioritize instant base64 Data URL from preview, avoiding slow or blocked cloud uploads
      let finalPhotoUrl = photoPreview || photoUrl;

      if (!finalPhotoUrl && selectedFile) {
        finalPhotoUrl = await uploadFile(
          selectedFile,
          'staff_photos',
          `${staffId.trim()}_${Date.now()}.jpg`,
          isDemoMode
        );
      }

      const savedStaff = await saveStaff(
        {
          id: editingStaff ? editingStaff.id : undefined,
          staffId: staffId.trim(),
          fullName: fullName.trim(),
          fullNameDhivehi: fullNameDhivehi.trim() || '',
          designation: designation.trim(),
          designationDhivehi: designationDhivehi.trim() || '',
          department: department.trim(),
          phone: phone.trim() || '',
          email: email.trim() || '',
          photoUrl: finalPhotoUrl || '',
          roles: selectedRoles.length > 0 ? selectedRoles : ['staff'],
          active: editingStaff ? editingStaff.active : true,
        },
        currentUser?.email || 'Administrator',
        isDemoMode
      );

      // If user toggled Create User Account (Save & Sync User)
      if (createAccountToggle && accountUsername.trim() && accountPin.trim()) {
        try {
          const syncResult = await saveAndSyncUserForStaff(
            {
              staffDocId: savedStaff.id,
              staffId: savedStaff.staffId,
              username: accountUsername.trim(),
              pin: accountPin.trim(),
              roles: selectedRoles.length > 0 ? selectedRoles : ['staff'],
              phone: phone.trim() || undefined,
              email: email.trim() || undefined,
            },
            currentUser?.email || 'Administrator',
            isDemoMode
          );

          setCredentialsModal({
            staffName: savedStaff.fullName,
            username: syncResult.user.username,
            pin: syncResult.user.pin,
            roles: syncResult.user.roles || selectedRoles,
          });
        } catch (syncErr: any) {
          console.warn('Staff member was created, but user account sync encountered an issue:', syncErr);
        }
      }

      setFormSuccess(
        editingStaff
          ? 'Staff profile successfully updated.'
          : createAccountToggle
          ? 'Staff member saved & user account synchronized!'
          : 'New staff member successfully added.'
      );

      // Always close the add/edit modal upon successful save
      setIsModalOpen(false);

      await loadData();
      await refreshUsers();
    } catch (err: any) {
      console.error('Error saving staff member:', err);
      setFormError(err.message || 'Failed to save staff record. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Open "Create User Account (Save & Sync User)" Modal for a specific staff member
  const handleOpenCreateUserModal = (staff: Staff) => {
    setTargetStaffForUser(staff);
    const defaultUser = staff.username || generateUsernameFromName(staff.fullName, staff.staffId);
    setUserFormUsername(defaultUser);
    setUserFormPin(generateRandomPin());
    setUserFormRoles(staff.roles && staff.roles.length > 0 ? staff.roles : ['staff']);
    setShowUserFormPin(true);
    setUserModalError(null);
    setUserModalOpen(true);
  };

  // Execute Save & Sync User Account from list
  const handleSaveAndSyncUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStaffForUser) return;
    if (!userFormUsername.trim() || !userFormPin.trim()) {
      setUserModalError('Please provide both username and security PIN.');
      return;
    }

    setSyncingUser(true);
    setUserModalError(null);

    try {
      const result = await saveAndSyncUserForStaff(
        {
          staffDocId: targetStaffForUser.id,
          staffId: targetStaffForUser.staffId,
          username: userFormUsername.trim(),
          pin: userFormPin.trim(),
          roles: userFormRoles.length > 0 ? userFormRoles : ['staff'],
          phone: targetStaffForUser.phone,
          email: targetStaffForUser.email,
        },
        currentUser?.email || 'Administrator',
        isDemoMode
      );

      setUserModalOpen(false);
      setCredentialsModal({
        staffName: targetStaffForUser.fullName,
        username: result.user.username,
        pin: result.user.pin,
        roles: result.user.roles || userFormRoles,
      });

      await loadData();
      await refreshUsers();
    } catch (err: any) {
      setUserModalError(err.message || 'Failed to create user account.');
    } finally {
      setSyncingUser(false);
    }
  };

  // Open "Assign Staff Roles (Multiple Role)" Modal
  const handleOpenAssignRolesModal = (staff: Staff) => {
    setTargetStaffForRoles(staff);
    setStaffRolesToAssign(staff.roles && staff.roles.length > 0 ? [...staff.roles] : ['staff']);
    setSyncRolesToUserAccount(true);
    setRolesModalError(null);
    setAssignRolesModalOpen(true);
  };

  // Execute Assign Staff Roles
  const handleSaveStaffRoles = async () => {
    if (!targetStaffForRoles) return;
    setSavingRoles(true);
    setRolesModalError(null);

    try {
      await assignStaffRoles(
        targetStaffForRoles.id,
        staffRolesToAssign.length > 0 ? staffRolesToAssign : ['staff'],
        syncRolesToUserAccount,
        currentUser?.email || 'Administrator',
        isDemoMode
      );

      setAssignRolesModalOpen(false);
      await loadData();
      await refreshUsers();
    } catch (err: any) {
      setRolesModalError(err.message || 'Failed to update staff roles.');
    } finally {
      setSavingRoles(false);
    }
  };

  const toggleRoleSelection = (roleId: string, currentList: string[], setter: (v: string[]) => void) => {
    if (currentList.includes(roleId)) {
      if (currentList.length === 1) return; // Keep at least one role
      setter(currentList.filter((r) => r !== roleId));
    } else {
      setter([...currentList, roleId]);
    }
  };

  const handleCopyCredentials = () => {
    if (!credentialsModal) return;
    const text = `Maduvvari Health Centre Portal Credentials\nStaff: ${credentialsModal.staffName}\nUsername: @${credentialsModal.username}\nSecurity PIN: ${credentialsModal.pin}\nRoles: ${credentialsModal.roles.join(', ')}`;
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handleToggleActive = async () => {
    if (!deactivateStaffTarget) return;

    try {
      const newStatus = !deactivateStaffTarget.active;
      await toggleStaffActiveStatus(
        deactivateStaffTarget.id,
        newStatus,
        currentUser?.email || 'Administrator',
        isDemoMode
      );
      setDeactivateStaffTarget(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update active status.');
    }
  };

  const handleDeleteStaff = async () => {
    if (!deleteStaffTarget) return;
    setIsDeleting(true);
    try {
      await deleteStaff(
        deleteStaffTarget.id,
        currentUser?.email || 'Administrator',
        isDemoMode
      );
      setDeleteStaffTarget(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete staff member.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered staff list
  // Count of staff per department for quick search & filter badges
  const departmentCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    staffList.forEach((s) => {
      counts[s.department] = (counts[s.department] || 0) + 1;
    });
    return counts;
  }, [staffList]);

  // Filtered staff list with multi-field search (Name in English/Dhivehi, Dept, Designation, Staff ID, Roles, etc.)
  const filteredStaff = staffList.filter((s) => {
    if (statusFilter === 'active' && !s.active) return false;
    if (statusFilter === 'inactive' && s.active) return false;
    if (departmentFilter !== 'all' && s.department !== departmentFilter) return false;

    if (roleFilter !== 'all') {
      const hasRole = s.roles?.some((r) => r.toLowerCase() === roleFilter.toLowerCase());
      if (!hasRole) return false;
    }

    if (accountFilter === 'has_account' && !s.hasUserAccount) return false;
    if (accountFilter === 'no_account' && s.hasUserAccount) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const terms = q.split(/\s+/).filter(Boolean);

      // Every term in the query must match at least one attribute of the staff member
      const matchesAllTerms = terms.every((term) => {
        const matchName = s.fullName.toLowerCase().includes(term);
        const matchNameDv = s.fullNameDhivehi ? s.fullNameDhivehi.toLowerCase().includes(term) : false;
        const matchId = s.staffId.toLowerCase().includes(term);
        const matchDesig = s.designation.toLowerCase().includes(term);
        const matchDesigDv = s.designationDhivehi ? s.designationDhivehi.toLowerCase().includes(term) : false;
        const matchDept = s.department.toLowerCase().includes(term);
        const matchUser = s.username ? s.username.toLowerCase().includes(term) : false;
        const matchPhone = s.phone ? s.phone.includes(term) : false;
        const matchEmail = s.email ? s.email.toLowerCase().includes(term) : false;
        const matchRole = s.roles?.some((r) => r.toLowerCase().includes(term));
        return (
          matchName ||
          matchNameDv ||
          matchId ||
          matchDesig ||
          matchDesigDv ||
          matchDept ||
          matchUser ||
          matchPhone ||
          matchEmail ||
          matchRole
        );
      });

      if (!matchesAllTerms) {
        return false;
      }
    }

    return true;
  });

  const isFilterActive =
    Boolean(searchQuery.trim()) ||
    departmentFilter !== 'all' ||
    roleFilter !== 'all' ||
    accountFilter !== 'all' ||
    statusFilter !== 'active';

  const handleResetFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('all');
    setRoleFilter('all');
    setAccountFilter('all');
    setStatusFilter('active');
    searchInputRef.current?.focus();
  };

  const totalSupervisors = staffList.filter((s) => s.roles?.includes('supervisor')).length;
  const totalRosterManagers = staffList.filter((s) => s.roles?.includes('roster_manager')).length;
  const totalWithAccount = staffList.filter((s) => s.hasUserAccount).length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Quick Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-teal-600" />
            <span>Staff Directory & Roles</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Manage members, assign multiple roles, and create synchronized user login accounts for rosters & handover
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsCsvModalOpen(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            title="Bulk import personnel records via CSV spreadsheet"
          >
            <Upload className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Import CSV</span>
          </button>

          <button
            type="button"
            onClick={() => exportStaffListToCsv(staffList)}
            disabled={staffList.length === 0}
            className="px-3.5 py-2.5 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            title="Export all staff directory to CSV spreadsheet"
          >
            <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-teal-600 text-white hover:bg-teal-700 transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Add New Staff Member</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Members</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{staffList.length}</div>
          <div className="text-[11px] text-teal-600 font-semibold mt-0.5">
            {staffList.filter((s) => s.active).length} Active in duty rosters
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Shift Supervisors</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{totalSupervisors}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
            Auto-synced to Handover & Board
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Roster In-Charge</div>
          <div className="text-2xl font-black text-purple-600 mt-1">{totalRosterManagers}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
            Weekly duty schedule editors
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">User Accounts</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{totalWithAccount}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
            {staffList.length - totalWithAccount} members pending account
          </div>
        </div>
      </div>

      {/* Global Staff Search & Discovery Hub */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        {/* Main Global Search Input Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className={`w-5 h-5 transition-colors ${searchQuery.trim() ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff by name (e.g. Dr. Aishath, Ali), department (e.g. Nursing, OPD), ID (MHC-101), designation, or role..."
            className="w-full pl-12 pr-28 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 focus:border-teal-500 dark:focus:border-teal-400 focus:bg-white dark:focus:bg-slate-800 rounded-xl text-sm sm:text-base font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition shadow-2xs"
          />
          {/* Action buttons inside search bar: Clear & Shortcut badge */}
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                title="Clear search query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd
              onClick={() => searchInputRef.current?.focus()}
              className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-2xs cursor-pointer hover:border-slate-400 select-none"
              title="Click or press / or Cmd+K to search"
            >
              <span>⌘</span><span>K</span>
            </kbd>
          </div>
        </div>

        {/* Quick Department Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Departments:</span>
          </span>
          <button
            type="button"
            onClick={() => setDepartmentFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              departmentFilter === 'all'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>All Departments</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                departmentFilter === 'all'
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {staffList.length}
            </span>
          </button>
          {departments.map((dept) => {
            const count = departmentCounts[dept.name] || 0;
            const isSelected = departmentFilter === dept.name;
            return (
              <button
                key={dept.id}
                type="button"
                onClick={() => setDepartmentFilter(isSelected ? 'all' : dept.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{dept.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isSelected
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Secondary Filter Controls & Live Status Summary */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="supervisor">Supervisors</option>
              <option value="roster_manager">Roster In-Charge</option>
              <option value="admin">System Admin</option>
              <option value="staff">Staff Members</option>
              <option value="Clinical In-Charge">Clinical In-Charge</option>
              <option value="On-Call Officer">On-Call Officers</option>
            </select>

            {/* Account Filter */}
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Accounts</option>
              <option value="has_account">Has User Account</option>
              <option value="no_account">Needs User Account</option>
            </select>

            {/* Status Filter */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  statusFilter === 'active'
                    ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Active ({staffList.filter((s) => s.active).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  statusFilter === 'inactive'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Deactivated ({staffList.filter((s) => !s.active).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All ({staffList.length})
              </button>
            </div>
          </div>

          {/* Results Summary & Reset button */}
          <div className="flex items-center gap-2.5 text-xs self-end md:self-auto">
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              Showing <span className="font-bold text-slate-900 dark:text-white">{filteredStaff.length}</span> of {staffList.length} staff
            </span>
            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer border border-teal-200 dark:border-teal-800"
                title="Reset all filters and search query"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Staff Directory Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <div className="h-10 w-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-400">Loading staff records...</p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="font-bold text-lg text-slate-700 dark:text-slate-300">
              {searchQuery.trim()
                ? `No staff matching "${searchQuery}"`
                : 'No staff members found.'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {isFilterActive
                ? 'Try adjusting your search query, or reset your filters to view all staff records.'
                : 'Your staff directory is currently empty. Click below to add your first healthcare staff member.'}
            </p>
            {isFilterActive && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Search & Filters</span>
                </button>
              </div>
            )}
            {staffList.length === 0 && !isFilterActive && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(true)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer border border-slate-300 dark:border-slate-700"
                >
                  <Upload className="w-4 h-4 text-teal-600" />
                  <span>Bulk Upload via CSV</span>
                </button>
                <button
                  type="button"
                  onClick={openAddModal}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Staff Member</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-3">Staff ID</th>
                  <th className="py-3 px-3">Department & Designation</th>
                  <th className="py-3 px-3">Assigned Roles (Multi-Role)</th>
                  <th className="py-3 px-3">User Account (Save & Sync)</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredStaff.map((staff) => {
                  const roles = staff.roles && staff.roles.length > 0 ? staff.roles : ['staff'];

                  return (
                    <tr key={staff.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      {/* Staff Member */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {staff.photoUrl ? (
                            <img
                              src={staff.photoUrl}
                              alt={staff.fullName}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-extrabold text-xs flex items-center justify-center shrink-0 border border-teal-200 dark:border-teal-800">
                              {staff.fullName
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white leading-tight">
                              {highlightMatch(staff.fullName, searchQuery)}
                            </p>
                            {staff.fullNameDhivehi && (
                              <p className="text-xs text-slate-400 font-medium font-thaana" dir="rtl">
                                {highlightMatch(staff.fullNameDhivehi, searchQuery)}
                              </p>
                            )}
                            {(staff.phone || staff.email) && (
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                {staff.phone && <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{highlightMatch(staff.phone, searchQuery)}</span>}
                                {staff.email && <span className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{highlightMatch(staff.email, searchQuery)}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Staff ID */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {highlightMatch(staff.staffId, searchQuery)}
                        </span>
                      </td>

                      {/* Department & Designation */}
                      <td className="py-3.5 px-3">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {highlightMatch(staff.department, searchQuery)}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {highlightMatch(staff.designation, searchQuery)}
                        </div>
                      </td>

                      {/* Assigned Roles (Multiple Roles) */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                          {roles.map((rId) => {
                            const found = AVAILABLE_ROLES.find((ar) => ar.id === rId);
                            const label = found ? found.name : rId;
                            const badgeClass = found?.badgeClass || 'bg-slate-100 text-slate-700 border-slate-200';
                            return (
                              <span
                                key={rId}
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeClass}`}
                              >
                                {label}
                              </span>
                            );
                          })}

                          <button
                            type="button"
                            onClick={() => handleOpenAssignRolesModal(staff)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline cursor-pointer ml-1"
                            title="Assign or modify roles"
                          >
                            <Shield className="w-3 h-3" />
                            <span>Edit Roles</span>
                          </button>
                        </div>
                      </td>

                      {/* User Account (Save & Sync User) */}
                      <td className="py-3.5 px-3">
                        {staff.hasUserAccount ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              <Key className="w-3.5 h-3.5 text-blue-600" />
                              <span>@{staff.username || 'user'}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenCreateUserModal(staff)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                              title="Update PIN / Sync Credentials"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenCreateUserModal(staff)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs cursor-pointer"
                            title="Create User Account and sync credentials"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>+ Save & Sync User</span>
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        {staff.active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400">
                            Deactivated
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenAssignRolesModal(staff)}
                            className="p-2 text-slate-600 dark:text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-lg transition"
                            title="Assign Multiple Roles"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenCreateUserModal(staff)}
                            className="p-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition"
                            title="User Account & PIN Sync"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(staff)}
                            className="p-2 text-slate-600 dark:text-slate-400 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/30 rounded-lg transition"
                            title="Edit Staff Member"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeactivateStaffTarget(staff)}
                            className={`p-2 rounded-lg transition ${
                              staff.active
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                            }`}
                            title={staff.active ? 'Deactivate Staff Member' : 'Reactivate Staff Member'}
                          >
                            {staff.active ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteStaffTarget(staff)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                            title="Permanently Delete Staff Member"
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

      {/* =======================================================================
          MODAL 1: ADD / EDIT STAFF MEMBER (with integrated Save & Sync User)
          ======================================================================= */}
      {isModalOpen && (
        <div
          id="staff-modal-overlay"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onPaste={handlePaste}
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <UserPlus className="w-6 h-6 text-teal-600" />
                  <span>{editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {editingStaff
                    ? 'Update profile details, multiple roles, and linked user credentials'
                    : 'Save new member and optionally create matching login credentials'}
                </p>
              </div>
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

            <form onSubmit={handleSaveStaff} className="mt-5 space-y-4">
              {/* Photo Upload & Preview Section */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  Staff Photo (Upload or Paste from Clipboard)
                </label>
                <div className="flex items-center gap-4">
                  {photoPreview ? (
                    <div className="relative">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-teal-600 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoPreview('');
                          setPhotoUrl('');
                          setSelectedFile(null);
                        }}
                        className="absolute -top-2 -right-2 p-1 bg-rose-600 text-white rounded-full shadow-xs hover:bg-rose-700 transition"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400">
                      <ImageIcon className="w-6 h-6" />
                      <span className="text-[10px] font-semibold mt-1">No Photo</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileInputChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-teal-600" />
                      <span>Upload from Device</span>
                    </button>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Tip: You can also copy an image and press <kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded border text-slate-700 dark:text-slate-300">Ctrl+V</kbd>
                    </p>
                    {isCompressing && (
                      <p className="text-[11px] text-teal-600 font-semibold animate-pulse">
                        Optimizing image...
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Staff ID & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Staff ID <span className="text-rose-500">*</span>
                    </label>
                    {!editingStaff && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextId = generateNextStaffId();
                          setStaffId(nextId);
                          if (!accountUsername) {
                            setAccountUsername(nextId.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                          }
                        }}
                        className="text-[10px] text-teal-600 font-bold hover:underline"
                      >
                        Auto ID
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    placeholder="e.g. MHC-108"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-teal-500 rounded-xl text-sm font-mono font-bold focus:outline-none transition uppercase"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Unique hospital ID</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-teal-500 rounded-xl text-sm focus:outline-none cursor-pointer"
                  >
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Full Name & Dhivehi Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Full Name (English) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (!editingStaff && (!accountUsername || accountUsername.startsWith('mhc_'))) {
                        setAccountUsername(generateUsernameFromName(e.target.value, staffId));
                      }
                    }}
                    placeholder="e.g. Dr. Mariyam Nazeer"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-teal-500 rounded-xl text-sm focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Full Name (Dhivehi - Optional)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={fullNameDhivehi}
                    onChange={(e) => setFullNameDhivehi(e.target.value)}
                    placeholder="ޑރ. މަރިޔަމް ނަޒީރު"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-teal-500 rounded-xl text-sm font-thaana focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Designation & Dhivehi Designation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Designation (English) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Medical Officer"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-teal-500 rounded-xl text-sm focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Designation (Dhivehi - Optional)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={designationDhivehi}
                    onChange={(e) => setDesignationDhivehi(e.target.value)}
                    placeholder="ސީނިއަރ މެޑިކަލް އޮފިސަރ"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-teal-500 rounded-xl text-sm font-thaana focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Contact Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Contact Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 7789011 or 6580043"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-teal-500 rounded-xl text-sm focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Official Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. mariyam.n@mhc.gov.mv"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-teal-500 rounded-xl text-sm focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Multi-Role Assignment Section */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span>Assign Staff Roles (Multiple Roles)</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Select one or more roles</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {AVAILABLE_ROLES.map((role) => {
                    const isChecked = selectedRoles.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                          isChecked
                            ? 'bg-white dark:bg-slate-900 border-teal-500 shadow-xs'
                            : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRoleSelection(role.id, selectedRoles, setSelectedRoles)}
                          className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                        />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white leading-tight">{role.name}</div>
                          <div className="text-[10px] text-slate-500 line-clamp-1">{role.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Integrated: Create User Account (Save & Sync User) Section */}
              <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="text-xs font-bold text-blue-950 dark:text-blue-200">
                        Create User Account (Save & Sync User)
                      </div>
                      <div className="text-[11px] text-blue-800 dark:text-blue-300">
                        Instantly generates portal login credentials and syncs supervisor access
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createAccountToggle}
                      onChange={(e) => setCreateAccountToggle(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {createAccountToggle && (
                  <div className="pt-2 border-t border-blue-200/60 dark:border-blue-800/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Username *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 font-bold">@</span>
                        <input
                          type="text"
                          value={accountUsername}
                          onChange={(e) =>
                            setAccountUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                          }
                          placeholder="e.g. dr_mariyam"
                          className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Security PIN *
                        </label>
                        <button
                          type="button"
                          onClick={() => setAccountPin(generateRandomPin())}
                          className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <RefreshCw className="w-2.5 h-2.5" /> Generate
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showAccountPin ? 'text' : 'password'}
                          value={accountPin}
                          onChange={(e) => setAccountPin(e.target.value)}
                          placeholder="4-digit PIN"
                          className="w-full pl-3 pr-9 py-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-mono font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAccountPin(!showAccountPin)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showAccountPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || isCompressing}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving & Syncing...</span>
                    </>
                  ) : (
                    <span>
                      {editingStaff
                        ? 'Update Staff Member'
                        : createAccountToggle
                        ? 'Save & Sync User'
                        : 'Save Staff Member'}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 2: DEDICATED "CREATE USER ACCOUNT (SAVE & SYNC USER)"
          ======================================================================= */}
      {userModalOpen && targetStaffForUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-xl">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Create User Account (Save & Sync User)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Configure login credentials for {targetStaffForUser.fullName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setUserModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {userModalError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{userModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAndSyncUser} className="mt-4 space-y-4">
              {/* Staff Member Info Banner */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs shrink-0">
                  {targetStaffForUser.staffId}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {targetStaffForUser.fullName}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {targetStaffForUser.department} • {targetStaffForUser.designation}
                  </div>
                </div>
              </div>

              {/* Username & PIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Login Username *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 font-bold">@</span>
                    <input
                      type="text"
                      required
                      value={userFormUsername}
                      onChange={(e) =>
                        setUserFormUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                      }
                      className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Security PIN *
                    </label>
                    <button
                      type="button"
                      onClick={() => setUserFormPin(generateRandomPin())}
                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Generate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showUserFormPin ? 'text' : 'password'}
                      required
                      value={userFormPin}
                      onChange={(e) => setUserFormPin(e.target.value)}
                      placeholder="4-digit PIN"
                      className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowUserFormPin(!showUserFormPin)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showUserFormPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Roles Selection for User Account */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Assigned Multiple Roles *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_ROLES.slice(0, 4).map((role) => {
                    const isChecked = userFormRoles.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className={`flex items-start gap-2 p-2 rounded-xl border text-xs cursor-pointer transition ${
                          isChecked
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200 font-bold'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRoleSelection(role.id, userFormRoles, setUserFormRoles)}
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div>{role.name}</div>
                          <div className="text-[10px] text-slate-500 font-normal">{role.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {userFormRoles.includes('supervisor') && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <strong>Auto-Sync Active:</strong> When saved, this member is automatically registered as a Supervisor in the <strong>Department Duty Rosters & Supervisors</strong> directory and TV board!
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={syncingUser}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  {syncingUser && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save & Sync User Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 3: DEDICATED "ASSIGN STAFF ROLE (MULTIPLE ROLE)"
          ======================================================================= */}
      {assignRolesModalOpen && targetStaffForRoles && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 dark:bg-purple-950 text-purple-600 rounded-xl">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Assign Staff Roles (Multiple Roles)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Configure multiple duty responsibilities for {targetStaffForRoles.fullName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssignRolesModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {rolesModalError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{rolesModalError}</span>
              </div>
            )}

            <div className="mt-4 space-y-4">
              {/* Staff Member Pill */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {targetStaffForRoles.fullName} ({targetStaffForRoles.staffId})
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {targetStaffForRoles.department} • {targetStaffForRoles.designation}
                  </div>
                </div>
                {targetStaffForRoles.hasUserAccount && (
                  <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded border border-blue-200">
                    @{targetStaffForRoles.username}
                  </span>
                )}
              </div>

              {/* Roles Checkbox Grid */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Select Multiple System & Duty Roles
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AVAILABLE_ROLES.map((role) => {
                    const isChecked = staffRolesToAssign.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className={`flex items-start gap-3 p-3 rounded-2xl border text-xs cursor-pointer transition ${
                          isChecked
                            ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-500 text-purple-950 dark:text-purple-200 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            toggleRoleSelection(role.id, staffRolesToAssign, setStaffRolesToAssign)
                          }
                          className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            <span>{role.name}</span>
                            {role.category === 'system' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 font-semibold uppercase">
                                System
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            {role.desc}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Sync Toggle */}
              {targetStaffForRoles.hasUserAccount && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      Sync to Login Account (@{targetStaffForRoles.username})
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Synchronizes these role permissions to their user account credentials
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={syncRolesToUserAccount}
                    onChange={(e) => setSyncRolesToUserAccount(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4 cursor-pointer"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAssignRolesModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveStaffRoles}
                  disabled={savingRoles}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  {savingRoles && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Multiple Roles</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 4: CREDENTIALS SUCCESS CARD (1-CLICK COPY)
          ======================================================================= */}
      {credentialsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              User Account Saved & Synced!
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Login credentials successfully created and linked for{' '}
              <strong className="text-slate-900 dark:text-white">{credentialsModal.staffName}</strong>
            </p>

            <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Username:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200">
                  @{credentialsModal.username}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Security PIN:</span>
                <span className="font-mono font-bold text-blue-600 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 tracking-wider">
                  {credentialsModal.pin}
                </span>
              </div>
              <div className="flex items-start justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 font-medium">Assigned Roles:</span>
                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 text-right">
                  {credentialsModal.roles.join(', ')}
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedKey ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
              </button>
              <button
                type="button"
                onClick={() => setCredentialsModal(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivateStaffTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {deactivateStaffTarget.active ? 'Deactivate Staff Member?' : 'Reactivate Staff Member?'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              {deactivateStaffTarget.active
                ? `Deactivating ${deactivateStaffTarget.fullName} (${deactivateStaffTarget.staffId}) will remove them from active rosters and the current TV board, while securely preserving all historical records.`
                : `Reactivating ${deactivateStaffTarget.fullName} will allow them to be selected for rosters and displayed on active boards.`}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeactivateStaffTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleActive}
                className={`px-5 py-2 text-sm font-bold text-white rounded-xl shadow-xs transition ${
                  deactivateStaffTarget.active
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                {deactivateStaffTarget.active ? 'Yes, Deactivate' : 'Yes, Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {deleteStaffTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-rose-600 mb-2">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Permanently Delete Staff Member?
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Are you sure you want to permanently delete <strong className="text-slate-900 dark:text-white">{deleteStaffTarget.fullName}</strong> ({deleteStaffTarget.staffId})?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteStaffTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteStaff}
                disabled={isDeleting}
                className="px-5 py-2 text-sm font-bold text-white rounded-xl bg-rose-600 hover:bg-rose-700 shadow-xs transition flex items-center gap-1.5"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      <StaffCsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onSuccess={() => {
          loadData();
          refreshUsers();
        }}
        existingStaffList={staffList}
        departments={departments}
        currentUserEmail={currentUser?.email || 'admin@mhc.gov.mv'}
        isDemoMode={isDemoMode}
      />
    </div>
  );
};
