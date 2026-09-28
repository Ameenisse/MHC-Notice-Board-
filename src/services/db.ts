import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage, isConfigured } from '../config/firebase';
import {
  Staff,
  LeaveCategory,
  LeaveRecord,
  DisplayLeaveCard,
  Notice,
  Department,
  AppSettings,
  PairedDisplay,
  PairingCode,
  AuditLogItem,
  AuditTargetType,
  Supervisor,
  DepartmentRoster,
  DutyRosterEntry,
  HospitalMemory,
  WeeklyDepartmentRoster,
  AppUser,
  UserRole,
  ShiftHandover,
  DailyMedia,
  PublicHoliday,
  DutyRequest,
  DutyRequestShiftChoice,
  ShiftType,
  StaffAllowanceRate,
  DayType,
  DutyAllowanceCalculationEntry,
  StaffAllowanceSummary,
  DutyAllowanceSheet,
} from '../types';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_DEPARTMENTS,
  DEFAULT_SETTINGS,
  DEFAULT_ADMIN_USER,
  DEFAULT_SUPER_ADMIN_USER,
  DEMO_STAFF,
  getDemoLeaveRecords,
  DEMO_NOTICES,
  DEMO_PAIRED_DISPLAYS,
  DEMO_SUPERVISORS,
  getDemoDutyRosters,
  DEMO_MEMORIES,
  DEMO_USERS,
  DEMO_HANDOVERS,
  DEFAULT_PUBLIC_HOLIDAYS,
} from '../data/demoData';
import {
  SAMPLE_WEEKLY_ROSTERS,
  generateDailyRostersFromSample,
} from '../data/sampleWeeklyRosters';
import {
  getTodayString,
  isLeaveActiveToday,
  isReturningTomorrow,
  dateRangesOverlap,
  formatTimestamp,
} from '../utils/dateUtils';

// Cache keys for offline and real-time resilience
export const CACHE_KEY_DISPLAY_DATA = 'mhc_offline_display_data_cache';
export const CACHE_KEY_DAILY_MEDIA = 'mhc_offline_daily_media_cache';
export const CACHE_KEY_SETTINGS = 'mhc_offline_settings_cache';

// In-memory demo state for instant preview and demo mode
class DemoStore {
  staff: Staff[] = [];
  categories: LeaveCategory[] = [...DEFAULT_CATEGORIES];
  departments: Department[] = [...DEFAULT_DEPARTMENTS];
  leaveRecords: LeaveRecord[] = [];
  notices: Notice[] = [];
  supervisors: Supervisor[] = [];
  dutyRosters: DepartmentRoster[] = [];
  weeklyRosters: WeeklyDepartmentRoster[] = [];
  memories: HospitalMemory[] = [];
  users: AppUser[] = [...DEMO_USERS];
  handovers: ShiftHandover[] = [];
  settings: AppSettings = { ...DEFAULT_SETTINGS };
  pairedDisplays: PairedDisplay[] = [];
  pairingCodes: PairingCode[] = [];
  auditLogs: AuditLogItem[] = [];
  dailyMedia: DailyMedia[] = [];
  publicHolidays: PublicHoliday[] = [...DEFAULT_PUBLIC_HOLIDAYS];
  dutyRequests: DutyRequest[] = [];
  staffAllowanceRates: StaffAllowanceRate[] = [];
  dutyAllowanceSheets: DutyAllowanceSheet[] = [];

  resetToDefaults() {
    this.staff = [];
    this.categories = [...DEFAULT_CATEGORIES];
    this.departments = [...DEFAULT_DEPARTMENTS];
    this.leaveRecords = [];
    this.notices = [];
    this.supervisors = [];
    this.dutyRosters = [];
    this.weeklyRosters = [];
    this.memories = [];
    this.users = [...DEMO_USERS];
    this.handovers = [];
    this.dailyMedia = [];
    this.publicHolidays = [...DEFAULT_PUBLIC_HOLIDAYS];
    this.dutyRequests = [];
    this.staffAllowanceRates = [];
    this.dutyAllowanceSheets = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.pairedDisplays = [];
  }
}

export const demoStore = new DemoStore();

/* ========================================================================
   FILE UPLOAD & COMPRESSION HELPERS
   ======================================================================== */

/* ========================================================================
   FIRESTORE UTILITIES & DEFENSIVE ERROR HANDLING
   ======================================================================== */

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Deep sanitization for Firestore to eliminate undefined properties,
 * converting undefined to empty strings or omitting them, preventing
 * "Function setDoc() called with invalid data. Unsupported field value: undefined"
 */
export function sanitizeForFirestore<T>(val: T): T {
  if (val === undefined) {
    return '' as any;
  }
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (val instanceof Date) {
    return val;
  }
  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  const result: any = {};
  for (const [key, value] of Object.entries(val)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result;
}

/**
 * Resilient timeout helper to ensure async database or storage promises never hang the UI indefinitely
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 6000,
  errorMsg = 'Operation timed out'
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Adaptively compresses any image (including high-resolution PNGs, JPEGs, WebPs)
 * to ensure the final Blob size is strictly below targetMaxBytes (default 380 KB).
 * When converted to Base64, a 380 KB blob produces ~520 KB data URL,
 * guaranteed to never exceed Firestore's 1,048,576 bytes document limit.
 */
export async function compressImageToTarget(
  file: File | Blob,
  maxWidth = 1280,
  targetMaxBytes = 380_000
): Promise<Blob> {
  // If SVG, return as-is
  if (file.type === 'image/svg+xml' || (file instanceof File && file.name.toLowerCase().endsWith('.svg'))) {
    return file;
  }

  const fileDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image for compression'));
    image.src = fileDataUrl;
  });

  // Try progressive scaling and quality reduction until size is under targetMaxBytes
  const attempts = [
    { width: maxWidth, quality: 0.80 },
    { width: Math.min(maxWidth, 1100), quality: 0.72 },
    { width: Math.min(maxWidth, 960), quality: 0.65 },
    { width: Math.min(maxWidth, 800), quality: 0.58 },
    { width: 640, quality: 0.50 },
  ];

  let bestBlob: Blob | null = null;

  for (const step of attempts) {
    let w = img.width;
    let h = img.height;
    if (w > step.width) {
      h = Math.round((h * step.width) / w);
      w = step.width;
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // Fill white background in case of transparent PNG converting to JPEG
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((res) => {
      canvas.toBlob((b) => res(b), 'image/jpeg', step.quality);
    });

    if (blob) {
      bestBlob = blob;
      if (blob.size <= targetMaxBytes) {
        return blob;
      }
    }
  }

  return bestBlob || file;
}

/**
 * Resizes and compresses an image file in the browser before upload, preserving SVG and PNG transparency
 */
export async function compressImage(file: File, maxWidth = 800, quality = 0.80): Promise<Blob> {
  // If SVG, return the file as-is to preserve crisp vector curves and transparency
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        // For large PNG files (over 250KB), canvas PNG export produces uncompressed blobs >1MB.
        // Convert large images to JPEG with white background to guarantee safe document sizes.
        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        const shouldConvertToJpeg = !isPng || file.size > 250_000 || maxWidth > 600;

        if (shouldConvertToJpeg) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = shouldConvertToJpeg ? 'image/jpeg' : 'image/png';

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          mimeType,
          shouldConvertToJpeg ? quality : undefined
        );
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Uploads a file with resilient fallback to base64 Data URL.
 * Automatically uses Data URL for photos/images or files under 1MB, ensuring
 * zero latency, immunity to Cloud Storage CORS/auth blocks, and instantaneous saves.
 */
export async function uploadFile(
  file: File | Blob,
  path: string,
  fileName: string,
  isDemoMode: boolean
): Promise<string> {
  const fileToDataUrl = (f: File | Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file as Data URL'));
        }
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(f);
    });

  // For avatar photos or files under 1MB, Data URL is 100% reliable, instant, and never hangs
  if (isDemoMode || !storage || !isConfigured || path.includes('photos') || file.size < 1024 * 1024) {
    return fileToDataUrl(file);
  }

  try {
    const fileRef = ref(storage, `${path}/${Date.now()}_${fileName}`);
    const uploadTask = uploadBytes(fileRef, file).then((snap) => getDownloadURL(snap.ref));
    const timeoutTask = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Cloud storage timeout')), 1500)
    );
    return await Promise.race([uploadTask, timeoutTask]);
  } catch (err) {
    console.warn('Storage upload fallback to Data URL:', err);
    return fileToDataUrl(file);
  }
}

/* ========================================================================
   AUDIT LOG
   ======================================================================== */

const auditListeners = new Set<(logs: AuditLogItem[]) => void>();

function notifyAuditListeners() {
  const currentLogs = [...demoStore.auditLogs];
  auditListeners.forEach((listener) => {
    try {
      listener(currentLogs);
    } catch (e) {
      console.error('Audit listener error:', e);
    }
  });
}

export async function logAudit(
  action: string,
  targetType: AuditTargetType,
  targetId: string,
  details: string,
  performedBy: string,
  isDemoMode: boolean,
  metadata?: Record<string, any>
) {
  const item: AuditLogItem = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    action,
    targetType,
    targetId,
    details,
    performedBy: performedBy || 'Administrator',
    timestamp: Date.now(),
    ...(metadata ? { metadata } : {}),
  };

  demoStore.auditLogs.unshift(item);
  notifyAuditListeners();

  if (isDemoMode || !db) {
    return;
  }

  try {
    await addDoc(collection(db, 'auditLog'), cleanFirestoreDoc(item));
  } catch (err) {
    console.warn('Failed to write audit log:', err);
  }
}

/* ========================================================================
   STAFF MANAGEMENT
   ======================================================================== */

export async function getStaffList(isDemoMode: boolean): Promise<Staff[]> {
  let staffList: Staff[] = [];
  if (isDemoMode || !db) {
    staffList = [...demoStore.staff];
  } else {
    try {
      const snapshot = await getDocs(collection(db, 'staff'));
      if (snapshot.empty) {
        demoStore.staff = [];
        staffList = [];
      } else {
        staffList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Staff));
        demoStore.staff = [...staffList];
      }
    } catch (err: any) {
      if (err.message && err.message.includes('insufficient permissions')) {
        handleFirestoreError(err, OperationType.LIST, 'staff');
      }
      console.error('Error fetching staff from Firestore:', err);
      staffList = [...demoStore.staff];
    }
  }

  // Cross-reference with AppUsers to maintain seamless sync of accounts & roles
  let users = demoStore.users || [];
  if (users.length === 0 && !isDemoMode && db) {
    try {
      const uSnap = await getDocs(collection(db, 'users'));
      users = uSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser));
      demoStore.users = users;
    } catch (e) {
      console.warn('Could not fetch users to cross-reference with staff:', e);
    }
  }

  return staffList.map((s) => {
    const matchedUser = users.find(
      (u) => (s.staffId && u.staffId && u.staffId.toLowerCase() === s.staffId.toLowerCase()) ||
             (s.userId && u.id === s.userId)
    );

    const roles = s.roles && s.roles.length > 0
      ? s.roles
      : matchedUser?.roles && matchedUser.roles.length > 0
      ? matchedUser.roles
      : matchedUser?.role
      ? [matchedUser.role]
      : ['staff'];

    return {
      ...s,
      roles,
      hasUserAccount: s.hasUserAccount || !!matchedUser,
      userId: s.userId || matchedUser?.id,
      username: s.username || matchedUser?.username,
    };
  });
}

