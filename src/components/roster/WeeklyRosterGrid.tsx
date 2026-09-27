import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  WeeklyDepartmentRoster,
  WeeklyRosterRow,
  WeeklyRosterShiftCell,
  RosterDepartmentCategory,
  PublicHoliday,
} from '../../types';
import {
  Sun,
  Sunset,
  Moon,
  Phone,
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  Printer,
  Sparkles,
  Users,
  ShieldAlert,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Share2,
  Palmtree,
  Loader2,
  FileText,
} from 'lucide-react';
import { getPublicHolidaysList } from '../../services/db';
import { SinglePageRosterExportCard } from './SinglePageRosterExportCard';
import { RosterShareModal } from './RosterShareModal';
import { downloadRosterAsImage, shareRosterAsImage } from '../../utils/rosterImageExporter';
import { exportWeeklyDutyRosterToPdf } from '../../utils/pdfExport';
import { toBlob, toPng } from 'html-to-image';

interface WeeklyRosterGridProps {
  rosters: WeeklyDepartmentRoster[];
  currentDateStr?: string; // e.g. "2026-09-23"
  isTvMode?: boolean;
  onPrint?: (deptId?: string) => void;
  onImportSample?: () => void;
  publicHolidays?: PublicHoliday[];
}

export const WeeklyRosterGrid: React.FC<WeeklyRosterGridProps> = ({
  rosters,
  currentDateStr = '2026-09-23',
  isTvMode = false,
  onPrint,
  onImportSample,
  publicHolidays: propHolidays,
}) => {
  const { settings, isDemoMode } = useApp();
  const isNightMode = settings?.themeMode !== 'day';
  const [activeCategory, setActiveCategory] = useState<RosterDepartmentCategory | 'all'>('attended');

  // Public Holidays
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>(propHolidays || []);

  useEffect(() => {
    if (propHolidays && propHolidays.length > 0) {
      setPublicHolidays(propHolidays);
      return;
    }
    const loadHolidays = async () => {
      try {
        const list = await getPublicHolidaysList(isDemoMode);
        setPublicHolidays(list);
      } catch (err) {
        console.error('Error fetching public holidays for roster grid:', err);
      }
    };
    loadHolidays();
  }, [propHolidays, isDemoMode]);

  // Export & Share State
  const [exportingRoster, setExportingRoster] = useState<WeeklyDepartmentRoster | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [sharedRoster, setSharedRoster] = useState<WeeklyDepartmentRoster | null>(null);
  const [sharedImageBlob, setSharedImageBlob] = useState<Blob | null>(null);
  const [sharedImageUrl, setSharedImageUrl] = useState<string | null>(null);

  // Hidden offscreen container reference for clean 1-page image capture
  const exportCardRef = useRef<HTMLDivElement>(null);

  const filteredRosters = activeCategory === 'all'
    ? rosters
    : rosters.filter((r) => r.category === activeCategory);

  const getHolidayForDay = (dateStr: string) => {
    return publicHolidays.find(
      (h) => h.active && (h.date === dateStr || (h.isRecurring && h.date.slice(5) === dateStr.slice(5)))
    );
  };

  const getShiftBadge = (cell?: WeeklyRosterShiftCell) => {
    if (!cell || !cell.code) {
      return <span className="text-slate-600 text-[10px] font-bold">-</span>;
    }

    const code = cell.code.trim();
    const isApprovedDutyChange = !!cell.isDutyRequestApproved;

    // Annual Leave (AL)
    if (code === 'ANNUAL LEAVE' || code === 'AL' || code.includes('ANNUAL')) {
      return (
        <div className="flex flex-col items-center justify-center gap-0.5 leading-none" title={cell.customNote || 'Annual Leave'}>
          <span className={`inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-black uppercase tracking-tight border shadow-2xs leading-tight ${
            isApprovedDutyChange
              ? 'text-red-500 bg-red-950/40 border-red-500 ring-1 ring-red-500/70 font-extrabold'
              : 'bg-teal-500/25 text-teal-300 border-teal-500/60'
          }`}>
            <Palmtree className={`w-2.5 h-2.5 ${isApprovedDutyChange ? 'text-red-500' : 'text-teal-300'} shrink-0`} />
            <span className={isApprovedDutyChange ? 'text-red-500 font-extrabold' : ''}>AL</span>
          </span>
          <span className={`text-[8px] sm:text-[9px] font-bold leading-none tracking-tight ${isApprovedDutyChange ? 'text-red-400 font-extrabold' : 'text-teal-400'}`}>
            {isApprovedDutyChange ? 'Duty Req' : 'Annual'}
          </span>
        </div>
      );
    }

    // Sick Leave (SL)
    if (code === 'SICK LEAVE' || code === 'SL' || code.includes('SICK')) {
      return (
        <div className="flex flex-col items-center justify-center gap-0.5 leading-none" title={cell.customNote || 'Sick Leave'}>
          <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-black uppercase tracking-tight border leading-tight ${
            isApprovedDutyChange
              ? 'text-red-500 bg-red-950/40 border-red-500 ring-1 ring-red-500/70 font-extrabold'
              : 'bg-rose-500/20 text-rose-300 border-rose-500/50'
          }`}>
            SL
          </span>
          <span className={`text-[8px] sm:text-[9px] font-bold leading-none tracking-tight ${isApprovedDutyChange ? 'text-red-400 font-extrabold' : 'text-rose-400'}`}>
            {isApprovedDutyChange ? 'Duty Req' : 'Sick'}
          </span>
        </div>
      );
    }

    // OFF Day
    if (code === 'OFF') {
      return (
        <div className="flex flex-col items-center justify-center gap-0.5 leading-none" title={cell.customNote || (isApprovedDutyChange ? 'Off Day (Duty Request Approved)' : 'Off Day')}>
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border leading-none ${
            isApprovedDutyChange
              ? 'text-red-500 font-extrabold bg-red-950/50 border-red-500 ring-1 ring-red-500/80 shadow-xs'
              : 'text-slate-400 bg-slate-800/80 border-slate-700/60'
          }`}>
            OFF
          </span>
          {isApprovedDutyChange && (
            <span className="text-[7.5px] sm:text-[8px] font-black text-red-400 uppercase tracking-tighter leading-none mt-0.5">
              Req Approved
            </span>
          )}
        </div>
      );
    }

    const isMorning = code === 'M' || code === '1' || code.startsWith('1');
    const isEvening = code === 'E' || code === '2' || code.startsWith('2') || code.includes('FRL');
    const isNight = code === 'N';
    const isOnCall = cell.isOnCall || code.includes('ONCALL') || cell.subText?.includes('ONCALL');

    let bg = isApprovedDutyChange
      ? 'bg-red-950/50 text-red-500 border-red-500 ring-1 ring-red-500/80 shadow-xs font-black'
      : 'bg-slate-800 text-slate-200 border-slate-700';
    let icon = null;

    if (isOnCall) {
      bg = isApprovedDutyChange
        ? 'bg-red-950/60 text-red-500 border-red-500 ring-1 ring-red-500/80 font-black'
        : 'bg-rose-950 text-rose-200 border-rose-600/80 shadow-xs';
      icon = <Phone className={`w-2 h-2 shrink-0 ${isApprovedDutyChange ? 'text-red-500' : ''}`} />;
    } else if (isNight) {
      bg = isApprovedDutyChange
        ? 'bg-red-950/60 text-red-500 border-red-500 ring-1 ring-red-500/80 font-black'
        : 'bg-indigo-950 text-indigo-200 border-indigo-600/80';
      icon = <Moon className={`w-2 h-2 shrink-0 ${isApprovedDutyChange ? 'text-red-500' : ''}`} />;
    } else if (isEvening) {
      bg = isApprovedDutyChange
        ? 'bg-red-950/60 text-red-500 border-red-500 ring-1 ring-red-500/80 font-black'
        : 'bg-sky-950 text-sky-200 border-sky-600/80';
      icon = <Sunset className={`w-2 h-2 shrink-0 ${isApprovedDutyChange ? 'text-red-500' : ''}`} />;
    } else if (isMorning) {
      bg = isApprovedDutyChange
        ? 'bg-red-950/60 text-red-500 border-red-500 ring-1 ring-red-500/80 font-black'
        : 'bg-emerald-950 text-emerald-200 border-emerald-600/80';
      icon = <Sun className={`w-2 h-2 shrink-0 ${isApprovedDutyChange ? 'text-red-500' : ''}`} />;
    }

    return (
      <div className="flex flex-col items-center justify-center gap-0.5" title={cell.customNote || (isApprovedDutyChange ? 'Duty Request Approved (Changed Cell)' : undefined)}>
        <span className={`inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-black border leading-tight ${bg}`}>
          {icon}
          <span className={isApprovedDutyChange ? 'text-red-500 font-black' : ''}>{code}</span>
        </span>
        {isApprovedDutyChange ? (
          <span className="text-[7.5px] sm:text-[8px] font-black text-red-400 uppercase tracking-tighter leading-none truncate max-w-[58px]">
            Req Approved
          </span>
        ) : cell.subText ? (
          <span className="text-[8px] sm:text-[9px] font-bold text-amber-300 leading-none tracking-tighter truncate max-w-[55px]">
            {cell.subText}
          </span>
        ) : null}
      </div>
    );
  };

  // Handler: Download 1-Page Roster Image
  const handleDownloadRosterImage = async (roster: WeeklyDepartmentRoster) => {
    setExportingRoster(roster);
    setIsExporting(true);

    // Wait for state & offscreen DOM node to update
    setTimeout(async () => {
      try {
        if (!exportCardRef.current) {
          throw new Error('Export card element not ready');
        }
        await downloadRosterAsImage(exportCardRef.current, roster);
      } catch (err) {
        console.error('Download image error:', err);
        alert('Failed to generate roster image. Please try again.');
      } finally {
        setIsExporting(false);
      }
    }, 150);
  };

  // Handler: Share Roster Image
  const handleShareRosterImage = async (roster: WeeklyDepartmentRoster) => {
    setExportingRoster(roster);
    setIsExporting(true);

    setTimeout(async () => {
      try {
        if (!exportCardRef.current) {
          throw new Error('Export card element not ready');
        }
        const result = await shareRosterAsImage(exportCardRef.current, roster);
        if (result.success) {
          if (!result.sharedViaNative && result.blob) {
            // Open in-app share modal with copy & messenger links
            setSharedRoster(roster);
            setSharedImageBlob(result.blob);
            setSharedImageUrl(URL.createObjectURL(result.blob));
            setShareModalOpen(true);
          }
        } else {
          alert('Could not share image: ' + (result.error || 'Unknown error'));
        }
      } catch (err) {
        console.error('Share error:', err);
        alert('Failed to prepare roster image for sharing.');
      } finally {
        setIsExporting(false);
      }
    }, 150);
  };

  // Handler: Export Department Roster to Official PDF
  const handleExportRosterPdf = async (roster: WeeklyDepartmentRoster) => {
    try {
      await exportWeeklyDutyRosterToPdf({
        rosters: [roster],
        settings,
        generatedBy: 'System Administrator',
        publicHolidays,
        filename: `MHC_Weekly_Roster_${roster.categoryName}_${roster.startDate || currentDateStr}.pdf`,
      });
    } catch (err: any) {
      console.error('Export department PDF error:', err);
      alert('Failed to generate PDF: ' + (err.message || err));
    }
  };

  return (
    <div className={`${isTvMode ? 'space-y-2' : 'space-y-4'} ${isNightMode ? 'text-slate-100' : 'text-slate-900'}`}>
      {/* Category Filter Tabs & Legend */}
      <div className={`flex flex-wrap items-center justify-between gap-2 ${
        isNightMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-100 border-slate-200'
      } ${isTvMode ? 'p-1.5 rounded-xl border' : 'p-2.5 rounded-2xl border'}`}>
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveCategory('attended')}
            className={`rounded-lg font-black transition flex items-center gap-1 shrink-0 cursor-pointer ${
              isTvMode ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 rounded-xl text-xs gap-1.5'
            } ${
              activeCategory === 'attended'
                ? 'bg-teal-500 text-slate-950 shadow-md scale-105'
                : isNightMode
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200'
            }`}
          >
            <span>Attendants</span>
            <span className="text-[9px] opacity-80">(Att)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('nurses')}
            className={`rounded-lg font-black transition flex items-center gap-1 shrink-0 cursor-pointer ${
              isTvMode ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 rounded-xl text-xs gap-1.5'
            } ${
              activeCategory === 'nurses'
                ? 'bg-teal-500 text-slate-950 shadow-md scale-105'
                : isNightMode
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200'
            }`}
          >
            <span>Nurses</span>
            <span className="text-[9px] opacity-80">(Nur)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('drivers')}
            className={`rounded-lg font-black transition flex items-center gap-1 shrink-0 cursor-pointer ${
              isTvMode ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 rounded-xl text-xs gap-1.5'
            } ${
              activeCategory === 'drivers'
                ? 'bg-teal-500 text-slate-950 shadow-md scale-105'
                : isNightMode
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200'
            }`}
          >
            <span>Drivers</span>
            <span className="text-[9px] opacity-80">(Drv)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('customer_service')}
            className={`rounded-lg font-black transition flex items-center gap-1 shrink-0 cursor-pointer ${
              isTvMode ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 rounded-xl text-xs gap-1.5'
            } ${
              activeCategory === 'customer_service'
                ? 'bg-teal-500 text-slate-950 shadow-md scale-105'
                : isNightMode
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200'
            }`}
          >
            <span>Customer Service</span>
            <span className="text-[9px] opacity-80">(CS)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`rounded-lg font-black transition flex items-center gap-1 shrink-0 cursor-pointer ${
              isTvMode ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 rounded-xl text-xs gap-1.5'
            } ${
              activeCategory === 'all'
                ? 'bg-teal-500 text-slate-950 shadow-md scale-105'
                : isNightMode
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200'
            }`}
          >
            <span>All</span>
          </button>
        </div>

        {/* Legend with Annual Leave & Public Holiday Indicators */}
        <div className={`hidden xl:flex items-center gap-2.5 font-bold text-slate-400 ${isTvMode ? 'text-[10px]' : 'text-[11px]'}`}>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>M: Morning</span>
          </span>
          <span className="flex items-center gap-1 text-sky-400">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span>E: Evening</span>
          </span>
          <span className="flex items-center gap-1 text-indigo-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span>N: Night</span>
          </span>
          <span className="flex items-center gap-1 text-teal-300">
            <Palmtree className="w-3 h-3 text-teal-400" />
            <span>AL: Annual Leave</span>
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>On-Call</span>
          </span>
          <span className="flex items-center gap-1 text-amber-300">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Public Holiday</span>
          </span>
          <span className="flex items-center gap-1 text-red-400 font-extrabold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span>Red: Duty Req Approved</span>
          </span>
        </div>
      </div>

      {/* Roster Tables */}
      {filteredRosters.map((roster) => (
        <div
          key={roster.id}
          className={`${
            isNightMode
              ? 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-xl'
              : 'bg-white border-slate-200 text-slate-900 shadow-xs'
          } border overflow-hidden ${
            isTvMode ? 'rounded-xl' : 'rounded-2xl'
          }`}
        >
          {/* Table Header / Banner */}
          <div className={`${
            isNightMode
              ? 'bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-slate-800'
              : 'bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 border-slate-200'
          } border-b flex flex-wrap items-center justify-between gap-3 ${
            isTvMode ? 'px-3 py-1.5' : 'px-5 py-3.5'
          }`}>
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className={`${isTvMode ? 'w-4 h-4' : 'w-5 h-5'} ${isNightMode ? 'text-teal-400' : 'text-teal-600'}`} />
                <h3 className={`font-black tracking-tight ${isNightMode ? 'text-slate-100' : 'text-slate-900'} ${isTvMode ? 'text-xs sm:text-sm' : 'text-base'}`}>
                  {roster.categoryName}
                </h3>
                {roster.categoryNameDhivehi && (
                  <span className={`font-thaana ${isNightMode ? 'text-teal-400' : 'text-teal-700'} ${isTvMode ? 'text-xs' : 'text-sm'}`}>
                    {roster.categoryNameDhivehi}
                  </span>
                )}
              </div>
              <p className={`font-bold ${isNightMode ? 'text-slate-400' : 'text-slate-500'} ${isTvMode ? 'text-[10px]' : 'text-xs mt-0.5'}`}>
                Schedule: <span className={isNightMode ? 'text-slate-200' : 'text-slate-800'}>{roster.weekRangeText}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`rounded-full font-black uppercase tracking-wider ${
                isNightMode
                  ? 'bg-teal-950 text-teal-300 border border-teal-800/80'
                  : 'bg-teal-100 text-teal-900 border border-teal-200'
              } ${
                isTvMode ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
              }`}>
                {roster.rows.length} Staff
              </span>

              {/* Download & Share Actions for Supervisors (Non-TV Mode) */}
              {!isTvMode && (
                <div className="flex items-center gap-1.5 ml-2">
                  <button
                    type="button"
                    onClick={() => handleExportRosterPdf(roster)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                    title="Export official department duty roster as PDF document for printing or archiving"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Export PDF</span>
                  </button>

                  {onPrint && (
                    <button
                      type="button"
                      onClick={() => onPrint(roster.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs shadow-xs transition cursor-pointer"
                      title="Open dedicated printable sheet for this department with official Maldives Ministry of Health header and sign-off blocks"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                      <span>Print</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDownloadRosterImage(roster)}
                    disabled={isExporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                    title="Download entire roster formatted into a crisp single-page PNG image"
                  >
                    {isExporting && exportingRoster?.id === roster.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-teal-400" />
                    )}
                    <span className="hidden sm:inline">Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleShareRosterImage(roster)}
                    disabled={isExporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                    title="Share roster image to WhatsApp, Viber, Telegram, or copy image"
                  >
                    <Share2 className="w-3.5 h-3.5 text-teal-400" />
                    <span className="hidden sm:inline">Share</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Roster Spreadsheet Grid - Fits 100% width without horizontal scroll */}
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed text-left border-collapse min-w-[700px]">
              <thead>
                <tr className={`${isNightMode ? 'bg-slate-950 text-slate-300 border-slate-800' : 'bg-slate-50 text-slate-700 border-slate-200'} text-[10px] sm:text-xs font-extrabold uppercase tracking-wider border-b`}>
                  <th className={`p-1 sm:p-2 w-[4%] text-center ${isNightMode ? 'text-slate-500' : 'text-slate-400'}`}>#</th>
                  <th className="p-1 sm:p-2 w-[22%] sm:w-[20%]">Staff Member</th>
                  {roster.days.map((day) => {
                    const isToday = day.dateStr === currentDateStr;
                    const holiday = getHolidayForDay(day.dateStr);

                    return (
                      <th
                        key={day.dateStr}
                        className={`p-1 text-center w-[9%] transition ${
                          holiday
                            ? 'bg-amber-950/80 text-amber-200 border-x-2 border-amber-500/90 shadow-inner'
                            : isToday
                            ? isNightMode
                              ? 'bg-teal-950/80 text-teal-300 border-x border-teal-500/80'
                              : 'bg-teal-100 text-teal-950 border-x border-teal-500/80'
                            : isNightMode
                            ? 'border-x border-slate-800/60'
                            : 'border-x border-slate-200'
                        }`}
                        title={holiday ? `Public Holiday: ${holiday.name}` : undefined}
                      >
                        <div className="flex items-center justify-center gap-0.5 leading-tight">
                          {holiday && <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                          <span className={`text-[10px] sm:text-[11px] font-black ${holiday ? 'text-amber-300' : ''}`}>
                            {day.dayName.slice(0, 3)}
                          </span>
                        </div>
                        <div className={`text-[9px] sm:text-[10px] font-semibold ${holiday ? 'text-amber-200' : isNightMode ? 'text-slate-400' : 'text-slate-500'} leading-tight`}>
                          {day.formattedDate.split(' ')[0]}
                        </div>
                        {holiday ? (
                          <span className="inline-block px-1 py-0.2 rounded bg-amber-500 text-slate-950 text-[8px] font-black tracking-tighter leading-none mt-0.5 truncate max-w-full">
                            HOLIDAY
                          </span>
                        ) : isToday ? (
                          <span className="inline-block px-1 py-0.2 rounded bg-teal-500 text-slate-950 text-[8px] font-black tracking-tighter leading-none mt-0.5">
                            TODAY
                          </span>
                        ) : null}
                      </th>
                    );
                  })}
                  <th className={`p-1 text-center text-[9px] sm:text-[10px] font-bold ${isNightMode ? 'text-slate-400 border-slate-800' : 'text-slate-500 border-slate-200'} border-l w-[4%]`}>
                    OFF
                  </th>
                  <th className={`p-1 text-center text-[9px] sm:text-[10px] font-bold ${isNightMode ? 'text-slate-400' : 'text-slate-500'} w-[4%]`}>
                    M
                  </th>
                  <th className={`p-1 text-center text-[9px] sm:text-[10px] font-bold ${isNightMode ? 'text-slate-400' : 'text-slate-500'} w-[4%]`}>
                    E
                  </th>
                  <th className={`p-1 text-center text-[9px] sm:text-[10px] font-bold ${isNightMode ? 'text-slate-400' : 'text-slate-500'} w-[4%]`}>
                    N
                  </th>
                </tr>
              </thead>

              <tbody className={`${isNightMode ? 'divide-slate-800/70' : 'divide-slate-200'} divide-y text-xs font-semibold`}>
                {roster.rows.map((row, idx) => {
                  return (
                    <tr
                      key={row.id}
                      className={`${isNightMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'} transition-colors`}
                    >
                      {/* Row Index */}
                      <td className={`${isTvMode ? 'p-0.5 sm:p-1' : 'p-1 sm:p-2'} text-center ${isNightMode ? 'text-slate-500' : 'text-slate-400'} font-bold text-[10px]`}>
                        {idx + 1}
                      </td>

                      {/* Staff Name & Designation */}
                      <td className={`${isTvMode ? 'p-1 sm:p-1.5' : 'p-1 sm:p-2'} overflow-hidden`}>
                        <div className={`font-extrabold ${isNightMode ? 'text-slate-100' : 'text-slate-900'} text-xs sm:text-sm leading-tight truncate`} title={row.staffName}>
                          {row.staffName}
                        </div>
                        <div className={`text-[10px] sm:text-[11px] ${isNightMode ? 'text-teal-400' : 'text-teal-700'} font-medium truncate leading-tight`}>
                          {row.designation}
                        </div>
                      </td>

                      {/* Day Shift Cells */}
                      {roster.days.map((day) => {
                        const cell = row.days[day.dateStr];
                        const isToday = day.dateStr === currentDateStr;
                        const holiday = getHolidayForDay(day.dateStr);

                        return (
                          <td
                            key={day.dateStr}
                            className={`${isTvMode ? 'p-0.5 sm:p-1' : 'p-1'} text-center align-middle transition ${
                              holiday
                                ? isNightMode
                                  ? 'bg-amber-950/20 border-x border-amber-600/40'
                                  : 'bg-amber-50/80 border-x border-amber-400/50'
                                : isToday
                                ? isNightMode
                                  ? 'bg-teal-950/30 border-x border-teal-500/50'
                                  : 'bg-teal-50 border-x border-teal-400/50'
                                : isNightMode
                                ? 'border-x border-slate-800/40'
                                : 'border-x border-slate-200'
                            }`}
                          >
                            {getShiftBadge(cell)}
                          </td>
                        );
                      })}

                      {/* Summary Tallies */}
                      <td className={`${isTvMode ? 'p-0.5 sm:p-1' : 'p-1'} text-center font-bold ${
                        isNightMode ? 'text-slate-300 border-slate-800 bg-slate-950/30' : 'text-slate-700 border-slate-200 bg-slate-50'
                      } border-l text-[10px] sm:text-xs`}>
                        {row.stats?.holidays ?? '-'}
                      </td>
                      <td className={`${isTvMode ? 'p-0.5 sm:p-1' : 'p-1'} text-center font-bold ${
                        isNightMode ? 'bg-slate-950/30 text-emerald-400' : 'bg-slate-50 text-emerald-700'
                      } text-[10px] sm:text-xs`}>
                        {row.stats?.mShifts ?? '-'}
                      </td>
                      <td className={`${isTvMode ? 'p-0.5 sm:p-1' : 'p-1'} text-center font-bold ${
                        isNightMode ? 'bg-slate-950/30 text-sky-400' : 'bg-slate-50 text-sky-700'
                      } text-[10px] sm:text-xs`}>
                        {row.stats?.eShifts ?? '-'}
                      </td>
                      <td className={`${isTvMode ? 'p-0.5 sm:p-1' : 'p-1'} text-center font-bold ${
                        isNightMode ? 'bg-slate-950/30 text-indigo-400' : 'bg-slate-50 text-indigo-700'
                      } text-[10px] sm:text-xs`}>
                        {row.stats?.nShifts ?? '-'}
                      </td>
                    </tr>
                  );
                })}

                {/* NIGHT ONCALL ROW (BOTTOM FIXED FOOTER) */}
                <tr className="bg-rose-950/40 border-t-2 border-rose-600/70 font-black">
                  <td className={`${isTvMode ? 'p-0.5 sm:p-1' : 'p-1 sm:p-2'} text-center text-rose-400`}>
                    <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5 mx-auto" />
                  </td>
                  <td className={`${isTvMode ? 'p-1 sm:p-1.5' : 'p-1 sm:p-2'} text-rose-300 uppercase tracking-wider text-[10px] sm:text-xs`}>
                    <div className="flex items-center gap-1 font-extrabold leading-tight">
                      <span>NIGHT Oncall</span>
                    </div>
                    <div className="text-[8px] sm:text-[9px] text-rose-400/80 font-normal leading-tight">
                      24/7 Clinical
                    </div>
                  </td>
                  {roster.days.map((day) => {
                    const onCall = roster.nightOnCallByDay[day.dateStr];
                    const isToday = day.dateStr === currentDateStr;
                    const holiday = getHolidayForDay(day.dateStr);

                    return (
                      <td
                        key={day.dateStr}
                        className={`${isTvMode ? 'p-0.5 sm:p-1' : 'p-1'} text-center text-rose-200 text-[10px] sm:text-xs font-black ${
                          holiday
                            ? 'bg-rose-950/90 border-x border-rose-500'
                            : isToday
                            ? 'bg-rose-900/60 border-x border-rose-500'
                            : 'border-x border-rose-800/40'
                        }`}
                      >
                        {onCall ? (
                          <div className="truncate">
                            <div className="font-extrabold text-rose-100 text-[10px] sm:text-xs truncate" title={onCall.name}>{onCall.name}</div>
                            {onCall.timing && (
                              <div className="text-[8px] text-rose-300 font-semibold leading-none truncate">{onCall.timing}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[10px]">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td colSpan={4} className="bg-rose-950/60 p-1 text-center text-[9px] text-rose-300 leading-tight">
                    Emergency: 6580043
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Hidden offscreen export card element for crisp 1-page image capture */}
      <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', zIndex: -100 }}>
        {exportingRoster && (
          <SinglePageRosterExportCard
            cardRef={exportCardRef}
            roster={exportingRoster}
            publicHolidays={publicHolidays}
          />
        )}
      </div>

      {/* Share Roster Modal */}
      {sharedRoster && (
        <RosterShareModal
          roster={sharedRoster}
          imageBlob={sharedImageBlob}
          imageUrl={sharedImageUrl}
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          onDownload={() => {
            if (sharedRoster) handleDownloadRosterImage(sharedRoster);
          }}
        />
      )}
    </div>
  );
};
