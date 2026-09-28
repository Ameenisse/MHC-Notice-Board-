import {
  Staff,
  LeaveCategory,
  LeaveRecord,
  Notice,
  Department,
  AppSettings,
  PairedDisplay,
  Supervisor,
  DepartmentRoster,
  HospitalMemory,
  AppUser,
  ShiftHandover,
  PublicHoliday,
} from '../types';

export const DEFAULT_CATEGORIES: LeaveCategory[] = [
  {
    id: 'cat_annual',
    name: 'Annual Leave',
    nameDhivehi: 'އަހަރީ ޗުއްޓީ',
    color: '#0d9488', // Teal
    order: 1,
    active: true,
  },
  {
    id: 'cat_sick',
    name: 'Sick Leave',
    nameDhivehi: 'ސަލާމް',
    color: '#e11d48', // Coral / Red-Rose
    order: 2,
    active: true,
  },
  {
    id: 'cat_fr',
    name: 'F.R Leave',
    nameDhivehi: 'އެފް.އާރް ޗުއްޓީ',
    color: '#0284c7', // Sky Blue
    order: 3,
    active: true,
  },
  {
    id: 'cat_maternity',
    name: 'Maternity leave',
    nameDhivehi: 'ވިހެއުމުގެ ޗުއްޓީ',
    color: '#ec4899', // Pink
    order: 4,
    active: true,
  },
  {
    id: 'cat_release',
    name: 'Release',
    nameDhivehi: 'ރިލީޒް',
    color: '#f59e0b', // Amber
    order: 5,
    active: true,
  },
  {
    id: 'cat_nopay',
    name: 'No pay leave',
    nameDhivehi: 'މުސާރަ ނުލިބޭ ޗުއްޓީ',
    color: '#64748b', // Slate
    order: 6,
    active: true,
  },
  {
    id: 'cat_other',
    name: 'Other Leave',
    nameDhivehi: 'އެހެނިހެން ޗުއްޓީ',
    color: '#8b5cf6', // Violet
    order: 7,
    active: true,
  },
];

export const DEFAULT_DEPARTMENTS: Department[] = [
  { id: 'dept_med', name: 'Medical & Clinical', nameDhivehi: 'ކްލިނިކަލް އަދި މެޑިކަލް', order: 1 },
  { id: 'dept_nurs', name: 'Nursing Services', nameDhivehi: 'ނަރުހުންގެ ޚިދުމަތް', order: 2 },
  { id: 'dept_diag', name: 'Diagnostic & Lab', nameDhivehi: 'ލެބޯޓްރީ އަދި ޑައިގްނޮސްޓިކް', order: 3 },
  { id: 'dept_pharm', name: 'Pharmacy', nameDhivehi: 'ފާމަސީ', order: 4 },
  { id: 'dept_ph', name: 'Public Health', nameDhivehi: 'ޢާންމު ޞިއްޙަތު', order: 5 },
  { id: 'dept_admin', name: 'Administration', nameDhivehi: 'އިދާރީ ހިންގުން', order: 6 },
];

export const DEFAULT_SETTINGS: AppSettings = {
  orgName: 'Maduvvari Health Centre',
  orgNameDhivehi: 'މަޑުއްވަރީ ސިއްޙީ މަރުކަޒު',
  logoUrl: '/mhc-logo.svg',
  boardTitle: 'Staff on Leave',
  boardTitleDhivehi: 'ޗުއްޓީގައިވާ މުވައްޒަފުން',
  displayMode: 'alternating',
  layoutMode: 'auto',
  tvSplitEnabled: true,
  tvSplitRatio: '50_50',
  cardsPerPage: 8,
  rotationInterval: 15,
  fallbackRefreshInterval: 60,
  showEmptyCategories: true,
  announcementStripEnabled: false,
  announcementText: '',
  announcementTextDhivehi: '',
  clockFormat: '24h',
  themeColor: '#0d9488',
  themeMode: 'night',
  defaultLanguage: 'en',
  timezone: 'Indian/Maldives',
};

export const DEFAULT_ADMIN_USER: AppUser = {
  id: 'admin',
  username: 'admin',
  pin: '2026',
  fullName: 'System Administrator',
  fullNameDhivehi: 'ސިސްޓަމް އެޑްމިނިސްޓްރޭޓަރ',
  role: 'admin',
  designation: 'Administrator',
  departmentId: 'dept_admin',
  departmentName: 'Administration',
  email: 'ameen.isse@gmail.com',
  active: true,
  createdAt: 1704067200000,
  updatedAt: 1704067200000,
};

