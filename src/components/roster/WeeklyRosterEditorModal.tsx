import React, { useState, useEffect } from 'react';
import {
  WeeklyDepartmentRoster,
  WeeklyRosterRow,
  WeeklyRosterShiftCell,
  Staff,
  PublicHoliday,
  Department,
  RosterDepartmentCategory,
  LeaveRecord,
} from '../../types';
import {
  X,
  Save,
  Plus,
  Trash2,
  Sparkles,
  Calendar,
  Users,
  Palmtree,
  Moon,
  Sun,
  Sunset,
  Phone,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { getLeaveRecordsList } from '../../services/db';

interface WeeklyRosterEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (roster: WeeklyDepartmentRoster) => Promise<void>;
  initialRoster?: WeeklyDepartmentRoster | null;
  staffList: Staff[];
  departments: Department[];
  publicHolidays: PublicHoliday[];
  isDemoMode: boolean;
}

export const WeeklyRosterEditorModal: React.FC<WeeklyRosterEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialRoster,
  staffList,
  departments,
  publicHolidays,
  isDemoMode,
}) => {
  const [category, setCategory] = useState<RosterDepartmentCategory>('attended');
  const [categoryName, setCategoryName] = useState<string>('Attendants');
  const [categoryNameDhivehi, setCategoryNameDhivehi] = useState<string>('އެޓެންޑެންޓުން');
  const [weekRangeText, setWeekRangeText] = useState<string>('20th September 2026 To 26th September 2026');
  const [startDate, setStartDate] = useState<string>('2026-09-20');
  const [endDate, setEndDate] = useState<string>('2026-09-26');

  const [days, setDays] = useState<
    Array<{ dateStr: string; dayName: string; formattedDate: string }>
  >([]);

  const [rows, setRows] = useState<WeeklyRosterRow[]>([]);
  const [nightOnCallByDay, setNightOnCallByDay] = useState<{
    [dateStr: string]: { name: string; timing?: string };
  }>({});

  const [saving, setSaving] = useState(false);
  const [autoSyncingLeaves, setAutoSyncingLeaves] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Generate 7 days array based on startDate
  const generateDaysFromStart = (startStr: string) => {
    try {
      const d = new Date(startStr);
      if (isNaN(d.getTime())) return;
      const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const newDays: Array<{ dateStr: string; dayName: string; formattedDate: string }> = [];

      for (let i = 0; i < 7; i++) {
        const cur = new Date(d);
        cur.setDate(cur.getDate() + i);

        const yyyy = cur.getFullYear();
        const mm = String(cur.getMonth() + 1).padStart(2, '0');
        const dd = String(cur.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const dayName = dayNames[cur.getDay()];
        const formattedDate = `${dd}.${mm}.${yyyy}`;

        newDays.push({ dateStr, dayName, formattedDate });
      }

      setDays(newDays);

      const endD = new Date(d);
      endD.setDate(endD.getDate() + 6);
      const endYyyy = endD.getFullYear();
      const endMm = String(endD.getMonth() + 1).padStart(2, '0');
      const endDd = String(endD.getDate()).padStart(2, '0');
      setEndDate(`${endYyyy}-${endMm}-${endDd}`);

      setWeekRangeText(
        `${d.getDate()}${getOrdinal(d.getDate())} ${monthNames[d.getMonth()]} ${d.getFullYear()} To ${endD.getDate()}${getOrdinal(endD.getDate())} ${monthNames[endD.getMonth()]} ${endD.getFullYear()}`
      );
    } catch (e) {
      console.warn('Date parsing error', e);
    }
  };

  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  // Populate from initial roster or defaults
  useEffect(() => {
    if (initialRoster) {
      setCategory(initialRoster.category);
      setCategoryName(initialRoster.categoryName);
      setCategoryNameDhivehi(initialRoster.categoryNameDhivehi || '');
      setWeekRangeText(initialRoster.weekRangeText);
      setStartDate(initialRoster.startDate);
      setEndDate(initialRoster.endDate);
      setDays(initialRoster.days || []);
      setRows(JSON.parse(JSON.stringify(initialRoster.rows || [])));
      setNightOnCallByDay(initialRoster.nightOnCallByDay || {});
    } else {
      setCategory('attended');
      setCategoryName('Attendants');
      setCategoryNameDhivehi('އެޓެންޑެންޓުން');
      setStartDate('2026-09-20');
      generateDaysFromStart('2026-09-20');

      // Initialize with sample rows from staffList matching department
      const matchingStaff = staffList.slice(0, 6);
      const initialRows: WeeklyRosterRow[] = matchingStaff.map((s, idx) => ({
        id: `row_${Date.now()}_${idx}`,
        staffName: s.fullName,
        designation: s.designation,
        days: {},
      }));
      setRows(initialRows);
      setNightOnCallByDay({});
    }
  }, [initialRoster, isOpen]);

  if (!isOpen) return null;

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    generateDaysFromStart(val);
  };

  const handleCategoryChange = (cat: RosterDepartmentCategory) => {
    setCategory(cat);
    if (cat === 'attended') {
      setCategoryName('Attendants');
      setCategoryNameDhivehi('އެޓެންޑެންޓުން');
    } else if (cat === 'nurses') {
      setCategoryName('Nurses');
      setCategoryNameDhivehi('ނަރުހުން');
    } else if (cat === 'drivers') {
      setCategoryName('Drivers');
      setCategoryNameDhivehi('ޑްރައިވަރުން');
    } else if (cat === 'customer_service') {
      setCategoryName('Customer Service');
      setCategoryNameDhivehi('ކަސްޓަމަރ ސަރވިސް');
    }
  };

  const handleCellCodeChange = (rowId: string, dateStr: string, code: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const newDays = { ...r.days };
        newDays[dateStr] = {
          code,
          isLeave: code.includes('LEAVE') || code === 'AL' || code === 'SL',
          leaveType: code === 'AL' ? 'Annual Leave' : code === 'SL' ? 'Sick Leave' : undefined,
        };
        return { ...r, days: newDays };
      })
    );
  };

  const handleAddRow = () => {
    const newRow: WeeklyRosterRow = {
      id: `row_${Date.now()}_${rows.length}`,
      staffName: staffList[0]?.fullName || 'Staff Member',
      designation: staffList[0]?.designation || 'Healthcare Staff',
      days: {},
    };
    setRows((prev) => [...prev, newRow]);
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const handleSelectStaff = (rowId: string, staffId: string) => {
    const selected = staffList.find((s) => s.id === staffId);
    if (!selected) return;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          staffName: selected.fullName,
          designation: selected.designation,
        };
      })
    );
  };

  // Helper: check if a date is a public holiday
  const getHolidayForDay = (dateStr: string) => {
    return publicHolidays.find(
      (h) => h.active && (h.date === dateStr || (h.isRecurring && h.date.slice(5) === dateStr.slice(5)))
    );
  };

  // Auto-Sync Staff Approved Annual Leaves into Roster
  const handleAutoSyncLeaves = async () => {
    setAutoSyncingLeaves(true);
    try {
      const allLeaves: LeaveRecord[] = await getLeaveRecordsList(isDemoMode);
      const approvedLeaves = allLeaves.filter((l) => l.status === 'approved');

      let syncedCount = 0;

      setRows((prev) =>
        prev.map((row) => {
          const matchedStaffLeaves = approvedLeaves.filter(
            (l) =>
              l.staffName.toLowerCase().trim() === row.staffName.toLowerCase().trim() ||
              l.staffId === row.id
          );

          if (matchedStaffLeaves.length === 0) return row;

          const updatedDays = { ...row.days };

          days.forEach((day) => {
            const hasLeaveOnDay = matchedStaffLeaves.find(
              (l) => day.dateStr >= l.startDate && day.dateStr <= l.endDate
            );

            if (hasLeaveOnDay) {
              const isAnnual =
                hasLeaveOnDay.categoryName.toLowerCase().includes('annual') ||
                hasLeaveOnDay.categoryId === 'cat_annual';
              const code = isAnnual ? 'AL' : 'SL';
              updatedDays[day.dateStr] = {
                code,
                isLeave: true,
                leaveType: hasLeaveOnDay.categoryName,
                customNote: hasLeaveOnDay.categoryName,
              };
              syncedCount++;
            }
          });

          return { ...row, days: updatedDays };
        })
      );

      setSyncFeedback(
        syncedCount > 0
          ? `Successfully synced ${syncedCount} approved leave shift(s) into this roaster!`
          : 'No approved leaves found matching current staff for this schedule week.'
      );
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err) {
      console.error('Error syncing leaves:', err);
      alert('Failed to sync leaves.');
    } finally {
      setAutoSyncingLeaves(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Compute stats for each row
      const processedRows = rows.map((r) => {
        let m = 0,
          eCount = 0,
          n = 0,
          off = 0,
          holidays = 0;

        days.forEach((d) => {
          const code = r.days[d.dateStr]?.code || '';
          const isHoliday = !!getHolidayForDay(d.dateStr);

          if (code === 'M' || code === '1' || code.startsWith('1')) m++;
          else if (code === 'E' || code === '2' || code.startsWith('2')) eCount++;
          else if (code === 'N') n++;
          else if (code === 'OFF') off++;

          if (isHoliday && code && code !== 'OFF' && !code.includes('LEAVE') && code !== 'AL') {
            holidays++;
          }
        });

        return {
          ...r,
          stats: {
            holidays,
            mShifts: m,
            eShifts: eCount,
            nShifts: n,
          },
        };
      });

      const rosterToSave: WeeklyDepartmentRoster = {
        id: initialRoster?.id || `roster_${category}_${startDate}`,
        category,
        categoryName,
        categoryNameDhivehi,
        title: `Official Duty Roster - ${categoryName}`,
        weekRangeText,
        startDate,
        endDate,
        days,
        nightOnCallByDay,
        rows: processedRows,
        updatedAt: Date.now(),
      };

      await onSave(rosterToSave);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save roster');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-6xl my-auto rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                {initialRoster ? `Edit Weekly Duty Roster: ${categoryName}` : 'Create New Weekly Duty Roster'}
              </h2>
              <p className="text-xs text-slate-400">
                Public holidays automatically highlight day columns. Set shifts and Annual Leaves for staff.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Top Controls: Category & Week Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Department Category
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as RosterDepartmentCategory)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-teal-500"
              >
                <option value="attended">Attendants (އެޓެންޑެންޓުން)</option>
                <option value="nurses">Nurses (ނަރުހުން)</option>
                <option value="drivers">Drivers (ޑްރައިވަރުން)</option>
                <option value="customer_service">Customer Service (ކަސްޓަމަރ ސަރވިސް)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Week Start Date (Sunday)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Week Range Heading
              </label>
              <input
                type="text"
                value={weekRangeText}
                onChange={(e) => setWeekRangeText(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-teal-500"
                placeholder="e.g. 20th September 2026 To 26th September 2026"
              />
            </div>
          </div>

          {/* Quick Tools: Sync Leaves & Add Staff */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-teal-950/30 border border-teal-800/40 p-3 rounded-xl">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAutoSyncLeaves}
                disabled={autoSyncingLeaves}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                title="Automatically checks approved annual and sick leaves for this week and populates AL / SL codes into staff cells"
              >
                <Palmtree className="w-3.5 h-3.5" />
                <span>Auto-Sync Staff Annual Leaves</span>
              </button>

              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-teal-400" />
                <span>Add Staff Row</span>
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Quick codes: <span className="text-teal-300 font-bold">AL</span> (Annual Leave) &bull;{' '}
              <span className="text-emerald-400 font-bold">M</span> &bull;{' '}
              <span className="text-sky-400 font-bold">E</span> &bull;{' '}
              <span className="text-indigo-400 font-bold">N</span> &bull;{' '}
              <span className="text-slate-400 font-bold">OFF</span> &bull;{' '}
              <span className="text-rose-400 font-bold">ONCALL</span>
            </div>
          </div>

          {syncFeedback && (
            <div className="p-3 rounded-lg bg-teal-950 border border-teal-500 text-teal-200 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
              <span>{syncFeedback}</span>
            </div>
          )}

          {/* Roster Spreadsheet Grid with Highlighted Public Holiday Day Columns */}
          <div className="border border-slate-700 rounded-xl overflow-x-auto bg-slate-950">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-900 text-slate-300 text-xs font-bold border-b border-slate-700">
                  <th className="p-2 w-10 text-center text-slate-500">#</th>
                  <th className="p-2 w-52">Staff Member</th>
                  {days.map((day) => {
                    const holiday = getHolidayForDay(day.dateStr);

                    return (
                      <th
                        key={day.dateStr}
                        className={`p-2 text-center border-x ${
                          holiday
                            ? 'bg-amber-950/80 text-amber-200 border-amber-500 shadow-inner'
                            : 'border-slate-800'
                        }`}
                        title={holiday ? `Public Holiday: ${holiday.name}` : undefined}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {holiday && <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />}
                          <span className={`text-xs font-black ${holiday ? 'text-amber-300' : ''}`}>
                            {day.dayName.slice(0, 3)}
                          </span>
                        </div>
                        <div className={`text-[10px] ${holiday ? 'text-amber-200 font-bold' : 'text-slate-400'}`}>
                          {day.formattedDate}
                        </div>
                        {holiday && (
                          <span className="inline-block mt-0.5 px-1 py-0.5 rounded bg-amber-500 text-slate-950 text-[8px] font-black uppercase tracking-tight">
                            HOLIDAY
                          </span>
                        )}
                      </th>
                    );
                  })}
                  <th className="p-2 w-10 text-center text-slate-400">Act</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800 text-xs font-medium">
                {rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-900/50">
                    <td className="p-2 text-center text-slate-500 font-bold">{idx + 1}</td>

                    {/* Staff selection */}
                    <td className="p-2">
                      <div className="space-y-1">
                        <select
                          value={staffList.find((s) => s.fullName === row.staffName)?.id || ''}
                          onChange={(e) => handleSelectStaff(row.id, e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none focus:border-teal-500"
                        >
                          <option value="">{row.staffName}</option>
                          {staffList.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.fullName} ({s.designation})
                            </option>
                          ))}
                        </select>
                        <div className="text-[10px] text-teal-400 truncate">{row.designation}</div>
                      </div>
                    </td>

                    {/* Day Cells with quick inputs and highlighted holiday column */}
                    {days.map((day) => {
                      const cell = row.days[day.dateStr] || { code: '' };
                      const holiday = getHolidayForDay(day.dateStr);

                      return (
                        <td
                          key={day.dateStr}
                          className={`p-1.5 text-center border-x ${
                            holiday ? 'bg-amber-950/25 border-amber-600/40' : 'border-slate-800'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="text"
                              value={cell.code}
                              onChange={(e) =>
                                handleCellCodeChange(row.id, day.dateStr, e.target.value.toUpperCase())
                              }
                              placeholder="-"
                              className={`w-14 text-center py-1 rounded text-xs font-black border focus:outline-none ${
                                cell.code === 'AL' || cell.code.includes('ANNUAL')
                                  ? 'bg-teal-900 text-teal-200 border-teal-500'
                                  : cell.code === 'SL' || cell.code.includes('SICK')
                                  ? 'bg-rose-950 text-rose-200 border-rose-600'
                                  : cell.code === 'OFF'
                                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                                  : cell.code === 'M' || cell.code === '1'
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                  : cell.code === 'E' || cell.code === '2'
                                  ? 'bg-sky-950 text-sky-300 border-sky-600'
                                  : cell.code === 'N'
                                  ? 'bg-indigo-950 text-indigo-300 border-indigo-600'
                                  : 'bg-slate-900 text-slate-200 border-slate-700'
                              }`}
                            />

                            {/* Quick shift selector chips */}
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleCellCodeChange(row.id, day.dateStr, 'M')}
                                className="px-1 rounded bg-emerald-950/80 text-emerald-400 text-[9px] font-black hover:bg-emerald-900"
                                title="Morning"
                              >
                                M
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCellCodeChange(row.id, day.dateStr, 'E')}
                                className="px-1 rounded bg-sky-950/80 text-sky-400 text-[9px] font-black hover:bg-sky-900"
                                title="Evening"
                              >
                                E
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCellCodeChange(row.id, day.dateStr, 'N')}
                                className="px-1 rounded bg-indigo-950/80 text-indigo-400 text-[9px] font-black hover:bg-indigo-900"
                                title="Night"
                              >
                                N
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCellCodeChange(row.id, day.dateStr, 'AL')}
                                className="px-1 rounded bg-teal-900 text-teal-300 text-[9px] font-black hover:bg-teal-800"
                                title="Annual Leave"
                              >
                                AL
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCellCodeChange(row.id, day.dateStr, 'OFF')}
                                className="px-1 rounded bg-slate-800 text-slate-400 text-[9px] font-black hover:bg-slate-700"
                                title="Off"
                              >
                                OFF
                              </button>
                            </div>
                          </div>
                        </td>
                      );
                    })}

                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition"
                        title="Remove row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Night On-Call Row Editor */}
                <tr className="bg-rose-950/40 border-t border-rose-600/60 font-bold">
                  <td className="p-2 text-center text-rose-400">
                    <Phone className="w-3.5 h-3.5 mx-auto" />
                  </td>
                  <td className="p-2 text-rose-300 text-xs">
                    <div>NIGHT Oncall</div>
                    <div className="text-[10px] text-rose-400/80 font-normal">24/7 Clinical Emergency</div>
                  </td>
                  {days.map((day) => {
                    const onCall = nightOnCallByDay[day.dateStr] || { name: '', timing: '' };
                    return (
                      <td key={day.dateStr} className="p-1.5 border-x border-rose-900/50">
                        <input
                          type="text"
                          value={onCall.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNightOnCallByDay((prev) => ({
                              ...prev,
                              [day.dateStr]: { ...prev[day.dateStr], name: val },
                            }));
                          }}
                          placeholder="Doctor / Nurse"
                          className="w-full bg-slate-900/80 border border-rose-800/80 rounded px-1.5 py-1 text-[11px] font-bold text-rose-200 focus:outline-none focus:border-rose-500 text-center"
                        />
                      </td>
                    );
                  })}
                  <td className="p-2 text-center text-rose-400 text-[10px]">Call</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Weekly Duty Roster'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