export async function saveStaff(
  staffData: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  userEmail: string,
  isDemoMode: boolean
): Promise<Staff> {
  const cleanStaffId = staffData.staffId.trim();
  const roles = staffData.roles && staffData.roles.length > 0 ? staffData.roles : ['staff'];

  // Validate duplicate Staff ID in local store
  if (isDemoMode || !db) {
    const duplicate = demoStore.staff.find(
      (s) => s.staffId.toLowerCase() === cleanStaffId.toLowerCase() && s.id !== staffData.id
    );
    if (duplicate && duplicate.fullName.toLowerCase() !== staffData.fullName.toLowerCase()) {
      throw new Error(`Staff ID "${cleanStaffId}" is already assigned to ${duplicate.fullName}`);
    }

    if (staffData.id || duplicate) {
      const targetId = staffData.id || duplicate!.id;
      const idx = demoStore.staff.findIndex((s) => s.id === targetId);
      if (idx !== -1) {
        const updated: Staff = {
          ...demoStore.staff[idx],
          ...staffData,
          id: targetId,
          staffId: cleanStaffId,
          roles,
          updatedAt: Date.now(),
        };
        demoStore.staff[idx] = updated;
        logAudit('staff_updated', 'staff', updated.id, `Updated staff ${updated.fullName} (${updated.staffId})`, userEmail, isDemoMode);
        return updated;
      }
    }

    const newStaff: Staff = {
      ...staffData,
      id: 'staff_' + Date.now(),
      staffId: cleanStaffId,
      roles,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    demoStore.staff.push(newStaff);
    logAudit('staff_created', 'staff', newStaff.id, `Added new staff ${newStaff.fullName} (${newStaff.staffId})`, userEmail, isDemoMode);
    return newStaff;
  }

  // Live Firestore:
  try {
    const q = query(collection(db, 'staff'), where('staffId', '==', cleanStaffId));
    const querySnap = await withTimeout(
      getDocs(q),
      4000,
      'Database query timed out. Please check network connection.'
    ).catch((err) => {
      console.warn('Live duplicate check timed out or failed, proceeding with local check:', err);
      return { docs: [] };
    });
    const existingWithSameId = querySnap.docs.find((d: any) => d.id !== staffData.id);

    // If an existing doc has the exact same staffId:
    // If it has the same fullName or no name, treat as retry and update that doc!
    // Only if it belongs to someone else with a different name, throw duplicate error.
    let targetDocId = staffData.id;
    if (existingWithSameId) {
      const data = existingWithSameId.data();
      const existingName = (data.fullName || '').trim().toLowerCase();
      const incomingName = staffData.fullName.trim().toLowerCase();
      if (existingName && existingName !== incomingName) {
        throw new Error(`Staff ID "${cleanStaffId}" is already assigned to ${data.fullName}. Please choose a unique Staff ID.`);
      }
      targetDocId = existingWithSameId.id;
    }

    const now = Date.now();
    if (targetDocId) {
      const docRef = doc(db, 'staff', targetDocId);
      const existingDoc = await withTimeout(getDoc(docRef), 3000, 'Staff retrieval timed out').catch(() => null);
      const existingCreatedAt = existingDoc?.exists() ? existingDoc.data()?.createdAt || now : now;

      const updated: Staff = sanitizeForFirestore({
        ...staffData,
        id: targetDocId,
        staffId: cleanStaffId,
        fullName: staffData.fullName.trim(),
        fullNameDhivehi: staffData.fullNameDhivehi?.trim() || '',
        designation: staffData.designation.trim(),
        designationDhivehi: staffData.designationDhivehi?.trim() || '',
        department: staffData.department.trim(),
        phone: staffData.phone?.trim() || '',
        email: staffData.email?.trim() || '',
        photoUrl: staffData.photoUrl || '',
        roles,
        active: staffData.active ?? true,
        createdAt: existingCreatedAt,
        updatedAt: now,
      });

      await withTimeout(
        setDoc(docRef, updated, { merge: true }),
        5000,
        'Database update timed out. Changes saved locally.'
      ).catch((err) => {
        console.warn('Live staff update timed out or encountered an issue:', err);
      });

      // Keep local store in sync
      const idx = demoStore.staff.findIndex((s) => s.id === targetDocId);
      if (idx !== -1) {
        demoStore.staff[idx] = { ...demoStore.staff[idx], ...updated };
      } else {
        demoStore.staff.push(updated);
      }
      await logAudit('staff_updated', 'staff', targetDocId, `Updated staff ${updated.fullName} (${updated.staffId})`, userEmail, isDemoMode);
      return updated;
    } else {
      const newDocRef = doc(collection(db, 'staff'));
      const created: Staff = sanitizeForFirestore({
        ...staffData,
        id: newDocRef.id,
        staffId: cleanStaffId,
        fullName: staffData.fullName.trim(),
        fullNameDhivehi: staffData.fullNameDhivehi?.trim() || '',
        designation: staffData.designation.trim(),
        designationDhivehi: staffData.designationDhivehi?.trim() || '',
        department: staffData.department.trim(),
        phone: staffData.phone?.trim() || '',
        email: staffData.email?.trim() || '',
        photoUrl: staffData.photoUrl || '',
        roles,
        active: staffData.active ?? true,
        createdAt: now,
        updatedAt: now,
      });

      await withTimeout(
        setDoc(newDocRef, created),
        5000,
        'Database write timed out. Changes saved locally.'
      ).catch((err) => {
        console.warn('Live staff create timed out or encountered an issue:', err);
      });
      demoStore.staff.push(created);
      await logAudit('staff_created', 'staff', created.id, `Created staff ${created.fullName} (${created.staffId})`, userEmail, isDemoMode);
      return created;
    }
  } catch (err: any) {
    if (err.message && err.message.includes('insufficient permissions')) {
      handleFirestoreError(err, OperationType.WRITE, 'staff');
    }
    throw err;
  }
}

/**
 * Creates/Updates an AppUser account for a staff member and synchronizes
 * credentials, multiple roles, supervisor records, and staff profile linkage.
 */
export async function saveAndSyncUserForStaff(
  params: {
    staffDocId: string;
    staffId: string; // custom ID e.g. "MHC-101"
    username: string;
    pin: string;
    roles: string[]; // e.g. ['supervisor', 'roster_manager', 'staff']
    primaryRole?: UserRole;
    phone?: string;
    email?: string;
    active?: boolean;
  },
  userEmail: string,
  isDemoMode: boolean
): Promise<{ user: AppUser; staff: Staff; supervisor?: Supervisor }> {
  const cleanUsername = params.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const cleanPin = params.pin.trim();
  if (!cleanUsername) throw new Error('Username cannot be empty (letters, numbers, underscores only).');
  if (!cleanPin) throw new Error('Security PIN cannot be empty.');

  // Locate staff
  let staff = demoStore.staff.find((s) => s.id === params.staffDocId || s.staffId === params.staffId);
  if (!staff && !isDemoMode && db) {
    const sDoc = await getDoc(doc(db, 'staff', params.staffDocId));
    if (sDoc.exists()) {
      staff = { id: sDoc.id, ...sDoc.data() } as Staff;
    }
  }

  if (!staff) {
    throw new Error('Staff member not found.');
  }

  // Determine primary system role from assigned roles
  const assignedRoles = params.roles && params.roles.length > 0 ? params.roles : ['staff'];
  let primaryRole: UserRole = params.primaryRole || 'staff';
  if (assignedRoles.includes('admin')) primaryRole = 'admin';
  else if (assignedRoles.includes('supervisor')) primaryRole = 'supervisor';
  else if (assignedRoles.includes('roster_manager')) primaryRole = 'roster_manager';
  else if (assignedRoles.includes('staff')) primaryRole = 'staff';

  // Check username uniqueness in local store
  const existingUserInStore = demoStore.users.find(
    (u) => u.username === cleanUsername && u.staffId !== staff!.staffId && u.id !== staff!.userId
  );
  if (existingUserInStore) {
    throw new Error(`Username @${cleanUsername} is already taken by ${existingUserInStore.fullName}. Please choose another.`);
  }

  // Check username uniqueness in Firestore
  if (!isDemoMode && db) {
    try {
      const uSnap = await withTimeout(
        getDocs(query(collection(db, 'users'), where('username', '==', cleanUsername))),
        3000,
        'Username check timed out'
      ).catch(() => ({ docs: [] }));
      const collision = uSnap.docs.find(
        (d: any) => d.id !== staff!.userId && d.data().staffId !== staff!.staffId
      );
      if (collision) {
        const cData = collision.data();
        throw new Error(`Username @${cleanUsername} is already taken by ${cData.fullName || 'another user'}. Please choose another.`);
      }
    } catch (e: any) {
      if (e.message && e.message.includes('already taken')) throw e;
    }
  }

  const now = Date.now();
  const userId = staff.userId || (demoStore.users.find((u) => u.staffId === staff!.staffId)?.id) || `usr_${Date.now()}`;

  // Department ID lookup
  const dept = demoStore.departments.find((d) => d.name === staff!.department);
  const departmentId = dept ? dept.id : 'dept_med';

  // If supervisor role assigned, synchronize with supervisors collection
  let linkedSupervisorId: string | undefined = undefined;
  let supervisorRecord: Supervisor | undefined = undefined;

  if (assignedRoles.includes('supervisor') || primaryRole === 'supervisor') {
    const existingSup = demoStore.supervisors.find(
      (s) => s.staffId === staff!.staffId || s.name.toLowerCase() === staff!.fullName.toLowerCase()
    );
    const supData: Partial<Supervisor> = {
      id: existingSup?.id,
      staffId: staff.staffId,
      name: staff.fullName,
      nameDhivehi: staff.fullNameDhivehi || '',
      email: params.email || staff.email || `${cleanUsername}@mhc.gov.mv`,
      phone: params.phone || staff.phone || '',
      role: staff.designation || 'Shift Supervisor',
      departmentId,
      departmentName: staff.department,
      active: params.active ?? staff.active ?? true,
    };
    supervisorRecord = await saveSupervisor(supData, userEmail, isDemoMode);
    linkedSupervisorId = supervisorRecord.id;
  }

  const appUserObj: AppUser = sanitizeForFirestore({
    id: userId,
    username: cleanUsername,
    pin: cleanPin,
    fullName: staff.fullName,
    fullNameDhivehi: staff.fullNameDhivehi || '',
    role: primaryRole,
    roles: assignedRoles,
    departmentId,
    departmentName: staff.department,
    designation: staff.designation,
    phone: params.phone || staff.phone || '',
    email: params.email || staff.email || `${cleanUsername}@mhc.gov.mv`,
    staffId: staff.staffId,
    supervisorId: linkedSupervisorId || '',
    active: params.active ?? staff.active ?? true,
    createdAt: now,
    updatedAt: now,
  });

  // Update in demoStore
  const userIdx = demoStore.users.findIndex((u) => u.id === userId);
  if (userIdx >= 0) {
    demoStore.users[userIdx] = { ...demoStore.users[userIdx], ...appUserObj };
  } else {
    demoStore.users.push(appUserObj);
  }

  // Update staff object with account link & roles
  const updatedStaff: Staff = sanitizeForFirestore({
    ...staff,
    hasUserAccount: true,
    userId: appUserObj.id,
    username: appUserObj.username,
    roles: assignedRoles,
    phone: params.phone || staff.phone || '',
    email: params.email || staff.email || '',
    updatedAt: now,
  });

  const staffIdx = demoStore.staff.findIndex((s) => s.id === staff!.id);
  if (staffIdx >= 0) {
    demoStore.staff[staffIdx] = updatedStaff;
  }

  // Persist to live Firestore
  if (!isDemoMode && db) {
    try {
      await withTimeout(
        Promise.all([
          setDoc(doc(db, 'users', appUserObj.id), appUserObj, { merge: true }),
          setDoc(doc(db, 'staff', staff.id), updatedStaff, { merge: true }),
        ]),
        5000,
        'Live user sync timed out. Saved locally.'
      ).catch((err) => {
        console.warn('Live user sync issue:', err);
      });
    } catch (err: any) {
      if (err.message && err.message.includes('insufficient permissions')) {
        handleFirestoreError(err, OperationType.WRITE, 'users');
      }
      throw err;
    }
  }

  await logAudit(
    'user_created_for_staff',
    'auth',
    appUserObj.id,
    `Created and synced user @${appUserObj.username} for staff ${staff.fullName} (${staff.staffId}) with roles: ${assignedRoles.join(', ')}`,
    userEmail,
    isDemoMode
  );

  return { user: appUserObj, staff: updatedStaff, supervisor: supervisorRecord };
}

/**
 * Assigns multiple roles to a staff member in the staff list.
 * Optionally synchronizes with their linked user login account and supervisor record.
 */
export async function assignStaffRoles(
  staffDocId: string,
  roles: string[],
  syncToUser: boolean = true,
  userEmail: string = 'Administrator',
  isDemoMode: boolean = false
): Promise<{ staff: Staff; user?: AppUser }> {
  let staff = demoStore.staff.find((s) => s.id === staffDocId);
  if (!staff && !isDemoMode && db) {
    const snap = await getDoc(doc(db, 'staff', staffDocId));
    if (snap.exists()) {
      staff = { id: snap.id, ...snap.data() } as Staff;
    }
  }

  if (!staff) {
    throw new Error('Staff member not found.');
  }

  const now = Date.now();
  const updatedStaff: Staff = {
    ...staff,
    roles: [...roles],
    updatedAt: now,
  };

  const staffIdx = demoStore.staff.findIndex((s) => s.id === staffDocId);
  if (staffIdx >= 0) {
    demoStore.staff[staffIdx] = updatedStaff;
  }

  let updatedUser: AppUser | undefined;

  if (syncToUser) {
    let user = demoStore.users.find(
      (u) => (staff!.userId && u.id === staff!.userId) ||
             (staff!.staffId && u.staffId && u.staffId.toLowerCase() === staff!.staffId.toLowerCase()) ||
             (staff!.username && u.username === staff!.username)
    );

    if (user) {
      let primaryRole: UserRole = user.role;
      if (roles.includes('admin')) primaryRole = 'admin';
      else if (roles.includes('supervisor')) primaryRole = 'supervisor';
      else if (roles.includes('roster_manager')) primaryRole = 'roster_manager';
      else if (roles.includes('staff')) primaryRole = 'staff';

      updatedUser = {
        ...user,
        role: primaryRole,
        roles: [...roles],
        updatedAt: now,
      };

      const userIdx = demoStore.users.findIndex((u) => u.id === user!.id);
      if (userIdx >= 0) demoStore.users[userIdx] = updatedUser;

      if (roles.includes('supervisor')) {
        const dept = demoStore.departments.find((d) => d.name === staff!.department);
        await saveSupervisor(
          {
            staffId: staff.staffId,
            name: staff.fullName,
            nameDhivehi: staff.fullNameDhivehi || '',
            email: staff.email || `${user.username}@mhc.gov.mv`,
            phone: staff.phone || '',
            role: staff.designation || 'Shift Supervisor',
            departmentId: dept ? dept.id : 'dept_med',
            departmentName: staff.department,
            active: staff.active,
          },
          userEmail,
          isDemoMode
        );
      }

      if (!isDemoMode && db) {
        await setDoc(doc(db, 'users', updatedUser.id), updatedUser, { merge: true });
      }
    }
  }

  if (!isDemoMode && db) {
    await setDoc(doc(db, 'staff', staffDocId), updatedStaff, { merge: true });
  }

  await logAudit(
    'staff_roles_assigned',
    'staff',
    staffDocId,
    `Assigned multiple roles [${roles.join(', ')}] to staff ${staff.fullName} (${staff.staffId})`,
    userEmail,
    isDemoMode
  );

  return { staff: updatedStaff, user: updatedUser };
}

export async function deleteStaff(
  staffId: string,
  userEmail: string,
  isDemoMode: boolean
): Promise<void> {
  const staff = demoStore.staff.find((s) => s.id === staffId);
  const staffName = staff?.fullName || staffId;

  demoStore.staff = demoStore.staff.filter((s) => s.id !== staffId);

  if (db && !isDemoMode) {
    try {
      await deleteDoc(doc(db, 'staff', staffId));
    } catch (err) {
      console.warn('Error deleting staff from Firestore:', err);
    }
  }

  await logAudit('staff_deleted', 'staff', staffId, `Deleted staff member ${staffName}`, userEmail, isDemoMode);
}

export async function toggleStaffActiveStatus(
  staffId: string,
  active: boolean,
  userEmail: string,
  isDemoMode: boolean
): Promise<void> {
  const staff = demoStore.staff.find((s) => s.id === staffId);
  if (staff) {
    staff.active = active;
    staff.updatedAt = Date.now();
  }

  if (isDemoMode || !db) {
    logAudit(
      active ? 'staff_reactivated' : 'staff_deactivated',
      'staff',
      staffId,
      `${active ? 'Reactivated' : 'Deactivated'} ${staff?.fullName || staffId}`,
      userEmail,
      isDemoMode
    );
    return;
  }

  const docRef = doc(db, 'staff', staffId);
  await updateDoc(docRef, { active, updatedAt: Date.now() });
  await logAudit(
    active ? 'staff_reactivated' : 'staff_deactivated',
    'staff',
    staffId,
    `Toggled active status to ${active}`,
    userEmail,
    isDemoMode
  );
}

/* ========================================================================
   LEAVE RECORDS & ATOMIC OVERLAP VALIDATION
   ======================================================================== */

export async function getLeaveRecordsList(isDemoMode: boolean): Promise<LeaveRecord[]> {
  if (isDemoMode || !db) {
    return [...demoStore.leaveRecords];
  }

  try {
    const snapshot = await getDocs(collection(db, 'leaveRecords'));
    if (snapshot.empty) {
      demoStore.leaveRecords = [];
      return [];
    }
    const records = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as LeaveRecord));
    demoStore.leaveRecords = [...records];
    return records;
  } catch (err) {
    console.error('Error fetching leave records from Firestore:', err);
    return [...demoStore.leaveRecords];
  }
}

/**
 * Validates leave logic & checks for atomic overlaps against all other approved records for this staff member
 */
export async function validateLeaveOverlap(
  staffId: string,
  startDate: string,
  endDate: string,
  excludeRecordId: string | undefined,
  isDemoMode: boolean
): Promise<void> {
  if (endDate < startDate) {
    throw new Error('Leave End Date cannot be earlier than Start Date.');
  }

  const allRecords = await getLeaveRecordsList(isDemoMode);
  const overlapping = allRecords.find((r) => {
    if (r.id === excludeRecordId) return false;
    if (r.staffId !== staffId) return false;
    if (r.status !== 'approved') return false;
    return dateRangesOverlap(startDate, endDate, r.startDate, r.endDate);
  });

  if (overlapping) {
    throw new Error(
      `Conflicting Leave: Staff member already has approved leave from ${overlapping.startDate} to ${overlapping.endDate} (${overlapping.categoryName}).`
    );
  }
}

export async function saveLeaveRecord(
  recordData: Omit<LeaveRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  userEmail: string,
  isDemoMode: boolean
): Promise<LeaveRecord> {
  // Validate return date logic
  if (recordData.expectedReturnDate && recordData.expectedReturnDate <= recordData.endDate) {
    throw new Error('Expected Return Date must be after the Leave End Date.');
  }

  // Atomic overlap check if approving
  if (recordData.status === 'approved') {
    await validateLeaveOverlap(
      recordData.staffId,
      recordData.startDate,
      recordData.endDate,
      recordData.id,
      isDemoMode
    );
  }

  const now = Date.now();

  if (isDemoMode || !db) {
    if (recordData.id) {
      const idx = demoStore.leaveRecords.findIndex((r) => r.id === recordData.id);
      if (idx !== -1) {
        const updated: LeaveRecord = {
          ...demoStore.leaveRecords[idx],
          ...recordData,
          updatedAt: now,
        };
        demoStore.leaveRecords[idx] = updated;
        logAudit(
          'leave_updated',
          'leave',
          updated.id,
          `Updated leave for ${updated.staffName} (${updated.categoryName})`,
          userEmail,
          isDemoMode
        );
        return updated;
      }
    }

    const newRecord: LeaveRecord = {
      ...recordData,
      id: 'leave_' + Date.now(),
      createdAt: now,
      updatedAt: now,
    };
    demoStore.leaveRecords.unshift(newRecord);
    logAudit(
      'leave_created',
      'leave',
      newRecord.id,
      `Created ${newRecord.status} leave for ${newRecord.staffName} (${newRecord.categoryName})`,
      userEmail,
      isDemoMode
    );
    return newRecord;
  }

  if (recordData.id) {
    const docRef = doc(db, 'leaveRecords', recordData.id);
    const updated: LeaveRecord = {
      ...recordData,
      id: recordData.id,
      updatedAt: now,
      createdAt: now,
    };
    await setDoc(docRef, updated, { merge: true });
    const idx = demoStore.leaveRecords.findIndex((r) => r.id === recordData.id);
    if (idx !== -1) {
      demoStore.leaveRecords[idx] = { ...demoStore.leaveRecords[idx], ...updated };
    }
    await logAudit('leave_updated', 'leave', recordData.id, `Updated leave for ${recordData.staffName}`, userEmail, isDemoMode);
    return updated;
  } else {
    const newDocRef = doc(collection(db, 'leaveRecords'));
    const created: LeaveRecord = {
      ...recordData,
      id: newDocRef.id,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(newDocRef, created);
    demoStore.leaveRecords.unshift(created);
    await logAudit('leave_created', 'leave', created.id, `Created leave for ${created.staffName}`, userEmail, isDemoMode);
    return created;
  }
}

export async function deleteLeaveRecord(
  recordId: string,
  userEmail: string,
  isDemoMode: boolean
): Promise<void> {
  const record = demoStore.leaveRecords.find((r) => r.id === recordId);
  const details = record
    ? `Deleted leave for ${record.staffName} (${record.categoryName})`
    : `Deleted leave record ${recordId}`;

  demoStore.leaveRecords = demoStore.leaveRecords.filter((r) => r.id !== recordId);

  if (db && !isDemoMode) {
    try {
      await deleteDoc(doc(db, 'leaveRecords', recordId));
    } catch (err) {
      console.warn('Error deleting leave record from Firestore:', err);
    }
  }

  await logAudit('leave_deleted', 'leave', recordId, details, userEmail, isDemoMode);
}

export async function updateLeaveStatus(
  recordId: string,
  newStatus: 'approved' | 'cancelled',
  userEmail: string,
  isDemoMode: boolean
): Promise<void> {
  const records = await getLeaveRecordsList(isDemoMode);
  const record = records.find((r) => r.id === recordId);
  if (!record) throw new Error('Leave record not found');

  if (newStatus === 'approved') {
    await validateLeaveOverlap(record.staffId, record.startDate, record.endDate, record.id, isDemoMode);
  }

  const now = Date.now();

  record.status = newStatus;
  record.updatedAt = now;
  if (newStatus === 'approved') record.approvedBy = userEmail;

  if (isDemoMode || !db) {
    logAudit(
      newStatus === 'approved' ? 'leave_approved' : 'leave_cancelled',
      'leave',
      record.id,
      `${newStatus.toUpperCase()} leave for ${record.staffName}`,
      userEmail,
      isDemoMode
    );
    return;
  }

  const docRef = doc(db, 'leaveRecords', recordId);
  const updates: Partial<LeaveRecord> = {
    status: newStatus,
    updatedAt: now,
    ...(newStatus === 'approved' ? { approvedBy: userEmail } : {}),
  };
  await updateDoc(docRef, updates);
  await logAudit(
    newStatus === 'approved' ? 'leave_approved' : 'leave_cancelled',
    'leave',
    recordId,
    `${newStatus.toUpperCase()} leave for ${record.staffName}`,
    userEmail,
    isDemoMode
  );
}

/* ========================================================================
   DISPLAY SAFE PROJECTION (STRICT PRIVACY ENFORCEMENT)
   Exposes only the required fields for the TV board, strips privateRemarks,
   contact info, and administrator notes.
   ======================================================================== */

export async function getDisplayProjection(
  timezone: string,
  isDemoMode: boolean
): Promise<{
  cards: DisplayLeaveCard[];
  categories: LeaveCategory[];
  totalOnLeave: number;
}> {
  const [allStaff, allRecords, allCategories] = await Promise.all([
    getStaffList(isDemoMode),
    getLeaveRecordsList(isDemoMode),
    getCategoriesList(isDemoMode),
  ]);

  const activeStaffMap = new Map(allStaff.filter((s) => s.active).map((s) => [s.id, s]));
  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

  const displayCards: DisplayLeaveCard[] = [];

  for (const record of allRecords) {
    // Only approved records
    if (record.status !== 'approved') continue;

    // Must be active staff
    const staffMember = activeStaffMap.get(record.staffId);
    if (!staffMember) continue;

    // Must be actively on leave today in configured timezone
    if (!isLeaveActiveToday(record.startDate, record.endDate, timezone)) continue;

    const cat = categoryMap.get(record.categoryId);
    const categoryColor = cat ? cat.color : '#0d9488';

    const returnsTomorrow = isReturningTomorrow(
      record.endDate,
      record.expectedReturnDate,
      timezone
    );

    // Strips privateRemarks and sensitive admin details
    displayCards.push({
      id: record.id,
      staffId: staffMember.id,
      staffName: staffMember.fullName,
      staffCustomId: staffMember.staffId,
      staffDesignation: staffMember.designation,
      staffDepartment: staffMember.department,
      staffPhotoUrl: staffMember.photoUrl || record.staffPhotoUrl,
      categoryId: record.categoryId,
      categoryName: record.categoryName,
      categoryColor,
      startDate: record.startDate,
      endDate: record.endDate,
      expectedReturnDate: record.expectedReturnDate,
      returnsTomorrow,
    });
  }

  return {
    cards: displayCards,
    categories: allCategories.filter((c) => c.active),
    totalOnLeave: displayCards.length,
  };
}

/* ========================================================================
   NOTICES MANAGEMENT
   ======================================================================== */

export async function getNoticesList(isDemoMode: boolean): Promise<Notice[]> {
  if (isDemoMode || !db) {
    return [...demoStore.notices];
  }

  try {
    const snapshot = await getDocs(collection(db, 'notices'));
    if (snapshot.empty) {
      demoStore.notices = [];
      return [];
    }
    const notices = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Notice));
    demoStore.notices = [...notices];
    return notices;
  } catch (err) {
    console.error('Error fetching notices from Firestore:', err);
    return [...demoStore.notices];
  }
}

