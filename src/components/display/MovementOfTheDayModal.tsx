import React, { useState, useEffect, useRef } from 'react';
import { DailyMedia } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import {
  X,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Clock,
  Sparkles,
  Camera,
  Film,
  Maximize2,
  CheckCircle2,
} from 'lucide-react';

interface MovementOfTheDayModalProps {
  media: DailyMedia;
  onClose: () => void;
  timezone?: string;
}

export const MovementOfTheDayModal: React.FC<MovementOfTheDayModalProps> = ({
  media,
  onClose,
  timezone = 'Indian/Maldives',
}) => {
  const isVideo = media.type === 'video';
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Audio & Playback
  const [isMuted, setIsMuted] = useState<boolean>(media.autoPlayMuted);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Timing
  // For photo: defaults to media.photoDurationSeconds (default: 60)
  // For video: if playVideoFullLength is true, length is dynamically determined from video metadata
  const totalDuration = isVideo
    ? (media.playVideoFullLength ? (media.videoDurationSeconds || 60) : (media.photoDurationSeconds || 60))
    : (media.photoDurationSeconds || 60);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(totalDuration);
  const [actualDuration, setActualDuration] = useState<number>(totalDuration);

  // Handle Video Metadata & Duration
  const handleLoadedMetadata = () => {
    if (videoRef.current && isVideo) {
      const dur = Math.ceil(videoRef.current.duration);
      if (dur > 0 && media.playVideoFullLength) {
        setActualDuration(dur);
        setRemainingSeconds(dur);
      }
      videoRef.current.play().catch((err) => {
        console.warn('Autoplay prevented, switching to muted:', err);
        setIsMuted(true);
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      });
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && isVideo && media.playVideoFullLength) {
      const curr = videoRef.current.currentTime;
      const dur = videoRef.current.duration || actualDuration;
      const rem = Math.max(0, Math.ceil(dur - curr));
      setRemainingSeconds(rem);
    }
  };

  const handleVideoEnded = () => {
    if (isVideo && media.playVideoFullLength) {
      // Disappear immediately when video completes
      onClose();
    }
  };

  // Photo Countdown Timer: decrement remaining seconds every second
  useEffect(() => {
    if (isVideo && media.playVideoFullLength) {
      return; // Handled by video playback events
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isVideo, media.playVideoFullLength]);

  // Safely trigger onClose when countdown finishes (outside of render)
  useEffect(() => {
    if (isVideo && media.playVideoFullLength) {
      return;
    }

    if (remainingSeconds <= 0) {
      onClose();
    }
  }, [remainingSeconds, isVideo, media.playVideoFullLength, onClose]);

  // Keyboard shortcut: Escape to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    } else {
      setIsMuted(!isMuted);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const progressPercent = actualDuration > 0
    ? Math.max(0, Math.min(100, ((actualDuration - remainingSeconds) / actualDuration) * 100))
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col justify-between overflow-hidden select-none transition-all duration-500 animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Animated Progress Bar */}
      <div className="w-full bg-slate-800/60 h-1.5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-teal-400 via-emerald-400 to-amber-400 transition-all duration-300 ease-linear shadow-[0_0_12px_rgba(20,184,166,0.6)]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Header Bar */}
      <header className="px-6 py-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent z-10 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-inner">
              {isVideo ? <Film className="w-6 h-6 animate-pulse" /> : <Camera className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-bold uppercase tracking-wider">
                  {isVideo ? 'Video of the Day' : 'Photo of the Day'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold" dir="rtl">
                  މިއަދުގެ ހަރަކާތް
                </span>
              </div>
              <h2 className="text-white text-lg sm:text-xl font-black tracking-tight mt-0.5">
                Maduvvari Health Centre • Movement of the Day
              </h2>
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          {/* Countdown timer badge */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-300 text-xs sm:text-sm font-semibold shadow-inner">
            <Clock className="w-4 h-4 text-teal-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span>
              Closes in <strong className="text-white font-mono text-base">{remainingSeconds}s</strong>
            </span>
          </div>

          {/* Sound Toggle for Video */}
          {isVideo && (
            <button
              type="button"
              onClick={toggleAudio}
              className={`p-2.5 rounded-xl border transition flex items-center gap-2 ${
                isMuted
                  ? 'bg-amber-500/20 border-amber-400/40 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-teal-500/20 border-teal-400/40 text-teal-300 hover:bg-teal-500/30'
              }`}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              <span className="text-xs font-bold hidden sm:inline">
                {isMuted ? 'Unmute' : 'Audio On'}
              </span>
            </button>
          )}

          {/* Video Play/Pause */}
          {isVideo && (
            <button
              type="button"
              onClick={togglePlayPause}
              className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title={isPlaying ? 'Pause Video' : 'Play Video'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
          )}

          {/* Dismiss / Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-400 hover:text-white hover:bg-rose-600 hover:border-rose-500 transition shadow-lg flex items-center gap-2"
            title="Dismiss to Live Board (Esc)"
          >
            <X className="w-5 h-5" />
            <span className="text-xs font-bold hidden sm:inline">Dismiss</span>
          </button>
        </div>
      </header>

      {/* Main Fullscreen Showcase Stage */}
      <main className="flex-1 relative flex items-center justify-center p-4 sm:p-8 overflow-hidden">
        {isVideo ? (
          <div className="relative w-full h-full max-h-[76vh] flex items-center justify-center">
            <div className="relative inline-flex items-center justify-center max-h-[76vh] max-w-full">
              <video
                ref={videoRef}
                src={media.mediaUrl}
                poster={media.thumbnailUrl}
                autoPlay
                playsInline
                muted={isMuted}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleVideoEnded}
                className="max-h-[76vh] w-auto max-w-full rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] border border-white/10 object-contain bg-black"
              />

              {/* Title of Media overlay on top of video, fit in one line without text background */}
              <div className="absolute top-3 sm:top-5 inset-x-0 flex items-center justify-center px-4 sm:px-8 pointer-events-none select-none z-20">
                <div className="max-w-5xl w-full flex items-center justify-center overflow-hidden">
                  <div className="flex items-center justify-center gap-3 sm:gap-4 max-w-full overflow-hidden whitespace-nowrap">
                    <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight truncate [text-shadow:_0_2px_16px_rgb(0_0_0_/_95%),_0_4px_30px_rgb(0_0_0_/_90%),_0_1px_4px_rgb(0_0_0_/_100%)] drop-shadow-[0_8px_24px_rgba(0,0,0,0.95)]">
                      {media.title}
                    </h1>
                    {media.titleDhivehi && (
                      <span
                        className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-teal-300 font-faruma truncate shrink-0 [text-shadow:_0_2px_16px_rgb(0_0_0_/_95%),_0_4px_30px_rgb(0_0_0_/_90%),_0_1px_4px_rgb(0_0_0_/_100%)] drop-shadow-[0_8px_24px_rgba(0,0,0,0.95)]"
                        dir="rtl"
                      >
                        • {media.titleDhivehi}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full max-h-[76vh] flex items-center justify-center">
            <div className="relative inline-flex items-center justify-center max-h-[76vh] max-w-full">
              <img
                src={media.mediaUrl}
                alt={media.title}
                className="max-h-[76vh] w-auto max-w-full rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] border border-white/10 object-contain animate-in zoom-in-95 duration-500"
              />

              {/* Title of Media overlay on top of photo, fit in one line without text background */}
              <div className="absolute top-3 sm:top-5 inset-x-0 flex items-center justify-center px-4 sm:px-8 pointer-events-none select-none z-20">
                <div className="max-w-5xl w-full flex items-center justify-center overflow-hidden">
                  <div className="flex items-center justify-center gap-3 sm:gap-4 max-w-full overflow-hidden whitespace-nowrap">
                    <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight truncate [text-shadow:_0_2px_16px_rgb(0_0_0_/_95%),_0_4px_30px_rgb(0_0_0_/_90%),_0_1px_4px_rgb(0_0_0_/_100%)] drop-shadow-[0_8px_24px_rgba(0,0,0,0.95)]">
                      {media.title}
                    </h1>
                    {media.titleDhivehi && (
                      <span
                        className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-teal-300 font-faruma truncate shrink-0 [text-shadow:_0_2px_16px_rgb(0_0_0_/_95%),_0_4px_30px_rgb(0_0_0_/_90%),_0_1px_4px_rgb(0_0_0_/_100%)] drop-shadow-[0_8px_24px_rgba(0,0,0,0.95)]"
                        dir="rtl"
                      >
                        • {media.titleDhivehi}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Narrative & Metadata Bar */}
      <footer className="px-6 py-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent border-t border-white/10 z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2 text-teal-400 text-xs font-bold tracking-wide uppercase">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{formatDate(media.date, timezone)}</span>
              <span>•</span>
              <span className="text-slate-400 font-normal">Active Movement Broadcast</span>
            </div>

            {/* If video, show title in footer (or keep for video context) */}
            {isVideo && (
              <>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                  {media.title}
                </h1>

                {media.titleDhivehi && (
                  <h2 className="text-xl sm:text-2xl font-bold text-teal-300 tracking-wide font-faruma leading-relaxed" dir="rtl">
                    {media.titleDhivehi}
                  </h2>
                )}
              </>
            )}

            {media.caption && (
              <p className="text-slate-200 text-sm sm:text-base leading-relaxed line-clamp-2">
                {media.caption}
              </p>
            )}

            {media.captionDhivehi && (
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-faruma line-clamp-2" dir="rtl">
                {media.captionDhivehi}
              </p>
            )}
          </div>

          <div className="flex flex-col items-start md:items-end text-xs text-slate-400 shrink-0">
            <span className="text-slate-300 font-semibold">Maduvvari Health Centre Terminal</span>
            <span>Broadcast interval: every {media.intervalMinutes}m</span>
            <span className="text-emerald-400 flex items-center gap-1 mt-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Auto-purges next day
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