export const DEFAULT_SUPER_ADMIN_USER: AppUser = {
  id: 'appadmin',
  username: 'appadmin',
  pin: '2026',
  fullName: 'Super Administrator',
  fullNameDhivehi: 'ސުޕަރ އެޑްމިނިސްޓްރޭޓަރ',
  role: 'admin',
  roles: ['admin', 'supervisor', 'super_admin'],
  designation: 'Super Administrator',
  departmentId: 'dept_admin',
  departmentName: 'Administration',
  email: 'appadmin@mhc.gov.mv',
  active: true,
  createdAt: 1704067200000,
  updatedAt: 1704067200000,
};

// All mock/fake arrays are reset to empty
export const DEMO_STAFF: Staff[] = [];

export function getDemoLeaveRecords(): LeaveRecord[] {
  return [];
}

export const DEMO_NOTICES: Notice[] = [];

export const DEMO_PAIRED_DISPLAYS: PairedDisplay[] = [];

export const DEMO_SUPERVISORS: Supervisor[] = [];

export function getDemoDutyRosters(_tz = 'Indian/Maldives'): DepartmentRoster[] {
  return [];
}

export const DEMO_MEMORIES: HospitalMemory[] = [];

export const DEMO_USERS: AppUser[] = [DEFAULT_ADMIN_USER, DEFAULT_SUPER_ADMIN_USER];

export const DEMO_HANDOVERS: ShiftHandover[] = [];

export const DEFAULT_PUBLIC_HOLIDAYS: PublicHoliday[] = [
  {
    id: 'hol_newyear_2026',
    name: "New Year's Day",
    nameDhivehi: 'އައު އަހަރުގެ ދުވަސް',
    date: '2026-01-01',
    isRecurring: true,
    description: 'Public Holiday',
    active: true,
    createdAt: 1704067200000,
    updatedAt: 1704067200000,
  },
  {
    id: 'hol_eid_fitr_1_2026',
    name: 'Eid al-Fitr (Day 1)',
    nameDhivehi: 'ކުޑަ އީދު ފުރަތަމަ ދުވަސް',
    date: '2026-03-20',
    isRecurring: false,
    description: 'Islamic Holiday',
    active: true,
    createdAt: 1704067200000,
    updatedAt: 1704067200000,
  },
  {
    id: 'hol_labour_2026',
    name: 'Labour Day',
    nameDhivehi: 'މަސައްކަތްތެރިންގެ ދުވަސް',
    date: '2026-05-01',
    isRecurring: true,
    description: 'International Workers Day',
    active: true,
    createdAt: 1704067200000,
    updatedAt: 1704067200000,
  },
  {
    id: 'hol_eid_adha_2026',
    name: 'Eid al-Adha',
    nameDhivehi: 'ބޮޑު އީދު ދުވަސް',
    date: '2026-05-28',
    isRecurring: false,
    description: 'Islamic Holiday',
    active: true,
    createdAt: 1704067200000,
    updatedAt: 1704067200000,
  },
  {
    id: 'hol_indep_2026',
    name: 'Independence Day',
    nameDhivehi: 'މިނިވަން ދުވަސް',
    date: '2026-07-26',
    isRecurring: true,
    description: 'Maldives Independence Day',
    active: true,
    createdAt: 1704067200000,
    updatedAt: 1704067200000,
  },
  {
    id: 'hol_national_2026',
    name: 'National Day (Qaumee Dhuvas)',
    nameDhivehi: 'ދިވެހިރާއްޖޭގެ ޤައުމީ ދުވަސް',
    date: '2026-09-22',
    isRecurring: false,
    description: 'Maldives National Day - Special Roster Public Holiday',
    active: true,
    createdAt: 1704067200000,
    updatedAt: 1704067200000,
  },
  {
    id: 'hol_victory_2026',
    name: 'Victory Day',
    nameDhivehi: 'ނަޞްރުގެ ދުވަސް',
    date: '2026-11-03',
    isRecurring: true,
    description: 'National Memorial Day',
    active: true,
    createdAt: 1704067200000,
    updatedAt: 1704067200000,
  },
  {
    id: 'hol_republic_2026',
    name: 'Republic Day',
    nameDhivehi: 'ޖުމްހޫރީ ދުވަސް',
    date: '2026-11-11',
    isRecurring: true,
    description: 'Republic of Maldives Day',
    active: true,
    createdAt: 1704067200000,
    updatedAt: 1704067200000,
  },
];