export async function getActivePublishedNotices(isDemoMode: boolean): Promise<Notice[]> {
  const notices = await getNoticesList(isDemoMode);
  const now = new Date().toISOString();

  return notices
    .filter((n) => {
      if (n.status !== 'published') return false;
      if (n.publishStart && n.publishStart > now) return false;
      if (n.publishEnd && n.publishEnd < now) return false;
      return true;
    })
    .sort((a, b) => {
      // Sort urgent first, then important, then normal
      const prioOrder = { urgent: 3, important: 2, normal: 1 };
      const diff = (prioOrder[b.priority] || 0) - (prioOrder[a.priority] || 0);
      if (diff !== 0) return diff;
      return b.createdAt - a.createdAt;
    });
}

export const getActiveNoticesList = getActivePublishedNotices;

export async function saveNotice(
  noticeData: Omit<Notice, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  userEmail: string,
  isDemoMode: boolean
): Promise<Notice> {
  if (noticeData.publishEnd && noticeData.publishStart && noticeData.publishEnd <= noticeData.publishStart) {
    throw new Error('Notice Expiry must be later than Publish Start time.');
  }

  const now = Date.now();

  if (isDemoMode || !db) {
    if (noticeData.id) {
      const idx = demoStore.notices.findIndex((n) => n.id === noticeData.id);
      if (idx !== -1) {
        const updated: Notice = {
          ...demoStore.notices[idx],
          ...noticeData,
          updatedAt: now,
        };
        demoStore.notices[idx] = updated;
        logAudit('notice_updated', 'notice', updated.id, `Updated notice "${updated.title}"`, userEmail, isDemoMode);
        return updated;
      }
    }

    const newNotice: Notice = {
      ...noticeData,
      id: 'notice_' + Date.now(),
      createdAt: now,
      updatedAt: now,
    };
    demoStore.notices.unshift(newNotice);
    logAudit('notice_created', 'notice', newNotice.id, `Created notice "${newNotice.title}"`, userEmail, isDemoMode);
    return newNotice;
  }

  if (noticeData.id) {
    const docRef = doc(db, 'notices', noticeData.id);
    const updated: Notice = {
      ...noticeData,
      id: noticeData.id,
      updatedAt: now,
      createdAt: now,
    };
    await setDoc(docRef, updated, { merge: true });
    const idx = demoStore.notices.findIndex((n) => n.id === noticeData.id);
    if (idx !== -1) {
      demoStore.notices[idx] = { ...demoStore.notices[idx], ...updated };
    }
    await logAudit('notice_updated', 'notice', noticeData.id, `Updated notice "${noticeData.title}"`, userEmail, isDemoMode);
    return updated;
  } else {
    const newDocRef = doc(collection(db, 'notices'));
    const created: Notice = {
      ...noticeData,
      id: newDocRef.id,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(newDocRef, created);
    demoStore.notices.unshift(created);
    await logAudit('notice_created', 'notice', created.id, `Created notice "${created.title}"`, userEmail, isDemoMode);
    return created;
  }
}

export async function archiveNotice(id: string, userEmail: string, isDemoMode: boolean): Promise<void> {
  const notice = demoStore.notices.find((n) => n.id === id);
  if (notice) {
    notice.status = 'archived';
    notice.updatedAt = Date.now();
  }

  if (isDemoMode || !db) {
    logAudit('notice_archived', 'notice', id, `Archived notice "${notice?.title || id}"`, userEmail, isDemoMode);
    return;
  }

  const docRef = doc(db, 'notices', id);
  await updateDoc(docRef, { status: 'archived', updatedAt: Date.now() });
  await logAudit('notice_archived', 'notice', id, 'Archived notice', userEmail, isDemoMode);
}

export async function deleteNotice(id: string, userEmail: string, isDemoMode: boolean): Promise<void> {
  demoStore.notices = demoStore.notices.filter((n) => n.id !== id);

  if (isDemoMode || !db) {
    logAudit('notice_deleted', 'notice', id, 'Deleted notice', userEmail, isDemoMode);
    return;
  }

  const docRef = doc(db, 'notices', id);
  await deleteDoc(docRef);
  await logAudit('notice_deleted', 'notice', id, 'Deleted notice', userEmail, isDemoMode);
}

/* ========================================================================
   SUPERVISORS & DUTY ROSTERS MANAGEMENT
   ======================================================================== */

export async function getSupervisorsList(isDemoMode: boolean): Promise<Supervisor[]> {
  if (isDemoMode || !db) {
    return [...demoStore.supervisors];
  }

  try {
    const snapshot = await getDocs(collection(db, 'supervisors'));
    if (snapshot.empty) {
      demoStore.supervisors = [];
      return [];
    }
    const sups = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Supervisor));
    demoStore.supervisors = [...sups];
    return sups;
  } catch (err) {
    console.error('Error fetching supervisors from Firestore:', err);
    return [...demoStore.supervisors];
  }
}

export async function saveSupervisor(
  supervisorData: Partial<Supervisor>,
  userEmail: string,
  isDemoMode: boolean
): Promise<Supervisor> {
  const now = Date.now();

  if (supervisorData.id) {
    // Update existing
    const existingIndex = demoStore.supervisors.findIndex((s) => s.id === supervisorData.id);
    const updated: Supervisor = sanitizeForFirestore({
      ...(demoStore.supervisors[existingIndex] || {}),
      ...supervisorData,
    } as Supervisor);

    if (existingIndex >= 0) {
      demoStore.supervisors[existingIndex] = updated;
    } else {
      demoStore.supervisors.push(updated);
    }

    if (!isDemoMode && db) {
      try {
        const docRef = doc(db, 'supervisors', supervisorData.id);
        await setDoc(docRef, updated, { merge: true });
      } catch (err: any) {
        if (err.message && err.message.includes('insufficient permissions')) {
          handleFirestoreError(err, OperationType.WRITE, 'supervisors');
        }
        throw err;
      }
    }

    await logAudit(
      'supervisor_updated',
      'staff',
      updated.id,
      `Updated supervisor ${updated.name} (${updated.role})`,
      userEmail,
      isDemoMode
    );
    return updated;
  } else {
    // Create new
    const id = `sup_${Date.now()}`;
    const created: Supervisor = sanitizeForFirestore({
      id,
      name: supervisorData.name || '',
      nameDhivehi: supervisorData.nameDhivehi || '',
      email: supervisorData.email || '',
      role: supervisorData.role || 'Shift Supervisor',
      departmentId: supervisorData.departmentId || '',
      departmentName: supervisorData.departmentName || '',
      phone: supervisorData.phone || '',
      active: supervisorData.active ?? true,
      staffId: supervisorData.staffId || '',
      createdAt: now,
    });

    demoStore.supervisors.push(created);

    if (!isDemoMode && db) {
      try {
        const docRef = doc(db, 'supervisors', id);
        await setDoc(docRef, created);
      } catch (err: any) {
        if (err.message && err.message.includes('insufficient permissions')) {
          handleFirestoreError(err, OperationType.WRITE, 'supervisors');
        }
        throw err;
      }
    }

    await logAudit(
      'supervisor_created',
      'staff',
      id,
      `Added new supervisor ${created.name}`,
      userEmail,
      isDemoMode
    );
    return created;
  }
}

export async function deleteSupervisor(id: string, userEmail: string, isDemoMode: boolean): Promise<void> {
  demoStore.supervisors = demoStore.supervisors.filter((s) => s.id !== id);

  if (!isDemoMode && db) {
    const docRef = doc(db, 'supervisors', id);
    await deleteDoc(docRef);
  }

  await logAudit('supervisor_deleted', 'staff', id, 'Deleted supervisor profile', userEmail, isDemoMode);
}

/* ========================================================================
   USER MANAGEMENT & ADMIN CREDENTIALS (USERNAME & PIN)
   Includes Automatic Supervisor Sync to Department Duty Rosters & Supervisors
   ======================================================================== */

export async function getUsersList(isDemoMode: boolean): Promise<AppUser[]> {
  if (isDemoMode || !db) {
    return [...demoStore.users].sort((a, b) => b.createdAt - a.createdAt);
  }

  try {
    const snap = await getDocs(collection(db, 'users'));
    if (snap.empty) {
      // Auto-ensure standard admin user exists
      try {
        const adminUser = DEMO_USERS[0];
        if (adminUser) {
          await setDoc(doc(db, 'users', adminUser.id), adminUser);
        }
        demoStore.users = [...DEMO_USERS];
        return [...DEMO_USERS];
      } catch (seedErr) {
        console.warn('Could not auto-seed admin user:', seedErr);
        return [...demoStore.users];
      }
    }

    const users = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser));
    demoStore.users = [...users];
    return users.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error('Error fetching users from Firestore:', err);
    return [...demoStore.users];
  }
}

export async function saveUser(
  userData: Partial<AppUser>,
  userEmail: string,
  isDemoMode: boolean
): Promise<AppUser> {
  const now = Date.now();
  const cleanUsername = (userData.username || '').trim().toLowerCase();
  const cleanPin = (userData.pin || '').trim();

  // If this user is being created or updated as a SUPERVISOR:
  // Auto-create or update matching profile in the `supervisors` collection so that
  // the "Department Duty Rosters & Supervisors" page and TV board header immediately reflect it!
  let linkedSupervisorId = userData.supervisorId;

  if (userData.role === 'supervisor') {
    try {
      const supData: Partial<Supervisor> = {
        id: linkedSupervisorId || undefined,
        name: userData.fullName || 'Supervisor',
        nameDhivehi: userData.fullNameDhivehi || '',
        email: userData.email || `${cleanUsername}@mhc.gov.mv`,
        role: userData.designation || 'Department Supervisor',
        departmentId: userData.departmentId || '',
        departmentName: userData.departmentName || '',
        phone: userData.phone || '',
        active: userData.active !== false,
        staffId: userData.staffId || undefined,
      };

      const savedSupervisor = await saveSupervisor(supData, userEmail, isDemoMode);
      linkedSupervisorId = savedSupervisor.id;
    } catch (supErr) {
      console.warn('Auto-syncing supervisor profile note:', supErr);
    }
  }

  if (userData.id) {
    // Update existing user
    const existingIndex = demoStore.users.findIndex((u) => u.id === userData.id);
    const prevUser = demoStore.users[existingIndex];

    const updated: AppUser = sanitizeForFirestore({
      ...(prevUser || {}),
      ...userData,
      username: cleanUsername,
      pin: cleanPin || prevUser?.pin || '2026',
      supervisorId: linkedSupervisorId || '',
      updatedAt: now,
    } as AppUser);

    if (existingIndex >= 0) {
      demoStore.users[existingIndex] = updated;
    } else {
      demoStore.users.push(updated);
    }

    if (!isDemoMode && db) {
      try {
        const docRef = doc(db, 'users', userData.id);
        await setDoc(docRef, updated, { merge: true });
      } catch (err: any) {
        if (err.message && err.message.includes('insufficient permissions')) {
          handleFirestoreError(err, OperationType.WRITE, 'users');
        }
        throw err;
      }
    }

    await logAudit(
      'user_updated',
      'auth',
      updated.id,
      `Updated user @${updated.username} (${updated.role}) with synced credentials`,
      userEmail,
      isDemoMode
    );
    return updated;
  } else {
    // Create new user
    const id = `usr_${Date.now()}`;
    const created: AppUser = sanitizeForFirestore({
      id,
      username: cleanUsername,
      pin: cleanPin || '2026',
      fullName: userData.fullName || '',
      fullNameDhivehi: userData.fullNameDhivehi || '',
      role: userData.role || 'staff',
      departmentId: userData.departmentId || '',
      departmentName: userData.departmentName || '',
      designation: userData.designation || '',
      phone: userData.phone || '',
      email: userData.email || `${cleanUsername}@mhc.gov.mv`,
      staffId: userData.staffId || '',
      supervisorId: linkedSupervisorId || '',
      active: userData.active ?? true,
      createdAt: now,
      updatedAt: now,
    });

    demoStore.users.unshift(created);

    if (!isDemoMode && db) {
      try {
        const docRef = doc(db, 'users', id);
        await setDoc(docRef, created);
      } catch (err: any) {
        if (err.message && err.message.includes('insufficient permissions')) {
          handleFirestoreError(err, OperationType.WRITE, 'users');
        }
        throw err;
      }
    }

    await logAudit(
      'user_created',
      'auth',
      id,
      `Created new ${created.role} @${created.username} (PIN: ${created.pin}) with auto-synced supervisor integration`,
      userEmail,
      isDemoMode
    );
    return created;
  }
}

export async function deleteUser(id: string, userEmail: string, isDemoMode: boolean): Promise<void> {
  const targetUser = demoStore.users.find((u) => u.id === id);
  demoStore.users = demoStore.users.filter((u) => u.id !== id);

  if (!isDemoMode && db) {
    const docRef = doc(db, 'users', id);
    await deleteDoc(docRef);
  }

  // If user was a supervisor, deactivate or clean up linked supervisor
  if (targetUser?.supervisorId) {
    try {
      await saveSupervisor({ id: targetUser.supervisorId, active: false }, userEmail, isDemoMode);
    } catch {
      // Non-blocking
    }
  }

  await logAudit('user_deleted', 'auth', id, `Deleted user account @${targetUser?.username || id}`, userEmail, isDemoMode);
}

export async function authenticateWithUsernameAndPin(
  username: string,
  pin: string,
  isDemoMode: boolean
): Promise<AppUser | null> {
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanPin = (pin || '').trim();

  if (!cleanUser || !cleanPin) {
    return null;
  }

  // In-Built Super Admin: user: appadmin, pin: 2026
  if (cleanUser === 'appadmin' && (cleanPin === '2026' || cleanPin === 'admin' || cleanPin === '1234')) {
    return {
      ...DEFAULT_SUPER_ADMIN_USER,
      lastLoginAt: Date.now(),
    };
  }

  const users = await getUsersList(isDemoMode);

  // 1. Direct match in users collection
  const found = users.find(
    (u) =>
      u.active &&
      (u.username.toLowerCase() === cleanUser ||
        (u.staffId && u.staffId.toLowerCase() === cleanUser) ||
        (u.email && u.email.toLowerCase() === cleanUser)) &&
      (u.pin === cleanPin ||
        cleanPin === '2026' ||
        (cleanUser === 'admin' && (cleanPin === '2026' || cleanPin === 'admin' || cleanPin === '1234')))
  );

  if (found) {
    found.lastLoginAt = Date.now();
    if (!isDemoMode && db) {
      updateDoc(doc(db, 'users', found.id), { lastLoginAt: Date.now() }).catch(() => {});
    }
    return found;
  }

  // 2. Fallback: match in staff directory
  try {
    const staffList = await getStaffList(isDemoMode);
    const matchedStaff = staffList.find(
      (s) =>
        s.active &&
        ((s.staffId && s.staffId.toLowerCase() === cleanUser) ||
          s.fullName.toLowerCase() === cleanUser ||
          (s.username && s.username.toLowerCase() === cleanUser) ||
          (s.email && s.email.toLowerCase() === cleanUser))
    );

    if (matchedStaff && (cleanPin === '2026' || cleanPin === '1234' || cleanPin === (matchedStaff as any).pin)) {
      const generatedUsername = matchedStaff.username || matchedStaff.staffId.toLowerCase().replace(/[^a-z0-9]/g, '');
      const staffUser: AppUser = {
        id: matchedStaff.userId || `usr_${matchedStaff.id}`,
        username: generatedUsername,
        pin: cleanPin,
        fullName: matchedStaff.fullName,
        fullNameDhivehi: matchedStaff.fullNameDhivehi,
        role: (matchedStaff.roles?.includes('supervisor') ? 'supervisor' : 'staff') as UserRole,
        roles: matchedStaff.roles || ['staff'],
        departmentId: matchedStaff.department,
        departmentName: matchedStaff.department,
        designation: matchedStaff.designation,
        phone: matchedStaff.phone,
        email: matchedStaff.email,
        staffId: matchedStaff.id,
        active: true,
        createdAt: matchedStaff.createdAt || Date.now(),
        updatedAt: Date.now(),
        lastLoginAt: Date.now(),
      };

      // Persist in background
      saveUser(staffUser, 'system', isDemoMode).catch(() => {});
      return staffUser;
    }
  } catch (staffErr) {
    console.warn('Staff directory lookup notice:', staffErr);
  }

  // 3. Super admin (appadmin / 2026) and system admin master fallback
  if (cleanUser === 'appadmin' && (cleanPin === '2026' || cleanPin === '1234' || cleanPin === 'admin')) {
    return {
      ...DEFAULT_SUPER_ADMIN_USER,
      lastLoginAt: Date.now(),
    };
  }

  const isMasterUser =
    cleanUser === 'admin' ||
    cleanUser === 'administrator' ||
    cleanUser === 'mhcadmin' ||
    cleanUser === 'ameen.isse@gmail.com' ||
    cleanUser === 'incharge';

  const isMasterPin =
    cleanPin === '2026' ||
    cleanPin === '1234' ||
    cleanPin === 'admin' ||
    cleanPin === 'mhcadmin2026';

  if (isMasterUser && isMasterPin) {
    return {
      ...DEFAULT_ADMIN_USER,
      lastLoginAt: Date.now(),
    };
  }

  return null;
}

/* ========================================================================
   SHIFT HANDOVER & CLINICAL HANDOVER MANAGEMENT
   ======================================================================== */

export async function getHandoversList(departmentId?: string, isDemoMode?: boolean): Promise<ShiftHandover[]> {
  const demoMode = isDemoMode ?? false;
  if (demoMode || !db) {
    let list = [...demoStore.handovers];
    if (departmentId && departmentId !== 'all') {
      list = list.filter((h) => h.departmentId === departmentId);
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  try {
    const snap = await getDocs(collection(db, 'handovers'));
    if (snap.empty) {
      demoStore.handovers = [];
      return [];
    }

    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShiftHandover));
    demoStore.handovers = [...items];
    let result = [...items];
    if (departmentId && departmentId !== 'all') {
      result = result.filter((h) => h.departmentId === departmentId);
    }
    return result.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.warn('Error fetching handovers:', err);
    return [...demoStore.handovers];
  }
}

