import { Staff } from '../types';

export interface ParsedStaffRow {
  rowNumber: number;
  staffId: string;
  fullName: string;
  fullNameDhivehi?: string;
  designation: string;
  designationDhivehi?: string;
  department: string;
  departmentDhivehi?: string;
  phone?: string;
  email?: string;
  roles: string[];
  active: boolean;
  isExisting: boolean;
  existingId?: string;
  isValid: boolean;
  validationError?: string;
}

export interface StaffCsvParseResult {
  rows: ParsedStaffRow[];
  totalRows: number;
  validCount: number;
  newCount: number;
  updateCount: number;
  errorCount: number;
  errors: string[];
}

/**
 * Splits CSV line taking into account double quotes and commas within quotes
 */
function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Detect delimiter: comma, semicolon, or tab
 */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (semiCount > commaCount && semiCount > tabCount) return ';';
  if (tabCount > commaCount && tabCount > semiCount) return '\t';
  return ',';
}

/**
 * Normalize header name for matching
 */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Parses CSV text into validated staff records
 */
export function parseStaffCsv(
  csvText: string,
  existingStaffList: Staff[] = [],
  defaultDepartment = 'Clinical / OPD'
): StaffCsvParseResult {
  // Strip UTF-8 BOM if present
  let cleanText = csvText;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.substring(1);
  }

  const lines = cleanText
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      rows: [],
      totalRows: 0,
      validCount: 0,
      newCount: 0,
      updateCount: 0,
      errorCount: 1,
      errors: ['The CSV file is empty or does not contain header and data rows.'],
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headerCells = parseCsvLine(lines[0], delimiter).map(normalizeHeader);

  // Map header indices
  const findIndex = (...aliases: string[]): number => {
    for (const a of aliases) {
      const cleanAlias = a.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idx = headerCells.findIndex((h) => h === cleanAlias || h.includes(cleanAlias));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idIdx = findIndex('staffid', 'id', 'code', 'employeeid', 'idnumber');
  const nameIdx = findIndex('fullname', 'name', 'staffname', 'employeename');
  const nameDvIdx = findIndex('fullnamedhivehi', 'dhivehiname', 'namedv', 'dvname');
  const desigIdx = findIndex('designation', 'position', 'jobtitle', 'title', 'post');
  const desigDvIdx = findIndex('designationdhivehi', 'positiondv', 'dhivehidesignation');
  const deptIdx = findIndex('department', 'dept', 'section', 'ward', 'division');
  const deptDvIdx = findIndex('departmentdhivehi', 'deptdv', 'dhivehidepartment');
  const phoneIdx = findIndex('phone', 'mobile', 'contact', 'tel', 'phonenumber');
  const emailIdx = findIndex('email', 'mail', 'emailaddress');
  const rolesIdx = findIndex('roles', 'role', 'permissions', 'assignedroles');
  const activeIdx = findIndex('active', 'status', 'isactive', 'enabled');

  if (nameIdx === -1) {
    return {
      rows: [],
      totalRows: 0,
      validCount: 0,
      newCount: 0,
      updateCount: 0,
      errorCount: 1,
      errors: ['Could not find a "Full Name" or "Name" column in the CSV header.'],
    };
  }

  // Pre-calculate existing IDs map for fast lookup
  const existingMap = new Map<string, Staff>();
  existingStaffList.forEach((s) => {
    if (s.staffId) {
      existingMap.set(s.staffId.trim().toLowerCase(), s);
    }
  });

  // Calculate highest existing numeric ID for generating missing IDs
  let maxIdNum = 100;
  existingStaffList.forEach((s) => {
    const match = s.staffId.match(/\d+/);
    if (match) {
      const val = parseInt(match[0], 10);
      if (!isNaN(val) && val > maxIdNum) maxIdNum = val;
    }
  });

  const parsedRows: ParsedStaffRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.trim()) continue;

    const cells = parseCsvLine(rawLine, delimiter);
    const getCell = (idx: number): string => (idx !== -1 && cells[idx] !== undefined ? cells[idx].trim() : '');

    const fullName = getCell(nameIdx);
    if (!fullName) {
      parsedRows.push({
        rowNumber: i + 1,
        staffId: getCell(idIdx) || `MHC-${++maxIdNum}`,
        fullName: '(Empty Name)',
        designation: getCell(desigIdx) || 'Staff',
        department: getCell(deptIdx) || defaultDepartment,
        roles: ['staff'],
        active: true,
        isExisting: false,
        isValid: false,
        validationError: 'Full Name is required and cannot be empty.',
      });
      continue;
    }

    let staffId = getCell(idIdx);
    if (!staffId) {
      maxIdNum++;
      staffId = `MHC-${maxIdNum}`;
    }

    const designation = getCell(desigIdx) || 'Staff Member';
    const department = getCell(deptIdx) || defaultDepartment;
    const fullNameDhivehi = getCell(nameDvIdx) || undefined;
    const designationDhivehi = getCell(desigDvIdx) || undefined;
    const departmentDhivehi = getCell(deptDvIdx) || undefined;
    const phone = getCell(phoneIdx) || undefined;
    const email = getCell(emailIdx) || undefined;

    // Parse roles
    const rawRoles = getCell(rolesIdx);
    let roles: string[] = ['staff'];
    if (rawRoles) {
      const splitted = rawRoles
        .split(/[;,|/]/)
        .map((r) => r.trim().toLowerCase())
        .filter((r) => r.length > 0);

      const validRoles: string[] = [];
      splitted.forEach((r) => {
        if (r.includes('supervis') || r === 'supervisor') validRoles.push('supervisor');
        else if (r.includes('roster') || r.includes('manager') || r === 'roster_manager') validRoles.push('roster_manager');
        else if (r.includes('admin')) validRoles.push('admin');
        else if (r.includes('clinical') || r.includes('in-charge') || r.includes('incharge')) validRoles.push('Clinical In-Charge');
        else if (r.includes('call') || r.includes('emergency')) validRoles.push('On-Call Officer');
        else if (r.includes('pharmacy')) validRoles.push('Pharmacy In-Charge');
        else if (r.includes('lab')) validRoles.push('Lab Lead');
        else validRoles.push(r);
      });

      if (validRoles.length > 0) {
        // Guarantee 'staff' is present if not already
        if (!validRoles.includes('staff')) validRoles.push('staff');
        roles = Array.from(new Set(validRoles));
      }
    }

    // Active status
    const rawActive = getCell(activeIdx).toLowerCase();
    const active =
      rawActive === '' ||
      rawActive === 'true' ||
      rawActive === '1' ||
      rawActive === 'yes' ||
      rawActive === 'active' ||
      rawActive === 'y';

    const existingMatch = existingMap.get(staffId.toLowerCase());
    const isExisting = Boolean(existingMatch);

    parsedRows.push({
      rowNumber: i + 1,
      staffId,
      fullName,
      fullNameDhivehi,
      designation,
      designationDhivehi,
      department,
      departmentDhivehi,
      phone,
      email,
      roles,
      active,
      isExisting,
      existingId: existingMatch?.id,
      isValid: true,
    });
  }

  const validRows = parsedRows.filter((r) => r.isValid);
  const newCount = validRows.filter((r) => !r.isExisting).length;
  const updateCount = validRows.filter((r) => r.isExisting).length;
  const errorCount = parsedRows.filter((r) => !r.isValid).length;

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validCount: validRows.length,
    newCount,
    updateCount,
    errorCount,
    errors,
  };
}

