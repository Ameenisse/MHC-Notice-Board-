import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  formatFullCurrentDate,
  formatLiveClock,
  formatTimeAgo,
} from '../../utils/dateUtils';
import { Link } from 'react-router-dom';
import { Maximize, Minimize, Wifi, WifiOff, RefreshCw, Sparkles, LogIn, Home } from 'lucide-react';
import { MHCLogo } from './MHCLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface TVHeaderProps {
  lastUpdated: number;
  isSyncing: boolean;
  onManualRefresh?: () => void;
  activeTab?: 'leave' | 'notices' | 'memories' | 'split';
  totalLeaveCount?: number;
  totalNoticeCount?: number;
  totalMemoryCount?: number;
  totalRosterCount?: number;
  isSplitScreen?: boolean;
  isNavVisible?: boolean;
}

export const TVHeader: React.FC<TVHeaderProps> = ({
  lastUpdated,
  isSyncing,
  onManualRefresh,
  activeTab = 'split',
  totalLeaveCount = 0,
  totalNoticeCount = 0,
  totalMemoryCount = 0,
  totalRosterCount = 0,
  isSplitScreen = true,
  isNavVisible = true,
}) => {
  const { settings, isOnline, isDemoMode, language } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Live Clock ticker every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const tz = settings.timezone || 'Indian/Maldives';
  const dateFormatted = formatFullCurrentDate(currentTime, tz);
  const timeFormatted = formatLiveClock(currentTime, settings.clockFormat || '24h', tz);

  let displayTitle = 'Staff on Leave & Noticeboard';
  if (isSplitScreen) {
    displayTitle = language === 'dv'
      ? 'ޕޯސްޓްތަކާއި ބަހާތަކުގެ ޑިއުޓީ ރޯސްޓަރ'
      : 'Hospital Bulletin & Department Duty Rosters';
  } else if (activeTab === 'leave') {
    displayTitle = language === 'dv' && settings.boardTitleDhivehi
      ? settings.boardTitleDhivehi
      : settings.boardTitle || 'Staff on Leave';
  } else if (activeTab === 'notices') {
    displayTitle = language === 'dv'
      ? 'އިޢުލާން ބޯޑު'
      : 'Announcements & Notices';
  } else if (activeTab === 'memories') {
    displayTitle = language === 'dv'
      ? 'ހަނދާންތަކާއި ޚާއްޞަ ޚަބަރު'
      : 'Hospital Memories & Milestones';
  }

  const orgDisplayName =
    language === 'dv' && settings.orgNameDhivehi ? settings.orgNameDhivehi : settings.orgName;

  const isNightMode = settings.themeMode === 'night';

  return (
    <header
      id="tv-header"
      className={`border-b-2 px-4 sm:px-6 py-2 sm:py-2.5 select-none shrink-0 transition-colors duration-200 ${
        isNightMode
          ? 'bg-slate-950 border-slate-800 text-slate-100 shadow-md'
          : 'bg-white border-slate-200 text-slate-900 shadow-xs'
      }`}
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Organization Identity & Board Title */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={orgDisplayName}
                className={`h-11 w-11 sm:h-12 sm:w-12 object-contain rounded-xl border shadow-xs p-0.5 ${
                  isNightMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'
                }`}
                referrerPolicy="no-referrer"
              />
            ) : (
              <MHCLogo
                className={`h-11 w-11 sm:h-12 sm:w-12 rounded-xl border shadow-xs p-0.5 ${
                  isNightMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'
                }`}
              />
            )}

              <div>
              <div className="flex items-center gap-2">
                <h2
                  className={`text-[11px] sm:text-xs font-bold tracking-wide uppercase ${
                    isNightMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {orgDisplayName}
                </h2>
                {isDemoMode && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-xs">
                    <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                    DEMO
                  </span>
                )}
                {isSplitScreen && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border hidden sm:inline-block ${
                      isNightMode
                        ? 'bg-teal-950/80 text-teal-300 border-teal-700/60'
                        : 'bg-teal-50 text-teal-800 border-teal-200'
                    }`}
                  >
                    50" SPLIT TV FIT
                  </span>
                )}
              </div>
              <h1
                className={`text-lg sm:text-xl md:text-2xl font-black tracking-tight flex items-center gap-2.5 leading-tight ${
                  isNightMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                {displayTitle}
                {!isSplitScreen && activeTab === 'leave' && totalLeaveCount > 0 && (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                      isNightMode
                        ? 'bg-teal-950 text-teal-300 border-teal-700'
                        : 'bg-teal-100 text-teal-900 border-teal-200'
                    }`}
                  >
                    {totalLeaveCount} on leave
                  </span>
                )}
                {!isSplitScreen && activeTab === 'notices' && totalNoticeCount > 0 && (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                      isNightMode
                        ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                        : 'bg-indigo-100 text-indigo-900 border-indigo-200'
                    }`}
                  >
                    {totalNoticeCount} notices
                  </span>
                )}
                {!isSplitScreen && activeTab === 'memories' && totalMemoryCount > 0 && (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                      isNightMode
                        ? 'bg-purple-950 text-purple-300 border-purple-700'
                        : 'bg-purple-100 text-purple-900 border-purple-200'
                    }`}
                  >
                    {totalMemoryCount} memories
                  </span>
                )}
              </h1>
            </div>
          </div>
        </div>

        {/* Right: Date, Live Clock & Status Indicators */}
        <div className="flex items-center gap-5 w-full md:w-auto justify-between md:justify-end">
          {/* Live Date & Clock */}
          <div className="text-right">
            <div
              className={`text-xs font-bold tracking-wide ${
                isNightMode ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              {dateFormatted}
            </div>
            <div
              className={`text-xl md:text-2xl font-black tabular-nums tracking-tight ${
                isNightMode ? 'text-white' : 'text-slate-950'
              }`}
            >
              {timeFormatted}
            </div>
          </div>

          {/* Connection, Sync & Fullscreen Controls */}
          <div
            className={`flex items-center gap-2.5 pl-4 border-l ${
              isNightMode ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            {/* Status indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                isOnline
                  ? isNightMode
                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
              title={
                isOnline
                  ? `Connected to live Firestore. Last updated: ${formatTimeAgo(lastUpdated)}`
                  : 'Offline: Displaying cached data. Dates will continue updating.'
              }
            >
              {isOnline ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden sm:inline">LIVE</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden sm:inline">OFFLINE</span>
                </>
              )}
            </div>

            {/* Interactive action buttons (auto-hide after 5s inactive mouse) */}
            <div
              className={`flex items-center gap-1.5 transition-all duration-500 ease-in-out ${
                isNavVisible
                  ? 'opacity-100 max-w-[420px]'
                  : 'opacity-0 max-w-0 overflow-hidden pointer-events-none'
              }`}
            >
              {/* PWA Install Button for Offline TV App */}
              <PWAInstallButton variant="tv" />

              {/* Home / Display refresh link */}
              <Link
                to="/display"
                onClick={(e) => {
                  if (onManualRefresh) {
                    onManualRefresh();
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs ${
                  isNightMode
                    ? 'bg-slate-900 hover:bg-slate-800 text-teal-300 border-slate-700 hover:border-teal-500'
                    : 'bg-white hover:bg-slate-50 text-teal-800 border-slate-200 hover:border-teal-600'
                }`}
                title="Return to Home Display"
              >
                <Home className="w-3.5 h-3.5 text-teal-500" />
                <span className="hidden sm:inline">Home</span>
              </Link>

              {/* Go to Login Page button */}
              <Link
                to="/admin"
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs ${
                  isNightMode
                    ? 'bg-slate-900 hover:bg-slate-800 text-teal-300 border-slate-700 hover:border-teal-500'
                    : 'bg-white hover:bg-slate-50 text-teal-800 border-slate-200 hover:border-teal-600'
                }`}
                title="Go to Admin / Supervisor Login Page"
              >
                <LogIn className="w-3.5 h-3.5 text-teal-600" />
                <span className="hidden sm:inline">Admin Login</span>
              </Link>

              {/* Manual refresh button */}
              {onManualRefresh && (
                <button
                  onClick={onManualRefresh}
                  disabled={isSyncing}
                  className={`p-1.5 rounded-lg transition ${
                    isNightMode
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                  title="Refresh display data"
                  aria-label="Refresh data"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-teal-600' : ''}`} />
                </button>
              )}

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                className={`p-1.5 rounded-lg transition ${
                  isNightMode
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title={isFullscreen ? 'Exit fullscreen (F11)' : 'Enter fullscreen (F11)'}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4" />
                ) : (
                  <Maximize className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