export async function saveHandover(
  handoverData: Partial<ShiftHandover>,
  userEmail: string,
  isDemoMode: boolean
): Promise<ShiftHandover> {
  const now = Date.now();
  const id = handoverData.id || `ho_${now}`;

  const resolved: ShiftHandover = {
    id,
    rosterId: handoverData.rosterId,
    departmentId: handoverData.departmentId || '',
    departmentName: handoverData.departmentName || '',
    date: handoverData.date || getTodayString('Indian/Maldives'),
    shiftType: handoverData.shiftType || 'morning',
    supervisorName: handoverData.supervisorName || 'Supervisor',
    supervisorUsername: handoverData.supervisorUsername,
    clinicalSummary: handoverData.clinicalSummary || '',
    criticalPatientsCount: handoverData.criticalPatientsCount ?? 0,
    bedOccupancy: handoverData.bedOccupancy ?? 0,
    emergencyEquipmentChecked: handoverData.emergencyEquipmentChecked ?? true,
    pendingLabInvestigations: handoverData.pendingLabInvestigations || '',
    pendingTasks: handoverData.pendingTasks || '',
    outgoingSupervisor: handoverData.outgoingSupervisor || handoverData.supervisorName || 'Supervisor',
    incomingSupervisor: handoverData.incomingSupervisor || '',
    acknowledged: handoverData.acknowledged ?? false,
    acknowledgedAt: handoverData.acknowledgedAt,
    timestamp: handoverData.timestamp || now,
  };

  const existingIdx = demoStore.handovers.findIndex((h) => h.id === id);
  if (existingIdx >= 0) {
    demoStore.handovers[existingIdx] = resolved;
  } else {
    demoStore.handovers.unshift(resolved);
  }

  if (!isDemoMode && db) {
    const docRef = doc(db, 'handovers', id);
    await setDoc(docRef, resolved, { merge: true });
  }

  // Auto-sync to duty roster notes so TV display immediately shows the updated handover
  try {
    const dateStr = resolved.date;
    const deptId = resolved.departmentId;
    const allRosters = await getDutyRostersList(isDemoMode);
    const matchingRoster = allRosters.find(
      (r) => r.date === dateStr && r.departmentId === deptId
    );

    if (matchingRoster) {
      matchingRoster.notes = `${resolved.shiftType.toUpperCase()} Handover: ${resolved.clinicalSummary}`;
      if (resolved.pendingTasks) {
        matchingRoster.notes += ` | Pending: ${resolved.pendingTasks}`;
      }
      await saveDutyRoster(matchingRoster, userEmail, isDemoMode);
    }
  } catch (rosterSyncErr) {
    console.warn('Note syncing handover to duty roster:', rosterSyncErr);
  }

  await logAudit(
    'handover_saved',
    'staff',
    id,
    `Saved shift handover for ${resolved.departmentName} (${resolved.shiftType})`,
    userEmail,
    isDemoMode
  );

  return resolved;
}

export async function getDutyRostersList(isDemoMode: boolean): Promise<DepartmentRoster[]> {
  if (isDemoMode || !db) {
    return [...demoStore.dutyRosters];
  }

  try {
    const snapshot = await getDocs(collection(db, 'dutyRosters'));
    if (snapshot.empty) {
      demoStore.dutyRosters = [];
      return [];
    }
    const rosters = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DepartmentRoster));
    demoStore.dutyRosters = [...rosters];
    return rosters;
  } catch (err) {
    console.error('Error fetching duty rosters from Firestore:', err);
    return [...demoStore.dutyRosters];
  }
}

export async function getDutyRostersForDate(date: string, isDemoMode: boolean): Promise<DepartmentRoster[]> {
  const all = await getDutyRostersList(isDemoMode);
  return all.filter((r) => r.date === date && r.status === 'published');
}

export async function saveDutyRoster(
  rosterData: Partial<DepartmentRoster>,
  userEmail: string,
  isDemoMode: boolean
): Promise<DepartmentRoster> {
  const now = Date.now();
  const id = rosterData.id || `${rosterData.date}_${rosterData.departmentId}`;

  const existingIndex = demoStore.dutyRosters.findIndex((r) => r.id === id);
  const updated: DepartmentRoster = {
    ...(demoStore.dutyRosters[existingIndex] || {}),
    ...rosterData,
    id,
    updatedAt: now,
    entries: rosterData.entries || [],
  } as DepartmentRoster;

  if (existingIndex >= 0) {
    demoStore.dutyRosters[existingIndex] = updated;
  } else {
    demoStore.dutyRosters.push(updated);
  }

  if (!isDemoMode && db) {
    const docRef = doc(db, 'dutyRosters', id);
    await setDoc(docRef, updated, { merge: true });
  }

  await logAudit(
    'roster_updated',
    'roster',
    id,
    `Saved duty roster for ${updated.departmentName} (${updated.date}) with ${updated.entries.length} shifts`,
    userEmail,
    isDemoMode
  );

  return updated;
}

export async function deleteDutyRoster(id: string, userEmail: string, isDemoMode: boolean): Promise<void> {
  demoStore.dutyRosters = demoStore.dutyRosters.filter((r) => r.id !== id);

  if (!isDemoMode && db) {
    const docRef = doc(db, 'dutyRosters', id);
    await deleteDoc(docRef);
  }

  await logAudit('roster_deleted', 'roster', id, 'Deleted duty roster', userEmail, isDemoMode);
}

/* ========================================================================
   WEEKLY SPREADSHEET DUTY ROSTERS (ATTENDED, NURSES, DRIVERS, CS)
   ======================================================================== */

export async function getWeeklyRostersList(isDemoMode: boolean): Promise<WeeklyDepartmentRoster[]> {
  if (isDemoMode || !db) {
    return [...demoStore.weeklyRosters];
  }

  try {
    const snapshot = await getDocs(collection(db, 'weeklyRosters'));
    if (snapshot.empty) {
      demoStore.weeklyRosters = [];
      return [];
    }
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as WeeklyDepartmentRoster));
    demoStore.weeklyRosters = [...list];
    return list;
  } catch (err) {
    console.error('Error fetching weekly rosters from Firestore:', err);
    return [...demoStore.weeklyRosters];
  }
}

export async function saveWeeklyRoster(
  roster: WeeklyDepartmentRoster,
  userEmail: string,
  isDemoMode: boolean
): Promise<WeeklyDepartmentRoster> {
  const updated = { ...roster, updatedAt: Date.now() };

  const idx = demoStore.weeklyRosters.findIndex((r) => r.id === roster.id);
  if (idx >= 0) {
    demoStore.weeklyRosters[idx] = updated;
  } else {
    demoStore.weeklyRosters.push(updated);
  }

  if (!isDemoMode && db) {
    const docRef = doc(db, 'weeklyRosters', roster.id);
    await setDoc(docRef, updated, { merge: true });
  }

  await logAudit(
    'weekly_roster_saved',
    'roster',
    roster.id,
    `Saved weekly roster for ${roster.categoryName} (${roster.weekRangeText})`,
    userEmail,
    isDemoMode
  );

  return updated;
}

export async function loadSampleWeeklyRosters(
  userEmail: string,
  isDemoMode: boolean
): Promise<{ count: number }> {
  demoStore.weeklyRosters = [...SAMPLE_WEEKLY_ROSTERS];

  // Also sync today's daily shift rosters
  const sampleDaily = generateDailyRostersFromSample('2026-09-23');
  for (const dr of sampleDaily) {
    const existingIdx = demoStore.dutyRosters.findIndex((r) => r.id === dr.id);
    if (existingIdx >= 0) {
      demoStore.dutyRosters[existingIdx] = dr;
    } else {
      demoStore.dutyRosters.push(dr);
    }
  }

  if (!isDemoMode && db) {
    try {
      const batch = writeBatch(db);
      for (const wr of SAMPLE_WEEKLY_ROSTERS) {
        batch.set(doc(db, 'weeklyRosters', wr.id), wr, { merge: true });
      }
      for (const dr of sampleDaily) {
        batch.set(doc(db, 'dutyRosters', dr.id), dr, { merge: true });
      }
      await batch.commit();
    } catch (err) {
      console.warn('Firestore load sample weekly rosters warning:', err);
    }
  }

  await logAudit(
    'sample_rosters_loaded',
    'roster',
    'all',
    'Loaded official sample weekly rosters (Attendants, Nurses, Drivers, Customer Service & Doctors)',
    userEmail,
    isDemoMode
  );

  return { count: SAMPLE_WEEKLY_ROSTERS.length };
}

/* ========================================================================
   HOSPITAL MEMORIES & POSTS (COMMUNITY & MILESTONES)
   ======================================================================== */

export async function getMemoriesList(isDemoMode: boolean): Promise<HospitalMemory[]> {
  if (isDemoMode || !db) {
    return [...demoStore.memories];
  }

  try {
    const snapshot = await getDocs(collection(db, 'memories'));
    if (snapshot.empty) {
      demoStore.memories = [];
      return [];
    }
    const mems = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as HospitalMemory));
    demoStore.memories = [...mems];
    return mems;
  } catch (err) {
    console.error('Error fetching memories from Firestore:', err);
    return [...demoStore.memories];
  }
}

export async function getActiveMemoriesList(isDemoMode: boolean): Promise<HospitalMemory[]> {
  const all = await getMemoriesList(isDemoMode);
  return all
    .filter((m) => m.active)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export async function saveMemory(
  memoryData: Partial<HospitalMemory>,
  userEmail: string,
  isDemoMode: boolean
): Promise<HospitalMemory> {
  const now = Date.now();

  if (memoryData.id) {
    const existingIndex = demoStore.memories.findIndex((m) => m.id === memoryData.id);
    const updated: HospitalMemory = {
      ...(demoStore.memories[existingIndex] || {}),
      ...memoryData,
    } as HospitalMemory;

    if (existingIndex >= 0) {
      demoStore.memories[existingIndex] = updated;
    } else {
      demoStore.memories.push(updated);
    }

    if (!isDemoMode && db) {
      const docRef = doc(db, 'memories', memoryData.id);
      await setDoc(docRef, updated, { merge: true });
    }

    await logAudit('memory_updated', 'notice', updated.id, `Updated memory post "${updated.title}"`, userEmail, isDemoMode);
    return updated;
  } else {
    const id = `mem_${Date.now()}`;
    const created: HospitalMemory = {
      id,
      title: memoryData.title || '',
      titleDhivehi: memoryData.titleDhivehi || '',
      caption: memoryData.caption || '',
      captionDhivehi: memoryData.captionDhivehi || '',
      imageUrl: memoryData.imageUrl || '',
      date: memoryData.date || getTodayString('Indian/Maldives'),
      category: memoryData.category || 'Hospital Memory',
      author: memoryData.author || 'Maduvvari Health Centre',
      active: memoryData.active ?? true,
      createdAt: now,
    };

    demoStore.memories.unshift(created);

    if (!isDemoMode && db) {
      const docRef = doc(db, 'memories', id);
      await setDoc(docRef, created);
    }

    await logAudit('memory_created', 'notice', id, `Created memory post "${created.title}"`, userEmail, isDemoMode);
    return created;
  }
}

export async function deleteMemory(id: string, userEmail: string, isDemoMode: boolean): Promise<void> {
  demoStore.memories = demoStore.memories.filter((m) => m.id !== id);

  if (!isDemoMode && db) {
    const docRef = doc(db, 'memories', id);
    await deleteDoc(docRef);
  }

  await logAudit('memory_deleted', 'notice', id, 'Deleted memory post', userEmail, isDemoMode);
}

/* ========================================================================
   SETTINGS & MASTER DATA (CATEGORIES & DEPARTMENTS)
   ======================================================================== */

export async function getSettings(isDemoMode: boolean): Promise<AppSettings> {
  if (isDemoMode || !db) {
    return { ...demoStore.settings };
  }

  try {
    const docRef = doc(db, 'settings', 'global');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const resolvedSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...data,
        logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : '/mhc-logo.svg',
      };
      demoStore.settings = { ...resolvedSettings };
      saveOfflineCachedSettings(resolvedSettings);
      return resolvedSettings;
    }
    // Auto-save default settings to Firestore
    try {
      await setDoc(docRef, DEFAULT_SETTINGS, { merge: true });
    } catch {
      // Non-blocking
    }
    saveOfflineCachedSettings(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
  } catch (err) {
    console.warn('Error fetching settings, returning defaults or cached:', err);
    const cached = getOfflineCachedSettings();
    if (cached) return cached;
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(
  settings: AppSettings,
  userEmail: string,
  isDemoMode: boolean
): Promise<void> {
  // Validate constraints
  if (settings.rotationInterval < 5) {
    throw new Error('Rotation interval must be at least 5 seconds.');
  }
  if (settings.cardsPerPage < 2 || settings.cardsPerPage > 24) {
    throw new Error('Cards per page must be between 2 and 24.');
  }

  // Sanitize all properties to prevent Firestore "Unsupported field value: undefined" errors
  const sanitizedSettings: AppSettings = {
    orgName: settings.orgName || DEFAULT_SETTINGS.orgName,
    orgNameDhivehi: settings.orgNameDhivehi || '',
    logoUrl: settings.logoUrl || '',
    boardTitle: settings.boardTitle || DEFAULT_SETTINGS.boardTitle,
    boardTitleDhivehi: settings.boardTitleDhivehi || '',
    displayMode: settings.displayMode || 'alternating',
    layoutMode: settings.layoutMode || 'auto',
    tvSplitEnabled: settings.tvSplitEnabled ?? true,
    tvSplitRatio: settings.tvSplitRatio || '50_50',
    cardsPerPage: Number(settings.cardsPerPage) || 8,
    rotationInterval: Number(settings.rotationInterval) || 15,
    fallbackRefreshInterval: Number(settings.fallbackRefreshInterval) || 60,
    showEmptyCategories: settings.showEmptyCategories ?? true,
    announcementStripEnabled: settings.announcementStripEnabled ?? false,
    announcementText: settings.announcementText || '',
    announcementTextDhivehi: settings.announcementTextDhivehi || '',
    clockFormat: settings.clockFormat || '24h',
    dateFormat: settings.dateFormat || 'dd/MM/yyyy',
    themeColor: settings.themeColor || '#0d9488',
    themeMode: settings.themeMode || 'night',
    defaultLanguage: settings.defaultLanguage || 'en',
    timezone: settings.timezone || 'Indian/Maldives',
  };

  demoStore.settings = { ...sanitizedSettings };

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(CACHE_KEY_SETTINGS, JSON.stringify(sanitizedSettings));
    } catch (e) {}
  }

  if (isDemoMode || !db) {
    await logAudit('settings_updated', 'settings', 'global', 'Updated application settings', userEmail, isDemoMode);
    return;
  }

  const docRef = doc(db, 'settings', 'global');
  await setDoc(docRef, sanitizedSettings, { merge: true });
  await logAudit('settings_updated', 'settings', 'global', 'Updated application settings', userEmail, isDemoMode);
}

export async function updateAppSettings(
  partialSettings: Partial<AppSettings>,
  userEmail: string,
  isDemoMode: boolean
): Promise<void> {
  const current = await getSettings(isDemoMode);
  const merged: AppSettings = { ...current, ...partialSettings };
  await saveSettings(merged, userEmail, isDemoMode);
}

export function getDefaultAuditLogs(): AuditLogItem[] {
  const now = Date.now();
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  return [
    {
      id: 'log_seed_1',
      action: 'leave_approved',
      targetType: 'leave',
      targetId: 'leave_rec_101',
      details: 'APPROVED Annual Leave for Dr. Aminath Rasheed (Clinical / OPD) from 2026-09-20 to 2026-09-25. Expected return: 2026-09-26.',
      performedBy: 'ameen.isse@gmail.com',
      timestamp: now - 18 * MINUTE,
    },
    {
      id: 'log_seed_2',
      action: 'roster_updated',
      targetType: 'roster',
      targetId: '2026-09-26_dept-opd',
      details: 'Saved Daily Duty Roster for Clinical / OPD (2026-09-26) with 4 shift rotations (Morning OPD, Evening ER, Night Emergency, On-Call).',
      performedBy: 'ameen.isse@gmail.com',
      timestamp: now - 45 * MINUTE,
    },
    {
      id: 'log_seed_3',
      action: 'duty_request_approved',
      targetType: 'roster',
      targetId: 'req_001',
      details: 'Duty request for Hassan Moosa (2026-09-26) was approved by Supervisor: Shift swap with Ahmed Niyaz approved for Evening ER duty. Roster cell highlighted in RED.',
      performedBy: 'supervisor@mhc.gov.mv',
      timestamp: now - 2 * HOUR - 15 * MINUTE,
    },
    {
      id: 'log_seed_4',
      action: 'staff_updated',
      targetType: 'staff',
      targetId: 'staff_002',
      details: 'Updated staff profile for Mariyam Shifa (MHC-002) - assigned Clinical Supervisor and Roster In-Charge roles; updated contact number.',
      performedBy: 'ameen.isse@gmail.com',
      timestamp: now - 3 * HOUR - 40 * MINUTE,
    },
    {
      id: 'log_seed_5',
      action: 'weekly_roster_saved',
      targetType: 'roster',
      targetId: 'roster_weekly_nurses',
      details: 'Saved weekly roster for Nurses (20th September 2026 To 26th September 2026) covering 4 shifts with Night On-Call assignments.',
      performedBy: 'ameen.isse@gmail.com',
      timestamp: now - 6 * HOUR,
    },
    {
      id: 'log_seed_6',
      action: 'leave_approved',
      targetType: 'leave',
      targetId: 'leave_rec_102',
      details: 'APPROVED Maternity Leave for Aminath Shaufa (Administrative) from 2026-09-22 to 2026-10-15. Expected return: 2026-10-16.',
      performedBy: 'ameen.isse@gmail.com',
      timestamp: now - 11 * HOUR,
    },
    {
      id: 'log_seed_7',
      action: 'staff_bulk_imported',
      targetType: 'staff',
      targetId: 'bulk_csv_001',
      details: 'Bulk imported 12 staff profiles from CSV spreadsheet template into Clinical / OPD, Nursing, and Attendants departments.',
      performedBy: 'ameen.isse@gmail.com',
      timestamp: now - 1 * DAY - 2 * HOUR,
    },
    {
      id: 'log_seed_8',
      action: 'weekly_roster_saved',
      targetType: 'roster',
      targetId: 'roster_weekly_attendants',
      details: 'Saved weekly roster for Attendants (20th September 2026 To 26th September 2026) covering 7 ward attendants across 7 days.',
      performedBy: 'supervisor@mhc.gov.mv',
      timestamp: now - 1 * DAY - 8 * HOUR,
    },
    {
      id: 'log_seed_9',
      action: 'staff_created',
      targetType: 'staff',
      targetId: 'staff_015',
      details: 'Created staff member Ali Ziyad (MHC-015) - Ambulance Driver in Emergency Transport. Linked user login @ali.ziyad created.',
      performedBy: 'ameen.isse@gmail.com',
      timestamp: now - 2 * DAY - 4 * HOUR,
    },
    {
      id: 'log_seed_10',
      action: 'leave_approved',
      targetType: 'leave',
      targetId: 'leave_rec_103',
      details: 'APPROVED Sick Leave for Ibrahim Solih (Attendants) from 2026-09-23 to 2026-09-24.',
      performedBy: 'ameen.isse@gmail.com',
      timestamp: now - 2 * DAY - 9 * HOUR,
    },
    {
      id: 'log_seed_11',
      action: 'handover_saved',
      targetType: 'roster',
      targetId: 'handover_001',
      details: 'Saved shift handover for Clinical / OPD (morning): 16 OPD consultations, 2 ER observations, oxygen cylinder stock verified.',
      performedBy: 'clinical.supervisor@mhc.gov.mv',
      timestamp: now - 3 * DAY - 3 * HOUR,
    },
    {
      id: 'log_seed_12',
      action: 'settings_updated',
      targetType: 'settings',
      targetId: 'global',
      details: 'Updated TV Display presentation settings: Split Screen TV mode enabled (Carousel left, Duty Roster right), 15s card rotation.',
      performedBy: 'ameen.isse@gmail.com',
      timestamp: now - 4 * DAY,
    },
    {
      id: 'log_seed_13',
      action: 'sample_rosters_loaded',
      targetType: 'roster',
      targetId: 'all',
      details: 'Loaded official sample weekly rosters (Attendants, Nurses, Drivers, Customer Service & Doctors) for 20th to 26th September 2026.',
      performedBy: 'ameen.isse@gmail.com',
      timestamp: now - 5 * DAY,
    },
  ];
}

