import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { TVHeader } from '../../components/common/TVHeader';
import { AnnouncementStrip } from '../../components/common/AnnouncementStrip';
import { PairingScreen } from './PairingScreen';
import { subscribeToDisplayData, getTodayDailyMedia } from '../../services/db';
import {
  DisplayLeaveCard,
  LeaveCategory,
  Notice,
  DepartmentRoster,
  HospitalMemory,
  WeeklyDepartmentRoster,
  DailyMedia,
} from '../../types';
import { formatDate, getTodayString } from '../../utils/dateUtils';
import { WeeklyRosterGrid } from '../../components/roster/WeeklyRosterGrid';
import { MovementOfTheDayModal } from '../../components/display/MovementOfTheDayModal';
import {
  Calendar,
  Clock,
  FileText,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
  Sparkles,
  Sun,
  Sunset,
  Moon,
  Phone,
  Radio,
  Building,
  UserCheck,
  ShieldCheck,
  Camera,
  Layers,
  Maximize2,
  Split,
  Pause,
  Play,
  RotateCcw,
  Grid,
  LogIn,
} from 'lucide-react';

export const DisplayPage: React.FC = () => {
  const {
    settings,
    refreshSettings,
    isDemoMode,
    isTVPaired,
    isAdmin,
    language,
    isOnline,
    lastSyncTime,
    setLastSyncTime,
    syncError,
    setSyncError,
    toggleThemeMode,
  } = useApp();

  const isNightMode = settings.themeMode === 'night';

  // Core Data
  const [leaveCards, setLeaveCards] = useState<DisplayLeaveCard[]>([]);
  const [categories, setCategories] = useState<LeaveCategory[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dutyRosters, setDutyRosters] = useState<DepartmentRoster[]>([]);
  const [weeklyRosters, setWeeklyRosters] = useState<WeeklyDepartmentRoster[]>([]);
  const [memories, setMemories] = useState<HospitalMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Split Display Layout State
  // Default to split screen (one side rotating posts, one side static duty rosters)
  const [isSplitScreen, setIsSplitScreen] = useState<boolean>(true);
  const [splitRatio, setSplitRatio] = useState<'50_50' | '55_45' | '45_55'>('50_50');

  // Left Side (Auto-Switching Posts Carousel)
  // Views: 'leave' | 'notices' | 'memories'
  const [carouselView, setCarouselView] = useState<'leave' | 'notices' | 'memories'>('leave');
  const [currentPage, setCurrentPage] = useState(0);
  const [rotationProgress, setRotationProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Right Side (Static Duty Rosters - No Switching)
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [rosterDisplayMode, setRosterDisplayMode] = useState<'weekly_grid' | 'today_cards'>('weekly_grid');

  // Modals
  const [selectedPdfNotice, setSelectedPdfNotice] = useState<Notice | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<HospitalMemory | null>(null);

  // Photo & Video (Movement) of the Day State
  const [dailyMedia, setDailyMedia] = useState<DailyMedia | null>(null);
  const [isDailyMediaModalOpen, setIsDailyMediaModalOpen] = useState<boolean>(false);
  const [nextMediaTriggerTime, setNextMediaTriggerTime] = useState<number | null>(null);

  // Auto-hide navigations, control strips & cursor after 5 seconds of inactive mouse
  const [isNavVisible, setIsNavVisible] = useState<boolean>(true);

  useEffect(() => {
    let inactivityTimer: any = null;

    const resetInactivityTimer = () => {
      setIsNavVisible(true);
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        setIsNavVisible(false);
      }, 5000); // 5 seconds of inactive mouse
    };

    // Initial 5-second timer
    inactivityTimer = setTimeout(() => {
      setIsNavVisible(false);
    }, 5000);

    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('mousedown', resetInactivityTimer);
    window.addEventListener('touchstart', resetInactivityTimer);
    window.addEventListener('keydown', resetInactivityTimer);

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      window.removeEventListener('mousemove', resetInactivityTimer);
      window.removeEventListener('mousedown', resetInactivityTimer);
      window.removeEventListener('touchstart', resetInactivityTimer);
      window.removeEventListener('keydown', resetInactivityTimer);
    };
  }, []);

  const tz = settings.timezone || 'Indian/Maldives';

  // Movement of the Day: Periodic Fullscreen Takeover (every 1hr default, auto-dismisses, auto-deletes next day)
  useEffect(() => {
    let intervalTimer: any = null;
    let pollTimer: any = null;

    const fetchAndScheduleDailyMedia = async () => {
      try {
        const todayStr = getTodayString(tz);
        const media = await getTodayDailyMedia(isDemoMode);

        // Auto-delete / ignore if media date is not today
        if (media && media.date === todayStr && media.active) {
          setDailyMedia(media);

          const intervalMs = Math.max(1, media.intervalMinutes || 60) * 60 * 1000;
          setNextMediaTriggerTime(Date.now() + intervalMs);

          if (intervalTimer) clearInterval(intervalTimer);

          intervalTimer = setInterval(() => {
            // Re-verify it's still today before popping up
            const currentTodayStr = getTodayString(tz);
            if (media.date === currentTodayStr && media.active) {
              setIsDailyMediaModalOpen(true);
              setNextMediaTriggerTime(Date.now() + intervalMs);
            } else {
              // Date passed or deactivated, dismiss & clean
              setIsDailyMediaModalOpen(false);
              setDailyMedia(null);
            }
          }, intervalMs);
        } else {
          setDailyMedia(null);
          setIsDailyMediaModalOpen(false);
          setNextMediaTriggerTime(null);
        }
      } catch (err) {
        console.warn('Error fetching movement of the day for display:', err);
      }
    };

    fetchAndScheduleDailyMedia();

    // Re-check for new daily media uploads every 2 minutes
    pollTimer = setInterval(fetchAndScheduleDailyMedia, 120 * 1000);

    return () => {
      if (intervalTimer) clearInterval(intervalTimer);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [tz, isDemoMode]);

  // Live Subscription
  useEffect(() => {
    setIsSyncing(true);
    const unsubscribe = subscribeToDisplayData(tz, isDemoMode, (data) => {
      setLeaveCards(data.cards);
      setCategories(data.categories);
      setNotices(data.notices);
      setDutyRosters(data.dutyRosters);
      setWeeklyRosters(data.weeklyRosters || []);
      setMemories(data.memories);
      setLastSyncTime(Date.now());
      setSyncError(null);
      setLoading(false);
      setIsSyncing(false);
    });

    // Fallback periodic refresh for settings
    const refreshIntervalSeconds = Math.max(30, settings.fallbackRefreshInterval || 60);
    const timer = setInterval(() => {
      refreshSettings().catch(() => {});
    }, refreshIntervalSeconds * 1000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [tz, isDemoMode, settings.fallbackRefreshInterval]);

  // Group leave cards by category
  const cardsByCategory = useMemo(() => {
    const grouped = new Map<string, DisplayLeaveCard[]>();
    for (const cat of categories) {
      grouped.set(cat.id, []);
    }
    for (const card of leaveCards) {
      const list = grouped.get(card.categoryId);
      if (list) {
        list.push(card);
      } else {
        grouped.set(card.categoryId, [card]);
      }
    }
    return grouped;
  }, [categories, leaveCards]);

  const visibleCategories = useMemo(() => {
    if (settings.showEmptyCategories) {
      return categories;
    }
    return categories.filter((cat) => {
      const list = cardsByCategory.get(cat.id);
      return list && list.length > 0;
    });
  }, [categories, cardsByCategory, settings.showEmptyCategories]);

  // Pagination for Carousel
  const cardsPerPage = Math.max(2, isSplitScreen ? 6 : (settings.cardsPerPage || 8));
  const totalLeavePages = Math.max(1, Math.ceil(leaveCards.length / cardsPerPage));
  const totalNoticePages = Math.max(1, Math.ceil(notices.length / 2));
  const totalMemoryPages = Math.max(1, Math.ceil(memories.length / 2));

  // Rotation Interval Timer (default 15s)
  const intervalSeconds = Math.max(5, settings.rotationInterval || 15);

  const advanceRotation = () => {
    // Rotation cycle: leave -> notices -> memories -> leave
    if (carouselView === 'leave') {
      if (currentPage + 1 < totalLeavePages) {
        setCurrentPage(currentPage + 1);
      } else {
        // Move to notices if available, else memories, else stay
        if (notices.length > 0) {
          setCarouselView('notices');
          setCurrentPage(0);
        } else if (memories.length > 0) {
          setCarouselView('memories');
          setCurrentPage(0);
        } else {
          setCurrentPage(0);
        }
      }
    } else if (carouselView === 'notices') {
      if (currentPage + 1 < totalNoticePages) {
        setCurrentPage(currentPage + 1);
      } else {
        // Move to memories if available, else leave
        if (memories.length > 0) {
          setCarouselView('memories');
          setCurrentPage(0);
        } else {
          setCarouselView('leave');
          setCurrentPage(0);
        }
      }
    } else {
      // currently on memories
      if (currentPage + 1 < totalMemoryPages) {
        setCurrentPage(currentPage + 1);
      } else {
        setCarouselView('leave');
        setCurrentPage(0);
      }
    }
  };

  useEffect(() => {
    if (isPaused) return;

    const stepMs = 100;
    const increment = (stepMs / (intervalSeconds * 1000)) * 100;

    const progressTimer = setInterval(() => {
      setRotationProgress((prev) => {
        if (prev >= 100) {
          advanceRotation();
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => clearInterval(progressTimer);
  }, [
    isPaused,
    intervalSeconds,
    carouselView,
    currentPage,
    totalLeavePages,
    totalNoticePages,
    totalMemoryPages,
    notices.length,
    memories.length,
  ]);

  // Paginated items
  const paginatedLeaveCards = useMemo(() => {
    if (leaveCards.length <= cardsPerPage) return leaveCards;
    const start = currentPage * cardsPerPage;
    return leaveCards.slice(start, start + cardsPerPage);
  }, [leaveCards, currentPage, cardsPerPage]);

  const paginatedNotices = useMemo(() => {
    const start = currentPage * 2;
    return notices.slice(start, start + 2);
  }, [notices, currentPage]);

  const paginatedMemories = useMemo(() => {
    const start = currentPage * 2;
    return memories.slice(start, start + 2);
  }, [memories, currentPage]);

  // TV Screen Fit Mode (Standard 1080p fit vs Ultra-compact fit for 50" TVs)
  const [tvFitScale, setTvFitScale] = useState<'fit_100' | 'compact_tv'>('fit_100');

  // Filter duty rosters
  const displayedDutyRosters = useMemo(() => {
    if (selectedDeptFilter === 'all') return dutyRosters;
    return dutyRosters.filter((r) => r.departmentId === selectedDeptFilter);
  }, [dutyRosters, selectedDeptFilter]);

  // Get unique departments present in rosters
  const rosterDepartments = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of dutyRosters) {
      map.set(r.departmentId, r.departmentName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [dutyRosters]);

  // If display is not paired and user is not an administrator, show Pairing screen
  if (!isTVPaired && !isAdmin) {
    return <PairingScreen onPairedSuccess={() => {}} />;
  }

  return (
    <div
      id="tv-display-container"
      className={`h-screen max-h-screen w-screen max-w-full flex flex-col justify-between select-none overflow-hidden transition-colors duration-200 ${
        !isNavVisible ? 'cursor-none' : 'cursor-default'
      } ${
        isNightMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Top Header */}
      <TVHeader
        lastUpdated={lastSyncTime}
        isSyncing={isSyncing}
        onManualRefresh={() => {}}
        activeTab={carouselView}
        totalLeaveCount={leaveCards.length}
        totalNoticeCount={notices.length}
        totalMemoryCount={memories.length}
        totalRosterCount={dutyRosters.length}
        isSplitScreen={isSplitScreen}
        isNavVisible={isNavVisible}
      />

      {/* Control Strip for Mode & TV Tuning (Auto-hides after 5s inactive mouse) */}
      <div
        className={`transition-all duration-500 ease-in-out overflow-hidden shrink-0 ${
          isNavVisible
            ? 'max-h-20 opacity-100'
            : 'max-h-0 opacity-0 py-0 border-b-0 pointer-events-none'
        }`}
      >
        <div className={`border-b px-4 sm:px-6 py-1.5 flex items-center justify-between text-xs shrink-0 transition-colors duration-200 ${
          isNightMode
            ? 'bg-slate-950/90 border-slate-800 text-slate-300'
            : 'bg-white border-slate-200 text-slate-700 shadow-2xs'
        }`}>
        <div className="flex items-center gap-3">
          <span className={`font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-[11px] sm:text-xs ${
            isNightMode ? 'text-slate-400' : 'text-slate-600'
          }`}>
            <Split className="w-3.5 h-3.5 text-teal-500" />
            <span>50" TV Split Layout:</span>
          </span>

          <div className={`flex items-center rounded-lg p-0.5 border ${
            isNightMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              type="button"
              onClick={() => setIsSplitScreen(true)}
              className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] sm:text-xs transition flex items-center gap-1.5 ${
                isSplitScreen
                  ? 'bg-teal-600 text-white shadow-xs'
                  : isNightMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <span>Split TV (Posts + Rosters)</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSplitScreen(false)}
              className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] sm:text-xs transition flex items-center gap-1.5 ${
                !isSplitScreen
                  ? 'bg-teal-600 text-white shadow-xs'
                  : isNightMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <span>Full Screen Posts</span>
            </button>
          </div>

          {isSplitScreen && (
            <div className={`hidden md:flex items-center gap-1.5 pl-3 border-l ${
              isNightMode ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <span className={`font-bold text-[11px] ${isNightMode ? 'text-slate-500' : 'text-slate-400'}`}>Ratio:</span>
              {(['50_50', '55_45', '45_55'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSplitRatio(r)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    splitRatio === r
                      ? isNightMode
                        ? 'bg-slate-800 text-teal-400 border border-teal-500/30'
                        : 'bg-white text-teal-700 border border-teal-500 shadow-2xs'
                      : isNightMode
                      ? 'text-slate-500 hover:text-slate-300'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {r.replace('_', ' / ')}
                </button>
              ))}
            </div>
          )}

          {/* 50-inch TV Fit Density Selector */}
          <div className={`hidden lg:flex items-center gap-1.5 pl-3 border-l ${
            isNightMode ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <span className={`font-bold text-[11px] ${isNightMode ? 'text-slate-500' : 'text-slate-400'}`}>TV Fit:</span>
            <button
              type="button"
              onClick={() => setTvFitScale('fit_100')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                tvFitScale === 'fit_100'
                  ? isNightMode
                    ? 'bg-teal-950 text-teal-300 border border-teal-600/60'
                    : 'bg-teal-100 text-teal-900 border border-teal-300'
                  : isNightMode
                  ? 'text-slate-500 hover:text-slate-300'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Standard 1080p
            </button>
            <button
              type="button"
              onClick={() => setTvFitScale('compact_tv')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                tvFitScale === 'compact_tv'
                  ? isNightMode
                    ? 'bg-teal-950 text-teal-300 border border-teal-600/60'
                    : 'bg-teal-100 text-teal-900 border border-teal-300'
                  : isNightMode
                  ? 'text-slate-500 hover:text-slate-300'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Ultra-Fit 50"
            </button>
          </div>

          {/* Day / Night Mode Toggle Button */}
          <div className={`flex items-center gap-1.5 pl-3 border-l ${
            isNightMode ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <button
              type="button"
              onClick={() => toggleThemeMode()}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                isNightMode
                  ? 'bg-slate-900 text-indigo-300 hover:text-white border border-slate-700'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
              }`}
              title={`Switch to ${isNightMode ? 'Day Mode' : 'Night Mode'}`}
            >
              {isNightMode ? (
                <>
                  <Moon className="w-3 h-3 text-indigo-400" />
                  <span>Night Mode</span>
                </>
              ) : (
                <>
                  <Sun className="w-3 h-3 text-amber-600" />
                  <span>Day Mode</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Carousel Quick Navigation */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 font-bold ${
            isNightMode ? 'text-slate-400' : 'text-slate-600'
          }`}>
            <span className="text-[11px]">Rotating:</span>
            <span className="text-teal-500 font-extrabold uppercase text-[11px]">{carouselView}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className={`p-1 rounded border transition ${
              isNightMode
                ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 border-slate-200'
            }`}
            title={isPaused ? 'Resume Carousel' : 'Pause Carousel'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-500" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          {/* Go to Login Page Button */}
          <Link
            to="/admin"
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1.5 border shadow-2xs ${
              isNightMode
                ? 'bg-slate-900 text-teal-300 hover:text-white border-slate-700 hover:border-teal-500'
                : 'bg-slate-50 text-teal-800 hover:bg-slate-100 border-slate-300 hover:border-teal-600'
            }`}
            title="Go to Admin & Supervisor Login Page"
          >
            <LogIn className="w-3.5 h-3.5 text-teal-600" />
            <span>Login</span>
          </Link>
        </div>
      </div>
    </div>

      {/* Main Board Canvas */}
      <main
        className={`flex-1 min-h-0 ${
          tvFitScale === 'compact_tv' ? 'p-1.5 sm:p-2 xl:p-2.5' : 'p-2 sm:p-3 xl:p-3.5'
        } flex flex-col justify-between overflow-hidden`}
      >
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
            <div className="h-12 w-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-lg font-bold text-slate-300">
              Synchronizing Maduvvari Health Centre Board...
            </p>
          </div>
        ) : (
          <div
            className={`flex-1 min-h-0 grid ${
              tvFitScale === 'compact_tv' ? 'gap-2 xl:gap-2.5' : 'gap-2.5 xl:gap-3.5'
            } overflow-hidden ${
              isSplitScreen
                ? splitRatio === '55_45'
                  ? 'grid-cols-1 lg:grid-cols-12'
                  : splitRatio === '45_55'
                  ? 'grid-cols-1 lg:grid-cols-12'
                  : 'grid-cols-1 lg:grid-cols-2'
                : 'grid-cols-1'
            }`}
          >
            {/* ========================================================
                SIDE 1: POSTS CAROUSEL (LEAVES / NOTICES / MEMORIES)
                AUTO-SWITCHING WITH TIMER & PROGRESS INDICATOR
                ======================================================== */}
            <section
              className={`min-h-0 h-full flex flex-col justify-between rounded-2xl xl:rounded-3xl border transition-colors duration-200 ${
                isNightMode
                  ? 'bg-slate-950/60 border-slate-800 shadow-xl'
                  : 'bg-white border-slate-200 shadow-md'
              } ${
                tvFitScale === 'compact_tv' ? 'p-2 sm:p-2.5 xl:p-3' : 'p-2.5 sm:p-3 xl:p-3.5'
              } overflow-hidden relative ${
                isSplitScreen
                  ? splitRatio === '55_45'
                    ? 'lg:col-span-7'
                    : splitRatio === '45_55'
                    ? 'lg:col-span-5'
                    : ''
                  : ''
              }`}
            >
              {/* Header Banner on Left Side */}
              <div className={`border-b pb-1.5 mb-1.5 sm:mb-2 shrink-0 ${
                isNightMode ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                    <span className={`text-[11px] sm:text-xs font-black uppercase tracking-wider ${
                      isNightMode ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      Auto-Rotating Posts & Bulletins
                    </span>
                  </div>

                  {/* Carousel View Badges */}
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCarouselView('leave');
                        setCurrentPage(0);
                        setRotationProgress(0);
                      }}
                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black transition flex items-center gap-1 ${
                        carouselView === 'leave'
                          ? 'bg-teal-500 text-slate-950 shadow-xs'
                          : isNightMode
                          ? 'bg-slate-900 text-slate-400 hover:text-slate-200'
                          : 'bg-slate-100 text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      <Calendar className="w-3 h-3" />
                      <span>Leaves ({leaveCards.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCarouselView('notices');
                        setCurrentPage(0);
                        setRotationProgress(0);
                      }}
                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black transition flex items-center gap-1 ${
                        carouselView === 'notices'
                          ? 'bg-indigo-500 text-white shadow-xs'
                          : isNightMode
                          ? 'bg-slate-900 text-slate-400 hover:text-slate-200'
                          : 'bg-slate-100 text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      <FileText className="w-3 h-3" />
                      <span>Notices ({notices.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCarouselView('memories');
                        setCurrentPage(0);
                        setRotationProgress(0);
                      }}
                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black transition flex items-center gap-1 ${
                        carouselView === 'memories'
                          ? 'bg-purple-500 text-white shadow-xs'
                          : isNightMode
                          ? 'bg-slate-900 text-slate-400 hover:text-slate-200'
                          : 'bg-slate-100 text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      <Camera className="w-3 h-3" />
                      <span>Memories ({memories.length})</span>
                    </button>
                  </div>
                </div>

                {/* Progress bar indicating rotation timing */}
                <div className={`w-full h-1 rounded-full overflow-hidden mt-2 border ${
                  isNightMode ? 'bg-slate-900 border-slate-800/80' : 'bg-slate-200 border-slate-300'
                }`}>
                  <div
                    className={`h-full transition-all duration-100 ${
                      carouselView === 'leave'
                        ? 'bg-teal-500'
                        : carouselView === 'notices'
                        ? 'bg-indigo-500'
                        : 'bg-purple-500'
                    }`}
                    style={{ width: `${rotationProgress}%` }}
                  />
                </div>
              </div>

              {/* POST CONTENT 1: LEAVES VIEW */}
              {carouselView === 'leave' && (
                <div className="flex-1 flex flex-col justify-between overflow-y-auto">
                  {visibleCategories.length === 0 || leaveCards.length === 0 ? (
                    <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed ${
                      isNightMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="h-16 w-16 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center mb-3">
                        <Calendar className="w-8 h-8" />
                      </div>
                      <h3 className={`text-xl font-black ${isNightMode ? 'text-slate-200' : 'text-slate-900'}`}>
                        {language === 'dv' ? 'މިވަގުތު ޗުއްޓީގައި އެއްވެސް މުވައްޒަފަކު ނެތް' : 'All Medical & Clinical Staff on Duty'}
                      </h3>
                      <p className={`text-sm mt-1 max-w-sm ${isNightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Zero staff on leave scheduled for today at Maduvvari Health Centre. Full service active.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                      {visibleCategories.map((category) => {
                        const categoryCards = paginatedLeaveCards.filter((c) => c.categoryId === category.id);
                        const totalInCat = leaveCards.filter((c) => c.categoryId === category.id).length;

                        return (
                          <div
                            key={category.id}
                            className={`rounded-xl sm:rounded-2xl border overflow-hidden shadow-xs flex flex-col ${
                              isNightMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50/80 border-slate-200'
                            }`}
                            style={{ borderTopColor: category.color, borderTopWidth: '3px' }}
                          >
                            <div className={`px-3 py-1.5 border-b flex items-center justify-between ${
                              isNightMode ? 'bg-slate-950/60 border-slate-800/80' : 'bg-white border-slate-200'
                            }`}>
                              <span className={`text-xs sm:text-sm font-black tracking-tight ${
                                isNightMode ? 'text-slate-100' : 'text-slate-900'
                              }`}>
                                {category.name}
                              </span>
                              <span
                                className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black text-white"
                                style={{ backgroundColor: category.color }}
                              >
                                {totalInCat}
                              </span>
                            </div>

                            <div className="p-2 space-y-1.5 flex-1 min-h-[60px]">
                              {categoryCards.length === 0 ? (
                                <p className={`text-xs italic py-3 text-center ${
                                  isNightMode ? 'text-slate-500' : 'text-slate-400'
                                }`}>
                                  No staff on leave in this category
                                </p>
                              ) : (
                                categoryCards.map((staff) => (
                                  <div
                                    key={staff.id}
                                    className={`rounded-lg p-1.5 sm:p-2 border flex items-center gap-2.5 relative ${
                                      isNightMode ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
                                    }`}
                                  >
                                    {staff.staffPhotoUrl ? (
                                      <img
                                        src={staff.staffPhotoUrl}
                                        alt={staff.staffName}
                                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-md object-cover border shrink-0 ${
                                          isNightMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-100'
                                        }`}
                                      />
                                    ) : (
                                      <div
                                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-md flex items-center justify-center text-white font-black text-xs shrink-0"
                                        style={{ backgroundColor: category.color }}
                                      >
                                        {staff.staffName.slice(0, 2).toUpperCase()}
                                      </div>
                                    )}

                                    <div className="min-w-0 flex-1">
                                      <h4 className={`text-xs sm:text-sm font-extrabold truncate leading-tight ${
                                        isNightMode ? 'text-slate-100' : 'text-slate-900'
                                      }`}>
                                        {staff.staffName}
                                      </h4>
                                      <p className={`text-[10px] sm:text-xs font-semibold truncate leading-tight ${
                                        isNightMode ? 'text-teal-400' : 'text-teal-700'
                                      }`}>
                                        {staff.staffDesignation}
                                      </p>
                                      <p className={`text-[9px] sm:text-[10px] truncate leading-tight ${
                                        isNightMode ? 'text-slate-400' : 'text-slate-500'
                                      }`}>
                                        {staff.staffDepartment}
                                      </p>
                                    </div>

                                    {staff.returnsTomorrow && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[8px] sm:text-[9px] font-black uppercase tracking-wider shrink-0 leading-none">
                                        Tomorrow
                                      </span>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* POST CONTENT 2: NOTICES VIEW */}
              {carouselView === 'notices' && (
                <div className="flex-1 flex flex-col justify-between overflow-y-auto space-y-3">
                  {notices.length === 0 ? (
                    <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed ${
                      isNightMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <FileText className="w-12 h-12 text-slate-400 mb-2" />
                      <h3 className={`text-lg font-black ${isNightMode ? 'text-slate-300' : 'text-slate-700'}`}>No Active Notices</h3>
                      <p className={`text-xs ${isNightMode ? 'text-slate-500' : 'text-slate-400'}`}>Official hospital circulars will be displayed here.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {paginatedNotices.map((notice) => (
                        <div
                          key={notice.id}
                          className={`rounded-xl sm:rounded-2xl border p-3 sm:p-4 shadow-xs space-y-2 ${
                            isNightMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${
                                  notice.priority === 'urgent'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : notice.priority === 'important'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                }`}
                              >
                                {notice.priority} Bulletin
                              </span>
                              <h3 className={`text-sm sm:text-base font-black mt-1.5 leading-snug ${
                                isNightMode ? 'text-slate-100' : 'text-slate-900'
                              }`}>
                                {notice.title}
                              </h3>
                              {notice.titleDhivehi && (
                                <p className={`text-xs sm:text-sm font-thaana font-medium mt-0.5 ${
                                  isNightMode ? 'text-teal-300' : 'text-teal-700'
                                }`}>
                                  {notice.titleDhivehi}
                                </p>
                              )}
                            </div>
                          </div>

                          <p className={`text-xs sm:text-sm leading-relaxed line-clamp-3 ${
                            isNightMode ? 'text-slate-300' : 'text-slate-600'
                          }`}>
                            {notice.message}
                          </p>
                          {notice.messageDhivehi && (
                            <p className={`text-xs sm:text-sm font-thaana leading-relaxed line-clamp-2 ${
                              isNightMode ? 'text-slate-400' : 'text-slate-500'
                            }`} dir="rtl">
                              {notice.messageDhivehi}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* POST CONTENT 3: MEMORIES & MILESTONES VIEW */}
              {carouselView === 'memories' && (
                <div className="flex-1 flex flex-col justify-between overflow-y-auto space-y-3">
                  {memories.length === 0 ? (
                    <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed ${
                      isNightMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <Camera className="w-12 h-12 text-slate-400 mb-2" />
                      <h3 className={`text-lg font-black ${isNightMode ? 'text-slate-300' : 'text-slate-700'}`}>No Memories Published</h3>
                      <p className={`text-xs ${isNightMode ? 'text-slate-500' : 'text-slate-400'}`}>Hospital milestones and community outreach will appear here.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {paginatedMemories.map((mem) => (
                        <div
                          key={mem.id}
                          className={`rounded-xl sm:rounded-2xl border overflow-hidden shadow-xs flex flex-col ${
                            isNightMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="relative h-32 sm:h-36 xl:h-40 bg-slate-950 overflow-hidden">
                            <img
                              src={mem.imageUrl}
                              alt={mem.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-xs text-white px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                              {mem.category}
                            </div>
                            <div className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-xs text-slate-300 px-1.5 py-0.5 rounded text-[9px] font-bold">
                              {formatDate(mem.date, tz, 'medium')}
                            </div>
                          </div>

                          <div className="p-2.5 sm:p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className={`text-xs sm:text-sm font-extrabold leading-snug line-clamp-1 ${
                                isNightMode ? 'text-slate-100' : 'text-slate-900'
                              }`}>
                                {mem.title}
                              </h4>
                              {mem.titleDhivehi && (
                                <p className={`text-[11px] sm:text-xs font-thaana font-medium mt-0.5 line-clamp-1 ${
                                  isNightMode ? 'text-teal-300' : 'text-teal-700'
                                }`}>
                                  {mem.titleDhivehi}
                                </p>
                              )}
                              <p className={`text-[11px] sm:text-xs mt-1 line-clamp-2 leading-relaxed ${
                                isNightMode ? 'text-slate-400' : 'text-slate-600'
                              }`}>
                                {mem.caption}
                              </p>
                            </div>

                            <div className={`pt-1.5 border-t text-[9px] font-bold flex items-center justify-between ${
                              isNightMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
                            }`}>
                              <span>MHC Milestones</span>
                              <span>{mem.author}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Pagination Controls for Left Side */}
              <div className={`pt-2 border-t flex items-center justify-between text-[11px] sm:text-xs shrink-0 ${
                isNightMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'
              }`}>
                <span className={`font-semibold ${isNightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {carouselView === 'leave'
                    ? `Page ${currentPage + 1} of ${totalLeavePages}`
                    : carouselView === 'notices'
                    ? `Page ${currentPage + 1} of ${totalNoticePages}`
                    : `Page ${currentPage + 1} of ${totalMemoryPages}`}
                </span>

                <div className={`flex items-center gap-2 transition-opacity duration-500 ${
                  isNavVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    className={`p-1 rounded transition ${
                      isNightMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => advanceRotation()}
                    className={`p-1 rounded transition ${
                      isNightMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>

            {/* ========================================================
                SIDE 2: DEPARTMENT DUTY ROSTERS (NO SWITCHING)
                ALWAYS VISIBLE, STABLE, CLINICAL SHIFT BOARD
                ======================================================== */}
            {isSplitScreen && (
              <section
                className={`min-h-0 h-full flex flex-col justify-between rounded-2xl xl:rounded-3xl border transition-colors duration-200 ${
                  isNightMode
                    ? 'bg-slate-950/60 border-slate-800 shadow-xl'
                    : 'bg-white border-slate-200 shadow-md'
                } ${
                  tvFitScale === 'compact_tv' ? 'p-2 sm:p-2.5 xl:p-3' : 'p-2.5 sm:p-3 xl:p-3.5'
                } overflow-hidden ${
                  splitRatio === '55_45'
                    ? 'lg:col-span-5'
                    : splitRatio === '45_55'
                    ? 'lg:col-span-7'
                    : ''
                }`}
              >
                {/* Header Banner on Right Side */}
                <div className={`border-b pb-2 mb-2 sm:mb-2.5 space-y-1.5 shrink-0 ${
                  isNightMode ? 'border-slate-800' : 'border-slate-200'
                }`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Building className={`w-4 h-4 shrink-0 ${isNightMode ? 'text-teal-400' : 'text-teal-600'}`} />
                      <div>
                        <h2 className={`text-xs sm:text-sm font-black uppercase tracking-wider leading-tight ${
                          isNightMode ? 'text-slate-200' : 'text-slate-900'
                        }`}>
                          Department Duty Rosters
                        </h2>
                        <span className={`text-[10px] sm:text-[11px] font-thaana leading-none block ${
                          isNightMode ? 'text-teal-400' : 'text-teal-700'
                        }`}>
                          ބަހާތަކުގެ ޑިއުޓީ ރޯސްޓަރ
                        </span>
                      </div>
                    </div>

                    {/* View Switcher: Weekly Grid vs Today's Shifts */}
                    <div className={`flex items-center gap-1 p-0.5 rounded-lg border shrink-0 ${
                      isNightMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
                    }`}>
                      <button
                        type="button"
                        onClick={() => setRosterDisplayMode('weekly_grid')}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-black flex items-center gap-1 transition ${
                          rosterDisplayMode === 'weekly_grid'
                            ? 'bg-teal-500 text-slate-950 shadow-xs'
                            : isNightMode
                            ? 'text-slate-400 hover:text-slate-200'
                            : 'text-slate-600 hover:text-slate-950'
                        }`}
                      >
                        <Grid className="w-3 h-3" />
                        <span>Weekly Grid</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRosterDisplayMode('today_cards')}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-black flex items-center gap-1 transition ${
                          rosterDisplayMode === 'today_cards'
                            ? 'bg-teal-500 text-slate-950 shadow-xs'
                            : isNightMode
                            ? 'text-slate-400 hover:text-slate-200'
                            : 'text-slate-600 hover:text-slate-950'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>Today's Shifts</span>
                      </button>
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 leading-none">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>Fixed View</span>
                      </span>
                    </div>
                  </div>

                  {/* Department Filter Pills for Today's Cards View */}
                  {rosterDisplayMode === 'today_cards' && rosterDepartments.length > 1 && (
                    <div className="flex items-center gap-1 overflow-x-auto pt-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedDeptFilter('all')}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 transition ${
                          selectedDeptFilter === 'all'
                            ? 'bg-teal-600 text-white shadow-xs'
                            : isNightMode
                            ? 'bg-slate-900 text-slate-400 hover:text-slate-200'
                            : 'bg-slate-100 text-slate-600 hover:text-slate-950'
                        }`}
                      >
                        All ({dutyRosters.length})
                      </button>
                      {rosterDepartments.map((dept) => (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => setSelectedDeptFilter(dept.id)}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 transition ${
                            selectedDeptFilter === dept.id
                              ? 'bg-teal-600 text-white shadow-xs'
                              : isNightMode
                              ? 'bg-slate-900 text-slate-400 hover:text-slate-200'
                              : 'bg-slate-100 text-slate-600 hover:text-slate-950'
                          }`}
                        >
                          {dept.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* VIEW 1: WEEKLY SPREADSHEET GRID (OFFICIAL ROSTER FORMAT) */}
                {rosterDisplayMode === 'weekly_grid' && (
                  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-2 pr-0.5">
                    <WeeklyRosterGrid
                      rosters={weeklyRosters}
                      currentDateStr={getTodayString(tz)}
                      isTvMode={true}
                    />
                  </div>
                )}

                {/* VIEW 2: TODAY'S SHIFT CARDS */}
                {rosterDisplayMode === 'today_cards' && (
                <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2.5 pr-0.5 content-start">
                  {displayedDutyRosters.length === 0 ? (
                    <div className={`col-span-full h-full flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed ${
                      isNightMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <Building className="w-12 h-12 text-slate-400 mb-2" />
                      <h3 className={`text-base font-black ${isNightMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        No Duty Rosters Available for Today
                      </h3>
                      <p className={`text-xs mt-1 max-w-xs ${isNightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Admins can publish department shifts via the Duty Roster & Supervisor panel.
                      </p>
                    </div>
                  ) : (
                    displayedDutyRosters.map((roster) => (
                      <div
                        key={roster.id}
                        className={`rounded-2xl border overflow-hidden shadow-xs flex flex-col ${
                          isNightMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50/80 border-slate-200'
                        }`}
                      >
                        {/* Department & In-Charge Supervisor Header */}
                        <div className={`px-3.5 py-2.5 border-b flex items-center justify-between gap-2 shrink-0 ${
                          isNightMode
                            ? 'bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-slate-800 text-slate-100'
                            : 'bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 border-slate-200 text-slate-900'
                        }`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-xs sm:text-sm font-black tracking-tight truncate">
                                {roster.departmentName}
                              </h3>
                              {roster.departmentNameDhivehi && (
                                <span className={`text-[11px] font-thaana truncate ${
                                  isNightMode ? 'text-slate-400' : 'text-slate-500'
                                }`}>
                                  {roster.departmentNameDhivehi}
                                </span>
                              )}
                            </div>
                            <div className={`text-[10px] sm:text-[11px] font-bold flex items-center gap-1 mt-0.5 truncate ${
                              isNightMode ? 'text-teal-300' : 'text-teal-700'
                            }`}>
                              <UserCheck className={`w-3 h-3 shrink-0 ${isNightMode ? 'text-teal-400' : 'text-teal-600'}`} />
                              <span className="truncate">
                                In-Charge: <strong>{roster.supervisorName}</strong>
                                {roster.supervisorRole ? ` (${roster.supervisorRole})` : ''}
                              </span>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider shrink-0 ${
                            isNightMode
                              ? 'bg-teal-950 text-teal-300 border border-teal-800'
                              : 'bg-teal-100 text-teal-900 border border-teal-200'
                          }`}>
                            {roster.entries.length} Shifts
                          </span>
                        </div>

                        {/* Shift Entries Stack */}
                        <div className="p-2.5 space-y-1.5 flex-1">
                          {roster.entries.map((shift) => {
                            const isMorning = shift.shiftType === 'morning';
                            const isEvening = shift.shiftType === 'evening';
                            const isNight = shift.shiftType === 'night';
                            const isOnCall = shift.isOnCall || shift.shiftType === 'on_call';

                            return (
                              <div
                                key={shift.id}
                                className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition ${
                                  isNightMode
                                    ? isOnCall
                                      ? 'bg-rose-950/30 border-rose-800/80 shadow-xs'
                                      : isNight
                                      ? 'bg-indigo-950/30 border-indigo-800/70'
                                      : isEvening
                                      ? 'bg-blue-950/30 border-blue-800/70'
                                      : 'bg-amber-950/30 border-amber-800/70'
                                    : isOnCall
                                    ? 'bg-rose-50 border-rose-200 text-rose-950 shadow-xs'
                                    : isNight
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-950'
                                    : isEvening
                                    ? 'bg-blue-50 border-blue-200 text-blue-950'
                                    : 'bg-amber-50 border-amber-200 text-amber-950'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {shift.staffPhotoUrl ? (
                                    <img
                                      src={shift.staffPhotoUrl}
                                      alt={shift.staffName}
                                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border shrink-0 ${
                                        isNightMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
                                      }`}
                                    />
                                  ) : (
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-teal-800 text-white font-black text-xs flex items-center justify-center shrink-0">
                                      {shift.staffName.slice(0, 2).toUpperCase()}
                                    </div>
                                  )}

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1">
                                      <h4 className={`text-xs font-black truncate ${
                                        isNightMode ? 'text-slate-100' : 'text-slate-900'
                                      }`}>
                                        {shift.staffName}
                                      </h4>
                                      {isOnCall && (
                                        <span className="px-1 py-0.2 rounded text-[7px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse">
                                          ON-CALL
                                        </span>
                                      )}
                                    </div>
                                    <p className={`text-[10px] font-semibold truncate leading-tight ${
                                      isNightMode ? 'text-slate-400' : 'text-slate-600'
                                    }`}>
                                      {shift.staffDesignation}
                                    </p>
                                    {shift.station && (
                                      <p className={`text-[9px] font-bold truncate leading-tight ${
                                        isNightMode ? 'text-teal-400' : 'text-teal-700'
                                      }`}>
                                        @{shift.station}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black leading-tight ${
                                      isNightMode
                                        ? isOnCall
                                          ? 'bg-rose-900/60 text-rose-200 border border-rose-700'
                                          : isNight
                                          ? 'bg-indigo-900/60 text-indigo-200 border border-indigo-700'
                                          : isEvening
                                          ? 'bg-blue-900/60 text-blue-200 border border-blue-700'
                                          : 'bg-amber-900/60 text-amber-200 border border-amber-700'
                                        : isOnCall
                                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                        : isNight
                                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                        : isEvening
                                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                                    }`}
                                  >
                                    {isMorning && <Sun className="w-2.5 h-2.5" />}
                                    {isEvening && <Sunset className="w-2.5 h-2.5" />}
                                    {isNight && <Moon className="w-2.5 h-2.5" />}
                                    {isOnCall && <Phone className="w-2.5 h-2.5" />}
                                    <span>{shift.startTime} - {shift.endTime}</span>
                                  </span>
                                  <p className={`text-[9px] font-bold mt-0.5 truncate max-w-[90px] ${
                                    isNightMode ? 'text-slate-400' : 'text-slate-500'
                                  }`}>
                                    {shift.shiftName}
                                  </p>
                                </div>
                              </div>
                            );
                          })}

                          {roster.notes && (
                            <div className={`border rounded-lg p-1.5 text-[10px] ${
                              isNightMode ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                            }`}>
                              <strong className={isNightMode ? 'text-teal-400 font-semibold' : 'text-teal-700 font-semibold'}>Handover:</strong> {roster.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                )}

                <div className={`pt-2 border-t flex items-center justify-between text-[10px] sm:text-[11px] font-semibold shrink-0 ${
                  isNightMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-500'
                }`}>
                  <span>Maduvvari Health Centre 24/7 Clinical Emergency</span>
                  <span>Hotline: 6580043</span>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Bottom Announcement Strip */}
      <AnnouncementStrip />

      {/* Floating Movement of the Day Trigger Pill (for TV touch/click or manual preview, auto-hides after 5s inactive mouse) */}
      {dailyMedia && !isDailyMediaModalOpen && (
        <button
          type="button"
          onClick={() => setIsDailyMediaModalOpen(true)}
          className={`fixed bottom-14 right-6 z-40 px-3.5 py-1.5 rounded-full bg-slate-900/90 hover:bg-teal-700 text-white text-xs font-bold shadow-lg border border-teal-500/50 backdrop-blur-md flex items-center gap-2 transition-all duration-500 transform hover:scale-105 ${
            isNavVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
          title={`Movement of the Day: Pops up every ${dailyMedia.intervalMinutes}m`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
          </span>
          <span className="text-teal-300 font-extrabold uppercase tracking-wider text-[10px]">
            {dailyMedia.type === 'video' ? 'Video of Day' : 'Photo of Day'}
          </span>
          <span className="hidden sm:inline text-slate-300 text-[11px] font-normal">
            • {dailyMedia.title}
          </span>
        </button>
      )}

      {/* Fullscreen Movement of the Day Takeover Modal */}
      {isDailyMediaModalOpen && dailyMedia && (
        <MovementOfTheDayModal
          media={dailyMedia}
          onClose={() => setIsDailyMediaModalOpen(false)}
          timezone={tz}
        />
      )}
    </div>
  );
};
