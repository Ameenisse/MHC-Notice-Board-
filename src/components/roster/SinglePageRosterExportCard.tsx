import React from 'react';
import {
  WeeklyDepartmentRoster,
  WeeklyRosterShiftCell,
  PublicHoliday,
} from '../../types';
import {
  Sun,
  Sunset,
  Moon,
  Phone,
  Calendar,
  Sparkles,
  Building,
  Palmtree,
  ShieldAlert,
} from 'lucide-react';

interface SinglePageRosterExportCardProps {
  roster: WeeklyDepartmentRoster;
  publicHolidays?: PublicHoliday[];
  cardRef?: React.RefObject<HTMLDivElement | null>;
}

export const SinglePageRosterExportCard: React.FC<SinglePageRosterExportCardProps> = ({
  roster,
  publicHolidays = [],
  cardRef,
}) => {
  // Helper to check if a day matches an active public holiday
  const getHolidayForDay = (dateStr: string) => {
    return publicHolidays.find(
      (h) => h.active && (h.date === dateStr || (h.isRecurring && h.date.slice(5) === dateStr.slice(5)))
    );
  };

  const renderBadge = (cell?: WeeklyRosterShiftCell) => {
    if (!cell || !cell.code) {
      return <span className="text-slate-500 font-bold text-xs">-</span>;
    }

    const code = cell.code.trim();
    const isApprovedDutyChange = !!cell.isDutyRequestApproved;

    if (code === 'ANNUAL LEAVE' || code === 'AL' || code.includes('ANNUAL')) {
      return (
        <div className="flex flex-col items-center justify-center leading-none">
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black border ${
            isApprovedDutyChange ? 'bg-red-950 text-red-500 border-red-500' : 'bg-teal-500 text-slate-950 border-teal-300'
          }`}>
            🌴 {isApprovedDutyChange ? <span className="text-red-500 font-black">AL</span> : 'AL'}
          </span>
          <span className={`text-[7.5px] font-bold mt-0.5 ${isApprovedDutyChange ? 'text-red-400 font-black' : 'text-teal-300'}`}>
            {isApprovedDutyChange ? 'Duty Req' : 'Annual'}
          </span>
        </div>
      );
    }

    if (code === 'SICK LEAVE' || code === 'SL' || code.includes('SICK')) {
      return (
        <div className="flex flex-col items-center justify-center leading-none">
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black border ${
            isApprovedDutyChange ? 'bg-red-950 text-red-500 border-red-500' : 'bg-rose-500 text-white border-rose-300'
          }`}>
            <span className={isApprovedDutyChange ? 'text-red-500 font-black' : ''}>SL</span>
          </span>
          <span className={`text-[7.5px] font-bold mt-0.5 ${isApprovedDutyChange ? 'text-red-400 font-black' : 'text-rose-300'}`}>
            {isApprovedDutyChange ? 'Duty Req' : 'Sick'}
          </span>
        </div>
      );
    }

    if (code === 'OFF') {
      return (
        <div className="flex flex-col items-center justify-center leading-none">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black border ${
            isApprovedDutyChange ? 'bg-red-950 text-red-500 border-red-500 ring-1 ring-red-500' : 'text-slate-300 bg-slate-800 border-slate-600'
          }`}>
            OFF
          </span>
          {isApprovedDutyChange && (
            <span className="text-[7px] font-black text-red-400 uppercase mt-0.5">Approved</span>
          )}
        </div>
      );
    }

    const isMorning = code === 'M' || code === '1' || code.startsWith('1');
    const isEvening = code === 'E' || code === '2' || code.startsWith('2') || code.includes('FRL');
    const isNight = code === 'N';
    const isOnCall = cell.isOnCall || code.includes('ONCALL') || cell.subText?.includes('ONCALL');

    let bg = isApprovedDutyChange
      ? 'bg-red-950 text-red-500 border-red-500 ring-1 ring-red-500 font-black'
      : 'bg-slate-800 text-slate-100 border-slate-700';
    let icon = null;

    if (isOnCall) {
      bg = isApprovedDutyChange
        ? 'bg-red-950 text-red-500 border-red-500 font-black'
        : 'bg-rose-900 text-rose-100 border-rose-500';
      icon = <Phone className={`w-2.5 h-2.5 shrink-0 ${isApprovedDutyChange ? 'text-red-500' : ''}`} />;
    } else if (isNight) {
      bg = isApprovedDutyChange
        ? 'bg-red-950 text-red-500 border-red-500 font-black'
        : 'bg-indigo-900 text-indigo-100 border-indigo-500';
      icon = <Moon className={`w-2.5 h-2.5 shrink-0 ${isApprovedDutyChange ? 'text-red-500' : ''}`} />;
    } else if (isEvening) {
      bg = isApprovedDutyChange
        ? 'bg-red-950 text-red-500 border-red-500 font-black'
        : 'bg-sky-900 text-sky-100 border-sky-500';
      icon = <Sunset className={`w-2.5 h-2.5 shrink-0 ${isApprovedDutyChange ? 'text-red-500' : ''}`} />;
    } else if (isMorning) {
      bg = isApprovedDutyChange
        ? 'bg-red-950 text-red-500 border-red-500 font-black'
        : 'bg-emerald-900 text-emerald-100 border-emerald-500';
      icon = <Sun className={`w-2.5 h-2.5 shrink-0 ${isApprovedDutyChange ? 'text-red-500' : ''}`} />;
    }

    return (
      <div className="flex flex-col items-center justify-center gap-0.5 leading-none">
        <span className={`inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-black border ${bg}`}>
          {icon}
          <span className={isApprovedDutyChange ? 'text-red-500 font-black' : ''}>{code}</span>
        </span>
        {isApprovedDutyChange ? (
          <span className="text-[7.5px] font-black text-red-400 uppercase mt-0.5">Approved</span>
        ) : cell.subText ? (
          <span className="text-[8px] font-bold text-amber-300 truncate max-w-[60px] mt-0.5">
            {cell.subText}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div
      ref={cardRef as any}
      style={{ width: '1240px' }}
      className="bg-slate-950 text-slate-100 p-6 rounded-2xl border-2 border-slate-800 shadow-2xl font-sans"
    >
      {/* Official Header Banner */}
      <div className="flex items-center justify-between pb-4 border-b-2 border-teal-600/60 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border-2 border-teal-500/50 flex items-center justify-center p-2">
            <img src="/mhc-logo.svg" alt="MHC Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">
                MADUVVARI HEALTH CENTRE
              </h1>
              <span className="text-sm font-bold text-teal-400 font-thaana">
                މަޑުއްވަރީ ޞިއްޙީ މަރުކަޒު
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-extrabold text-teal-300">
                Department of {roster.categoryName} - Official Duty Roster
              </span>
              {roster.categoryNameDhivehi && (
                <span className="text-xs font-semibold text-teal-400 font-thaana">
                  ({roster.categoryNameDhivehi})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Schedule & Metadata */}
        <div className="text-right">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-950 border border-teal-600/70 text-teal-200 text-xs font-bold">
            <Calendar className="w-3.5 h-3.5 text-teal-400" />
            <span>{roster.weekRangeText}</span>
          </div>
          <p className="text-[11px] font-bold text-slate-400 mt-1">
            24/7 Clinical &amp; Administrative Coverage &bull; Phone: 6580043
          </p>
        </div>
      </div>

      {/* Roster Spreadsheet Grid - Structured to fit in ONE page */}
      <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900/90 mb-4">
        <table className="w-full table-fixed text-left border-collapse">
          <thead>
            <tr className="bg-slate-950 text-slate-300 text-xs font-extrabold uppercase tracking-wider border-b border-slate-700">
              <th className="p-2 w-[4%] text-center text-slate-500">#</th>
              <th className="p-2 w-[22%]">Staff Member</th>
              {roster.days.map((day) => {
                const holiday = getHolidayForDay(day.dateStr);

                return (
                  <th
                    key={day.dateStr}
                    className={`p-1.5 text-center w-[9.5%] border-x transition ${
                      holiday
                        ? 'bg-amber-950/90 text-amber-200 border-amber-500/80 shadow-inner'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 leading-tight">
                      {holiday && <Sparkles className="w-3 h-3 text-amber-400 inline shrink-0 animate-pulse" />}
                      <span className={`text-xs font-black ${holiday ? 'text-amber-300' : 'text-slate-100'}`}>
                        {day.dayName.slice(0, 3)}
                      </span>
                    </div>
                    <div className={`text-[10px] font-bold ${holiday ? 'text-amber-200' : 'text-slate-400'} leading-tight`}>
                      {day.formattedDate.split(' ')[0]}
                    </div>
                    {holiday && (
                      <div className="mt-1">
                        <span
                          className="inline-block px-1 py-0.5 rounded bg-amber-500 text-slate-950 text-[8px] font-black uppercase tracking-tighter leading-none truncate max-w-full"
                          title={holiday.name}
                        >
                          HOLIDAY
                        </span>
                      </div>
                    )}
                  </th>
                );
              })}
              <th className="p-1.5 text-center text-slate-400 border-l border-slate-800 text-[10px] font-extrabold w-[4.5%]">
                OFF
              </th>
              <th className="p-1.5 text-center text-emerald-400 text-[10px] font-extrabold w-[4.5%]">
                M
              </th>
              <th className="p-1.5 text-center text-sky-400 text-[10px] font-extrabold w-[4.5%]">
                E
              </th>
              <th className="p-1.5 text-center text-indigo-400 text-[10px] font-extrabold w-[4.5%]">
                N
              </th>
              <th className="p-1.5 text-center text-amber-400 text-[10px] font-extrabold w-[4.5%]">
                HOL
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/80 text-xs font-semibold">
            {roster.rows.map((row, idx) => {
              // Calculate holiday shifts for this row
              const holidayCount = roster.days.reduce((acc, day) => {
                const holiday = getHolidayForDay(day.dateStr);
                const cell = row.days[day.dateStr];
                if (holiday && cell?.code && cell.code !== 'OFF' && !cell.code.includes('LEAVE')) {
                  return acc + 1;
                }
                return acc;
              }, 0);

              return (
                <tr key={row.id} className="hover:bg-slate-800/30">
                  <td className="p-2 text-center text-slate-500 font-bold text-xs">
                    {idx + 1}
                  </td>
                  <td className="p-2 overflow-hidden">
                    <div className="font-extrabold text-white text-xs truncate" title={row.staffName}>
                      {row.staffName}
                    </div>
                    <div className="text-[10px] text-teal-400 font-medium truncate">
                      {row.designation}
                    </div>
                  </td>

                  {roster.days.map((day) => {
                    const cell = row.days[day.dateStr];
                    const holiday = getHolidayForDay(day.dateStr);

                    return (
                      <td
                        key={day.dateStr}
                        className={`p-1.5 text-center align-middle border-x ${
                          holiday
                            ? 'bg-amber-950/20 border-amber-600/40'
                            : 'border-slate-800/50'
                        }`}
                      >
                        {renderBadge(cell)}
                      </td>
                    );
                  })}

                  <td className="p-1.5 text-center font-bold text-slate-300 border-l border-slate-800 bg-slate-950/40 text-xs">
                    {row.stats?.holidays ?? '-'}
                  </td>
                  <td className="p-1.5 text-center font-bold text-emerald-400 bg-slate-950/40 text-xs">
                    {row.stats?.mShifts ?? '-'}
                  </td>
                  <td className="p-1.5 text-center font-bold text-sky-400 bg-slate-950/40 text-xs">
                    {row.stats?.eShifts ?? '-'}
                  </td>
                  <td className="p-1.5 text-center font-bold text-indigo-400 bg-slate-950/40 text-xs">
                    {row.stats?.nShifts ?? '-'}
                  </td>
                  <td className="p-1.5 text-center font-bold text-amber-300 bg-amber-950/20 text-xs">
                    {holidayCount || '-'}
                  </td>
                </tr>
              );
            })}

            {/* NIGHT ON-CALL ROW FOOTER */}
            <tr className="bg-rose-950/60 border-t-2 border-rose-500 text-rose-200">
              <td className="p-2 text-center text-rose-400">
                <Phone className="w-4 h-4 mx-auto" />
              </td>
              <td className="p-2">
                <div className="font-extrabold text-xs text-rose-300 uppercase tracking-wide">
                  Night On-Call
                </div>
                <div className="text-[9px] text-rose-400 font-semibold">
                  24/7 Clinical Emergency
                </div>
              </td>
              {roster.days.map((day) => {
                const onCall = roster.nightOnCallByDay[day.dateStr];
                const holiday = getHolidayForDay(day.dateStr);

                return (
                  <td
                    key={day.dateStr}
                    className={`p-1.5 text-center border-x ${
                      holiday
                        ? 'border-rose-700/60 bg-rose-950/80'
                        : 'border-rose-900/60'
                    }`}
                  >
                    {onCall ? (
                      <div className="truncate">
                        <div className="font-extrabold text-rose-100 text-xs truncate" title={onCall.name}>
                          {onCall.name}
                        </div>
                        {onCall.timing && (
                          <div className="text-[8px] text-rose-300 font-bold truncate">
                            {onCall.timing}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-600 text-xs">-</span>
                    )}
                  </td>
                );
              })}
              <td colSpan={5} className="p-1.5 text-center text-[10px] text-rose-300 font-bold bg-rose-950/80">
                Hospital Hotline: 6580043
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend, Public Holidays Note & Official Signature Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-400">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-300">Shift Codes:</span>
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> M: Morning
          </span>
          <span className="flex items-center gap-1 text-sky-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" /> E: Evening
          </span>
          <span className="flex items-center gap-1 text-indigo-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> N: Night
          </span>
          <span className="flex items-center gap-1 text-teal-300 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> AL: Annual Leave
          </span>
          <span className="flex items-center gap-1 text-rose-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> On-Call
          </span>
          <span className="flex items-center gap-1 text-amber-300 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Public Holiday Column
          </span>
        </div>

        <div className="text-right text-[10px] text-slate-400">
          <span>Prepared by Clinical Supervisor &bull; Approved by MHC Administration</span>
        </div>
      </div>
    </div>
  );
};