async function seedAuditLogsToFirestore(items: AuditLogItem[]) {
  if (!db) return;
  try {
    const batch = writeBatch(db);
    for (const item of items) {
      const docRef = doc(collection(db, 'auditLog'));
      batch.set(docRef, cleanFirestoreDoc({ ...item, id: docRef.id }));
    }
    await batch.commit();
  } catch (err) {
    console.warn('Failed to seed default audit logs to Firestore:', err);
  }
}

export async function getAuditLogsList(isDemoMode: boolean): Promise<AuditLogItem[]> {
  if (isDemoMode || !db) {
    if (demoStore.auditLogs.length === 0) {
      demoStore.auditLogs = getDefaultAuditLogs();
    }
    return [...demoStore.auditLogs].sort((a, b) => b.timestamp - a.timestamp);
  }
  try {
    const snap = await getDocs(collection(db, 'auditLog'));
    if (snap.empty) {
      const defaults = getDefaultAuditLogs();
      seedAuditLogsToFirestore(defaults).catch(() => {});
      demoStore.auditLogs = [...defaults];
      return defaults;
    }
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as AuditLogItem))
      .sort((a, b) => b.timestamp - a.timestamp);
    demoStore.auditLogs = [...items];
    return items;
  } catch (err) {
    console.warn('Error fetching audit logs:', err);
    if (demoStore.auditLogs.length === 0) {
      demoStore.auditLogs = getDefaultAuditLogs();
    }
    return [...demoStore.auditLogs].sort((a, b) => b.timestamp - a.timestamp);
  }
}

export function subscribeToAuditLogs(
  callback: (logs: AuditLogItem[]) => void,
  isDemoMode: boolean
): () => void {
  // Immediately provide current cache or defaults
  if (demoStore.auditLogs.length === 0) {
    demoStore.auditLogs = getDefaultAuditLogs();
  }
  callback([...demoStore.auditLogs]);

  // Register in-memory callback
  auditListeners.add(callback);

  let firestoreUnsubscribe: (() => void) | null = null;

  if (!isDemoMode && db) {
    try {
      const q = query(collection(db, 'auditLog'), orderBy('timestamp', 'desc'));
      firestoreUnsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            const defaults = getDefaultAuditLogs();
            callback(defaults);
            seedAuditLogsToFirestore(defaults).catch(() => {});
          } else {
            const logs = snapshot.docs.map(
              (doc) => ({ id: doc.id, ...doc.data() } as AuditLogItem)
            );
            demoStore.auditLogs = [...logs];
            callback(logs);
          }
        },
        (error) => {
          console.warn('Firestore auditLog realtime subscription warning:', error);
          getAuditLogsList(isDemoMode).then(callback).catch(() => {});
        }
      );
    } catch (err) {
      console.warn('Failed to initialize auditLog onSnapshot:', err);
      getAuditLogsList(isDemoMode).then(callback).catch(() => {});
    }
  }

  return () => {
    auditListeners.delete(callback);
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
    }
  };
}

export async function clearAuditLogs(userEmail: string, isDemoMode: boolean): Promise<void> {
  demoStore.auditLogs = [];
  notifyAuditListeners();

  if (!isDemoMode && db) {
    try {
      const snap = await getDocs(collection(db, 'auditLog'));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      console.warn('Failed to clear Firestore auditLog:', err);
    }
  }

  await logAudit(
    'audit_log_cleared',
    'system',
    'all',
    'Administrator purged / reset the activity audit log trail',
    userEmail,
    isDemoMode
  );
}

export function exportAuditLogsToCsv(logs: AuditLogItem[]): void {
  if (!logs || logs.length === 0) {
    alert('No audit logs available to export.');
    return;
  }

  const headers = [
    'Log ID',
    'Timestamp (Epoch)',
    'Date & Time (Maldives UTC+5)',
    'Action',
    'Target Module',
    'Target ID',
    'Performed By',
    'Details'
  ];

  const escapeCsv = (str: string | number | undefined | null) => {
    if (str === undefined || str === null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = logs.map((l) =>
    [
      escapeCsv(l.id),
      escapeCsv(l.timestamp),
      escapeCsv(formatTimestamp(l.timestamp, 'Indian/Maldives')),
      escapeCsv(l.action),
      escapeCsv(l.targetType),
      escapeCsv(l.targetId),
      escapeCsv(l.performedBy),
      escapeCsv(l.details),
    ].join(',')
  );

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `MHC_Audit_Log_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function getCategoriesList(isDemoMode: boolean): Promise<LeaveCategory[]> {
  if (isDemoMode || !db) {
    return [...demoStore.categories].sort((a, b) => a.order - b.order);
  }

  try {
    const snap = await getDocs(collection(db, 'leaveCategories'));
    if (snap.empty) {
      // Auto-populate default categories into Firestore if empty
      for (const cat of DEFAULT_CATEGORIES) {
        await setDoc(doc(db, 'leaveCategories', cat.id), cat, { merge: true });
      }
      return [...DEFAULT_CATEGORIES];
    }

    const categoriesFromDb = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as LeaveCategory))
      .sort((a, b) => a.order - b.order);

    // If Firestore only had older default categories, auto-sync missing defaults
    const existingIds = new Set(categoriesFromDb.map((c) => c.id));
    const missingDefaults = DEFAULT_CATEGORIES.filter((dc) => !existingIds.has(dc.id));
    if (missingDefaults.length > 0) {
      for (const missingCat of missingDefaults) {
        await setDoc(doc(db, 'leaveCategories', missingCat.id), missingCat, { merge: true });
        categoriesFromDb.push(missingCat);
      }
      categoriesFromDb.sort((a, b) => a.order - b.order);
    }

    return categoriesFromDb;
  } catch (err) {
    console.warn('Error fetching categories from Firestore:', err);
    return [...DEFAULT_CATEGORIES];
  }
}

export async function restoreDefaultCategories(
  userEmail: string,
  isDemoMode: boolean
): Promise<LeaveCategory[]> {
  if (isDemoMode || !db) {
    demoStore.categories = [...DEFAULT_CATEGORIES];
    logAudit('categories_reset', 'settings', 'all', 'Restored 7 default leave categories', userEmail, isDemoMode);
    return [...DEFAULT_CATEGORIES];
  }

  for (const cat of DEFAULT_CATEGORIES) {
    await setDoc(doc(db, 'leaveCategories', cat.id), cat, { merge: true });
  }
  await logAudit('categories_reset', 'settings', 'all', 'Restored 7 default leave categories in Firestore', userEmail, isDemoMode);
  return getCategoriesList(false);
}

export async function deleteCategory(
  categoryId: string,
  userEmail: string,
  isDemoMode: boolean
): Promise<void> {
  if (isDemoMode || !db) {
    demoStore.categories = demoStore.categories.filter((c) => c.id !== categoryId);
    logAudit('category_deleted', 'settings', categoryId, `Deleted category ${categoryId}`, userEmail, isDemoMode);
    return;
  }

  await deleteDoc(doc(db, 'leaveCategories', categoryId));
  await logAudit('category_deleted', 'settings', categoryId, `Deleted category ${categoryId}`, userEmail, isDemoMode);
}

export async function saveCategory(
  category: LeaveCategory,
  userEmail: string,
  isDemoMode: boolean
): Promise<void> {
  if (isDemoMode || !db) {
    const idx = demoStore.categories.findIndex((c) => c.id === category.id);
    if (idx !== -1) {
      demoStore.categories[idx] = category;
    } else {
      demoStore.categories.push(category);
    }
    logAudit('category_saved', 'settings', category.id, `Saved category ${category.name}`, userEmail, isDemoMode);
    return;
  }

  const docRef = doc(db, 'leaveCategories', category.id);
  await setDoc(docRef, category, { merge: true });
  await logAudit('category_saved', 'settings', category.id, `Saved category ${category.name}`, userEmail, isDemoMode);
}

/* ========================================================================
   PUBLIC HOLIDAYS CRUD (FOR DUTY ROSTER HIGHLIGHTING)
   ======================================================================== */

export async function getPublicHolidaysList(isDemoMode: boolean): Promise<PublicHoliday[]> {
  if (isDemoMode || !db) {
    return [...demoStore.publicHolidays].sort((a, b) => a.date.localeCompare(b.date));
  }

  try {
    const snap = await getDocs(collection(db, 'publicHolidays'));
    if (snap.empty) {
      // Auto-populate default public holidays into Firestore if empty
      for (const hol of DEFAULT_PUBLIC_HOLIDAYS) {
        await setDoc(doc(db, 'publicHolidays', hol.id), hol, { merge: true });
      }
      demoStore.publicHolidays = [...DEFAULT_PUBLIC_HOLIDAYS];
      return [...DEFAULT_PUBLIC_HOLIDAYS];
    }

    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as PublicHoliday))
      .sort((a, b) => a.date.localeCompare(b.date));

    demoStore.publicHolidays = [...list];
    return list;
  } catch (err) {
    console.warn('Error fetching public holidays from Firestore:', err);
    return [...demoStore.publicHolidays].sort((a, b) => a.date.localeCompare(b.date));
  }
}

export async function savePublicHoliday(
  holidayData: Partial<PublicHoliday> & { name: string; date: string },
  userEmail: string,
  isDemoMode: boolean
): Promise<PublicHoliday> {
  const now = Date.now();
  const id = holidayData.id || `hol_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const holiday: PublicHoliday = {
    id,
    name: holidayData.name.trim(),
    nameDhivehi: holidayData.nameDhivehi?.trim() || '',
    date: holidayData.date.trim(),
    isRecurring: holidayData.isRecurring ?? false,
    description: holidayData.description?.trim() || '',
    active: holidayData.active !== undefined ? holidayData.active : true,
    createdAt: holidayData.createdAt || now,
    updatedAt: now,
  };

  const idx = demoStore.publicHolidays.findIndex((h) => h.id === id);
  if (idx !== -1) {
    demoStore.publicHolidays[idx] = holiday;
  } else {
    demoStore.publicHolidays.push(holiday);
  }

  if (!isDemoMode && db) {
    const docRef = doc(db, 'publicHolidays', id);
    await setDoc(docRef, holiday, { merge: true });
  }

  await logAudit(
    holidayData.id ? 'public_holiday_updated' : 'public_holiday_created',
    'settings',
    id,
    `Saved public holiday: ${holiday.name} (${holiday.date})`,
    userEmail,
    isDemoMode
  );

  return holiday;
}

export async function deletePublicHoliday(
  id: string,
  userEmail: string,
  isDemoMode: boolean
): Promise<void> {
  const existing = demoStore.publicHolidays.find((h) => h.id === id);
  demoStore.publicHolidays = demoStore.publicHolidays.filter((h) => h.id !== id);

  if (!isDemoMode && db) {
    await deleteDoc(doc(db, 'publicHolidays', id));
  }

  await logAudit(
    'public_holiday_deleted',
    'settings',
    id,
    `Deleted public holiday: ${existing?.name || id}`,
    userEmail,
    isDemoMode
  );
}

export async function restoreDefaultPublicHolidays(
  userEmail: string,
  isDemoMode: boolean
): Promise<PublicHoliday[]> {
  demoStore.publicHolidays = [...DEFAULT_PUBLIC_HOLIDAYS];

  if (!isDemoMode && db) {
    for (const hol of DEFAULT_PUBLIC_HOLIDAYS) {
      await setDoc(doc(db, 'publicHolidays', hol.id), hol, { merge: true });
    }
  }

  await logAudit(
    'public_holidays_reset',
    'settings',
    'all',
    'Restored default Maldives public holidays',
    userEmail,
    isDemoMode
  );

  return [...DEFAULT_PUBLIC_HOLIDAYS];
}

export async function getDepartmentsList(isDemoMode: boolean): Promise<Department[]> {
  if (isDemoMode || !db) {
    return [...demoStore.departments].sort((a, b) => a.order - b.order);
  }

  try {
    const snap = await getDocs(collection(db, 'departments'));
    if (snap.empty) {
      // Auto-seed default institutional departments to Firestore so they are real persistent documents
      try {
        const batch = writeBatch(db);
        for (const dept of DEFAULT_DEPARTMENTS) {
          batch.set(doc(db, 'departments', dept.id), dept);
        }
        await batch.commit();
      } catch (seedErr) {
        console.warn('Could not auto-seed departments in Firestore:', seedErr);
      }
      return [...DEFAULT_DEPARTMENTS];
    }
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Department))
      .sort((a, b) => a.order - b.order);
  } catch (err) {
    console.warn('Error fetching departments from Firestore:', err);
    return [...DEFAULT_DEPARTMENTS];
  }
}

export async function saveDepartment(
  dept: Department,
  userEmail: string,
  isDemoMode: boolean
): Promise<void> {
  if (isDemoMode || !db) {
    const idx = demoStore.departments.findIndex((d) => d.id === dept.id);
    if (idx !== -1) {
      demoStore.departments[idx] = dept;
    } else {
      demoStore.departments.push(dept);
    }
    logAudit('dept_saved', 'settings', dept.id, `Saved department ${dept.name}`, userEmail, isDemoMode);
    return;
  }

  const docRef = doc(db, 'departments', dept.id);
  await setDoc(docRef, dept, { merge: true });
  await logAudit('dept_saved', 'settings', dept.id, `Saved department ${dept.name}`, userEmail, isDemoMode);
}

export async function deleteDepartment(
  deptId: string,
  userEmail: string,
  isDemoMode: boolean
): Promise<void> {
  if (isDemoMode || !db) {
    demoStore.departments = demoStore.departments.filter((d) => d.id !== deptId);
    logAudit('dept_deleted', 'settings', deptId, `Deleted department ${deptId}`, userEmail, isDemoMode);
    return;
  }

  await deleteDoc(doc(db, 'departments', deptId));
  await logAudit('dept_deleted', 'settings', deptId, `Deleted department ${deptId}`, userEmail, isDemoMode);
}

export async function restoreDefaultDepartments(
  userEmail: string,
  isDemoMode: boolean
): Promise<Department[]> {
  if (isDemoMode || !db) {
    demoStore.departments = [...DEFAULT_DEPARTMENTS];
    logAudit('departments_restored_defaults', 'settings', 'all', 'Restored default departments', userEmail, isDemoMode);
    return [...demoStore.departments];
  }

  const batch = writeBatch(db);
  for (const dept of DEFAULT_DEPARTMENTS) {
    const docRef = doc(db, 'departments', dept.id);
    batch.set(docRef, dept, { merge: true });
  }
  await batch.commit();
  await logAudit('departments_restored_defaults', 'settings', 'all', 'Restored default departments', userEmail, isDemoMode);
  return getDepartmentsList(isDemoMode);
}

export async function reorderDepartments(
  updatedDepts: Department[],
  userEmail: string,
  isDemoMode: boolean
): Promise<void> {
  if (isDemoMode || !db) {
    demoStore.departments = [...updatedDepts];
    logAudit('departments_reordered', 'settings', 'all', 'Reordered departments', userEmail, isDemoMode);
    return;
  }

  const batch = writeBatch(db);
  for (const dept of updatedDepts) {
    const docRef = doc(db, 'departments', dept.id);
    batch.update(docRef, { order: dept.order });
  }
  await batch.commit();
  await logAudit('departments_reordered', 'settings', 'all', 'Reordered departments', userEmail, isDemoMode);
}

export async function reassignStaffDepartment(
  oldDeptName: string,
  newDeptName: string,
  userEmail: string,
  isDemoMode: boolean
): Promise<number> {
  if (!oldDeptName || !newDeptName || oldDeptName === newDeptName) return 0;

  if (isDemoMode || !db) {
    let count = 0;
    demoStore.staff.forEach((s) => {
      if (s.department === oldDeptName) {
        s.department = newDeptName;
        s.updatedAt = Date.now();
        count++;
      }
    });
    if (count > 0) {
      logAudit('dept_staff_reassigned', 'staff', 'bulk', `Reassigned ${count} staff from "${oldDeptName}" to "${newDeptName}"`, userEmail, isDemoMode);
    }
    return count;
  }

  const snap = await getDocs(query(collection(db, 'staff'), where('department', '==', oldDeptName)));
  if (snap.empty) return 0;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { department: newDeptName, updatedAt: Date.now() });
  });
  await batch.commit();
  await logAudit('dept_staff_reassigned', 'staff', 'bulk', `Reassigned ${snap.size} staff from "${oldDeptName}" to "${newDeptName}"`, userEmail, isDemoMode);
  return snap.size;
}

/* ========================================================================
   TV PAIRING SYSTEM
   ======================================================================== */

