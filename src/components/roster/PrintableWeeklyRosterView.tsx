import React, { useState, useEffect } from 'react';
import {
  Printer,
  ArrowLeft,
  Settings2,
  Check,
  Building,
  Calendar,
  Layers,
  Sparkles,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import {
  WeeklyDepartmentRoster,
  PublicHoliday,
  AppSettings,
} from '../../types';
import { formatFullCurrentDate, formatLiveClock } from '../../utils/dateUtils';

interface PrintableWeeklyRosterViewProps {
  rosters: WeeklyDepartmentRoster[];
  currentDateStr: string;
  settings?: AppSettings;
  publicHolidays?: PublicHoliday[];
  onClose: () => void;
  initialDepartmentId?: string;
  generatedBy?: string;
}

export const PrintableWeeklyRosterView: React.FC<PrintableWeeklyRosterViewProps> = ({
  rosters,
  currentDateStr,
  settings,
  publicHolidays = [],
  onClose,
  initialDepartmentId = 'all',
  generatedBy = 'System Administrator',
}) => {
  const [selectedDeptId, setSelectedDeptId] = useState<string>(initialDepartmentId);
  const [density, setDensity] = useState<'compact' | 'standard'>('compact');
  const [showSignatures, setShowSignatures] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [showOnCallRow, setShowOnCallRow] = useState<boolean>(true);
  const [showStaffId, setShowStaffId] = useState<boolean>(true);
  const [showHolidays, setShowHolidays] = useState<boolean>(true);

  const tz = settings?.timezone || 'Indian/Maldives';
  const orgName = settings?.orgName || 'Maduvvari Health Centre';
  const now = new Date();
  const printDateStr = formatFullCurrentDate(now, tz);
  const printTimeStr = formatLiveClock(now, '24h', tz);

  // Filter rosters based on selection
  const displayedRosters =
    selectedDeptId === 'all'
      ? rosters
      : rosters.filter((r) => r.id === selectedDeptId || r.categoryName.toLowerCase() === selectedDeptId.toLowerCase());

  // Keyboard shortcut listener: Cmd/Ctrl + P triggers print, Escape exits
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans print:bg-white print:p-0">
      {/* 1. TOP INTERACTIVE CONTROL STRIP (AUTOMATICALLY HIDDEN ON PRINT) */}
      <div className="no-print sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-800 shadow-lg px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="Return to Duty Roster Editor (or press Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Exit Print View</span>
          </button>

          <div>
            <h1 className="text-sm font-black text-white flex items-center gap-2">
              <span>Printable Weekly Duty Roster</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-900/80 text-teal-300 border border-teal-700/60">
                Landscape A4
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Clean layout optimized for physical printing with automatic page breaks per department
            </p>
          </div>
        </div>

        {/* Center: Department Selection & Density */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
            <Building className="w-3.5 h-3.5 text-teal-400" />
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="all" className="bg-slate-800 text-white">
                All Departments ({rosters.length} Sheets)
              </option>
              {rosters.map((r) => (
                <option key={r.id} value={r.id} className="bg-slate-800 text-white">
                  {r.categoryName} ({r.rows?.length || 0} Staff)
                </option>
              ))}
            </select>
          </div>

          {/* Density Toggle */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
            <button
              type="button"
              onClick={() => setDensity('compact')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                density === 'compact'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Compact spacing to ensure all rows fit on a single page"
            >
              Compact (1-Page Fit)
            </button>
            <button
              type="button"
              onClick={() => setDensity('standard')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                density === 'standard'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Standard roomy row spacing"
            >
              Standard
            </button>
          </div>

          {/* Quick Toggles */}
          <div className="hidden lg:flex items-center gap-3 text-xs text-slate-300">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showSignatures}
                onChange={(e) => setShowSignatures(e.target.checked)}
                className="w-3.5 h-3.5 text-teal-600 rounded-sm focus:ring-teal-500"
              />
              <span>Sign-off Blocks</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showLegend}
                onChange={(e) => setShowLegend(e.target.checked)}
                className="w-3.5 h-3.5 text-teal-600 rounded-sm focus:ring-teal-500"
              />
              <span>Shift Legend</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnCallRow}
                onChange={(e) => setShowOnCallRow(e.target.checked)}
                className="w-3.5 h-3.5 text-teal-600 rounded-sm focus:ring-teal-500"
              />
              <span>On-Call Row</span>
            </label>
          </div>
        </div>

        {/* Right: Print Action Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs transition flex items-center gap-2 shadow-md cursor-pointer hover:scale-102"
          >
            <Printer className="w-4 h-4" />
            <span>Print Roster Now</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] bg-teal-700/80 rounded font-mono">
              ⌘P
            </kbd>
          </button>
        </div>
      </div>

      {/* 2. PRINTABLE DOCUMENT BODY */}
      <div className="flex-1 w-full max-w-[1280px] mx-auto p-4 sm:p-8 space-y-8 print:p-0 print:m-0 print:max-w-none">
        {displayedRosters.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-300 shadow-xs">
            <p className="text-base font-bold text-slate-700">No duty roster found for the selected department.</p>
            <button
              onClick={() => setSelectedDeptId('all')}
              className="mt-3 px-4 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-bold"
            >
              Show All Departments
            </button>
          </div>
        ) : (
          displayedRosters.map((roster, rosterIdx) => {
            const days = roster.days || [];
            const weekRange =
              roster.weekRangeText || `${roster.startDate} to ${roster.endDate}`;

            return (
              <div
                key={roster.id || rosterIdx}
                className="print-sheet page-sheet bg-white p-6 sm:p-8 rounded-2xl border border-slate-300 shadow-md print:shadow-none print:border-none print:p-0 print:m-0 flex flex-col justify-between"
                style={{
                  pageBreakAfter: rosterIdx < displayedRosters.length - 1 ? 'always' : 'auto',
                  breakAfter: rosterIdx < displayedRosters.length - 1 ? 'page' : 'auto',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                }}
              >
                <div>
                  {/* Official Government & Health Centre Header */}
                  <div className="border-b-2 border-slate-900 pb-3 mb-3 flex items-start justify-between">
                    <div>
                      <div className="text-[9px] font-black tracking-widest text-slate-600 uppercase">
                        REPUBLIC OF MALDIVES &bull; MINISTRY OF HEALTH
                      </div>
                      <h1 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-tight leading-tight mt-0.5">
                        {orgName}
                      </h1>
                      <p className="text-[11px] font-bold text-slate-700 mt-0.5">
                        Clinical Operations & Medical Administration Department
                      </p>
                    </div>

                    <div className="text-right border border-slate-300 bg-slate-50 px-3 py-1.5 rounded-lg">
                      <div className="text-[9px] font-black text-slate-800 tracking-wider">
                        OFFICIAL RECORD
                      </div>
                      <div className="text-[10px] text-slate-600 font-medium mt-0.5">
                        Generated: <span className="font-bold text-slate-900">{printDateStr}</span>
                      </div>
                      <div className="text-[9.5px] text-slate-500">
                        Time: {printTimeStr} (24hr) &bull; By: {generatedBy}
                      </div>
                    </div>
                  </div>

                  {/* Title Banner */}
                  <div className="bg-slate-100 border border-slate-300 px-4 py-2 rounded-lg mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-teal-600 inline-block print:bg-slate-900" />
                      <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                        DEPARTMENT DUTY ROSTER: {roster.categoryName}
                      </h2>
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      Schedule Period: <span className="text-slate-950">{weekRange}</span>
                    </div>
                  </div>

                  {/* Roster Spreadsheet Table */}
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <table className="w-full border-collapse text-center">
                      <thead>
                        <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                          <th className="py-2 px-1.5 w-8 border-r border-slate-700">#</th>
                          {showStaffId && (
                            <th className="py-2 px-2 w-20 border-r border-slate-700">Staff ID</th>
                          )}
                          <th className="py-2 px-3 text-left w-56 border-r border-slate-700">
                            Staff Name & Designation
                          </th>
                          {days.map((day) => {
                            const holiday = showHolidays
                              ? publicHolidays.find(
                                  (h) =>
                                    h.active &&
                                    (h.date === day.dateStr ||
                                      (h.isRecurring && h.date.slice(5) === day.dateStr.slice(5)))
                                )
                              : null;
                            const dayShort = day.dayName.slice(0, 3).toUpperCase();
                            const dateShort = day.formattedDate.split(' ')[0] || day.dateStr.slice(5);

                            return (
                              <th
                                key={day.dateStr}
                                className={`py-1.5 px-1 border-r border-slate-700 font-bold ${
                                  holiday ? 'bg-amber-950/80 text-amber-200' : ''
                                }`}
                              >
                                <div className="leading-tight">
                                  <div>{dayShort}</div>
                                  <div className="text-[9px] opacity-80">{dateShort}</div>
                                  {holiday && (
                                    <div className="text-[7.5px] font-black text-amber-300">*PH*</div>
                                  )}
                                </div>
                              </th>
                            );
                          })}
                          <th className="py-2 px-1.5 w-14 border-r border-slate-700 bg-slate-800">
                            Shifts
                          </th>
                          <th className="py-2 px-1.5 w-12 bg-slate-800">Off</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200 text-slate-900 text-[10px]">
                        {(roster.rows || []).map((row, rowIdx) => {
                          let shiftCount = 0;
                          let offCount = 0;

                          return (
                            <tr
                              key={row.id || rowIdx}
                              className={rowIdx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                            >
                              {/* Row Index */}
                              <td
                                className={`py-1.5 px-1 text-slate-500 font-mono border-r border-slate-200 ${
                                  density === 'compact' ? 'py-1' : 'py-2'
                                }`}
                              >
                                {rowIdx + 1}
                              </td>

                              {/* Staff ID */}
                              {showStaffId && (
                                <td
                                  className={`px-1.5 font-mono font-bold text-slate-700 border-r border-slate-200 ${
                                    density === 'compact' ? 'py-1' : 'py-2'
                                  }`}
                                >
                                  {row.id?.startsWith('MHC-') ? row.id : `STF-${rowIdx + 101}`}
                                </td>
                              )}

                              {/* Staff Name & Designation */}
                              <td
                                className={`px-2.5 text-left border-r border-slate-200 ${
                                  density === 'compact' ? 'py-1' : 'py-2'
                                }`}
                              >
                                <div className="font-black text-slate-950 leading-tight">
                                  {row.staffName}
                                </div>
                                <div className="text-[9px] text-slate-600 font-medium leading-none mt-0.5">
                                  {row.designation || 'Staff Member'}
                                </div>
                              </td>

                              {/* Day Shift Cells */}
                              {days.map((day) => {
                                const cell = row.days?.[day.dateStr];
                                const code = cell?.code || '-';

                                if (code === 'OFF') {
                                  offCount++;
                                } else if (code !== '-' && code) {
                                  shiftCount++;
                                }

                                const isMorning = code.startsWith('M') || code === '1';
                                const isEvening = code.startsWith('E') || code === '2';
                                const isNight = code.startsWith('N');
                                const isOnCall = cell?.isOnCall || code.includes('ONCALL');
                                const isLeave = code.includes('AL') || code.includes('SL') || code.includes('LEAVE');

                                return (
                                  <td
                                    key={day.dateStr}
                                    className={`px-1 font-bold border-r border-slate-200 ${
                                      density === 'compact' ? 'py-1' : 'py-2'
                                    }`}
                                  >
                                    {code === 'OFF' ? (
                                      <span className="text-slate-500 font-bold">OFF</span>
                                    ) : code === '-' || !code ? (
                                      <span className="text-slate-300">-</span>
                                    ) : isLeave ? (
                                      <span className="px-1 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                        {code}
                                      </span>
                                    ) : isMorning ? (
                                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black text-emerald-800 bg-emerald-50 border border-emerald-300">
                                        {code}
                                        {isOnCall && <span className="text-[7.5px] block leading-none">Call</span>}
                                      </span>
                                    ) : isEvening ? (
                                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black text-sky-800 bg-sky-50 border border-sky-300">
                                        {code}
                                        {isOnCall && <span className="text-[7.5px] block leading-none">Call</span>}
                                      </span>
                                    ) : isNight ? (
                                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black text-indigo-900 bg-indigo-50 border border-indigo-300">
                                        {code}
                                        {isOnCall && <span className="text-[7.5px] block leading-none">Call</span>}
                                      </span>
                                    ) : (
                                      <span className="px-1 py-0.5 rounded text-[9px] font-bold text-slate-800 bg-slate-100 border border-slate-300">
                                        {code}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}

                              {/* Total Shifts */}
                              <td
                                className={`px-1 font-black text-slate-900 border-r border-slate-200 bg-slate-50/50 ${
                                  density === 'compact' ? 'py-1' : 'py-2'
                                }`}
                              >
                                {shiftCount}
                              </td>

                              {/* Off Duty */}
                              <td
                                className={`px-1 font-bold text-slate-600 bg-slate-50/50 ${
                                  density === 'compact' ? 'py-1' : 'py-2'
                                }`}
                              >
                                {offCount}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Night On-Call Emergency Row */}
                        {showOnCallRow &&
                          roster.nightOnCallByDay &&
                          Object.keys(roster.nightOnCallByDay).length > 0 && (
                            <tr className="bg-rose-50/80 font-bold border-t-2 border-slate-300">
                              <td className="py-1 px-1 border-r border-slate-200 text-rose-600">★</td>
                              {showStaffId && (
                                <td className="py-1 px-1.5 border-r border-slate-200 font-mono text-[9px] text-rose-700">
                                  ON-CALL
                                </td>
                              )}
                              <td className="py-1 px-2.5 text-left border-r border-slate-200 text-rose-900 font-black">
                                Night Emergency On-Call Rotation
                              </td>
                              {days.map((day) => {
                                const onCallItem = roster.nightOnCallByDay[day.dateStr];
                                return (
                                  <td
                                    key={day.dateStr}
                                    className="py-1 px-1 border-r border-slate-200 text-rose-800 font-bold text-[9px]"
                                  >
                                    {onCallItem?.name || '-'}
                                  </td>
                                );
                              })}
                              <td className="border-r border-slate-200 text-slate-400">-</td>
                              <td className="text-slate-400">-</td>
                            </tr>
                          )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Section: Legend + Signatures */}
                <div className="mt-4 pt-3 border-t border-slate-300 space-y-3">
                  {/* Shift Working Hours Legend */}
                  {showLegend && (
                    <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex flex-wrap items-center justify-between text-[8.5px] text-slate-600">
                      <div className="font-bold text-slate-900 mr-2 uppercase">
                        Shift Legend & Working Hours:
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>
                          <strong className="text-emerald-800">M:</strong> Morning Shift (07:45 - 15:45)
                        </span>
                        <span>
                          <strong className="text-sky-800">E:</strong> Evening Shift (15:45 - 23:00)
                        </span>
                        <span>
                          <strong className="text-indigo-900">N:</strong> Night Shift (23:00 - 08:00)
                        </span>
                        <span>
                          <strong className="text-slate-700">OFF:</strong> Scheduled Off-Duty
                        </span>
                        <span>
                          <strong className="text-rose-700">ON-CALL:</strong> Emergency Night Rotation
                        </span>
                        <span>
                          <strong className="text-amber-800">*PH*:</strong> Public Holiday
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 3-Column Official Verification Sign-Off Footer */}
                  {showSignatures && (
                    <div className="grid grid-cols-3 gap-4 pt-1">
                      {/* Box 1: Prepared By */}
                      <div className="border border-slate-300 p-2.5 rounded-lg bg-slate-50/50">
                        <div className="text-[9px] font-black uppercase text-slate-900">
                          1. PREPARED BY:
                        </div>
                        <div className="text-[8.5px] text-slate-600 mt-0.5">
                          Roster In-Charge / Shift Supervisor
                        </div>
                        <div className="mt-4 text-[8.5px] text-slate-500">
                          Signature: __________________________
                        </div>
                        <div className="mt-1 text-[8.5px] text-slate-500">
                          Date: ______________________________
                        </div>
                      </div>

                      {/* Box 2: Checked By */}
                      <div className="border border-slate-300 p-2.5 rounded-lg bg-slate-50/50">
                        <div className="text-[9px] font-black uppercase text-slate-900">
                          2. CHECKED & VERIFIED BY:
                        </div>
                        <div className="text-[8.5px] text-slate-600 mt-0.5">
                          Senior Administration / Human Resources
                        </div>
                        <div className="mt-4 text-[8.5px] text-slate-500">
                          Signature: __________________________
                        </div>
                        <div className="mt-1 text-[8.5px] text-slate-500">
                          Date: ______________________________
                        </div>
                      </div>

                      {/* Box 3: Approved By & Seal */}
                      <div className="border border-slate-300 p-2.5 rounded-lg bg-slate-50/50">
                        <div className="text-[9px] font-black uppercase text-slate-900">
                          3. APPROVED BY (OFFICIAL SEAL):
                        </div>
                        <div className="text-[8.5px] text-slate-600 mt-0.5">
                          Director / Medical Officer In-Charge
                        </div>
                        <div className="mt-4 text-[8.5px] text-slate-500">
                          Signature: __________________________
                        </div>
                        <div className="mt-1 text-[8.5px] text-slate-500">
                          Seal & Date: ________________________
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footnote & Page Number */}
                  <div className="text-center text-[8px] text-slate-400 pt-1">
                    Sheet {rosterIdx + 1} of {displayedRosters.length} &bull; {orgName} Official Electronic Record System
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
