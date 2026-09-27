import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  WeeklyDepartmentRoster,
  LeaveRecord,
  AppSettings,
  PublicHoliday,
} from '../types';
import { formatFullCurrentDate, formatLiveClock, getTodayString } from './dateUtils';

interface ExportRosterOptions {
  rosters: WeeklyDepartmentRoster[];
  settings?: AppSettings;
  generatedBy?: string;
  publicHolidays?: PublicHoliday[];
  filename?: string;
}

interface ExportLeaveOptions {
  leaveRecords: LeaveRecord[];
  settings?: AppSettings;
  generatedBy?: string;
  activeTab?: 'current' | 'upcoming' | 'history' | 'all';
  departmentFilter?: string;
  categoryFilter?: string;
  dateRangeStr?: string;
  filename?: string;
}

interface CombinedExportOptions {
  rosters: WeeklyDepartmentRoster[];
  leaveRecords: LeaveRecord[];
  settings?: AppSettings;
  generatedBy?: string;
  publicHolidays?: PublicHoliday[];
}

/**
 * Calculates calendar days difference inclusive
 */
function calculateDays(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 1;
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return isNaN(diffDays) ? 1 : diffDays;
}

/**
 * Formats YYYY-MM-DD to DD-MMM-YYYY for official reports
 */
function formatReportDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = parseInt(parts[1], 10) - 1;
    return `${parts[2]}-${months[monthIdx] || parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

/**
 * EXPORT 1: Weekly Duty Roster to Official PDF
 */
export async function exportWeeklyDutyRosterToPdf({
  rosters,
  settings,
  generatedBy = 'System Administrator',
  publicHolidays = [],
  filename,
}: ExportRosterOptions): Promise<void> {
  if (!rosters || rosters.length === 0) {
    throw new Error('No duty roster data available to export.');
  }

  // Create landscape A4 PDF document
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const tz = settings?.timezone || 'Indian/Maldives';
  const now = new Date();
  const dateStr = formatFullCurrentDate(now, tz);
  const timeStr = formatLiveClock(now, '24h', tz);
  const orgName = settings?.orgName || 'Maduvvari Health Centre';

  rosters.forEach((roster, rosterIndex) => {
    if (rosterIndex > 0) {
      doc.addPage('a4', 'landscape');
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. Top Decorative Header Bar
    doc.setFillColor(13, 148, 136); // #0d9488 Teal
    doc.rect(0, 0, pageWidth, 8, 'F');

    // 2. Organization & Government Identity
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('REPUBLIC OF MALDIVES  •  MINISTRY OF HEALTH', 14, 15);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(orgName.toUpperCase(), 14, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Clinical Operations & Medical Administration Department', 14, 27);

    // Right-side document metadata badge
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(pageWidth - 85, 11, 71, 18, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(pageWidth - 85, 11, 71, 18, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('OFFICIAL RECORD', pageWidth - 81, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Generated: ${dateStr}`, pageWidth - 81, 21);
    doc.text(`Time: ${timeStr} (24hr) • By: ${generatedBy}`, pageWidth - 81, 25);

    // 3. Document Title Banner
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 32, pageWidth - 28, 12, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, 32, pageWidth - 28, 12, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(13, 148, 136);
    doc.text(`DEPARTMENT DUTY ROSTER: ${roster.categoryName.toUpperCase()}`, 18, 39.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const weekLabel = roster.weekRangeText || `${formatReportDate(roster.startDate)} to ${formatReportDate(roster.endDate)}`;
    doc.text(`Schedule Period: ${weekLabel}`, pageWidth - 18, 39.5, { align: 'right' });

    // 4. Build Table Columns & Headers
    const days = roster.days || [];
    const tableHead: string[] = ['#', 'Staff ID', 'Staff Name & Designation'];

    days.forEach((day) => {
      const holiday = publicHolidays.find(
        (h) => h.active && (h.date === day.dateStr || (h.isRecurring && h.date.slice(5) === day.dateStr.slice(5)))
      );
      const dayShort = day.dayName.slice(0, 3).toUpperCase();
      const datePart = day.formattedDate.split(' ')[0] || day.dateStr.slice(5);
      const label = holiday ? `${dayShort}\n${datePart}\n*PH*` : `${dayShort}\n${datePart}`;
      tableHead.push(label);
    });

    tableHead.push('Shifts');
    tableHead.push('Off');

    // 5. Build Table Rows
    const tableBody: any[] = [];
    (roster.rows || []).forEach((row, idx) => {
      let shiftCount = 0;
      let offCount = 0;

      const rowData: string[] = [
        String(idx + 1),
        row.id?.startsWith('MHC-') ? row.id : `STF-${idx + 101}`,
        `${row.staffName}\n(${row.designation || 'Staff'})`,
      ];

      days.forEach((day) => {
        const cell = row.days?.[day.dateStr];
        const code = cell?.code || '-';

        if (code === 'OFF') {
          offCount++;
          rowData.push('OFF');
        } else if (code === '-' || !code) {
          rowData.push('-');
        } else {
          shiftCount++;
          if (cell?.isOnCall || code.includes('ONCALL')) {
            rowData.push(`${code}\n(Call)`);
          } else if (cell?.subText) {
            rowData.push(`${code}\n${cell.subText}`);
          } else {
            rowData.push(code);
          }
        }
      });

      rowData.push(String(shiftCount));
      rowData.push(String(offCount));
      tableBody.push(rowData);
    });

    // Night on-call rotation row if present
    if (roster.nightOnCallByDay && Object.keys(roster.nightOnCallByDay).length > 0) {
      const callRow: string[] = ['★', 'ON-CALL', 'Night Emergency Rotation'];
      days.forEach((day) => {
        const onCallItem = roster.nightOnCallByDay[day.dateStr];
        callRow.push(onCallItem?.name ? `${onCallItem.name}` : '-');
      });
      callRow.push('-', '-');
      tableBody.push(callRow);
    }

    // 6. Render autoTable
    autoTable(doc, {
      startY: 47,
      head: [tableHead],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        halign: 'center',
        valign: 'middle',
        lineColor: [203, 213, 225],
        lineWidth: 0.15,
        textColor: [15, 23, 42],
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [15, 23, 42], // Slate-900
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 46, halign: 'left', fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didParseCell: (data) => {
        // Highlight On-Call summary row
        if (data.row.raw && data.row.raw[0] === '★') {
          data.cell.styles.fillColor = [254, 242, 242]; // rose-50
          data.cell.styles.textColor = [190, 18, 60]; // rose-700
          data.cell.styles.fontStyle = 'bold';
        }
        // Highlight cell values
        if (typeof data.cell.raw === 'string') {
          if (data.cell.raw === 'OFF') {
            data.cell.styles.textColor = [100, 116, 139];
          } else if (data.cell.raw.startsWith('M')) {
            data.cell.styles.textColor = [4, 120, 87]; // emerald-700
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw.startsWith('E')) {
            data.cell.styles.textColor = [3, 105, 161]; // sky-700
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw.startsWith('N')) {
            data.cell.styles.textColor = [67, 56, 202]; // indigo-700
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    // 7. Legend & Shift Timing Guide
    const finalY = (doc as any).lastAutoTable?.finalY || 140;
    const legendY = Math.min(finalY + 4, pageHeight - 34);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('SHIFT LEGEND & WORKING HOURS:', 14, legendY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const legendText =
      'M: Morning Shift (07:45 - 15:45)  •  E: Evening Shift (15:45 - 23:00)  •  N: Night Shift (23:00 - 08:00)  •  OFF: Scheduled Off-Duty  •  ON-CALL: Night Emergency Rotation  •  *PH*: Public Holiday';
    doc.text(legendText, 66, legendY);

    // 8. Official Verification Sign-Off Footer
    const signY = pageHeight - 20;

    doc.setDrawColor(203, 213, 225);
    doc.line(14, signY - 6, pageWidth - 14, signY - 6);

    const signColWidth = (pageWidth - 28) / 3;

    // Column 1: Prepared By
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('1. PREPARED BY:', 14, signY - 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Roster Supervisor / In-Charge', 14, signY + 3);
    doc.text('Signature: __________________________', 14, signY + 8);
    doc.text('Date: ______________________________', 14, signY + 12);

    // Column 2: Checked By
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('2. CHECKED & VERIFIED BY:', 14 + signColWidth, signY - 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Senior Administration / Human Resources', 14 + signColWidth, signY + 3);
    doc.text('Signature: __________________________', 14 + signColWidth, signY + 8);
    doc.text('Date: ______________________________', 14 + signColWidth, signY + 12);

    // Column 3: Approved By
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('3. APPROVED BY (OFFICIAL SEAL):', 14 + signColWidth * 2, signY - 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Director / Medical Officer In-Charge', 14 + signColWidth * 2, signY + 3);
    doc.text('Signature: __________________________', 14 + signColWidth * 2, signY + 8);
    doc.text('Seal & Date: ________________________', 14 + signColWidth * 2, signY + 12);

    // Page number bottom right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Sheet ${rosterIndex + 1} of ${rosters.length} • Maduvvari Health Centre Official Electronic Record System`,
      pageWidth / 2,
      pageHeight - 3,
      { align: 'center' }
    );
  });

  const exportName =
    filename ||
    `MHC_Weekly_Duty_Roster_${rosters[0]?.startDate || getTodayString(tz)}.pdf`;
  doc.save(exportName);
}

/**
 * EXPORT 2: Staff Leave Schedule & Absence Records to Official PDF
 */
export async function exportStaffLeaveScheduleToPdf({
  leaveRecords,
  settings,
  generatedBy = 'System Administrator',
  activeTab = 'current',
  departmentFilter = 'all',
  categoryFilter = 'all',
  dateRangeStr,
  filename,
}: ExportLeaveOptions): Promise<void> {
  if (!leaveRecords) {
    throw new Error('No leave records provided to export.');
  }

  // Create landscape A4 PDF for wide, readable columns
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const tz = settings?.timezone || 'Indian/Maldives';
  const now = new Date();
  const dateStr = formatFullCurrentDate(now, tz);
  const timeStr = formatLiveClock(now, '24h', tz);
  const orgName = settings?.orgName || 'Maduvvari Health Centre';
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Top Decorative Bar
  doc.setFillColor(13, 148, 136); // #0d9488 Teal
  doc.rect(0, 0, pageWidth, 8, 'F');

  // 2. Organization Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('REPUBLIC OF MALDIVES  •  MINISTRY OF HEALTH', 14, 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(orgName.toUpperCase(), 14, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Human Resources & Staff Attendance Department', 14, 27);

  // Right-side document metadata badge
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(pageWidth - 85, 11, 71, 18, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(pageWidth - 85, 11, 71, 18, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('OFFICIAL RECORD', pageWidth - 81, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated: ${dateStr}`, pageWidth - 81, 21);
  doc.text(`Time: ${timeStr} (24hr) • By: ${generatedBy}`, pageWidth - 81, 25);

  // 3. Document Title Banner
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 32, pageWidth - 28, 12, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 32, pageWidth - 28, 12, 'S');

  let reportTitle = 'STAFF LEAVE SCHEDULE & ABSENCE RECORD';
  if (activeTab === 'current') {
    reportTitle = 'OFFICIAL RECORD OF STAFF CURRENTLY ON LEAVE (TODAY)';
  } else if (activeTab === 'upcoming') {
    reportTitle = 'SCHEDULED UPCOMING STAFF LEAVES & ABSENCE PLAN';
  } else if (activeTab === 'history') {
    reportTitle = 'OFFICIAL STAFF LEAVE DIRECTORY & HISTORICAL LOGS';
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(13, 148, 136);
  doc.text(reportTitle, 18, 39.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const filterSummary = `Dept: ${departmentFilter === 'all' ? 'All Departments' : departmentFilter}  •  Category: ${categoryFilter === 'all' ? 'All Categories' : categoryFilter}`;
  doc.text(filterSummary, pageWidth - 18, 39.5, { align: 'right' });

  // 4. Summary KPI Metrics Badges
  const totalCount = leaveRecords.length;
  const annualCount = leaveRecords.filter((r) => r.categoryName.toLowerCase().includes('annual')).length;
  const sickCount = leaveRecords.filter((r) => r.categoryName.toLowerCase().includes('sick')).length;
  const frCount = leaveRecords.filter((r) => r.categoryName.toLowerCase().includes('f.r') || r.categoryName.toLowerCase().includes('family')).length;
  const otherCount = totalCount - (annualCount + sickCount + frCount);

  const kpiBoxY = 47;
  const kpiBoxHeight = 11;
  const kpiBoxWidth = (pageWidth - 28 - 12) / 5;

  const kpiItems = [
    { label: 'TOTAL ON LEAVE', count: totalCount, color: [13, 148, 136] },
    { label: 'ANNUAL LEAVE', count: annualCount, color: [2, 132, 199] },
    { label: 'SICK LEAVE', count: sickCount, color: [225, 29, 72] },
    { label: 'FAMILY / F.R LEAVE', count: frCount, color: [217, 119, 6] },
    { label: 'OTHER CATEGORIES', count: Math.max(0, otherCount), color: [100, 116, 139] },
  ];

  kpiItems.forEach((kpi, i) => {
    const x = 14 + i * (kpiBoxWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, kpiBoxY, kpiBoxWidth, kpiBoxHeight, 1.5, 1.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, kpiBoxY, kpiBoxWidth, kpiBoxHeight, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.label, x + 3, kpiBoxY + 4.5);

    doc.setFont('helvetica', 'black');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(String(kpi.count), x + kpiBoxWidth - 4, kpiBoxY + 8.5, { align: 'right' });
  });

  // 5. Table Rows & Columns
  const tableHead = [
    '#',
    'Staff ID',
    'Full Name',
    'Designation',
    'Department',
    'Leave Category',
    'Start Date',
    'End Date',
    'Days',
    'Expected Return',
    'Status',
  ];

  const tableBody = leaveRecords.map((rec, idx) => {
    const days = calculateDays(rec.startDate, rec.endDate);
    return [
      String(idx + 1),
      rec.staffCustomId || rec.staffId || '-',
      rec.staffName || '-',
      rec.staffDesignation || '-',
      rec.staffDepartment || '-',
      rec.categoryName || '-',
      formatReportDate(rec.startDate),
      formatReportDate(rec.endDate),
      `${days} d`,
      rec.expectedReturnDate ? formatReportDate(rec.expectedReturnDate) : '-',
      (rec.status || 'approved').toUpperCase(),
    ];
  });

  // If empty
  if (tableBody.length === 0) {
    tableBody.push(['-', '-', 'No leave records match the selected criteria', '-', '-', '-', '-', '-', '-', '-', '-']);
  }

  autoTable(doc, {
    startY: 62,
    head: [tableHead],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      valign: 'middle',
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      textColor: [15, 23, 42],
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 38, fontStyle: 'bold' },
      3: { cellWidth: 36 },
      4: { cellWidth: 28 },
      5: { cellWidth: 26, fontStyle: 'bold' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 22, halign: 'center' },
      8: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      9: { cellWidth: 24, halign: 'center' },
      10: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      // Category colors
      if (data.column.index === 5 && typeof data.cell.raw === 'string') {
        const cat = data.cell.raw.toLowerCase();
        if (cat.includes('sick')) {
          data.cell.styles.textColor = [190, 18, 60];
        } else if (cat.includes('annual')) {
          data.cell.styles.textColor = [2, 132, 199];
        } else if (cat.includes('f.r') || cat.includes('family')) {
          data.cell.styles.textColor = [180, 83, 9];
        }
      }
      // Status pill style
      if (data.column.index === 10 && typeof data.cell.raw === 'string') {
        if (data.cell.raw === 'APPROVED') {
          data.cell.styles.textColor = [4, 120, 87];
        } else if (data.cell.raw === 'CANCELLED') {
          data.cell.styles.textColor = [156, 163, 175];
        } else {
          data.cell.styles.textColor = [180, 83, 9];
        }
      }
    },
  });

  // 6. Sign-off Footer
  const signY = pageHeight - 20;

  doc.setDrawColor(203, 213, 225);
  doc.line(14, signY - 6, pageWidth - 14, signY - 6);

  const signColWidth = (pageWidth - 28) / 3;

  // Column 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. PREPARED & SUBMITTED BY:', 14, signY - 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('HR Attendance / Records Officer', 14, signY + 3);
  doc.text('Signature: __________________________', 14, signY + 8);
  doc.text('Date: ______________________________', 14, signY + 12);

  // Column 2
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. VERIFIED BY SECTION SUPERVISOR:', 14 + signColWidth, signY - 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Clinical / Administrative In-Charge', 14 + signColWidth, signY + 3);
  doc.text('Signature: __________________________', 14 + signColWidth, signY + 8);
  doc.text('Date: ______________________________', 14 + signColWidth, signY + 12);

  // Column 3
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. APPROVED BY (DIRECTOR / IN-CHARGE):', 14 + signColWidth * 2, signY - 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Director / Medical Officer In-Charge', 14 + signColWidth * 2, signY + 3);
  doc.text('Signature: __________________________', 14 + signColWidth * 2, signY + 8);
  doc.text('Official Seal & Date: ________________', 14 + signColWidth * 2, signY + 12);

  // Page number footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Maduvvari Health Centre Official Electronic Record System • Total Records: ${totalCount}`,
    pageWidth / 2,
    pageHeight - 3,
    { align: 'center' }
  );

  const exportName =
    filename ||
    `MHC_Staff_Leave_Schedule_${activeTab}_${getTodayString(tz)}.pdf`;
  doc.save(exportName);
}

/**
 * EXPORT 3: Combined Comprehensive Operations Record (Weekly Rosters + Leave Schedule)
 */
export async function exportCombinedRosterAndLeavePdf({
  rosters,
  leaveRecords,
  settings,
  generatedBy = 'System Administrator',
  publicHolidays = [],
}: CombinedExportOptions): Promise<void> {
  const tz = settings?.timezone || 'Indian/Maldives';
  const todayStr = getTodayString(tz);

  // Export Weekly Duty Rosters
  await exportWeeklyDutyRosterToPdf({
    rosters,
    settings,
    generatedBy,
    publicHolidays,
    filename: `MHC_Comprehensive_Weekly_Rosters_${todayStr}.pdf`,
  });

  // Export Leave Schedule
  await exportStaffLeaveScheduleToPdf({
    leaveRecords,
    settings,
    generatedBy,
    activeTab: 'all',
    filename: `MHC_Comprehensive_Leave_Schedule_${todayStr}.pdf`,
  });
}