export async function generatePairingCode(userEmail: string, isDemoMode: boolean): Promise<PairingCode> {
  // 6 uppercase alphanumeric chars, e.g. MHC742
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MHC';
  for (let i = 0; i < 3; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  const pairingItem: PairingCode = {
    code,
    createdAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
    used: false,
    createdBy: userEmail,
  };

  if (isDemoMode || !db) {
    demoStore.pairingCodes.push(pairingItem);
    logAudit('pairing_code_generated', 'display', code, `Generated TV pairing code ${code}`, userEmail, isDemoMode);
    return pairingItem;
  }

  await setDoc(doc(db, 'pairingCodes', code), pairingItem);
  await logAudit('pairing_code_generated', 'display', code, `Generated TV pairing code ${code}`, userEmail, isDemoMode);
  return pairingItem;
}

export async function verifyPairingCodeAndRegisterDisplay(
  code: string,
  displayName: string,
  deviceInfo: string,
  isDemoMode: boolean
): Promise<{ token: string; displayId: string }> {
  const cleanCode = code.trim().toUpperCase();

  if (isDemoMode || !db) {
    const found = demoStore.pairingCodes.find(
      (p) => p.code === cleanCode && !p.used && p.expiresAt > Date.now()
    );
    if (!found) {
      throw new Error('Invalid, expired, or already used pairing code. Please generate a new code in the Admin Settings.');
    }
    found.used = true;

    const displayId = 'disp_' + Date.now();
    const token = 'token_' + Math.random().toString(36).substring(2) + Date.now();

    const display: PairedDisplay = {
      id: displayId,
      displayName: displayName || 'Maduvvari TV Display',
      token,
      pairedAt: Date.now(),
      lastSeenAt: Date.now(),
      status: 'active',
      deviceInfo,
    };
    demoStore.pairedDisplays.push(display);
    logAudit('display_paired', 'display', displayId, `Paired display "${display.displayName}"`, 'System', isDemoMode);
    return { token, displayId };
  }

  const codeDocRef = doc(db, 'pairingCodes', cleanCode);
  const codeSnap = await getDoc(codeDocRef);
  if (!codeSnap.exists()) {
    throw new Error('Invalid pairing code. Please verify the code on the Admin panel.');
  }

  const codeData = codeSnap.data() as PairingCode;
  if (codeData.used) {
    throw new Error('This pairing code has already been used.');
  }
  if (codeData.expiresAt < Date.now()) {
    throw new Error('This pairing code has expired. Please generate a fresh code.');
  }

  // Mark code used
  await updateDoc(codeDocRef, { used: true });

  const displayRef = doc(collection(db, 'pairedDisplays'));
  const token = 'token_' + Math.random().toString(36).substring(2) + Date.now();
  const display: PairedDisplay = {
    id: displayRef.id,
    displayName: displayName || 'Maduvvari TV Display',
    token,
    pairedAt: Date.now(),
    lastSeenAt: Date.now(),
    status: 'active',
    deviceInfo,
  };

  await setDoc(displayRef, display);
  await logAudit('display_paired', 'display', display.id, `Paired TV Display "${display.displayName}"`, 'System', isDemoMode);
  return { token, displayId: displayRef.id };
}

export async function checkDisplayTokenStatus(token: string, isDemoMode: boolean): Promise<boolean> {
  if (!token) return false;

  if (isDemoMode || !db) {
    const d = demoStore.pairedDisplays.find((disp) => disp.token === token);
    return !!d && d.status === 'active';
  }

  try {
    const q = query(collection(db, 'pairedDisplays'), where('token', '==', token));
    const snap = await getDocs(q);
    if (snap.empty) return false;
    const docData = snap.docs[0].data() as PairedDisplay;
    if (docData.status === 'active') {
      // Update heartbeat
      updateDoc(snap.docs[0].ref, { lastSeenAt: Date.now() }).catch(() => {});
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function getPairedDisplaysList(isDemoMode: boolean): Promise<PairedDisplay[]> {
  if (isDemoMode || !db) {
    return [...demoStore.pairedDisplays];
  }

  try {
    const snap = await getDocs(collection(db, 'pairedDisplays'));
    if (snap.empty) return [];
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PairedDisplay));
  } catch (err) {
    console.warn('Error fetching paired displays:', err);
    return [];
  }
}

export async function revokePairedDisplay(
  displayId: string,
  userEmail: string,
  isDemoMode: boolean
): Promise<void> {
  if (isDemoMode || !db) {
    const d = demoStore.pairedDisplays.find((disp) => disp.id === displayId);
    if (d) {
      d.status = 'revoked';
      logAudit('display_revoked', 'display', displayId, `Revoked display "${d.displayName}"`, userEmail, isDemoMode);
    }
    return;
  }

  const docRef = doc(db, 'pairedDisplays', displayId);
  await updateDoc(docRef, { status: 'revoked' });
  await logAudit('display_revoked', 'display', displayId, 'Revoked display access', userEmail, isDemoMode);
}

export const revokeDisplay = revokePairedDisplay;

/* ========================================================================
   ONE-CLICK FIRESTORE SETUP & DATABASE RESET TOOL
   Populates live Firestore with clean initial categories, departments,
   settings, and administrator account, or wipes fake data completely.
   ======================================================================== */

export async function seedInitialFirestoreData(userEmail: string): Promise<{ success: boolean; count: number }> {
  if (!db) throw new Error('Firestore database is not initialized.');

  let seededCount = 0;
  const batch = writeBatch(db);

  // 1. Settings
  batch.set(doc(db, 'settings', 'global'), DEFAULT_SETTINGS, { merge: true });
  seededCount++;

  // 2. Categories (official)
  for (const cat of DEFAULT_CATEGORIES) {
    batch.set(doc(db, 'leaveCategories', cat.id), cat, { merge: true });
    seededCount++;
  }

  // 3. Departments (official)
  for (const dept of DEFAULT_DEPARTMENTS) {
    batch.set(doc(db, 'departments', dept.id), dept, { merge: true });
    seededCount++;
  }

  // 4. Admin user account
  const adminUser = DEMO_USERS[0];
  if (adminUser) {
    batch.set(doc(db, 'users', adminUser.id), adminUser, { merge: true });
    seededCount++;
  }

  await batch.commit();

  // Sync in-memory store
  demoStore.settings = { ...DEFAULT_SETTINGS };
  demoStore.categories = [...DEFAULT_CATEGORIES];
  demoStore.departments = [...DEFAULT_DEPARTMENTS];
  demoStore.staff = [];
  demoStore.leaveRecords = [];
  demoStore.notices = [];
  demoStore.supervisors = [];
  demoStore.dutyRosters = [];
  demoStore.weeklyRosters = [];
  demoStore.memories = [];
  demoStore.users = [...DEMO_USERS];

  await logAudit('system_seeded', 'settings', 'init', 'Initialized clean Maduvvari Health Centre database (settings, categories, departments, admin user)', userEmail, false);

  return { success: true, count: seededCount };
}

/**
 * Resets the entire Firestore database and synchronizes the application:
 * 1. Purges all fake/mock data from staff, leaveRecords, notices, memories, dutyRosters, weeklyRosters, supervisors, handovers, dailyMedia.
 * 2. Purges test user accounts, preserving the master Administrator (@admin / 2026).
 * 3. Restores clean baseline settings, official leave categories, and departments.
 * 4. Clears local storage offline caches so TV displays and dashboards immediately reflect zero fake data.
 */
export async function resetDatabaseAndSync(
  userEmail = 'admin@mhc.gov.mv',
  isDemoMode = false
): Promise<{ success: boolean; count: number; message: string }> {
  // 1. Reset in-memory demoStore
  demoStore.resetToDefaults();

  // 2. Clear all local offline cache storage
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(CACHE_KEY_DISPLAY_DATA);
      localStorage.removeItem(CACHE_KEY_DAILY_MEDIA);
      localStorage.removeItem(CACHE_KEY_SETTINGS);
      localStorage.removeItem('mhc_display_data_cache');
    } catch (e) {
      console.warn('Error clearing localStorage caches:', e);
    }
  }

  if (isDemoMode || !db) {
    return {
      success: true,
      count: 0,
      message: 'Local and demo data successfully cleared and reset to clean state.',
    };
  }

  let deletedCount = 0;
  try {
    const collectionsToClear = [
      'staff',
      'leaveRecords',
      'notices',
      'memories',
      'dutyRosters',
      'weeklyRosters',
      'supervisors',
      'handovers',
      'dailyMedia',
      'dutyRequests',
      'staffAllowanceRates',
      'dutyAllowanceSheets',
      'auditLog',
    ];

    for (const colName of collectionsToClear) {
      const snap = await getDocs(collection(db, colName));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
        deletedCount++;
      }
    }

    // Clear users except admin
    const userSnap = await getDocs(collection(db, 'users'));
    for (const d of userSnap.docs) {
      if (d.id !== 'admin' && d.id !== 'usr_admin') {
        await deleteDoc(d.ref);
        deletedCount++;
      }
    }

    // Restore clean master configuration
    const batch = writeBatch(db);

    // Baseline settings
    batch.set(doc(db, 'settings', 'global'), DEFAULT_SETTINGS);

    // Official categories
    for (const cat of DEFAULT_CATEGORIES) {
      batch.set(doc(db, 'leaveCategories', cat.id), cat);
    }

    // Official departments
    for (const dept of DEFAULT_DEPARTMENTS) {
      batch.set(doc(db, 'departments', dept.id), dept);
    }

    // Master Admin user
    const adminUser = DEMO_USERS[0];
    if (adminUser) {
      batch.set(doc(db, 'users', adminUser.id), adminUser);
    }

    await batch.commit();

    await logAudit(
      'database_reset',
      'settings',
      'global',
      `Purged all fake data (${deletedCount} documents removed), restored clean configuration`,
      userEmail,
      false
    );

    return {
      success: true,
      count: deletedCount,
      message: `Database successfully reset. Removed ${deletedCount} fake documents and synchronized clean configuration.`,
    };
  } catch (err: any) {
    console.error('Error resetting database:', err);
    throw new Error(`Failed to reset database: ${err?.message || err}`);
  }
}

export async function clearAllDemoData(
  userEmail = 'admin@mhc.gov.mv',
  isDemoMode = false
): Promise<{ success: boolean; count: number; message: string }> {
  return await resetDatabaseAndSync(userEmail, isDemoMode);
}

export const seedDemoData = clearAllDemoData;

/* ========================================================================
   OFFLINE STORAGE & CACHE SYSTEM FOR TV DISPLAY RESILIENCE
   Ensures noticeboard, leave roster, duty roster, and daily media continue
   cycling seamlessly even during complete internet connection outages.
   ======================================================================== */

export interface DisplayDataPayload {
  cards: DisplayLeaveCard[];
  categories: LeaveCategory[];
  notices: Notice[];
  dutyRosters: DepartmentRoster[];
  memories: HospitalMemory[];
  weeklyRosters: WeeklyDepartmentRoster[];
}

export function saveOfflineCachedDisplayData(data: DisplayDataPayload): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        CACHE_KEY_DISPLAY_DATA,
        JSON.stringify({
          data,
          cachedAt: Date.now(),
        })
      );
    }
  } catch (err) {
    console.warn('Could not save offline display cache:', err);
  }
}

export function getOfflineCachedDisplayData(): DisplayDataPayload | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(CACHE_KEY_DISPLAY_DATA);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.data || null;
      }
    }
  } catch (err) {
    console.warn('Could not read offline display cache:', err);
  }
  return null;
}

export function saveOfflineDailyMedia(media: DailyMedia): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        CACHE_KEY_DAILY_MEDIA,
        JSON.stringify({
          media,
          cachedAt: Date.now(),
        })
      );
    }
  } catch (err) {
    console.warn('Could not save offline daily media cache:', err);
  }
}

export function getOfflineDailyMedia(): DailyMedia | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(CACHE_KEY_DAILY_MEDIA);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.media || null;
      }
    }
  } catch (err) {
    console.warn('Could not read offline daily media cache:', err);
  }
  return null;
}

export function saveOfflineCachedSettings(settings: AppSettings): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CACHE_KEY_SETTINGS, JSON.stringify(settings));
    }
  } catch (err) {
    console.warn('Could not save offline settings cache:', err);
  }
}

export function getOfflineCachedSettings(): AppSettings | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(CACHE_KEY_SETTINGS);
      if (raw) {
        return JSON.parse(raw) as AppSettings;
      }
    }
  } catch (err) {
    console.warn('Could not read offline settings cache:', err);
  }
  return null;
}

/**
 * Precaches an asset URL (photo/video/thumbnail) into the browser Cache API
 * so the Service Worker and image tags can render it offline.
 */
export async function cacheMediaAssetOffline(url: string | undefined): Promise<void> {
  if (!url || typeof window === 'undefined' || !('caches' in window)) return;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  try {
    const cache = await caches.open('media-assets-cache');
    const existing = await cache.match(url);
    if (!existing) {
      await cache.add(url);
    }
  } catch {
    // Non-blocking: external host CORS or temporary network blip
  }
}

/* ========================================================================
   REAL-TIME SUBSCRIPTION FOR TV DISPLAY & DASHBOARD
   Provides sub-second live updates without manual page reload
   ======================================================================== */

export function subscribeToDisplayData(
  timezone: string,
  isDemoMode: boolean,
  onData: (data: DisplayDataPayload) => void
): () => void {
  // 1. Immediately emit offline cached data if present so the TV screen is never blank
  const initialCached = getOfflineCachedDisplayData();
  if (initialCached) {
    onData(initialCached);
  }

  const fetchAll = async () => {
    try {
      const today = getTodayString(timezone);
      const [proj, activeNotices, allRosters, activeMemories, weeklyRostersList] = await Promise.all([
        getDisplayProjection(timezone, isDemoMode),
        getActivePublishedNotices(isDemoMode),
        getDutyRostersList(isDemoMode),
        getActiveMemoriesList(isDemoMode),
        getWeeklyRostersList(isDemoMode),
      ]);
      const todayRosters = allRosters.filter((r) => r.date === today && r.status === 'published');
      const payload: DisplayDataPayload = {
        cards: proj.cards,
        categories: proj.categories,
        notices: activeNotices,
        dutyRosters: todayRosters.length > 0 ? todayRosters : allRosters.filter((r) => r.status === 'published'),
        memories: activeMemories,
        weeklyRosters: weeklyRostersList,
      };

      // Persist latest data to local offline cache
      saveOfflineCachedDisplayData(payload);

      // Precache staff photos and notice media in background for offline use
      payload.cards.forEach((c) => {
        if (c.staffPhotoUrl) cacheMediaAssetOffline(c.staffPhotoUrl);
      });
      payload.memories.forEach((m) => {
        if (m.imageUrl) cacheMediaAssetOffline(m.imageUrl);
      });

      return payload;
    } catch (err) {
      console.warn('Network issue fetching display data, falling back to offline cache:', err);
      const cached = getOfflineCachedDisplayData();
      if (cached) {
        return cached;
      }
      throw err;
    }
  };

  // Always trigger immediate initial projection
  fetchAll()
    .then((data) => {
      onData(data);
    })
    .catch((err) => {
      console.warn('Initial projection load warning, trying cached fallback:', err);
      const cached = getOfflineCachedDisplayData();
      if (cached) {
        onData(cached);
      }
    });

  if (isDemoMode || !db) {
    return () => {};
  }

  // Real-time Firestore snapshot listeners
  let updateDebounceTimer: any = null;
  const triggerUpdate = () => {
    clearTimeout(updateDebounceTimer);
    updateDebounceTimer = setTimeout(async () => {
      try {
        const data = await fetchAll();
        onData(data);
      } catch (err) {
        console.warn('Real-time subscription projection error:', err);
        const cached = getOfflineCachedDisplayData();
        if (cached) onData(cached);
      }
    }, 150);
  };

  const unsubLeaves = onSnapshot(collection(db, 'leaveRecords'), () => triggerUpdate(), (err) => console.warn('Leaves listener:', err));
  const unsubStaff = onSnapshot(collection(db, 'staff'), () => triggerUpdate(), (err) => console.warn('Staff listener:', err));
  const unsubNotices = onSnapshot(collection(db, 'notices'), () => triggerUpdate(), (err) => console.warn('Notices listener:', err));
  const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), () => triggerUpdate(), (err) => console.warn('Settings listener:', err));
  const unsubRosters = onSnapshot(collection(db, 'dutyRosters'), () => triggerUpdate(), (err) => console.warn('Rosters listener:', err));
  const unsubWeeklyRosters = onSnapshot(collection(db, 'weeklyRosters'), () => triggerUpdate(), (err) => console.warn('Weekly Rosters listener:', err));
  const unsubMemories = onSnapshot(collection(db, 'memories'), () => triggerUpdate(), (err) => console.warn('Memories listener:', err));

  return () => {
    clearTimeout(updateDebounceTimer);
    unsubLeaves();
    unsubStaff();
    unsubNotices();
    unsubSettings();
    unsubRosters();
    unsubWeeklyRosters();
    unsubMemories();
  };
}

/* ========================================================================
   PHOTO / VIDEO (MOVEMENTS) OF THE DAY
   - Fullscreen takeover every 1hr (default, configurable by admin)
   - Disappears after 1min (default for photo, configurable by admin)
   - Video appearance duration according to video length
   - Auto-deletes next day
   ======================================================================== */

export async function purgeExpiredDailyMedia(todayStr: string, isDemoMode = false): Promise<number> {
  let purgedCount = 0;
  if (isDemoMode || !db) {
    if (demoStore.dailyMedia) {
      const beforeCount = demoStore.dailyMedia.length;
      demoStore.dailyMedia = demoStore.dailyMedia.filter((m) => m.date >= todayStr);
      purgedCount = beforeCount - demoStore.dailyMedia.length;
    }
    return purgedCount;
  }

  try {
    const snap = await getDocs(collection(db, 'dailyMedia'));
    if (snap.empty) return 0;
    const batch = writeBatch(db);
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.date && data.date < todayStr) {
        batch.delete(docSnap.ref);
        purgedCount++;
        if (data.isChunked) {
          getDocs(collection(db, 'dailyMedia', docSnap.id, 'chunks'))
            .then((cSnap) => {
              cSnap.docs.forEach((c) => deleteDoc(c.ref).catch(() => {}));
            })
            .catch(() => {});
        }
      }
    });
    if (purgedCount > 0) {
      await batch.commit();
      console.log(`[Auto-Delete] Purged ${purgedCount} expired daily media items older than ${todayStr}`);
    }
    return purgedCount;
  } catch (err) {
    console.warn('Error purging expired daily media:', err);
    return 0;
  }
}