/**
 * Generates an official sample CSV template with pre-filled examples
 */
export function generateSampleStaffCsv(): string {
  const headers = [
    'Staff ID',
    'Full Name',
    'Full Name Dhivehi',
    'Designation',
    'Designation Dhivehi',
    'Department',
    'Phone',
    'Email',
    'Roles',
    'Active',
  ];

  const sampleRows = [
    [
      'MHC-101',
      'Dr. Aminath Rasheed',
      'ޑރ. އާމިނަތު ރަޝީދު',
      'Senior Medical Officer',
      'ސީނިއަރ މެޑިކަލް އޮފިސަރ',
      'Clinical / OPD',
      '7712345',
      'aminath.rasheed@mhc.gov.mv',
      'supervisor; staff',
      'true',
    ],
    [
      'MHC-102',
      'Fathimath Ali',
      'ފާޠިމަތު ޢަލީ',
      'Registered Nurse',
      'ރެޖިސްޓާރޑް ނާރސް',
      'Nursing',
      '7723456',
      'fathimath.ali@mhc.gov.mv',
      'staff',
      'true',
    ],
    [
      'MHC-103',
      'Ahmed Hassan',
      'އަޙްމަދު ޙަސަން',
      'Senior Administrative Officer',
      'ސީނިއަރ އެޑްމިނިސްޓްރޭޓިވް އޮފިސަރ',
      'Administration',
      '7734567',
      'ahmed.hassan@mhc.gov.mv',
      'admin; staff',
      'true',
    ],
    [
      'MHC-104',
      'Mariyam Shifna',
      'މަރްޔަމް ޝިފްނާ',
      'Pharmacy In-Charge',
      'ފާމަސީ އިންޗާރޖް',
      'Pharmacy',
      '7745678',
      'mariyam.shifna@mhc.gov.mv',
      'Pharmacy In-Charge; staff',
      'true',
    ],
    [
      'MHC-105',
      'Ibrahim Naeem',
      'އިބްރާހީމް ނަޢީމް',
      'Senior Medical Laboratory Technologist',
      'ސީނިއަރ މެޑިކަލް ލެބޯރެޓަރީ ޓެކްނޮލޮޖިސްޓް',
      'Laboratory',
      '7756789',
      'ibrahim.naeem@mhc.gov.mv',
      'Lab Lead; staff',
      'true',
    ],
  ];

  const escapeCell = (val: string): string => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...sampleRows.map((row) => row.map(escapeCell).join(',')),
  ].join('\r\n');

  return csvContent;
}

/**
 * Triggers browser download of sample staff CSV template
 */
export function downloadStaffCsvTemplate(): void {
  const content = generateSampleStaffCsv();
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mhc_staff_import_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports current staff directory as a clean CSV file
 */
export function exportStaffListToCsv(staffList: Staff[]): void {
  const headers = [
    'Staff ID',
    'Full Name',
    'Full Name Dhivehi',
    'Designation',
    'Designation Dhivehi',
    'Department',
    'Department Dhivehi',
    'Phone',
    'Email',
    'Roles',
    'Has User Account',
    'Username',
    'Active',
  ];

  const escapeCell = (val: string | undefined | null): string => {
    if (!val) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = staffList.map((s) => [
    escapeCell(s.staffId),
    escapeCell(s.fullName),
    escapeCell(s.fullNameDhivehi || ''),
    escapeCell(s.designation),
    escapeCell(s.designationDhivehi || ''),
    escapeCell(s.department),
    escapeCell(s.departmentDhivehi || ''),
    escapeCell(s.phone || ''),
    escapeCell(s.email || ''),
    escapeCell((s.roles || ['staff']).join('; ')),
    escapeCell(s.hasUserAccount ? 'Yes' : 'No'),
    escapeCell(s.username || ''),
    escapeCell(s.active ? 'Active' : 'Inactive'),
  ]);

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().split('T')[0];
  a.download = `mhc_staff_directory_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
