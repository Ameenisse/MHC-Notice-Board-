import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  getCategoriesList,
  saveCategory,
  restoreDefaultCategories,
  deleteCategory,
  getDepartmentsList,
  saveDepartment,
  deleteDepartment,
  restoreDefaultDepartments,
  reassignStaffDepartment,
  generatePairingCode,
  getPairedDisplaysList,
  revokeDisplay,
  getAuditLogsList,
  getStaffList,
  getLeaveRecordsList,
  getNoticesList,
  resetDatabaseAndSync,
  uploadFile,
  compressImage,
} from '../../services/db';
import {
  LeaveCategory,
  Department,
  Staff,
  AppSettings,
  PairedDisplay,
  AuditLog,
  PairingCodeRecord,
  DisplayMode,
  DisplaySplitRatio,
} from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { MHCLogo } from '../../components/common/MHCLogo';
import {
  Settings as SettingsIcon,
  Tv,
  Palette,
  Shield,
  FileDown,
  Upload,
  Trash2,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  KeyRound,
  RefreshCw,
  PowerOff,
  History,
  Sparkles,
  RotateCcw,
  Sliders,
  Radio,
  Image as ImageIcon,
  Link2,
  Check,
  Loader2,
  FileImage,
  Eye,
  Building2,
  Users,
  ArrowUp,
  ArrowDown,
  Search,
  Database,
  Split,
  Sun,
  Moon,
  Calendar,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';
import { PublicHolidaysManagement } from '../../components/admin/PublicHolidaysManagement';

interface SettingsPageProps {
  defaultTab?: 'roster' | 'departments' | 'display' | 'categories' | 'pairing' | 'audit' | 'data' | 'general';
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ defaultTab }) => {
  const { settings, refreshSettings, updateAppSettings, currentUser, isDemoMode } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read tab parameter from URL query if available
  const tabParam = searchParams.get('tab');
  const validTabs = ['roster', 'departments', 'display', 'categories', 'pairing'] as const;
  type TabType = typeof validTabs[number];

  // Immediately redirect moved sections to Super Admin Panel
  useEffect(() => {
    if (tabParam === 'general' || tabParam === 'identity' || (defaultTab as string) === 'general') {
      navigate('/admin/super-admin?tab=identity', { replace: true });
    } else if (tabParam === 'audit' || tabParam === 'audit-log' || (defaultTab as string) === 'audit') {
      navigate('/admin/super-admin?tab=audit', { replace: true });
    } else if (
      tabParam === 'data' ||
      tabParam === 'database' ||
      tabParam === 'backup' ||
      (defaultTab as string) === 'data'
    ) {
      navigate('/admin/super-admin?tab=database', { replace: true });
    }
  }, [tabParam, defaultTab, navigate]);

  const getInitialTab = (): TabType => {
    if (defaultTab && (validTabs as readonly string[]).includes(defaultTab)) return defaultTab as TabType;
    if (tabParam === 'displays' || tabParam === 'tv' || tabParam === 'pairing') return 'pairing';
    if (tabParam === 'departments' || tabParam === 'department' || tabParam === 'dept') return 'departments';
    if (tabParam === 'display' || tabParam === 'theme') return 'display';
    if (tabParam === 'categories' || tabParam === 'category') return 'categories';
    return 'roster';
  };

  // Active section tab
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);

  // Sync tab if defaultTab or searchParam changes
  useEffect(() => {
    if (defaultTab && (validTabs as readonly string[]).includes(defaultTab)) {
      setActiveTab(defaultTab as TabType);
    } else if (tabParam) {
      if (tabParam === 'roster' || tabParam === 'roaster' || tabParam === 'holidays') {
        setActiveTab('roster');
      } else if (tabParam === 'displays' || tabParam === 'tv' || tabParam === 'pairing') {
        setActiveTab('pairing');
      } else if ((validTabs as readonly string[]).includes(tabParam)) {
        setActiveTab(tabParam as TabType);
      }
    }
  }, [defaultTab, tabParam]);

  const handleTabSelect = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Safe date formatters to prevent rendering exceptions
  const formatPairedDate = (pairedAt: any) => {
    if (!pairedAt) return 'Registered';
    try {
      if (typeof pairedAt === 'number') {
        return new Date(pairedAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      if (typeof pairedAt === 'string') {
        const parsed = new Date(pairedAt);
        if (!isNaN(parsed.getTime())) {
          return parsed.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        }
        return pairedAt.split('T')[0] || pairedAt;
      }
      if (pairedAt?.seconds) {
        return new Date(pairedAt.seconds * 1000).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      }
      return String(pairedAt);
    } catch {
      return 'Registered';
    }
  };

  const formatAuditDate = (ts: any) => {
    if (!ts) return 'N/A';
    try {
      if (typeof ts === 'number') {
        return new Date(ts).toLocaleString('en-GB');
      }
      if (typeof ts === 'string') {
        const d = new Date(ts);
        return isNaN(d.getTime()) ? ts : d.toLocaleString('en-GB');
      }
      if (ts?.seconds) {
        return new Date(ts.seconds * 1000).toLocaleString('en-GB');
      }
      return String(ts);
    } catch {
      return 'N/A';
    }
  };

  // General Settings Form
  const [orgName, setOrgName] = useState(settings.orgName);
  const [orgNameDhivehi, setOrgNameDhivehi] = useState(settings.orgNameDhivehi || '');
  const [boardTitle, setBoardTitle] = useState(settings.boardTitle);
  const [boardTitleDhivehi, setBoardTitleDhivehi] = useState(settings.boardTitleDhivehi || '');
  const [timezone, setTimezone] = useState(settings.timezone || 'Indian/Maldives');
  const [clockFormat, setClockFormat] = useState<'12h' | '24h'>(settings.clockFormat || '12h');
  const [dateFormat, setDateFormat] = useState(settings.dateFormat || 'dd/MM/yyyy');
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '');

  // Display Settings
  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    settings.displayMode || 'alternating'
  );
  const [themeMode, setThemeMode] = useState<'night' | 'day'>(settings.themeMode || 'night');
  const [rotationInterval, setRotationInterval] = useState(settings.rotationInterval || 15);
  const [cardsPerPage, setCardsPerPage] = useState(settings.cardsPerPage || 8);
  const [showEmptyCategories, setShowEmptyCategories] = useState(settings.showEmptyCategories ?? true);
  const [tvSplitEnabled, setTvSplitEnabled] = useState(settings.tvSplitEnabled ?? true);
  const [tvSplitRatio, setTvSplitRatio] = useState<DisplaySplitRatio>(
    settings.tvSplitRatio || '50_50'
  );
  const [announcementStripEnabled, setAnnouncementStripEnabled] = useState(
    settings.announcementStripEnabled ?? false
  );
  const [announcementText, setAnnouncementText] = useState(settings.announcementText || '');
  const [announcementTextDhivehi, setAnnouncementTextDhivehi] = useState(
    settings.announcementTextDhivehi || ''
  );

  // Categories State
  const [categories, setCategories] = useState<LeaveCategory[]>([]);
  const [editingCategory, setEditingCategory] = useState<LeaveCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catNameDhivehi, setCatNameDhivehi] = useState('');
  const [catColor, setCatColor] = useState('#0d9488');
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);

  // Departments State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptNameDhivehi, setDeptNameDhivehi] = useState('');
  const [deptOrder, setDeptOrder] = useState(1);
  const [savingDept, setSavingDept] = useState(false);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [deptSuccess, setDeptSuccess] = useState<string | null>(null);
  const [restoringDepts, setRestoringDepts] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');

  // Department Reassignment & Safe Deletion State
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [reassignTargetDept, setReassignTargetDept] = useState<string>('');
  const [isDeleteDeptModalOpen, setIsDeleteDeptModalOpen] = useState(false);
  const [deletingDeptLoading, setDeletingDeptLoading] = useState(false);

  // Pairing State
  const [activePairingCode, setActivePairingCode] = useState<PairingCodeRecord | null>(null);
  const [pairedDisplays, setPairedDisplays] = useState<PairedDisplay[]>([]);
  const [pairingLoading, setPairingLoading] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Status & Feedback
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Dedicated Logo Upload & Management State
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoSuccess, setLogoSuccess] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualUrlInput, setManualUrlInput] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Demo & Database Reset State & Handlers
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [seedDemoSuccess, setSeedDemoSuccess] = useState<string | null>(null);
  const [seedDemoError, setSeedDemoError] = useState<string | null>(null);

  const handleResetDatabase = async () => {
    if (
      !confirm(
        '⚠️ RESET DATABASE & PURGE FAKE DATA\n\nThis will permanently wipe all test/fake data from the Firestore database (staff profiles, leave records, notices, memories, duty rosters, weekly rosters, supervisors, handovers, and daily media).\n\nIt will synchronize the application with clean baseline settings, the 6 official hospital departments, and the 7 official leave categories.\n\nDo you wish to proceed?'
      )
    ) {
      return;
    }

    setSeedingDemo(true);
    setSeedDemoSuccess(null);
    setSeedDemoError(null);
    try {
      const res = await resetDatabaseAndSync(currentUser?.email || 'admin@mhc.gov.mv', isDemoMode);
      setSeedDemoSuccess(res.message || 'Database successfully reset and synchronized with the app.');
      await loadData();
      await refreshSettings();
    } catch (err: any) {
      setSeedDemoError(err.message || 'Failed to reset database.');
    } finally {
      setSeedingDemo(false);
    }
  };

  // Sync settings when loaded from Firestore or updated
  useEffect(() => {
    if (settings) {
      setOrgName(settings.orgName || '');
      setOrgNameDhivehi(settings.orgNameDhivehi || '');
      setBoardTitle(settings.boardTitle || '');
      setBoardTitleDhivehi(settings.boardTitleDhivehi || '');
      setTimezone(settings.timezone || 'Indian/Maldives');
      setClockFormat(settings.clockFormat || '12h');
      setDateFormat(settings.dateFormat || 'dd/MM/yyyy');
      setLogoUrl(settings.logoUrl || '');
      setDisplayMode(settings.displayMode || 'alternating');
      setThemeMode(settings.themeMode || 'night');
      setRotationInterval(settings.rotationInterval || 15);
      setCardsPerPage(settings.cardsPerPage || 8);
      setShowEmptyCategories(settings.showEmptyCategories ?? true);
      setTvSplitEnabled(settings.tvSplitEnabled ?? true);
      setTvSplitRatio(settings.tvSplitRatio || '50_50');
      setAnnouncementStripEnabled(settings.announcementStripEnabled ?? false);
      setAnnouncementText(settings.announcementText || '');
      setAnnouncementTextDhivehi(settings.announcementTextDhivehi || '');
    }
  }, [settings]);

  const loadData = async () => {
    try {
      const [cats, depts, staffMembers, displays, logs] = await Promise.all([
        getCategoriesList(isDemoMode),
        getDepartmentsList(isDemoMode),
        getStaffList(isDemoMode),
        getPairedDisplaysList(isDemoMode),
        getAuditLogsList(isDemoMode),
      ]);
      setCategories(cats);
      setDepartments(depts);
      setStaffList(staffMembers);
      setPairedDisplays(displays);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error loading settings data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemoMode]);

  // Handle Logo file processing (drag-and-drop or file selection)
  const processAndApplyLogoFile = async (file: File) => {
    const validExtensions = /\.(png|jpe?g|svg|webp|gif)$/i;
    const isImageMime = file.type.startsWith('image/');
    if (!isImageMime && !validExtensions.test(file.name)) {
      setLogoError('Unsupported file format. Please upload a PNG, SVG, WebP, JPG, or GIF file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setLogoError('File is too large (maximum 5MB). Please upload a smaller image.');
      return;
    }

    setUploadingLogo(true);
    setLogoError(null);
    setLogoSuccess(null);

    try {
      let finalUrl = '';
      if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        // Read SVG directly as Data URL for lossless vector rendering & transparency
        finalUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        const compressedBlob = await compressImage(file, 400, 0.9);
        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        const compressedFile = new File([compressedBlob], file.name, {
          type: isPng ? 'image/png' : 'image/jpeg',
        });
        finalUrl = await uploadFile(
          compressedFile,
          'logos',
          `logo_${Date.now()}.${isPng ? 'png' : 'jpg'}`,
          isDemoMode
        );
      }

      setLogoUrl(finalUrl);
      await updateAppSettings({ logoUrl: finalUrl });
      setLogoSuccess('Organization logo uploaded and saved to Cloud Firestore.');
      setTimeout(() => setLogoSuccess(null), 4000);
    } catch (err: any) {
      console.error('Logo upload error:', err);
      setLogoError(err.message || 'Failed to upload and save organization logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await processAndApplyLogoFile(file);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  const handleDropLogo = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLogo(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processAndApplyLogoFile(e.dataTransfer.files[0]);
    }
  };

  const handleApplyUrlLogo = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = manualUrlInput.trim();
    if (!url) return;

    setUploadingLogo(true);
    setLogoError(null);
    setLogoSuccess(null);
    try {
      setLogoUrl(url);
      await updateAppSettings({ logoUrl: url });
      setLogoSuccess('Organization logo URL saved and applied.');
      setShowUrlInput(false);
      setManualUrlInput('');
      setTimeout(() => setLogoSuccess(null), 4000);
    } catch (err: any) {
      setLogoError(err.message || 'Failed to save logo URL.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleResetToOfficialLogo = async () => {
    setUploadingLogo(true);
    setLogoError(null);
    setLogoSuccess(null);
    try {
      const defaultLogo = '/mhc-logo.svg';
      setLogoUrl(defaultLogo);
      await updateAppSettings({ logoUrl: defaultLogo });
      setLogoSuccess('Restored to official Maduvvari Health Centre emblem.');
      setTimeout(() => setLogoSuccess(null), 4000);
    } catch (err: any) {
      setLogoError(err.message || 'Failed to reset logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    setLogoError(null);
    setLogoSuccess(null);
    try {
      setLogoUrl('');
      await updateAppSettings({ logoUrl: '' });
      setLogoSuccess('Organization logo removed.');
      setTimeout(() => setLogoSuccess(null), 4000);
    } catch (err: any) {
      setLogoError(err.message || 'Failed to remove logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Save General & Display Settings
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    const updated: Partial<AppSettings> = {
      orgName: orgName.trim(),
      orgNameDhivehi: orgNameDhivehi.trim() || '',
      boardTitle: boardTitle.trim(),
      boardTitleDhivehi: boardTitleDhivehi.trim() || '',
      timezone,
      clockFormat,
      dateFormat,
      logoUrl: logoUrl.trim(),
      displayMode,
      themeMode,
      rotationInterval: Math.max(5, Number(rotationInterval) || 15),
      cardsPerPage: Math.max(2, Math.min(24, Number(cardsPerPage) || 8)),
      showEmptyCategories,
      tvSplitEnabled,
      tvSplitRatio,
      announcementStripEnabled,
      announcementText: announcementText.trim(),
      announcementTextDhivehi: announcementTextDhivehi.trim(),
    };

    try {
      await updateAppSettings(updated);
      setSaveSuccess('System preferences and TV settings successfully saved.');
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err: any) {
      console.error('Failed to update settings:', err);
      setSaveError(err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  // Instant Day / Night Mode Toggle
  const handleToggleThemeMode = async (targetMode?: 'night' | 'day') => {
    const newMode: 'night' | 'day' = targetMode || (themeMode === 'day' ? 'night' : 'day');
    setThemeMode(newMode);
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      await updateAppSettings({ themeMode: newMode });
      setSaveSuccess(`Switched to ${newMode === 'day' ? 'Day Mode (Light theme)' : 'Night Mode (Dark theme)'} successfully.`);
      setTimeout(() => setSaveSuccess(null), 3500);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to switch theme mode.');
    } finally {
      setSaving(false);
    }
  };

  const [restoringCategories, setRestoringCategories] = useState(false);

  // Handle Category Save
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    try {
      await saveCategory(
        {
          id: editingCategory ? editingCategory.id : `cat_${Date.now()}`,
          name: catName.trim(),
          nameDhivehi: catNameDhivehi.trim() || undefined,
          color: catColor,
          order: editingCategory ? editingCategory.order : categories.length + 1,
          active: editingCategory ? editingCategory.active : true,
        },
        currentUser?.email || 'Administrator',
        isDemoMode
      );
      setIsCatModalOpen(false);
      setEditingCategory(null);
      const cats = await getCategoriesList(isDemoMode);
      setCategories(cats);
    } catch (err: any) {
      alert(err.message || 'Failed to save category.');
    }
  };

  // Handle Restore Default Categories
  const handleRestoreDefaultCategories = async () => {
    if (
      !confirm(
        'Restore the 7 default leave categories (Annual Leave, Sick Leave, F.R Leave, Maternity leave, Release, No pay leave, Other Leave)?'
      )
    ) {
      return;
    }

    setRestoringCategories(true);
    try {
      const updated = await restoreDefaultCategories(
        currentUser?.email || 'Administrator',
        isDemoMode
      );
      setCategories(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to restore default categories.');
    } finally {
      setRestoringCategories(false);
    }
  };

  // Handle Delete Category
  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Are you sure you want to delete category "${categoryName}"?`)) return;

    try {
      await deleteCategory(categoryId, currentUser?.email || 'Administrator', isDemoMode);
      const cats = await getCategoriesList(isDemoMode);
      setCategories(cats);
    } catch (err: any) {
      alert(err.message || 'Failed to delete category.');
    }
  };

  // ==========================================
  // DEPARTMENT CRUD HANDLERS
  // ==========================================
  const handleOpenAddDept = () => {
    setEditingDept(null);
    setDeptName('');
    setDeptNameDhivehi('');
    const maxOrder = departments.length > 0 ? Math.max(...departments.map((d) => d.order || 0)) : 0;
    setDeptOrder(maxOrder + 1);
    setDeptError(null);
    setIsDeptModalOpen(true);
  };

  const handleOpenEditDept = (dept: Department) => {
    setEditingDept(dept);
    setDeptName(dept.name);
    setDeptNameDhivehi(dept.nameDhivehi || '');
    setDeptOrder(dept.order || 1);
    setDeptError(null);
    setIsDeptModalOpen(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = deptName.trim();
    if (!trimmedName) {
      setDeptError('Department name in English is required.');
      return;
    }

    // Check duplicate name
    const isDuplicate = departments.some(
      (d) => d.name.toLowerCase() === trimmedName.toLowerCase() && d.id !== editingDept?.id
    );
    if (isDuplicate) {
      setDeptError(`A department named "${trimmedName}" already exists.`);
      return;
    }

    setSavingDept(true);
    setDeptError(null);

    try {
      const deptId = editingDept?.id || 'dept_' + Date.now();
      const oldName = editingDept?.name;

      const deptToSave: Department = {
        id: deptId,
        name: trimmedName,
        nameDhivehi: deptNameDhivehi.trim() || undefined,
        order: Number(deptOrder) || 1,
      };

      await saveDepartment(deptToSave, currentUser?.email || 'Administrator', isDemoMode);

      // If department was renamed, update assigned staff records
      if (oldName && oldName !== trimmedName) {
        await reassignStaffDepartment(oldName, trimmedName, currentUser?.email || 'Administrator', isDemoMode);
      }

      // Refresh data
      const [updatedDepts, updatedStaff] = await Promise.all([
        getDepartmentsList(isDemoMode),
        getStaffList(isDemoMode),
      ]);
      setDepartments(updatedDepts);
      setStaffList(updatedStaff);
      setIsDeptModalOpen(false);
      setEditingDept(null);
      setDeptSuccess(
        editingDept
          ? `Department "${trimmedName}" updated successfully.`
          : `Department "${trimmedName}" added successfully.`
      );
      setTimeout(() => setDeptSuccess(null), 4000);
    } catch (err: any) {
      setDeptError(err.message || 'Failed to save department.');
    } finally {
      setSavingDept(false);
    }
  };

  const handleMoveDept = async (dept: Department, direction: 'up' | 'down') => {
    const sorted = [...departments].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((d) => d.id === dept.id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sorted.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const currentDept = sorted[index];
    const targetDept = sorted[targetIndex];

    const currentOrder = currentDept.order;
    const targetOrder = targetDept.order;

    currentDept.order = targetOrder;
    targetDept.order = currentOrder;

    // Optimistic state update
    const newSorted = [...sorted].sort((a, b) => a.order - b.order);
    setDepartments(newSorted);

    try {
      await Promise.all([
        saveDepartment(currentDept, currentUser?.email || 'Administrator', isDemoMode),
        saveDepartment(targetDept, currentUser?.email || 'Administrator', isDemoMode),
      ]);
    } catch (err: any) {
      console.error('Error reordering departments:', err);
      const refreshed = await getDepartmentsList(isDemoMode);
      setDepartments(refreshed);
    }
  };

  const handleRequestDeleteDept = (dept: Department) => {
    const assignedStaff = staffList.filter((s) => s.department === dept.name);
    if (assignedStaff.length > 0) {
      // Prompt to reassign staff before deleting
      setDeletingDept(dept);
      const otherDepts = departments.filter((d) => d.id !== dept.id);
      setReassignTargetDept(otherDepts[0]?.name || '');
      setIsDeleteDeptModalOpen(true);
    } else {
      if (confirm(`Are you sure you want to delete department "${dept.name}"?`)) {
        executeDeleteDept(dept.id, null);
      }
    }
  };

  const executeDeleteDept = async (deptId: string, reassignTo: string | null) => {
    setDeletingDeptLoading(true);
    try {
      const deptToDelete = departments.find((d) => d.id === deptId);
      if (reassignTo && deptToDelete) {
        await reassignStaffDepartment(deptToDelete.name, reassignTo, currentUser?.email || 'Administrator', isDemoMode);
      }
      await deleteDepartment(deptId, currentUser?.email || 'Administrator', isDemoMode);

      const [updatedDepts, updatedStaff] = await Promise.all([
        getDepartmentsList(isDemoMode),
        getStaffList(isDemoMode),
      ]);
      setDepartments(updatedDepts);
      setStaffList(updatedStaff);
      setIsDeleteDeptModalOpen(false);
      setDeletingDept(null);
      setDeptSuccess(
        `Department deleted successfully${reassignTo ? ` and staff reassigned to "${reassignTo}"` : ''}.`
      );
      setTimeout(() => setDeptSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete department.');
    } finally {
      setDeletingDeptLoading(false);
    }
  };

  const handleRestoreDefaultDepartments = async () => {
    if (
      !confirm(
        'Restore the 6 institutional default departments (Medical & Clinical, Nursing Services, Diagnostic & Lab, Pharmacy, Public Health, Administration)? Any missing defaults will be created.'
      )
    ) {
      return;
    }

    setRestoringDepts(true);
    try {
      const updated = await restoreDefaultDepartments(
        currentUser?.email || 'Administrator',
        isDemoMode
      );
      setDepartments(updated);
      setDeptSuccess('Default institutional departments restored successfully.');
      setTimeout(() => setDeptSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to restore default departments.');
    } finally {
      setRestoringDepts(false);
    }
  };

  // Generate TV Pairing Code
  const handleGeneratePairingCode = async () => {
    setPairingLoading(true);
    try {
      const codeRecord = await generatePairingCode(
        currentUser?.email || 'Administrator',
        isDemoMode
      );
      setActivePairingCode(codeRecord);
    } catch (err: any) {
      alert(err.message || 'Failed to generate pairing code.');
    } finally {
      setPairingLoading(false);
    }
  };

  // Revoke Display
  const handleRevokeDisplay = async (displayId: string) => {
    try {
      await revokeDisplay(displayId, currentUser?.email || 'Administrator', isDemoMode);
      const displays = await getPairedDisplaysList(isDemoMode);
      setPairedDisplays(displays);
    } catch (err: any) {
      alert(err.message || 'Failed to revoke display.');
    }
  };

  // Export Complete Backup JSON
  const handleExportBackup = async () => {
    try {
      const [staff, leaves, cats, nots] = await Promise.all([
        getStaffList(isDemoMode),
        getLeaveRecordsList(isDemoMode),
        getCategoriesList(isDemoMode),
        getNoticesList(isDemoMode),
      ]);

      const backupData = {
        exportDate: new Date().toISOString(),
        institution: 'Maduvvari Health Centre',
        version: '1.0.0',
        settings,
        staff,
        leaveRecords: leaves,
        categories: cats,
        notices: nots,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MHC_LeaveBoard_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export system backup.');
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-teal-600" />
            <span>Settings & Preferences</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Configure institutional identity, TV display rotation, pairing codes, and leave categories
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Day / Night Mode Quick Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              id="btn-quick-theme-day"
              type="button"
              onClick={() => handleToggleThemeMode('day')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                themeMode === 'day'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Switch to Day Mode (Light Theme)"
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Day</span>
            </button>
            <button
              id="btn-quick-theme-night"
              type="button"
              onClick={() => handleToggleThemeMode('night')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                themeMode === 'night'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Switch to Night Mode (Dark Theme)"
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Night</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleSaveSettings()}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            title="Save changes to organizational preferences and TV screen display"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-teal-200" />
                <span>Save All Settings</span>
              </>
            )}
          </button>

          <Link
            to="/admin/super-admin"
            className="px-4 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-2 shadow-xs cursor-pointer"
            title="Open Super Admin Governance Panel"
          >
            <ShieldAlert className="w-4 h-4 text-slate-950" />
            <span>Super Admin Panel</span>
          </Link>
        </div>
      </div>

      {/* Super Admin Relocation Notice Banner */}
      <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-800 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-700" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
              Institutional Identity, Audit Logs &amp; Database Backup Relocated
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              These governance controls are now isolated in the Super Admin Panel. (In-built: <strong className="font-mono text-amber-900">user: appadmin</strong> &bull; <strong className="font-mono text-amber-900">pin: 2026</strong>).
            </p>
          </div>
        </div>
        <Link
          to="/admin/super-admin"
          className="px-3.5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center justify-center gap-1.5 shadow-xs shrink-0"
        >
          <span>Open Super Admin</span>
          <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
        </Link>
      </div>

      {/* Tabs Navigation (Operational Settings Only) */}
      <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex flex-wrap sm:flex-nowrap gap-1 overflow-x-auto">
        <button
          id="tab-btn-roster"
          type="button"
          onClick={() => handleTabSelect('roster')}
          className={`flex-1 min-w-[160px] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'roster'
              ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Calendar className="w-4 h-4 text-amber-500" />
          <span>Roaster &amp; Holidays</span>
        </button>

        <button
          id="tab-btn-departments"
          type="button"
          onClick={() => handleTabSelect('departments')}
          className={`flex-1 min-w-[140px] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'departments'
              ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Building2 className="w-4 h-4 text-teal-600" />
          <span>Departments</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'departments'
                ? 'bg-teal-100 text-teal-800'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {departments.length}
          </span>
        </button>

        <button
          id="tab-btn-display"
          type="button"
          onClick={() => handleTabSelect('display')}
          className={`flex-1 min-w-[140px] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'display'
              ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Palette className="w-4 h-4 text-teal-600" />
          <span>TV Display Rules</span>
        </button>

        <button
          id="tab-btn-categories"
          type="button"
          onClick={() => handleTabSelect('categories')}
          className={`flex-1 min-w-[140px] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'categories'
              ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-teal-600" />
          <span>Leave Categories</span>
        </button>

        <button
          id="tab-btn-pairing"
          type="button"
          onClick={() => handleTabSelect('pairing')}
          className={`flex-1 min-w-[160px] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'pairing'
              ? 'bg-teal-700 text-white shadow-md shadow-teal-900/20 font-black'
              : 'text-teal-900 bg-teal-50/80 hover:bg-teal-100 hover:text-teal-950 font-extrabold border border-teal-200/70'
          }`}
        >
          <Tv className={`w-4 h-4 ${activeTab === 'pairing' ? 'text-white' : 'text-teal-700'}`} />
          <span>Paired TV Displays</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'pairing'
                ? 'bg-teal-900/70 text-teal-100 border border-teal-500/40'
                : 'bg-teal-200 text-teal-900'
            }`}
          >
            {pairedDisplays.filter((d) => d.status === 'active' || (d as any).active).length}
          </span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          <span>{saveError}</span>
        </div>
      )}

      {/* =========================================================
          TAB 1: GENERAL IDENTITY (RELOCATED TO SUPER ADMIN)
          ========================================================= */}
      {activeTab === ('general' as any) && (
        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-inner">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Institutional Identity Relocated</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Facility names, logos, branding, and localized Thaana identities are protected and managed within the dedicated Super Admin Panel.
          </p>
          <Link
            to="/admin/super-admin?tab=identity"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400 shadow-md transition"
          >
            <span>Open Institutional Identity in Super Admin</span>
            <ChevronRight className="w-4 h-4 stroke-[3]" />
          </Link>
        </div>
      )}
      {false && (
        <form onSubmit={handleSaveSettings} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <h2 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3">
            Organization Identity & Localization
          </h2>

          {/* Organization Logo Management Card */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-teal-600" />
                  <span>Organization Logo & Crest</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Broadcasted across TV displays, board headers, staff directory, and admin portals.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {logoUrl && logoUrl !== '/mhc-logo.svg' && (
                  <button
                    type="button"
                    onClick={handleResetToOfficialLogo}
                    disabled={uploadingLogo}
                    className="px-3 py-1.5 bg-white hover:bg-teal-50 text-teal-800 rounded-xl text-xs font-bold border border-slate-200 shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Restore default Maduvvari Health Centre emblem"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-teal-600" />
                    <span>Reset to Official Emblem</span>
                  </button>
                )}
                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={uploadingLogo}
                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold border border-slate-200 shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Remove custom logo and use title text only"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Logo</span>
                  </button>
                )}
              </div>
            </div>

            {/* In-card Feedback Notifications */}
            {logoSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{logoSuccess}</span>
              </div>
            )}
            {logoError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{logoError}</span>
              </div>
            )}

            {/* Grid: Live Preview vs. Upload Dropzone & Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Left Column: Live Contextual Previews */}
              <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>Live Display Preview</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                    {logoUrl === '/mhc-logo.svg'
                      ? 'Official Vector Emblem'
                      : logoUrl.startsWith('data:image/svg')
                      ? 'Custom SVG Vector'
                      : logoUrl.startsWith('data:')
                      ? 'Custom Uploaded'
                      : logoUrl
                      ? 'Custom URL'
                      : 'No Logo (Title only)'}
                  </span>
                </div>

                {/* 1. TV Display Board Simulation (Dark Slate context) */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                    <span>TV Display Header Preview (Dark Context)</span>
                    <span className="text-[10px] text-slate-400">1080p Monitor</span>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-3 flex items-center gap-3 border border-slate-800 shadow-inner">
                    <div className="h-12 w-12 rounded-xl bg-white p-1 border border-slate-700/60 shadow-xs shrink-0 flex items-center justify-center overflow-hidden">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Logo preview"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <MHCLogo className="w-full h-full" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-200 truncate">{orgName || 'Maduvvari Health Centre'}</p>
                      <p className="text-[11px] text-teal-400 font-medium truncate">{boardTitle || 'Staff Duty & Leave Board'}</p>
                    </div>
                  </div>
                </div>

                {/* 2. Admin Navbar Simulation (Light White context) */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                    <span>Admin Portal Header (Light Context)</span>
                    <span className="text-[10px] text-slate-400">Desktop & Print</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 border border-slate-200">
                    <div className="h-10 w-10 rounded-lg bg-white p-0.5 border border-slate-200 shadow-2xs shrink-0 flex items-center justify-center overflow-hidden">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Logo preview"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <MHCLogo className="w-full h-full" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{orgName || 'Maduvvari Health Centre'}</p>
                      <p className="text-[10px] text-slate-500 truncate">Administration Portal</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Upload Dropzone & URL Input */}
              <div className="lg:col-span-7 flex flex-col justify-between space-y-3">
                {/* Drag-and-Drop Area */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingLogo(true);
                  }}
                  onDragLeave={() => setIsDraggingLogo(false)}
                  onDrop={handleDropLogo}
                  onClick={() => !uploadingLogo && logoInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[150px] ${
                    isDraggingLogo
                      ? 'border-teal-500 bg-teal-50/70 scale-[1.01]'
                      : 'border-slate-300 hover:border-teal-500 bg-white hover:bg-slate-50/70'
                  } ${uploadingLogo ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <input
                    type="file"
                    ref={logoInputRef}
                    onChange={handleLogoFileChange}
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/gif"
                    className="hidden"
                  />

                  {uploadingLogo ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                      <p className="text-xs font-bold text-teal-900">Uploading and saving organization logo...</p>
                      <p className="text-[11px] text-slate-500">Updating Firestore and broadcasting in real-time</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-2 border border-teal-100 shadow-2xs">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-800">
                        <span className="text-teal-600 underline underline-offset-2">Click to choose image file</span> or drag & drop here
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Supports PNG (with transparency), SVG vector, WebP, JPG, or GIF up to 5MB
                      </p>
                    </div>
                  )}
                </div>

                {/* Alternative: Link via URL */}
                <div className="pt-1">
                  {!showUrlInput ? (
                    <div className="flex items-center justify-between text-xs px-1">
                      <button
                        type="button"
                        onClick={() => setShowUrlInput(true)}
                        className="text-teal-700 hover:text-teal-800 font-bold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Or enter hosted logo image URL</span>
                      </button>
                      <span className="text-[11px] text-slate-400">Applies immediately across all displays</span>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-300">
                      <Link2 className="w-4 h-4 text-slate-400 shrink-0 ml-1.5" />
                      <input
                        type="url"
                        placeholder="https://example.gov.mv/logo.png"
                        value={manualUrlInput}
                        onChange={(e) => setManualUrlInput(e.target.value)}
                        className="flex-1 text-xs py-1 px-1 text-slate-800 placeholder:text-slate-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleApplyUrlLogo}
                        disabled={!manualUrlInput.trim() || uploadingLogo}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        Apply URL
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowUrlInput(false);
                          setManualUrlInput('');
                        }}
                        className="px-2 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="settings-org-name" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Organization Name (English)
              </label>
              <input
                id="settings-org-name"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="settings-org-name-dhivehi" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Organization Name (Dhivehi)
              </label>
              <input
                id="settings-org-name-dhivehi"
                type="text"
                dir="rtl"
                value={orgNameDhivehi}
                onChange={(e) => setOrgNameDhivehi(e.target.value)}
                placeholder="މަޑުއްވަރީ ޞިއްޙީ މަރުކަޒު"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="settings-board-title" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                TV Board Title (English)
              </label>
              <input
                id="settings-board-title"
                type="text"
                value={boardTitle}
                onChange={(e) => setBoardTitle(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="settings-board-title-dhivehi" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                TV Board Title (Dhivehi)
              </label>
              <input
                id="settings-board-title-dhivehi"
                type="text"
                dir="rtl"
                value={boardTitleDhivehi}
                onChange={(e) => setBoardTitleDhivehi(e.target.value)}
                placeholder="ޗުއްޓީގައި ތިބި މުވައްޒަފުން"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="settings-timezone" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Default Timezone
              </label>
              <select
                id="settings-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none cursor-pointer"
              >
                <option value="Indian/Maldives">Indian/Maldives (UTC+05:00)</option>
                <option value="UTC">UTC (Universal Coordinated Time)</option>
              </select>
            </div>

            <div>
              <label htmlFor="settings-clock-format" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Clock Format on TV
              </label>
              <select
                id="settings-clock-format"
                value={clockFormat}
                onChange={(e) => setClockFormat(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none cursor-pointer"
              >
                <option value="12h">12-Hour (e.g. 02:30:15 PM)</option>
                <option value="24h">24-Hour (e.g. 14:30:15)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex-1 w-full">
              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{saveSuccess}</span>
                </div>
              )}
              {saveError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving General Settings...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save General Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* =========================================================
          TAB: ROASTER SETTINGS & PUBLIC HOLIDAYS (CRUD)
          ========================================================= */}
      {activeTab === 'roster' && (
        <PublicHolidaysManagement
          isDemoMode={isDemoMode}
          currentUserEmail={currentUser?.email || 'admin@mhc.gov.mv'}
        />
      )}

      {/* =========================================================
          TAB: DEPARTMENTS CRUD
          ========================================================= */}
      {activeTab === 'departments' && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          {/* Header & Primary Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-600" />
                <span>Institutional Departments & Clinical Divisions</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Manage medical sections, clinical wards, and administrative units. Configured departments populate staff registration, leave filtering, and public TV headers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestoreDefaultDepartments}
                disabled={restoringDepts}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-300 cursor-pointer disabled:opacity-50"
                title="Restore the 6 institutional default departments (Medical & Clinical, Nursing, Lab, Pharmacy, Public Health, Administration)"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${restoringDepts ? 'animate-spin text-teal-600' : ''}`} />
                <span>{restoringDepts ? 'Restoring...' : 'Restore Defaults'}</span>
              </button>

              <button
                id="btn-add-department"
                type="button"
                onClick={handleOpenAddDept}
                className="px-3.5 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Department</span>
              </button>
            </div>
          </div>

          {/* Alert feedback */}
          {deptSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{deptSuccess}</span>
            </div>
          )}

          {/* Search bar & quick stats */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="dept-search-input"
                type="text"
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                placeholder="Search departments by English name or ދިވެހި..."
                className="w-full pl-9 pr-3 py-1.5 bg-white rounded-lg border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 shrink-0">
              <span className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 font-semibold">
                Departments: <strong className="text-slate-900">{departments.length}</strong>
              </span>
              <span className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 font-semibold">
                Assigned Staff:{' '}
                <strong className="text-teal-700">
                  {staffList.filter((s) => s.department).length}
                </strong>
              </span>
            </div>
          </div>

          {/* Departments List / Cards */}
          {departments.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No departments configured</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Click "Add Department" or "Restore Defaults" to populate healthcare units.
              </p>
              <button
                type="button"
                onClick={handleRestoreDefaultDepartments}
                className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition"
              >
                Restore 6 Default Departments
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments
                .filter((d) => {
                  if (!deptSearch.trim()) return true;
                  const q = deptSearch.toLowerCase();
                  return (
                    d.name.toLowerCase().includes(q) ||
                    (d.nameDhivehi && d.nameDhivehi.toLowerCase().includes(q))
                  );
                })
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((dept, idx, filteredArr) => {
                  const assignedStaff = staffList.filter((s) => s.department === dept.name);
                  const isFirst = idx === 0;
                  const isLast = idx === filteredArr.length - 1;

                  return (
                    <div
                      key={dept.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between group"
                    >
                      <div>
                        {/* Top Meta: Order & Reorder arrows */}
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/70">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                              Order #{dept.order}
                            </span>
                            <div className="flex items-center">
                              <button
                                type="button"
                                onClick={() => handleMoveDept(dept, 'up')}
                                disabled={isFirst}
                                className="p-1 text-slate-400 hover:text-teal-700 disabled:opacity-20 disabled:hover:text-slate-400 transition cursor-pointer"
                                title="Move up in order"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveDept(dept, 'down')}
                                disabled={isLast}
                                className="p-1 text-slate-400 hover:text-teal-700 disabled:opacity-20 disabled:hover:text-slate-400 transition cursor-pointer"
                                title="Move down in order"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              assignedStaff.length > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            <Users className="w-3 h-3" />
                            <span>{assignedStaff.length} Staff</span>
                          </span>
                        </div>

                        {/* Department Names */}
                        <div className="mt-3">
                          <h3 className="font-extrabold text-slate-900 text-base leading-snug">
                            {dept.name}
                          </h3>
                          {dept.nameDhivehi ? (
                            <p className="text-sm font-medium text-teal-800 mt-1 font-thaana text-right" dir="rtl">
                              {dept.nameDhivehi}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic mt-1">No Dhivehi name set</p>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-4 pt-2.5 border-t border-slate-200/80 flex items-center justify-between">
                        <div className="text-[11px] text-slate-500">
                          {assignedStaff.length > 0 ? (
                            <span className="truncate block max-w-[140px] text-slate-500" title={assignedStaff.map((s) => s.fullName).join(', ')}>
                              {assignedStaff.map((s) => s.fullName).slice(0, 2).join(', ')}
                              {assignedStaff.length > 2 ? ` +${assignedStaff.length - 2}` : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400">Available</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditDept(dept)}
                            className="px-2.5 py-1 bg-white hover:bg-teal-50 text-teal-700 hover:text-teal-900 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRequestDeleteDept(dept)}
                            className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-800 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer flex items-center gap-1"
                            title={assignedStaff.length > 0 ? 'Reassign staff & delete department' : 'Delete department'}
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* =========================================================
              MODAL: ADD / EDIT DEPARTMENT
              ========================================================= */}
          {isDeptModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-teal-600" />
                    <span>{editingDept ? 'Edit Department' : 'Create Department'}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeptModalOpen(false);
                      setEditingDept(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {deptError && (
                  <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{deptError}</span>
                  </div>
                )}

                <form onSubmit={handleSaveDepartment} className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="dept-name-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Department Name (English) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="dept-name-input"
                      type="text"
                      required
                      value={deptName}
                      onChange={(e) => setDeptName(e.target.value)}
                      placeholder="e.g. Dental Clinic"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Used in official staff profiles, duty rosters, and reports.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="dept-name-dv-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Department Name (Dhivehi / ތާނަ)
                    </label>
                    <input
                      id="dept-name-dv-input"
                      type="text"
                      dir="rtl"
                      value={deptNameDhivehi}
                      onChange={(e) => setDeptNameDhivehi(e.target.value)}
                      placeholder="މިސާލަކަށް: ދަތުގެ ފަރުވާ"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-thaana focus:ring-2 focus:ring-teal-500 focus:outline-none text-right"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Optional Thaana translation displayed when system language is Dhivehi or Bilingual.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="dept-order-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Display Order
                    </label>
                    <input
                      id="dept-order-input"
                      type="number"
                      min={1}
                      max={999}
                      value={deptOrder}
                      onChange={(e) => setDeptOrder(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Controls sorting priority in staff dropdowns and filter bars.
                    </p>
                  </div>

                  {editingDept && (
                    <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl text-xs text-teal-800 space-y-1">
                      <p className="font-bold flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>Staff Linkage</span>
                      </p>
                      <p className="text-[11px] text-teal-700">
                        {staffList.filter((s) => s.department === editingDept.name).length} staff member(s) currently assigned. Renaming this department will update their staff profiles automatically.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeptModalOpen(false);
                        setEditingDept(null);
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-save-department"
                      type="submit"
                      disabled={savingDept}
                      className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {savingDept ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>{editingDept ? 'Update Department' : 'Save Department'}</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* =========================================================
              MODAL: REASSIGN STAFF & SAFE DELETE DEPARTMENT
              ========================================================= */}
          {isDeleteDeptModalOpen && deletingDept && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
                <div className="flex items-center gap-3 text-rose-600 mb-3">
                  <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Delete "{deletingDept.name}"?
                    </h3>
                    <p className="text-xs text-slate-500">
                      Safe Department Removal & Staff Reassignment
                    </p>
                  </div>
                </div>

                <div className="space-y-3 py-2 text-xs text-slate-600">
                  <p>
                    There are currently{' '}
                    <strong className="text-rose-700 font-black">
                      {staffList.filter((s) => s.department === deletingDept.name).length} staff member(s)
                    </strong>{' '}
                    assigned to this department:
                  </p>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 max-h-28 overflow-y-auto space-y-1">
                    {staffList
                      .filter((s) => s.department === deletingDept.name)
                      .map((s) => (
                        <div key={s.id} className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-800">{s.fullName}</span>
                          <span className="text-slate-400 font-mono">{s.staffId}</span>
                        </div>
                      ))}
                  </div>

                  <div>
                    <label htmlFor="reassign-dept-select" className="block text-xs font-bold text-slate-700 mb-1">
                      Reassign these staff to:
                    </label>
                    <select
                      id="reassign-dept-select"
                      value={reassignTargetDept}
                      onChange={(e) => setReassignTargetDept(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    >
                      {departments
                        .filter((d) => d.id !== deletingDept.id)
                        .map((d) => (
                          <option key={d.id} value={d.name}>
                            {d.name} {d.nameDhivehi ? `(${d.nameDhivehi})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeleteDeptModalOpen(false);
                      setDeletingDept(null);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deletingDeptLoading || !reassignTargetDept}
                    onClick={() => executeDeleteDept(deletingDept.id, reassignTargetDept)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {deletingDeptLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Reassigning & Deleting...</span>
                      </>
                    ) : (
                      <span>Reassign & Delete</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          TAB 2: DISPLAY RULES & ANNOUNCEMENT STRIP
          ========================================================= */}
      {activeTab === 'display' && (
        <form onSubmit={handleSaveSettings} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                TV Terminal Display Modes & Theme
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure daylight visibility, night shifts, split layouts, and automatic rotation.
              </p>
            </div>

            {/* Quick Status Pill */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Current Theme:</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 shadow-2xs border ${
                  themeMode === 'day'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-900 text-slate-100 border-slate-700'
                }`}
              >
                {themeMode === 'day' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-600" />
                    <span>Day Mode (Light)</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Night Mode (Dark)</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Dedicated Day / Night Mode Toggle Card */}
          <div className="bg-gradient-to-br from-slate-50 to-teal-50/30 p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-2xl border shadow-xs transition ${
                    themeMode === 'day'
                      ? 'bg-amber-500 text-white border-amber-400 ring-4 ring-amber-100'
                      : 'bg-slate-900 text-indigo-300 border-slate-700 ring-4 ring-slate-100'
                  }`}
                >
                  {themeMode === 'day' ? (
                    <Sun className="w-6 h-6 animate-spin-slow" />
                  ) : (
                    <Moon className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>TV Display Day / Night Mode Switch</span>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                      Live Broadcast
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Instantly toggle display theme across all connected 50" TV screens and web terminals.
                  </p>
                </div>
              </div>

              {/* Segmented Toggle Control */}
              <div className="inline-flex p-1 bg-slate-200/90 rounded-2xl border border-slate-300 shadow-inner">
                <button
                  id="theme-switch-day"
                  type="button"
                  onClick={() => handleToggleThemeMode('day')}
                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
                    themeMode === 'day'
                      ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300/50'
                      : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
                  }`}
                >
                  <Sun className="w-4 h-4 text-white" />
                  <span>Day Mode (Light)</span>
                </button>

                <button
                  id="theme-switch-night"
                  type="button"
                  onClick={() => handleToggleThemeMode('night')}
                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
                    themeMode === 'night'
                      ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-700/50'
                      : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
                  }`}
                >
                  <Moon className="w-4 h-4 text-indigo-300" />
                  <span>Night Mode (Dark)</span>
                </button>
              </div>
            </div>

            {/* Visual Description & Clickable Preset Panels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/70">
              <button
                type="button"
                onClick={() => handleToggleThemeMode('day')}
                className={`p-3.5 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                  themeMode === 'day'
                    ? 'border-amber-500 bg-white shadow-xs ring-2 ring-amber-200/50'
                    : 'border-slate-200 bg-white/70 hover:bg-white text-slate-500'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between font-black text-slate-900 mb-1">
                    <span className="flex items-center gap-1.5 text-amber-600 text-xs">
                      <Sun className="w-4 h-4" /> Day Mode (Light Theme)
                    </span>
                    {themeMode === 'day' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold">
                        Active on TV
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 font-normal leading-relaxed">
                    Designed for daytime outpatient departments (OPD), bright reception counters, and sunlit corridors. Clean white canvas with crisp dark typography.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-amber-800">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>High daytime legibility</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleToggleThemeMode('night')}
                className={`p-3.5 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                  themeMode === 'night'
                    ? 'border-indigo-600 bg-slate-900 text-slate-100 shadow-md ring-2 ring-indigo-500/30'
                    : 'border-slate-200 bg-white/70 hover:bg-white text-slate-500'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between font-black mb-1">
                    <span className={`flex items-center gap-1.5 text-xs ${themeMode === 'night' ? 'text-indigo-300' : 'text-slate-800'}`}>
                      <Moon className="w-4 h-4" /> Night Mode (Dark Theme)
                    </span>
                    {themeMode === 'night' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-extrabold border border-indigo-700">
                        Active on TV
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] font-normal leading-relaxed ${themeMode === 'night' ? 'text-slate-300' : 'text-slate-600'}`}>
                    Deep midnight slate-900 background eliminating glare in emergency wards and night stations. Vivid illuminated teal, amber, and blue duty shifts.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-teal-400">
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                  <span>Glare-free night vision & low eye fatigue</span>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label htmlFor="display-mode-select" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Display Mode
              </label>
              <select
                id="display-mode-select"
                value={displayMode}
                onChange={(e) => setDisplayMode(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none cursor-pointer"
              >
                <option value="alternating">Alternating (Leave Board + Notices)</option>
                <option value="leave_only">Leave Board Only</option>
                <option value="notices_only">Notices Only</option>
              </select>
            </div>

            <div>
              <label htmlFor="rotation-interval-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Slide Rotation Interval (Seconds)
              </label>
              <input
                id="rotation-interval-input"
                type="number"
                min={5}
                max={120}
                value={rotationInterval}
                onChange={(e) => setRotationInterval(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Recommended: 15 to 30 seconds</p>
            </div>

            <div>
              <label htmlFor="cards-per-page-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Staff Cards Per Page
              </label>
              <input
                id="cards-per-page-input"
                type="number"
                min={2}
                max={24}
                value={cardsPerPage}
                onChange={(e) => setCardsPerPage(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Prevents unreadable shrinking on TV</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showEmptyCategories}
                onChange={(e) => setShowEmptyCategories(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm font-semibold text-slate-800">
                Show Empty Categories on TV (Displays "No staff currently on leave" placeholder)
              </span>
            </label>
          </div>

          {/* Split Screen TV Layout Section */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Split className="w-4 h-4 text-teal-600" />
                  <span>Dual Split TV Screen Layout</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Splits the TV into two panels: one side for rotating posts (leaves, notices, memories) and the other side for fixed departmental duty rosters without switching.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={tvSplitEnabled}
                  onChange={(e) => setTvSplitEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {tvSplitEnabled && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="tv-split-ratio" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Screen Split Ratio
                    </label>
                    <select
                      id="tv-split-ratio"
                      value={tvSplitRatio}
                      onChange={(e) => setTvSplitRatio(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="50_50">50% Posts / 50% Duty Rosters (Balanced)</option>
                      <option value="55_45">55% Posts / 45% Duty Rosters (Wider Carousel)</option>
                      <option value="45_55">45% Posts / 55% Duty Rosters (Wider Duty Roster)</option>
                    </select>
                  </div>
                  <div className="text-xs text-slate-500 flex flex-col justify-center">
                    <p className="font-semibold text-slate-700">Display Behavior:</p>
                    <p className="text-[11px] mt-0.5">
                      Left side auto-switches between Leaves, Notices, and Memories. Right side stays static showing clinical department shifts and in-charge supervisors.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Optional Announcement Strip */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Bottom Announcement Ticker Strip
                </h3>
                <p className="text-xs text-slate-500">
                  Shows a scrolling marquee banner at the bottom of the TV screen
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={announcementStripEnabled}
                  onChange={(e) => setAnnouncementStripEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {announcementStripEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label htmlFor="announcement-text-en" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Announcement Text (English)
                  </label>
                  <input
                    id="announcement-text-en"
                    type="text"
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="e.g. OPD consultations commence at 08:00 AM daily."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="announcement-text-dv" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Announcement Text (Dhivehi)
                  </label>
                  <input
                    id="announcement-text-dv"
                    type="text"
                    dir="rtl"
                    value={announcementTextDhivehi}
                    onChange={(e) => setAnnouncementTextDhivehi(e.target.value)}
                    placeholder="ދިވެހި ބަހުން ލިޔުއްވާ..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-teal-500 rounded-xl text-sm focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex-1 w-full">
              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{saveSuccess}</span>
                </div>
              )}
              {saveError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Display Settings...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Display Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* =========================================================
          TAB 3: LEAVE CATEGORIES
          ========================================================= */}
      {activeTab === 'categories' && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Leave Categories</h2>
              <p className="text-xs text-slate-500 mt-1">
                Standard institutional defaults: Annual Leave, Sick Leave, F.R Leave, Maternity leave, Release, No pay leave, Other Leave
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestoreDefaultCategories}
                disabled={restoringCategories}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-300 cursor-pointer disabled:opacity-50"
                title="Restore the 7 institutional default categories"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${restoringCategories ? 'animate-spin' : ''}`} />
                <span>{restoringCategories ? 'Restoring...' : 'Restore Defaults'}</span>
              </button>

              <button
                onClick={() => {
                  setEditingCategory(null);
                  setCatName('');
                  setCatNameDhivehi('');
                  setCatColor('#0d9488');
                  setIsCatModalOpen(true);
                }}
                className="px-3.5 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-4 rounded-xl border bg-slate-50 flex flex-col justify-between"
                style={{ borderTopColor: cat.color, borderTopWidth: '5px' }}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className="w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingCategory(cat);
                          setCatName(cat.name);
                          setCatNameDhivehi(cat.nameDhivehi || '');
                          setCatColor(cat.color);
                          setIsCatModalOpen(true);
                        }}
                        className="text-xs font-bold text-teal-700 hover:text-teal-900 cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base mt-2">{cat.name}</h3>
                  {cat.nameDhivehi && (
                    <p className="text-xs text-slate-500 font-medium">{cat.nameDhivehi}</p>
                  )}
                </div>

                <div className="mt-4 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Color: {cat.color}</span>
                  <span className={cat.active ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                    {cat.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Category Edit Modal */}
          {isCatModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
                <h3 className="text-lg font-black text-slate-900">
                  {editingCategory ? 'Edit Leave Category' : 'Create Leave Category'}
                </h3>

                <form onSubmit={handleSaveCategory} className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="cat-name-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Category Name (English)
                    </label>
                    <input
                      id="cat-name-input"
                      type="text"
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      required
                      placeholder="e.g. Maternity leave"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="cat-name-dhivehi-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Category Name (Dhivehi - Optional)
                    </label>
                    <input
                      id="cat-name-dhivehi-input"
                      type="text"
                      dir="rtl"
                      value={catNameDhivehi}
                      onChange={(e) => setCatNameDhivehi(e.target.value)}
                      placeholder="ދިވެހި ބަހުން..."
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="cat-color-picker" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Theme Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="cat-color-picker"
                        type="color"
                        value={catColor}
                        onChange={(e) => setCatColor(e.target.value)}
                        className="h-10 w-16 rounded-xl border border-slate-300 cursor-pointer p-1"
                      />
                      <span className="font-mono text-xs font-bold text-slate-700">{catColor}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    {editingCategory ? (
                      <button
                        type="button"
                        onClick={() => {
                          handleDeleteCategory(editingCategory.id, editingCategory.name);
                          setIsCatModalOpen(false);
                        }}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    ) : <div />}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCatModalOpen(false)}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                      >
                        Save Category
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          TAB 4: TV PAIRING TERMINALS
          ========================================================= */}
      {activeTab === 'pairing' && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Tv className="w-5 h-5 text-teal-600" />
                <span>Secure TV Terminal Pairing</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Authorize public screens to stream live projections without exposing administrative privileges.
              </p>
            </div>

            <button
              onClick={handleGeneratePairingCode}
              disabled={pairingLoading}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>{pairingLoading ? 'Generating...' : 'Generate New Pairing Code'}</span>
            </button>
          </div>

          {/* Active Pairing Code Banner */}
          {activePairingCode && (
            <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-300 text-center space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Active TV Screen Pairing Code
              </p>
              <div className="text-4xl sm:text-5xl font-mono font-black text-slate-950 tracking-widest py-2">
                {activePairingCode.code}
              </div>
              <p className="text-xs text-amber-900 font-medium">
                Enter this 6-character code on the TV display screen at <span className="font-mono font-bold">/display</span>.
                Valid for 15 minutes.
              </p>
            </div>
          )}

          {/* Paired Displays Table */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">Currently Paired Display Terminals</h3>
            {pairedDisplays.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm font-semibold">No paired TV displays registered yet.</p>
                <p className="text-xs mt-1">
                  Generate a pairing code above to connect your first reception monitor.
                </p>
              </div>
            ) : (
              <div className="w-full">
                <table className="w-full text-left text-xs border-collapse table-auto sm:table-fixed">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-500 uppercase">
                      <th className="py-2.5 px-3 sm:w-[25%]">Screen Name</th>
                      <th className="py-2.5 px-2 sm:w-[15%]">Status</th>
                      <th className="py-2.5 px-2 sm:w-[25%]">Paired Time</th>
                      <th className="py-2.5 px-2 sm:w-[20%]">Device Info</th>
                      <th className="py-2.5 px-3 text-right sm:w-[15%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pairedDisplays.map((disp) => {
                      const isConnected = disp.status === 'active' || (disp as any).active === true;
                      const screenName = disp.displayName || (disp as any).name || 'Reception Display';
                      return (
                        <tr key={disp.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-900 truncate">{screenName}</td>
                          <td className="py-2.5 px-2">
                            {isConnected ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Connected
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                Revoked
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-slate-500 text-[11px]">{formatPairedDate(disp.pairedAt)}</td>
                          <td className="py-2.5 px-2 text-slate-500 truncate">{disp.deviceInfo || 'Web Display'}</td>
                          <td className="py-2.5 px-3 text-right">
                            {isConnected && (
                              <button
                                onClick={() => handleRevokeDisplay(disp.id)}
                                className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg font-bold text-[11px] transition cursor-pointer"
                              >
                                Revoke
                              </button>
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
      )}

      {/* =========================================================
          TAB 5: AUDIT LOGS (RELOCATED TO SUPER ADMIN)
          ========================================================= */}
      {activeTab === ('audit' as any) && (
        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-inner">
            <History className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Audit Logs Relocated</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            The full administrative audit trail, tracking operator logins, shift modifications, and data changes, is now securely located in the Super Admin Panel.
          </p>
          <Link
            to="/admin/super-admin?tab=audit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400 shadow-md transition"
          >
            <span>Open Audit Logs in Super Admin</span>
            <ChevronRight className="w-4 h-4 stroke-[3]" />
          </Link>
        </div>
      )}
      {false && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-teal-600" />
              <span>Administrative Audit Trail</span>
            </h2>
            <span className="text-xs font-bold text-slate-400">
              {auditLogs.length} total events logged
            </span>
          </div>

          <div className="w-full">
            <table className="w-full text-left text-xs border-collapse table-auto sm:table-fixed">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-500 uppercase">
                  <th className="py-2.5 px-3 sm:w-[22%]">Timestamp</th>
                  <th className="py-2.5 px-2 sm:w-[18%]">Administrator</th>
                  <th className="py-2.5 px-2 sm:w-[15%]">Action</th>
                  <th className="py-2.5 px-2 sm:w-[15%]">Entity</th>
                  <th className="py-2.5 px-3 sm:w-[30%]">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {formatAuditDate(log.timestamp)}
                    </td>
                    <td className="py-2.5 px-2 font-bold text-slate-800 truncate">{log.performedBy}</td>
                    <td className="py-2.5 px-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-semibold text-slate-600 truncate">{log.targetType || (log as any).entityType}</td>
                    <td className="py-2.5 px-3 text-slate-500 truncate" title={log.details}>{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 6: DEMO DATA & BACKUP (RELOCATED TO SUPER ADMIN)
          ========================================================= */}
      {activeTab === ('data' as any) && (
        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-inner">
            <Database className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Database &amp; Backup Relocated</h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Full system database snapshots, JSON export/restore operations, and factory baseline wipe tools have been relocated to the Super Admin Panel.
          </p>
          <Link
            to="/admin/super-admin?tab=database"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400 shadow-md transition"
          >
            <span>Open Database &amp; Backup in Super Admin</span>
            <ChevronRight className="w-4 h-4 stroke-[3]" />
          </Link>
        </div>
      )}
      {false && (
        <div className="space-y-6">
          {/* Feedback messages */}
          {seedDemoSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-medium">{seedDemoSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setSeedDemoSuccess(null)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {seedDemoError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span className="font-medium">{seedDemoError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSeedDemoError(null)}
                className="text-xs font-bold text-rose-700 hover:text-rose-900 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Database Reset & Synchronization Card */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px] uppercase tracking-wider mb-1.5 border border-rose-200">
                  <Database className="w-3.5 h-3.5 text-rose-600" />
                  <span>Production Synchronization &amp; Cleanup</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-rose-600" />
                  <span>Reset Database &amp; Remove Fake Data</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Purge all mock and fake data from Firestore (staff profiles, leave records, notices, duty rosters, shift handovers, and daily media). Restores clean institutional configuration and syncs with the app.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetDatabase}
                disabled={seedingDemo}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer shrink-0"
              >
                {seedingDemo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resetting Database...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 text-white" />
                    <span>Reset Database &amp; Sync</span>
                  </>
                )}
              </button>
            </div>

            {/* Current System Status & Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Registered Staff</span>
                <p className="text-2xl font-black text-slate-800 mt-0.5">{staffList.length}</p>
                <span className="text-[11px] text-slate-500">Personnel profiles</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Departments</span>
                <p className="text-2xl font-black text-slate-800 mt-0.5">{departments.length}</p>
                <span className="text-[11px] text-slate-500">Official units</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Leave Categories</span>
                <p className="text-2xl font-black text-slate-800 mt-0.5">{categories.length}</p>
                <span className="text-[11px] text-slate-500">Official types</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Paired Displays</span>
                <p className="text-2xl font-black text-slate-800 mt-0.5">{pairedDisplays.length}</p>
                <span className="text-[11px] text-slate-500">TV screen devices</span>
              </div>
            </div>

            {/* Clean State Overview Details */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>What happens during database reset &amp; sync?</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="flex items-start gap-2 bg-white p-3 rounded-lg border border-slate-200/60 shadow-2xs">
                  <div className="w-5 h-5 rounded-md bg-rose-100 text-rose-800 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    0
                  </div>
                  <div>
                    <strong className="text-slate-800 block">Fake Records Completely Purged</strong>
                    All mock staff, leaves, notices, memories, duty rosters, weekly rosters, and temporary media are wiped from Firestore and offline caches.
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-white p-3 rounded-lg border border-slate-200/60 shadow-2xs">
                  <div className="w-5 h-5 rounded-md bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    6
                  </div>
                  <div>
                    <strong className="text-slate-800 block">Official Health Centre Departments Preserved</strong>
                    Medical &amp; Clinical, Nursing Services, Diagnostic &amp; Lab, Pharmacy, Public Health, and Administration are kept ready.
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-white p-3 rounded-lg border border-slate-200/60 shadow-2xs">
                  <div className="w-5 h-5 rounded-md bg-sky-100 text-sky-800 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    7
                  </div>
                  <div>
                    <strong className="text-slate-800 block">Civil Service Leave Categories Preserved</strong>
                    Annual, Sick, F.R, Maternity, Release, No pay, and Other leave categories remain fully configured with color-coding.
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-white p-3 rounded-lg border border-slate-200/60 shadow-2xs">
                  <div className="w-5 h-5 rounded-md bg-purple-100 text-purple-800 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    1
                  </div>
                  <div>
                    <strong className="text-slate-800 block">Administrator Login Preserved</strong>
                    Your Master Administrator credentials (@admin / PIN 2026) are preserved for seamless management.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Backup & Data Export Card */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <FileDown className="w-5 h-5 text-teal-600" />
                  <span>Database Export & Backup</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Download an offline JSON snapshot of the Maduvvari Health Centre database.
                </p>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    const [allStaff, allLeaves, allNotices, allCats, allDepts] = await Promise.all([
                      getStaffList(isDemoMode),
                      getLeaveRecordsList(isDemoMode),
                      getNoticesList(isDemoMode),
                      getCategoriesList(isDemoMode),
                      getDepartmentsList(isDemoMode),
                    ]);
                    const backupData = {
                      facility: 'Maduvvari Health Centre',
                      exportedAt: new Date().toISOString(),
                      settings,
                      departments: allDepts,
                      categories: allCats,
                      staff: allStaff,
                      leaveRecords: allLeaves,
                      notices: allNotices,
                    };
                    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `MHC_Backup_${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (err: any) {
                    alert('Export failed: ' + (err.message || 'Unknown error'));
                  }
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>Export JSON Backup</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