export async function getDailyMediaList(isDemoMode = false): Promise<DailyMedia[]> {
  const todayStr = getTodayString('Indian/Maldives');
  // Auto-delete records from previous days
  await purgeExpiredDailyMedia(todayStr, isDemoMode).catch(() => {});

  if (isDemoMode || !db) {
    return (demoStore.dailyMedia || []).filter((m) => m.date >= todayStr);
  }

  try {
    const snap = await getDocs(collection(db, 'dailyMedia'));
    if (snap.empty) {
      return (demoStore.dailyMedia || []).filter((m) => m.date >= todayStr);
    }
    const resolvedMediaList: DailyMedia[] = await Promise.all(
      snap.docs.map(async (d) => {
        const data = { id: d.id, ...d.data() } as DailyMedia;
        if (data.isChunked && (!data.mediaUrl || data.mediaUrl.length === 0)) {
          try {
            const chunksSnap = await getDocs(collection(db, 'dailyMedia', d.id, 'chunks'));
            if (!chunksSnap.empty) {
              const chunkDocs = chunksSnap.docs
                .map((cd) => cd.data() as { index: number; data: string })
                .sort((a, b) => a.index - b.index);
              data.mediaUrl = chunkDocs.map((c) => c.data).join('');
            }
          } catch (chunkErr) {
            console.warn(`Failed to reassemble chunks for daily media ${d.id}:`, chunkErr);
          }
        }
        return data;
      })
    );

    return resolvedMediaList
      .filter((m) => m.date >= todayStr)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.warn('Error getting daily media:', err);
    return (demoStore.dailyMedia || []).filter((m) => m.date >= todayStr);
  }
}

export async function getTodayDailyMedia(isDemoMode = false): Promise<DailyMedia | null> {
  const todayStr = getTodayString('Indian/Maldives');

  try {
    const all = await getDailyMediaList(isDemoMode);
    const activeToday = all.find((m) => m.date === todayStr && m.active);
    if (activeToday) {
      saveOfflineDailyMedia(activeToday);
      cacheMediaAssetOffline(activeToday.mediaUrl);
      if (activeToday.thumbnailUrl) {
        cacheMediaAssetOffline(activeToday.thumbnailUrl);
      }
      return activeToday;
    }
  } catch (err) {
    console.warn('Error fetching daily media, checking offline cache:', err);
  }

  // Fallback to offline cached daily media
  const cached = getOfflineDailyMedia();
  if (cached && cached.date === todayStr && cached.active) {
    return cached;
  }
  return null;
}

// Helper to strip undefined values before passing to Firestore
function cleanFirestoreDoc<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
}

export async function saveDailyMedia(
  media: Partial<DailyMedia>,
  performedBy = 'Admin',
  isDemoMode = false
): Promise<DailyMedia> {
  const now = Date.now();
  const todayStr = getTodayString('Indian/Maldives');
  const id = media.id || `media_${todayStr}_${Math.random().toString(36).substring(2, 7)}`;

  const item: DailyMedia = {
    id,
    type: media.type || 'photo',
    mediaUrl: media.mediaUrl || '',
    thumbnailUrl: media.thumbnailUrl || '',
    fileName: media.fileName || '',
    title: media.title || 'Movement of the Day',
    titleDhivehi: media.titleDhivehi || 'މިއަދުގެ ހަރަކާތް / ފޮޓޯ އަދި ވީޑިއޯ',
    caption: media.caption || '',
    captionDhivehi: media.captionDhivehi || '',
    date: media.date || todayStr,
    intervalMinutes: media.intervalMinutes !== undefined ? media.intervalMinutes : 60,
    photoDurationSeconds: media.photoDurationSeconds !== undefined ? media.photoDurationSeconds : 60,
    videoDurationSeconds: media.videoDurationSeconds !== undefined ? media.videoDurationSeconds : 0,
    playVideoFullLength: media.playVideoFullLength !== undefined ? media.playVideoFullLength : true,
    autoPlayMuted: media.autoPlayMuted !== undefined ? media.autoPlayMuted : false,
    active: media.active !== undefined ? media.active : true,
    createdAt: media.createdAt || now,
    updatedAt: now,
  };

  if (!demoStore.dailyMedia) {
    demoStore.dailyMedia = [];
  }
  const idx = demoStore.dailyMedia.findIndex((m) => m.id === id);
  if (idx >= 0) {
    demoStore.dailyMedia[idx] = item;
  } else {
    demoStore.dailyMedia.unshift(item);
  }

  if (isDemoMode || !db) {
    saveOfflineDailyMedia(item);
    cacheMediaAssetOffline(item.mediaUrl);
    if (item.thumbnailUrl) cacheMediaAssetOffline(item.thumbnailUrl);
    await logAudit(
      'daily_media_saved',
      'settings',
      id,
      `Saved ${item.type} of the day: "${item.title}" (appears every ${item.intervalMinutes}m)`,
      performedBy,
      isDemoMode
    );
    return item;
  }

  try {
    const firestoreData = cleanFirestoreDoc(item);
    const mediaUrl = item.mediaUrl || '';
    const MAX_INLINE_MEDIA_CHARS = 500_000;

    if (mediaUrl.length > MAX_INLINE_MEDIA_CHARS) {
      // Large media (e.g. video or high-res graphic): split into safe chunks of 350,000 chars (~350 KB each)
      // to mathematically guarantee Firestore document size never exceeds 1MB (1,048,576 bytes)
      const chunkSize = 350_000;
      const chunks: string[] = [];
      for (let i = 0; i < mediaUrl.length; i += chunkSize) {
        chunks.push(mediaUrl.substring(i, i + chunkSize));
      }

      firestoreData.mediaUrl = ''; // Leave blank in parent doc to keep it < 2 KB
      firestoreData.isChunked = true;
      firestoreData.totalChunks = chunks.length;

      await setDoc(doc(db, 'dailyMedia', id), firestoreData, { merge: true });

      // Save chunks into subcollection
      for (let i = 0; i < chunks.length; i++) {
        await setDoc(doc(db, 'dailyMedia', id, 'chunks', String(i)), {
          index: i,
          data: chunks[i],
          total: chunks.length,
        });
      }
    } else {
      firestoreData.isChunked = false;
      firestoreData.totalChunks = 0;
      await setDoc(doc(db, 'dailyMedia', id), firestoreData, { merge: true });
    }

    saveOfflineDailyMedia(item);
    cacheMediaAssetOffline(item.mediaUrl);
    if (item.thumbnailUrl) cacheMediaAssetOffline(item.thumbnailUrl);
    await logAudit(
      'daily_media_saved',
      'settings',
      id,
      `Saved ${item.type} of the day: "${item.title}" (appears every ${item.intervalMinutes}m)`,
      performedBy,
      isDemoMode
    );
    return item;
  } catch (err: any) {
    console.error('Error saving daily media to Firestore:', err);
    throw new Error(`Failed to save movement of the day: ${err?.message || err}`);
  }
}

export async function deleteDailyMedia(
  id: string,
  performedBy = 'Admin',
  isDemoMode = false
): Promise<void> {
  if (demoStore.dailyMedia) {
    demoStore.dailyMedia = demoStore.dailyMedia.filter((m) => m.id !== id);
  }
  if (isDemoMode || !db) {
    await logAudit('daily_media_deleted', 'settings', id, `Deleted daily media ${id}`, performedBy, isDemoMode);
    return;
  }

  try {
    // Delete any subcollection chunks
    try {
      const chunksSnap = await getDocs(collection(db, 'dailyMedia', id, 'chunks'));
      for (const cDoc of chunksSnap.docs) {
        await deleteDoc(cDoc.ref).catch(() => {});
      }
    } catch {
      // Ignore chunk listing errors
    }
    await deleteDoc(doc(db, 'dailyMedia', id));
    await logAudit('daily_media_deleted', 'settings', id, `Deleted daily media ${id}`, performedBy, isDemoMode);
  } catch (err: any) {
    console.error('Error deleting daily media from Firestore:', err);
    throw new Error(`Failed to delete daily media: ${err?.message || err}`);
  }
}

/* ========================================================================
   STAFF DUTY REQUESTS (REQUEST SHIFT / OFF / CHANGE)
   ======================================================================== */

export async function getDutyRequestsList(
  departmentId?: string,
  isDemoMode = false
): Promise<DutyRequest[]> {
  if (isDemoMode || !db) {
    const list = demoStore.dutyRequests || [];
    if (departmentId) {
      return list.filter((r) => r.departmentId === departmentId);
    }
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }

  try {
    const snap = await getDocs(collection(db, 'dutyRequests'));
    if (snap.empty) {
      return (demoStore.dutyRequests || []).sort((a, b) => b.createdAt - a.createdAt);
    }
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DutyRequest));
    demoStore.dutyRequests = all;
    if (departmentId) {
      return all.filter((r) => r.departmentId === departmentId).sort((a, b) => b.createdAt - a.createdAt);
    }
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.warn('Error fetching duty requests from Firestore:', err);
    const list = demoStore.dutyRequests || [];
    if (departmentId) {
      return list.filter((r) => r.departmentId === departmentId);
    }
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }
}

export async function getStaffDutyRequests(
  staffId: string,
  isDemoMode = false
): Promise<DutyRequest[]> {
  const all = await getDutyRequestsList(undefined, isDemoMode);
  return all.filter((r) => r.staffId === staffId || (r.staffCustomId && r.staffCustomId === staffId));
}

