export interface Staff {
  id: string;
  staffId: string; // e.g. "MHC-001" (unique constraint)
  fullName: string;
  fullNameDhivehi?: string;
  designation: string;
  designationDhivehi?: string;
  department: string;
  departmentDhivehi?: string;
  photoUrl?: string;
  phone?: string;
  email?: string;
  roles?: string[]; // Multiple assigned roles e.g. ['supervisor', 'roster_manager', 'staff', 'Clinical In-Charge']
  hasUserAccount?: boolean;
  userId?: string; // Linked AppUser doc ID
  username?: string; // Linked AppUser username
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface LeaveCategory {
  id: string;
  name: string; // e.g. "Annual Leave", "Sick Leave", "F.R Leave", "Other Leave"
  nameDhivehi?: string;
  color: string; // hex code, e.g. #0d9488
  order: number;
  active: boolean;
}

export type LeaveStatus = 'draft' | 'approved' | 'cancelled';

export interface LeaveRecord {
  id: string;
  staffId: string;
  staffName: string;
  staffCustomId: string;
  staffDesignation: string;
  staffDepartment: string;
  staffPhotoUrl?: string;
  categoryId: string;
  categoryName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  expectedReturnDate?: string; // YYYY-MM-DD
  status: LeaveStatus;
  privateRemarks?: string; // Private admin remarks (excluded from TV projection)
  createdAt: number;
  updatedAt: number;
  approvedBy?: string;
}

// Display-safe projected leave record without private fields
export interface DisplayLeaveCard {
  id: string;
  staffId: string;
  staffName: string;
  staffCustomId: string;
  staffDesignation: string;
  staffDepartment: string;
  staffPhotoUrl?: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  startDate: string;
  endDate: string;
  expectedReturnDate?: string;
  returnsTomorrow: boolean;
}

export type NoticePriority = 'normal' | 'important' | 'urgent';
export type NoticeStatus = 'draft' | 'published' | 'archived';
export type AttachmentType = 'image' | 'pdf' | 'none';

export interface Notice {
  id: string;
  title: string;
  titleDhivehi?: string;
  message: string;
  messageDhivehi?: string;
  priority: NoticePriority;
  publishStart: string; // ISO string or YYYY-MM-DDTHH:mm
  publishEnd: string; // ISO string or YYYY-MM-DDTHH:mm
  status: NoticeStatus;
  attachmentUrl?: string;
  attachmentType?: AttachmentType;
  coverImageUrl?: string;
  attachmentFileName?: string;
  createdAt: number;
  updatedAt: number;
}

export type DisplayMode = 'leave_only' | 'notices_only' | 'alternating' | 'split_screen';
export type DisplaySplitRatio = '50_50' | '55_45' | '45_55' | '60_40';
export type DisplayLayout = 'auto' | 'landscape' | 'portrait';
export type AppLanguage = 'en' | 'dv' | 'both';

export type ShiftType = 'morning' | 'evening' | 'night' | 'on_call' | 'general';

export interface DutyRosterEntry {
  id: string;
  staffId: string;
  staffName: string;
  staffCustomId?: string;
  staffDesignation: string;
  staffPhotoUrl?: string;
  departmentId: string;
  departmentName: string;
  shiftType: ShiftType;
  shiftName: string; // e.g. "Morning Duty", "Evening Duty", "Night Duty", "On-Call / Emergency"
  shiftNameDhivehi?: string;
  startTime: string; // e.g. "08:00"
  endTime: string; // e.g. "15:00"
  station?: string; // e.g. "OPD Room 1", "Triage / ER", "Main Ward", "Lab Station", "Pharmacy Counter"
  isOnCall: boolean;
  supervisorRemarks?: string;
  order: number;
}

export interface DepartmentRoster {
  id: string; // e.g. "2026-09-23_dept-medical"
  date: string; // YYYY-MM-DD
  departmentId: string;
  departmentName: string;
  departmentNameDhivehi?: string;
  supervisorId?: string;
  supervisorName: string;
  supervisorRole?: string;
  status: 'draft' | 'published';
  notes?: string;
  entries: DutyRosterEntry[];
  updatedAt: number;
}

export type RosterDepartmentCategory = 'attended' | 'nurses' | 'drivers' | 'customer_service';

export interface WeeklyRosterShiftCell {
  code: string; // e.g., "M", "E", "N", "OFF", "1", "2", "ONCALL", "E (FRL)", "1 (OPD)", "ANNUAL LEAVE", "SICK LEAVE"
  subText?: string; // e.g. "(00:00-08:00)" or "(OPD)"
  startTime?: string;
  endTime?: string;
  isOnCall?: boolean;
  isLeave?: boolean;
  leaveType?: string;
  customNote?: string;
  isDutyRequestApproved?: boolean; // Highlighted in red text when approved by supervisor
  dutyRequestId?: string;
}

export interface WeeklyRosterRow {
  id: string;
  staffName: string;
  designation: string;
  staffPhotoUrl?: string;
  days: {
    [dayIndexOrDate: string]: WeeklyRosterShiftCell;
  };
  stats?: {
    holidays?: number;
    mShifts?: number;
    eShifts?: number;
    nShifts?: number;
  };
}

export interface WeeklyDepartmentRoster {
  id: string;
  category: RosterDepartmentCategory;
  categoryName: string; // e.g. "Attendants", "Nurses", "Drivers", "Customer Service"
  categoryNameDhivehi?: string;
  title: string;
  weekRangeText: string; // e.g. "20th September 2026 To 26th September 2026"
  startDate: string; // YYYY-MM-DD (Sunday)
  endDate: string; // YYYY-MM-DD (Saturday)
  days: Array<{
    dateStr: string;
    dayName: string; // "SUNDAY", "MONDAY", etc.
    formattedDate: string; // "20-Sep-26" or "20.09.2026"
  }>;
  nightOnCallByDay: {
    [dayIndexOrDate: string]: {
      name: string;
      timing?: string;
    };
  };
  rows: WeeklyRosterRow[];
  updatedAt: number;
}

export interface Supervisor {
  id: string;
  staffId?: string;
  name: string;
  nameDhivehi?: string;
  email: string;
  role: string; // e.g. "Clinical Supervisor", "Nursing In-Charge", "Lab Supervisor", "Chief Pharmacist", "Admin In-Charge"
  departmentId: string;
  departmentName: string;
  phone?: string;
  active: boolean;
  createdAt: number;
}

export interface HospitalMemory {
  id: string;
  title: string;
  titleDhivehi?: string;
  caption: string;
  captionDhivehi?: string;
  imageUrl: string;
  date: string; // YYYY-MM-DD
  category: string; // e.g. "Community Outreach", "Clinical Milestone", "Team Highlight", "Staff Appreciation", "Training & Workshop"
  author?: string;
  active: boolean;
  createdAt: number;
}

export interface Department {
  id: string;
  name: string;
  nameDhivehi?: string;
  order: number;
  code?: string;
  description?: string;
  active?: boolean;
}

export interface AppSettings {
  // Organisation
  orgName: string;
  orgNameDhivehi: string;
  logoUrl: string;
  boardTitle: string;
  boardTitleDhivehi: string;