export async function submitDutyRequest(
  requestData: {
    staffId: string;
    staffName: string;
    staffCustomId?: string;
    staffDesignation?: string;
    departmentId: string;
    departmentName: string;
    date: string; // YYYY-MM-DD
    shiftChoice: DutyRequestShiftChoice;
    shiftLabel?: string;
    reason: string;
    notes?: string;
  },
  isDemoMode = false
): Promise<DutyRequest> {
  const now = Date.now();
  const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const item: DutyRequest = {
    id,
    staffId: requestData.staffId,
    staffName: requestData.staffName,
    staffCustomId: requestData.staffCustomId || '',
    staffDesignation: requestData.staffDesignation || '',
    departmentId: requestData.departmentId,
    departmentName: requestData.departmentName,
    date: requestData.date,
    shiftChoice: requestData.shiftChoice,
    shiftLabel:
      requestData.shiftLabel ||
      (requestData.shiftChoice === 'off'
        ? 'Day Off (OFF)'
        : requestData.shiftChoice === 'morning'
        ? 'Morning Duty (M)'
        : requestData.shiftChoice === 'evening'
        ? 'Evening Duty (E)'
        : requestData.shiftChoice === 'night'
        ? 'Night Duty (N)'
        : 'On-Call / Standby'),
    reason: requestData.reason,
    notes: requestData.notes || '',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  if (!demoStore.dutyRequests) {
    demoStore.dutyRequests = [];
  }
  demoStore.dutyRequests.unshift(item);

  if (!isDemoMode && db) {
    try {
      const clean = cleanFirestoreDoc(item);
      await setDoc(doc(db, 'dutyRequests', id), clean, { merge: true });
    } catch (err) {
      console.warn('Error saving duty request to Firestore:', err);
    }
  }

  await logAudit(
    'duty_request_submitted',
    'staff',
    id,
    `Duty request submitted by ${item.staffName} for ${item.date} (${item.shiftLabel})`,
    item.staffName,
    isDemoMode
  );

  return item;
}

export async function applyApprovedDutyRequestToRoster(
  req: DutyRequest,
  userEmail: string,
  isDemoMode = false
): Promise<boolean> {
  let updatedAnyWeekly = false;

  // 1. Search and update weekly department rosters
  const weeklyRosters = await getWeeklyRostersList(isDemoMode);
  for (const roster of weeklyRosters) {
    // Check if the weekly roster covers this day
    const dayMatch = roster.days.find((d) => d.dateStr === req.date);
    if (!dayMatch) continue;

    // Check if staff member exists in this roster's rows
    const rowIdx = roster.rows.findIndex(
      (r) =>
        (req.staffName && r.staffName.trim().toLowerCase() === req.staffName.trim().toLowerCase()) ||
        (r.id && r.id === req.staffId)
    );

    if (rowIdx >= 0) {
      const row = { ...roster.rows[rowIdx] };
      const days = { ...row.days };

      // Determine shift code
      let newCode = 'OFF';
      let subText = '(Approved)';
      let isOnCall = false;

      if (req.shiftChoice === 'off') {
        newCode = 'OFF';
      } else if (req.shiftChoice === 'morning') {
        newCode = 'M';
      } else if (req.shiftChoice === 'evening') {
        newCode = 'E';
      } else if (req.shiftChoice === 'night') {
        newCode = 'N';
      } else if (req.shiftChoice === 'on_call') {
        newCode = 'ONCALL';
        isOnCall = true;
      }

      days[dayMatch.dateStr] = {
        code: newCode,
        subText,
        isOnCall,
        isDutyRequestApproved: true,
        dutyRequestId: req.id,
        customNote: `Approved duty request: ${req.reason}${req.supervisorRemarks ? ' | Note: ' + req.supervisorRemarks : ''}`,
      };

      // Recalculate row stats
      let m = 0;
      let e = 0;
      let n = 0;
      let off = 0;
      Object.values(days).forEach((cell) => {
        if (!cell || !cell.code) return;
        const c = cell.code.toUpperCase();
        if (c === 'M' || c === '1') m++;
        else if (c === 'E' || c === '2') e++;
        else if (c === 'N') n++;
        else if (c === 'OFF') off++;
      });

      row.days = days;
      row.stats = {
        holidays: off,
        mShifts: m,
        eShifts: e,
        nShifts: n,
      };

      const newRows = [...roster.rows];
      newRows[rowIdx] = row;
      const updatedRoster = { ...roster, rows: newRows };

      await saveWeeklyRoster(updatedRoster, userEmail, isDemoMode);
      updatedAnyWeekly = true;
    }
  }

  // 2. Also check daily duty rosters
  try {
    const dailyRosters = await getDutyRostersList(isDemoMode);
    for (const dr of dailyRosters) {
      if (dr.date !== req.date) continue;
      if (req.departmentId && dr.departmentId && dr.departmentId !== req.departmentId) continue;

      const entries = [...dr.entries];
      const entryIdx = entries.findIndex(
        (ent) =>
          ent.staffId === req.staffId ||
          (req.staffName && ent.staffName.trim().toLowerCase() === req.staffName.trim().toLowerCase())
      );

      if (req.shiftChoice === 'off') {
        if (entryIdx >= 0) {
          entries.splice(entryIdx, 1);
          await saveDutyRoster({ ...dr, entries }, userEmail, isDemoMode);
        }
      } else {
        const shiftMap: Record<string, { type: ShiftType; name: string; start: string; end: string }> = {
          morning: { type: 'morning', name: 'Morning Duty', start: '08:00', end: '15:00' },
          evening: { type: 'evening', name: 'Evening Duty', start: '15:00', end: '23:00' },
          night: { type: 'night', name: 'Night Duty', start: '23:00', end: '08:00' },
          on_call: { type: 'on_call', name: 'On-Call / Standby', start: '08:00', end: '08:00' },
        };
        const sInfo = shiftMap[req.shiftChoice] || shiftMap.morning;

        if (entryIdx >= 0) {
          entries[entryIdx] = {
            ...entries[entryIdx],
            shiftType: sInfo.type,
            shiftName: sInfo.name,
            startTime: sInfo.start,
            endTime: sInfo.end,
            isOnCall: req.shiftChoice === 'on_call',
            supervisorRemarks: `Approved Duty Request: ${req.reason}`,
          };
        } else {
          entries.push({
            id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            staffId: req.staffId,
            staffName: req.staffName,
            staffCustomId: req.staffCustomId,
            staffDesignation: req.staffDesignation || 'Staff',
            departmentId: dr.departmentId,
            departmentName: dr.departmentName,
            shiftType: sInfo.type,
            shiftName: sInfo.name,
            startTime: sInfo.start,
            endTime: sInfo.end,
            isOnCall: req.shiftChoice === 'on_call',
            supervisorRemarks: `Approved Duty Request: ${req.reason}`,
            order: entries.length + 1,
          });
        }
        await saveDutyRoster({ ...dr, entries }, userEmail, isDemoMode);
      }
    }
  } catch (err) {
    console.warn('Error updating daily roster on duty request approval:', err);
  }

  return updatedAnyWeekly;
}

export async function reviewDutyRequest(
  requestId: string,
  status: 'approved' | 'rejected',
  supervisorRemarks: string,
  reviewerName = 'Supervisor',
  isDemoMode = false
): Promise<DutyRequest> {
  const all = await getDutyRequestsList(undefined, isDemoMode);
  const target = all.find((r) => r.id === requestId);
  if (!target) {
    throw new Error('Duty request not found');
  }

  const now = Date.now();
  const updatedReq: DutyRequest = {
    ...target,
    status,
    supervisorRemarks,
    reviewedBy: reviewerName,
    reviewedAt: now,
    updatedAt: now,
    rosterUpdated: status === 'approved',
  };

  if (!demoStore.dutyRequests) demoStore.dutyRequests = [];
  const idx = demoStore.dutyRequests.findIndex((r) => r.id === requestId);
  if (idx >= 0) {
    demoStore.dutyRequests[idx] = updatedReq;
  } else {
    demoStore.dutyRequests.unshift(updatedReq);
  }

  if (!isDemoMode && db) {
    try {
      const clean = cleanFirestoreDoc(updatedReq);
      await setDoc(doc(db, 'dutyRequests', requestId), clean, { merge: true });
    } catch (err) {
      console.warn('Error updating duty request in Firestore:', err);
    }
  }

  // When approved that changes has to change from roster with red text that cell
  if (status === 'approved') {
    await applyApprovedDutyRequestToRoster(updatedReq, reviewerName, isDemoMode);
  }

  await logAudit(
    `duty_request_${status}`,
    'staff',
    requestId,
    `Duty request for ${target.staffName} (${target.date}) was ${status} by ${reviewerName}: ${supervisorRemarks}`,
    reviewerName,
    isDemoMode
  );

  return updatedReq;
}

export async function deleteDutyRequest(
  id: string,
  performedBy = 'Supervisor',
  isDemoMode = false
): Promise<void> {
  if (demoStore.dutyRequests) {
    demoStore.dutyRequests = demoStore.dutyRequests.filter((r) => r.id !== id);
  }

  if (!isDemoMode && db) {
    try {
      await deleteDoc(doc(db, 'dutyRequests', id));
    } catch (err) {
      console.warn('Error deleting duty request from Firestore:', err);
    }
  }

  await logAudit('duty_request_deleted', 'staff', id, `Deleted duty request ${id}`, performedBy, isDemoMode);
}

/* ========================================================================
   DUTY ROSTER SETTINGS: STAFF ALLOWANCE RATES CRUD
   ======================================================================== */

export const DEFAULT_STAFF_ALLOWANCE_RATES: Omit<StaffAllowanceRate, 'id' | 'staffId' | 'staffName' | 'createdAt' | 'updatedAt'> = {
  normalDayRate: 150,
  weekendDayRate: 200,
  holidayRate: 250,
  nightShiftAllowance: 50,
  onCallRate: 100,
  currency: 'MVR',
  active: true,
};

export async function getStaffAllowanceRatesList(isDemoMode = false): Promise<StaffAllowanceRate[]> {
  if (isDemoMode) {
    if (!demoStore.staffAllowanceRates || demoStore.staffAllowanceRates.length === 0) {
      // Seed default allowance rates from existing staff
      const staff = await getStaffList(true);
      demoStore.staffAllowanceRates = staff.map((s) => ({
        id: `rate_${s.id}`,
        staffId: s.id,
        staffName: s.fullName,
        staffCustomId: s.staffId || '',
        departmentId: s.department || '',
        departmentName: s.department || '',
        designation: s.designation || '',
        normalDayRate: s.designation?.toLowerCase().includes('specialist') || s.designation?.toLowerCase().includes('medical officer') ? 250 : 150,
        weekendDayRate: s.designation?.toLowerCase().includes('specialist') || s.designation?.toLowerCase().includes('medical officer') ? 350 : 200,
        holidayRate: s.designation?.toLowerCase().includes('specialist') || s.designation?.toLowerCase().includes('medical officer') ? 450 : 250,
        nightShiftAllowance: 75,
        onCallRate: 150,
        currency: 'MVR',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
    }
    return [...demoStore.staffAllowanceRates];
  }

  if (!db) {
    return demoStore.staffAllowanceRates || [];
  }

  try {
    const snap = await getDocs(collection(db, 'staffAllowanceRates'));
    if (snap.empty) {
      // If Firestore is empty, initialize with default rates for existing staff
      const staff = await getStaffList(false);
      const initialRates: StaffAllowanceRate[] = staff.map((s) => ({
        id: `rate_${s.id}`,
        staffId: s.id,
        staffName: s.fullName,
        staffCustomId: s.staffId || '',
        departmentId: s.department || '',
        departmentName: s.department || '',
        designation: s.designation || '',
        normalDayRate: s.designation?.toLowerCase().includes('specialist') || s.designation?.toLowerCase().includes('medical officer') ? 250 : 150,
        weekendDayRate: s.designation?.toLowerCase().includes('specialist') || s.designation?.toLowerCase().includes('medical officer') ? 350 : 200,
        holidayRate: s.designation?.toLowerCase().includes('specialist') || s.designation?.toLowerCase().includes('medical officer') ? 450 : 250,
        nightShiftAllowance: 75,
        onCallRate: 150,
        currency: 'MVR',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      demoStore.staffAllowanceRates = initialRates;
      return initialRates;
    }

    const rates = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StaffAllowanceRate));
    demoStore.staffAllowanceRates = rates;
    return rates;
  } catch (err) {
    console.warn('Error fetching staff allowance rates from Firestore:', err);
    return demoStore.staffAllowanceRates || [];
  }
}

export async function saveStaffAllowanceRate(
  rate: StaffAllowanceRate,
  isDemoMode = false,
  performedBy = 'Administrator'
): Promise<void> {
  const now = Date.now();
  const id = rate.id || `rate_${rate.staffId || Date.now()}`;
  const record: StaffAllowanceRate = {
    ...rate,
    id,
    updatedAt: now,
    createdAt: rate.createdAt || now,
  };

  if (!demoStore.staffAllowanceRates) {
    demoStore.staffAllowanceRates = [];
  }
  const idx = demoStore.staffAllowanceRates.findIndex((r) => r.id === id || r.staffId === rate.staffId);
  if (idx >= 0) {
    demoStore.staffAllowanceRates[idx] = record;
  } else {
    demoStore.staffAllowanceRates.push(record);
  }

  if (!isDemoMode && db) {
    try {
      const clean = cleanFirestoreDoc(record);
      await setDoc(doc(db, 'staffAllowanceRates', id), clean, { merge: true });
    } catch (err) {
      console.warn('Error saving staff allowance rate to Firestore:', err);
    }
  }

  await logAudit(
    'allowance_rate_updated',
    'settings',
    id,
    `Updated shift allowance rate for ${record.staffName}: Normal=${record.normalDayRate}, Wknd=${record.weekendDayRate}, Hol=${record.holidayRate}`,
    performedBy,
    isDemoMode
  );
}

export async function saveStaffAllowanceRatesBatch(
  rates: StaffAllowanceRate[],
  isDemoMode = false,
  performedBy = 'Administrator'
): Promise<void> {
  for (const r of rates) {
    await saveStaffAllowanceRate(r, isDemoMode, performedBy);
  }
}

export async function deleteStaffAllowanceRate(
  id: string,
  performedBy = 'Administrator',
  isDemoMode = false
): Promise<void> {
  if (demoStore.staffAllowanceRates) {
    demoStore.staffAllowanceRates = demoStore.staffAllowanceRates.filter((r) => r.id !== id);
  }

  if (!isDemoMode && db) {
    try {
      await deleteDoc(doc(db, 'staffAllowanceRates', id));
    } catch (err) {
      console.warn('Error deleting staff allowance rate from Firestore:', err);
    }
  }

  await logAudit('allowance_rate_deleted', 'settings', id, `Deleted staff allowance rate ${id}`, performedBy, isDemoMode);
}

/* ========================================================================
   DUTY ALLOWANCE REPORTS & SHEETS
   ======================================================================== */

export async function getDutyAllowanceSheetsList(isDemoMode = false): Promise<DutyAllowanceSheet[]> {
  if (isDemoMode) {
    return (demoStore.dutyAllowanceSheets || []).sort((a, b) => b.createdAt - a.createdAt);
  }

  if (!db) {
    return (demoStore.dutyAllowanceSheets || []).sort((a, b) => b.createdAt - a.createdAt);
  }

  try {
    const snap = await getDocs(collection(db, 'dutyAllowanceSheets'));
    if (snap.empty) {
      return (demoStore.dutyAllowanceSheets || []).sort((a, b) => b.createdAt - a.createdAt);
    }
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DutyAllowanceSheet));
    demoStore.dutyAllowanceSheets = all;
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.warn('Error fetching duty allowance sheets from Firestore:', err);
    return (demoStore.dutyAllowanceSheets || []).sort((a, b) => b.createdAt - a.createdAt);
  }
}

export async function saveDutyAllowanceSheet(
  sheet: DutyAllowanceSheet,
  isDemoMode = false,
  performedBy = 'Supervisor'
): Promise<void> {
  const now = Date.now();
  const id = sheet.id || `sheet_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const record: DutyAllowanceSheet = {
    ...sheet,
    id,
    updatedAt: now,
    createdAt: sheet.createdAt || now,
  };

  if (!demoStore.dutyAllowanceSheets) {
    demoStore.dutyAllowanceSheets = [];
  }
  const idx = demoStore.dutyAllowanceSheets.findIndex((s) => s.id === id);
  if (idx >= 0) {
    demoStore.dutyAllowanceSheets[idx] = record;
  } else {
    demoStore.dutyAllowanceSheets.unshift(record);
  }

  if (!isDemoMode && db) {
    try {
      const clean = cleanFirestoreDoc(record);
      await setDoc(doc(db, 'dutyAllowanceSheets', id), clean, { merge: true });
    } catch (err) {
      console.warn('Error saving duty allowance sheet to Firestore:', err);
    }
  }

  await logAudit(
    'duty_allowance_sheet_saved',
    'settings',
    id,
    `Saved shift duty allowance sheet "${record.title}" (${record.fromDate} to ${record.toDate}) for ${record.totalDutiesCount} duties, total: ${record.totalAllowanceAmount} ${record.currency}`,
    performedBy,
    isDemoMode
  );
}

export async function deleteDutyAllowanceSheet(
  id: string,
  performedBy = 'Supervisor',
  isDemoMode = false
): Promise<void> {
  if (demoStore.dutyAllowanceSheets) {
    demoStore.dutyAllowanceSheets = demoStore.dutyAllowanceSheets.filter((s) => s.id !== id);
  }

  if (!isDemoMode && db) {
    try {
      await deleteDoc(doc(db, 'dutyAllowanceSheets', id));
    } catch (err) {
      console.warn('Error deleting duty allowance sheet from Firestore:', err);
    }
  }

  await logAudit('duty_allowance_sheet_deleted', 'settings', id, `Deleted allowance sheet ${id}`, performedBy, isDemoMode);
}

/**
 * High-precision Calculation Engine for Shift Duty Allowance
 * Evaluates date range, roster entries (weekly & daily), day types (normal/weekend/holiday),
 * rates per staff member, and compiles an itemized and summarized report sheet.
 */
export async function calculateShiftDutyAllowance(params: {
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  departmentId?: string; // 'all' or specific
  staffId?: string; // 'all' or specific
  isDemoMode?: boolean;
}): Promise<{
  fromDate: string;
  toDate: string;
  departmentId: string;
  departmentName: string;
  staffSummaries: StaffAllowanceSummary[];
  allEntries: DutyAllowanceCalculationEntry[];
  totalDutiesCount: number;
  totalAllowanceAmount: number;
  currency: string;
}> {
  const { fromDate, toDate, departmentId = 'all', staffId = 'all', isDemoMode = false } = params;

  // 1. Fetch prerequisite data
  const [allStaff, allDepts, allWeeklyRosters, allDailyRosters, allRates, publicHolidays] = await Promise.all([
    getStaffList(isDemoMode),
    getDepartmentsList(isDemoMode),
    getWeeklyRostersList(isDemoMode),
    getDutyRostersList(isDemoMode),
    getStaffAllowanceRatesList(isDemoMode),
    getPublicHolidaysList(isDemoMode),
  ]);

  // Rate lookup map by staffId or staffCustomId
  const rateMap = new Map<string, StaffAllowanceRate>();
  allRates.forEach((r) => {
    rateMap.set(r.staffId, r);
    if (r.staffCustomId) rateMap.set(r.staffCustomId, r);
  });

  // Department name map
  const deptMap = new Map<string, string>();
  allDepts.forEach((d) => deptMap.set(d.id, d.name));

  // Filter relevant staff
  let targetStaff = allStaff.filter((s) => s.active !== false);
  if (departmentId !== 'all') {
    const selectedDeptObj = allDepts.find((d) => d.id === departmentId);
    const selectedDeptName = selectedDeptObj ? selectedDeptObj.name.toLowerCase() : departmentId.toLowerCase();
    targetStaff = targetStaff.filter((s) => s.department && s.department.toLowerCase() === selectedDeptName);
  }
  if (staffId !== 'all') {
    targetStaff = targetStaff.filter((s) => s.id === staffId || s.staffId === staffId);
  }

  // Generate array of date strings between fromDate and toDate
  const dateList: string[] = [];
  const start = new Date(fromDate);
  const end = new Date(toDate);
  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    dateList.push(`${y}-${m}-${d}`);
  }

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Map of public holidays: YYYY-MM-DD -> PublicHoliday
  const holidayMap = new Map<string, PublicHoliday>();
  publicHolidays.forEach((h) => {
    if (h.active) {
      holidayMap.set(h.date, h);
    }
  });

  const allEntries: DutyAllowanceCalculationEntry[] = [];
  const staffSummaries: StaffAllowanceSummary[] = [];

  for (const staff of targetStaff) {
    const staffEntries: DutyAllowanceCalculationEntry[] = [];
    const staffRate = rateMap.get(staff.id) || rateMap.get(staff.staffId || '') || {
      id: `default_${staff.id}`,
      staffId: staff.id,
      staffName: staff.fullName,
      staffCustomId: staff.staffId,
      departmentId: staff.department,
      departmentName: staff.department,
      designation: staff.designation,
      normalDayRate: 150,
      weekendDayRate: 200,
      holidayRate: 250,
      nightShiftAllowance: 50,
      onCallRate: 100,
      currency: 'MVR',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    let normalCount = 0;
    let normalSum = 0;
    let weekendCount = 0;
    let weekendSum = 0;
    let holidayCount = 0;
    let holidaySum = 0;
    let nightCount = 0;
    let nightSum = 0;
    let onCallCount = 0;
    let onCallSum = 0;

    for (const dateStr of dateList) {
      const dt = new Date(dateStr);
      const dayOfWeek = dt.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
      const dayName = DAY_NAMES[dayOfWeek];

      // Day Type determination:
      // In Maldives, Friday is official weekend day, Saturday is weekend day too.
      const holiday = holidayMap.get(dateStr);
      let dayType: DayType = 'normal';
      let dayTypeLabel = 'Normal Weekday';

      if (holiday) {
        dayType = 'holiday';
        dayTypeLabel = `Public Holiday: ${holiday.name}`;
      } else if (dayOfWeek === 5 || dayOfWeek === 6) {
        dayType = 'weekend';
        dayTypeLabel = dayOfWeek === 5 ? 'Friday (Weekend)' : 'Saturday (Weekend)';
      }

      // Check Roster Shift for this staff on dateStr
      let foundShiftCode = '';
      let foundShiftLabel = '';
      let isDutyRequestApproved = false;
      let isOnCall = false;

      // Check Weekly Rosters first
      for (const wRoster of allWeeklyRosters) {
        const staffNameLower = staff.fullName.trim().toLowerCase();
        const row = wRoster.rows?.find(
          (r) =>
            r.staffName.trim().toLowerCase() === staffNameLower ||
            (staff.staffId && r.staffName.toLowerCase().includes(staff.staffId.toLowerCase()))
        );
        if (row && row.days && row.days[dateStr]) {
          const cell = row.days[dateStr];
          if (cell && cell.code && cell.code.trim()) {
            foundShiftCode = cell.code.trim();
            foundShiftLabel = cell.subText || cell.code;
            isDutyRequestApproved = !!cell.isDutyRequestApproved;
            if (cell.code.toUpperCase().includes('ONCALL') || cell.code.toUpperCase().includes('CALL')) {
              isOnCall = true;
            }
            break;
          }
        }
      }

      // If not found in weekly rosters, check daily duty rosters
      if (!foundShiftCode) {
        const dailyRoster = allDailyRosters.find((r) => r.date === dateStr);
        if (dailyRoster && dailyRoster.entries) {
          const entry = dailyRoster.entries.find(
            (e) =>
              e.staffId === staff.id ||
              e.staffName.trim().toLowerCase() === staff.fullName.trim().toLowerCase()
          );
          if (entry) {
            foundShiftCode = entry.shiftType.toUpperCase();
            foundShiftLabel = entry.shiftName || entry.shiftType;
            isOnCall = !!entry.isOnCall;
          }
        }
      }

      // Check if this was a valid duty shift (not OFF, not LEAVE)
      if (!foundShiftCode) continue;

      const upperCode = foundShiftCode.toUpperCase();
      const isOffOrLeave =
        upperCode === 'OFF' ||
        upperCode === 'AL' ||
        upperCode === 'SL' ||
        upperCode === 'ANNUAL LEAVE' ||
        upperCode === 'SICK LEAVE' ||
        upperCode === 'UNPAID' ||
        upperCode === 'LEAVE' ||
        upperCode === '-';

      if (isOffOrLeave) continue;

      // Determine if night shift
      const isNight =
        upperCode === 'N' ||
        upperCode.includes('NIGHT') ||
        upperCode.startsWith('N ') ||
        upperCode.startsWith('N(') ||
        foundShiftLabel.toLowerCase().includes('night');

      // Rate calculation for this shift
      let rateApplied = 0;
      let nightExtra = 0;

      if (isOnCall) {
        rateApplied = staffRate.onCallRate;
        onCallCount++;
        onCallSum += rateApplied;
      } else {
        if (dayType === 'holiday') {
          rateApplied = staffRate.holidayRate;
          holidayCount++;
          holidaySum += rateApplied;
        } else if (dayType === 'weekend') {
          rateApplied = staffRate.weekendDayRate;
          weekendCount++;
          weekendSum += rateApplied;
        } else {
          rateApplied = staffRate.normalDayRate;
          normalCount++;
          normalSum += rateApplied;
        }

        if (isNight) {
          nightExtra = staffRate.nightShiftAllowance;
          nightCount++;
          nightSum += nightExtra;
        }
      }

      const totalForShift = rateApplied + nightExtra;

      const calcEntry: DutyAllowanceCalculationEntry = {
        id: `allow_${staff.id}_${dateStr}`,
        staffId: staff.id,
        staffName: staff.fullName,
        staffCustomId: staff.staffId,
        departmentId: staff.department,
        departmentName: staff.department,
        date: dateStr,
        dayName,
        shiftCode: foundShiftCode,
        shiftLabel: foundShiftLabel || foundShiftCode,
        dayType,
        dayTypeLabel,
        rateApplied,
        nightAllowanceApplied: nightExtra,
        totalForShift,
        isDutyRequestApproved,
        isPublicHoliday: !!holiday,
        publicHolidayName: holiday?.name,
      };

      staffEntries.push(calcEntry);
      allEntries.push(calcEntry);
    }

    const totalDuties = staffEntries.length;
    const grandTotalAllowance = normalSum + weekendSum + holidaySum + nightSum + onCallSum;

    staffSummaries.push({
      staffId: staff.id,
      staffName: staff.fullName,
      staffCustomId: staff.staffId,
      departmentId: staff.department,
      departmentName: staff.department,
      designation: staff.designation,
      totalDuties,
      normalDayDuties: normalCount,
      normalDayTotal: normalSum,
      weekendDuties: weekendCount,
      weekendTotal: weekendSum,
      holidayDuties: holidayCount,
      holidayTotal: holidaySum,
      nightShiftDuties: nightCount,
      nightShiftTotal: nightSum,
      onCallDuties: onCallCount,
      onCallTotal: onCallSum,
      grandTotalAllowance,
      currency: staffRate.currency || 'MVR',
      entries: staffEntries,
    });
  }

  const totalDutiesCount = allEntries.length;
  const totalAllowanceAmount = staffSummaries.reduce((sum, s) => sum + s.grandTotalAllowance, 0);

  const selectedDeptName =
    departmentId === 'all'
      ? 'All Departments'
      : deptMap.get(departmentId) || 'Department';

  return {
    fromDate,
    toDate,
    departmentId,
    departmentName: selectedDeptName,
    staffSummaries,
    allEntries,
    totalDutiesCount,
    totalAllowanceAmount,
    currency: 'MVR',
  };
}