  // Display Settings
  displayMode: DisplayMode;
  layoutMode: DisplayLayout;
  tvSplitEnabled: boolean; // Screen divided in two: Left for Carousel (Leaves/Notices/Memories), Right for Duty Rosters
  tvSplitRatio: '50_50' | '55_45' | '45_55' | '60_40';
  cardsPerPage: number;
  rotationInterval: number; // in seconds (minimum 5s, default 15s)
  fallbackRefreshInterval: number; // in seconds
  showEmptyCategories: boolean;
  announcementStripEnabled: boolean;
  announcementText: string;
  announcementTextDhivehi: string;
  clockFormat: '12h' | '24h';
  dateFormat?: string;
  themeColor: string; // primary accent
  themeMode?: 'night' | 'day'; // Display mode: 'night' (dark theme) or 'day' (light theme)
  defaultLanguage: AppLanguage;
  timezone: string; // default "Indian/Maldives"
}

export interface PairedDisplay {
  id: string;
  displayName: string;
  token: string;
  pairedAt: number;
  lastSeenAt: number;
  status: 'active' | 'revoked';
  deviceInfo?: string;
}

export interface PairingCode {
  code: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  createdBy?: string;
}
export type PairingCodeRecord = PairingCode;

export interface AdminProfile {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'super_admin';
  createdAt: number;
}

export type AuditTargetType =
  | 'staff'
  | 'leave'
  | 'roster'
  | 'notice'
  | 'settings'
  | 'display'
  | 'auth'
  | 'user'
  | 'system';

export interface AuditLogItem {
  id: string;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  details: string;
  performedBy: string;
  timestamp: number;
  metadata?: Record<string, any>;
}
export type AuditLog = AuditLogItem;

export type UserRole = 'admin' | 'supervisor' | 'staff' | 'roster_manager';

export interface AppUser {
  id: string;
  username: string; // Admin-controlled unique username
  pin: string; // Admin-controlled security PIN / passcode
  fullName: string;
  fullNameDhivehi?: string;
  role: UserRole; // Primary system role: 'admin' | 'supervisor' | 'staff' | 'roster_manager'
  roles?: string[]; // Multiple assigned roles e.g. ['supervisor', 'roster_manager', 'staff']
  departmentId?: string; // Assigned department id
  departmentName?: string; // Assigned department name
  designation?: string; // Professional title or supervisor role
  phone?: string;
  email?: string;
  staffId?: string; // Associated staff profile if linked
  supervisorId?: string; // Linked supervisor record in supervisors collection
  active: boolean;
  notes?: string;
  lastLoginAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ShiftHandover {
  id: string;
  rosterId?: string;
  departmentId: string;
  departmentName: string;
  date: string; // YYYY-MM-DD
  shiftType: ShiftType;
  supervisorName: string;
  supervisorUsername?: string;
  clinicalSummary: string;
  criticalPatientsCount?: number;
  bedOccupancy?: number;
  emergencyEquipmentChecked: boolean;
  pendingLabInvestigations?: string;
  pendingTasks: string;
  outgoingSupervisor: string;
  incomingSupervisor?: string;
  acknowledged: boolean;
  acknowledgedAt?: number;
  timestamp: number;
}

export interface DailyMedia {
  id: string;
  type: 'photo' | 'video';
  mediaUrl: string; // Data URL (Base64) or direct video/image URL
  thumbnailUrl?: string;
  fileName?: string;
  title: string;
  titleDhivehi?: string;
  caption?: string;
  captionDhivehi?: string;
  date: string; // YYYY-MM-DD
  intervalMinutes: number; // default: 60 (appear on full screen every 1hr)
  photoDurationSeconds: number; // default: 60 (disappear after 1min)
  videoDurationSeconds?: number; // duration according to video length in seconds
  playVideoFullLength: boolean; // default: true (disappear after video ends)
  autoPlayMuted: boolean;
  active: boolean;
  isChunked?: boolean;
  totalChunks?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PublicHoliday {
  id: string;
  name: string; // e.g. "Maldives National Day", "Eid al-Fitr", "Independence Day"
  nameDhivehi?: string; // Thaana text e.g. "ޤައުމީ ދުވަސް"
  date: string; // YYYY-MM-DD
  isRecurring?: boolean;
  description?: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export type DutyRequestStatus = 'pending' | 'approved' | 'rejected';
export type DutyRequestShiftChoice = 'morning' | 'evening' | 'night' | 'on_call' | 'off';

export interface DutyRequest {
  id: string;
  staffId: string;
  staffName: string;
  staffCustomId?: string; // e.g. MHC-001
  staffDesignation?: string;
  departmentId: string;
  departmentName: string;
  date: string; // YYYY-MM-DD
  shiftChoice: DutyRequestShiftChoice;
  shiftLabel?: string;
  reason: string;
  notes?: string;
  status: DutyRequestStatus;
  supervisorRemarks?: string;
  reviewedBy?: string;
  reviewedAt?: number;
  rosterUpdated?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type DayType = 'normal' | 'weekend' | 'holiday';

export interface StaffAllowanceRate {
  id: string; // doc ID or staffId
  staffId: string;
  staffName: string;
  staffCustomId?: string; // e.g. MHC-001
  departmentId?: string;
  departmentName?: string;
  designation?: string;
  // Day type rates (in MVR)
  normalDayRate: number;      // Weekday / standard shift rate (e.g. 150 MVR)
  weekendDayRate: number;     // Friday / Weekend shift rate (e.g. 200 MVR)
  holidayRate: number;        // Public Holiday rate (e.g. 250 MVR)
  // Shift type specific additions
  nightShiftAllowance: number; // Additional or separate Night Shift rate (e.g. 50 or 200 MVR)
  onCallRate: number;          // On-call allowance rate (e.g. 100 MVR)
  currency: string;           // default: "MVR"
  notes?: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DutyAllowanceCalculationEntry {
  id: string;
  staffId: string;
  staffName: string;
  staffCustomId?: string;
  departmentId?: string;
  departmentName?: string;
  date: string; // YYYY-MM-DD
  dayName: string; // Sun, Mon, etc.
  shiftCode: string; // e.g. "M", "E", "N", "1", "2", "ONCALL"
  shiftLabel: string; // e.g. "Morning Shift", "Night Duty"
  dayType: DayType; // 'normal' | 'weekend' | 'holiday'
  dayTypeLabel: string; // "Normal Weekday", "Friday/Weekend", "Public Holiday: Eid"
  rateApplied: number; // MVR rate
  nightAllowanceApplied: number; // MVR extra
  totalForShift: number; // MVR total
  isDutyRequestApproved?: boolean;
  isPublicHoliday?: boolean;
  publicHolidayName?: string;
  notes?: string;
}

export interface StaffAllowanceSummary {
  staffId: string;
  staffName: string;
  staffCustomId?: string;
  departmentId?: string;
  departmentName?: string;
  designation?: string;
  totalDuties: number;
  normalDayDuties: number;
  normalDayTotal: number;
  weekendDuties: number;
  weekendTotal: number;
  holidayDuties: number;
  holidayTotal: number;
  nightShiftDuties: number;
  nightShiftTotal: number;
  onCallDuties: number;
  onCallTotal: number;
  grandTotalAllowance: number;
  currency: string;
  entries: DutyAllowanceCalculationEntry[];
}

export interface DutyAllowanceSheet {
  id: string;
  title: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  departmentId?: string; // 'all' or specific
  departmentName?: string;
  staffId?: string; // 'all' or specific
  staffSummaries: StaffAllowanceSummary[];
  totalDutiesCount: number;
  totalAllowanceAmount: number;
  currency: string;
  generatedBy: string; // Supervisor name
  supervisorId?: string;
  status: 'draft' | 'verified' | 'submitted' | 'approved';
  notes?: string;
  createdAt: number;
  updatedAt: number;
}


