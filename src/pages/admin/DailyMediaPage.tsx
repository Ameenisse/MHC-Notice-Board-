import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  getDailyMediaList,
  saveDailyMedia,
  deleteDailyMedia,
  purgeExpiredDailyMedia,
  compressImage,
  compressImageToTarget,
} from '../../services/db';
import { DailyMedia } from '../../types';
import { getTodayString, formatDate } from '../../utils/dateUtils';
import { MovementOfTheDayModal } from '../../components/display/MovementOfTheDayModal';
import {
  Camera,
  Film,
  Upload,
  Clock,
  Trash2,
  Edit2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play,
  Volume2,
  VolumeX,
  Maximize2,
  Info,
  Calendar,
  Layers,
  FileVideo,
  FileImage,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export const DailyMediaPage: React.FC = () => {
  const { currentUser, isDemoMode, settings } = useApp();
  const tz = settings.timezone || 'Indian/Maldives';
  const todayStr = getTodayString(tz);

  const [mediaList, setMediaList] = useState<DailyMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [purgedMessage, setPurgedMessage] = useState<string | null>(null);

  // Modal / Preview state
  const [previewMedia, setPreviewMedia] = useState<DailyMedia | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    type: 'photo' as 'photo' | 'video',
    mediaUrl: '',
    thumbnailUrl: '',
    fileName: '',
    title: 'Movement of the Day',
    titleDhivehi: 'މިއަދުގެ ހަރަކާތް',
    caption: '',
    captionDhivehi: '',
    intervalMinutes: 60, // default: every 1 hour
    photoDurationSeconds: 60, // default: disappear after 1 min
    videoDurationSeconds: 0,
    playVideoFullLength: true,
    autoPlayMuted: false,
    active: true,
  });

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // Automatically purge previous days' media upon loading
      const purged = await purgeExpiredDailyMedia(todayStr, isDemoMode);
      if (purged > 0) {
        setPurgedMessage(`Auto-cleaned ${purged} expired media record(s) from previous days.`);
      }
      const data = await getDailyMediaList(isDemoMode);
      setMediaList(data);
    } catch (err) {
      console.error('Error loading daily media:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemoMode]);

  const showNotification = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  // Handle File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const isVid = file.type.startsWith('video/');
      const fileType = isVid ? 'video' : 'photo';

      if (isVid) {
        if (file.size > 15 * 1024 * 1024) {
          alert('Video is larger than 15MB. Please select a shorter or compressed clip under 15MB for rapid TV display loading.');
          setUploading(false);
          return;
        }

        // Read video as data URL or object URL
        const reader = new FileReader();
        reader.onload = (event) => {
          const videoDataUrl = event.target?.result as string;
          // Detect video duration
          const tempVideo = document.createElement('video');
          tempVideo.src = videoDataUrl;
          tempVideo.onloadedmetadata = () => {
            const dur = Math.ceil(tempVideo.duration) || 30;
            setFormData((prev) => ({
              ...prev,
              type: 'video',
              mediaUrl: videoDataUrl,
              fileName: file.name,
              videoDurationSeconds: dur,
              playVideoFullLength: true,
              title: prev.title || `Movement of the Day: ${file.name.replace(/\.[^/.]+$/, '')}`,
            }));
            setUploading(false);
          };
          tempVideo.onerror = () => {
            setFormData((prev) => ({
              ...prev,
              type: 'video',
              mediaUrl: videoDataUrl,
              fileName: file.name,
              videoDurationSeconds: 60,
              playVideoFullLength: true,
            }));
            setUploading(false);
          };
        };
        reader.readAsDataURL(file);
      } else {
        // Adaptively compress photo to strictly under 350KB ensuring safe Firestore storage
        const compressedBlob = await compressImageToTarget(file, 1280, 350_000);
        const reader = new FileReader();
        reader.onload = (event) => {
          const photoDataUrl = event.target?.result as string;
          setFormData((prev) => ({
            ...prev,
            type: 'photo',
            mediaUrl: photoDataUrl,
            fileName: file.name,
            title: prev.title || `Movement of the Day: ${file.name.replace(/\.[^/.]+$/, '')}`,
          }));
          setUploading(false);
        };
        reader.readAsDataURL(compressedBlob);
      }
    } catch (err) {
      console.error('File read error:', err);
      alert('Error reading uploaded file. Please try a different photo or video.');
      setUploading(false);
    }
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({
      type: 'photo',
      mediaUrl: '',
      thumbnailUrl: '',
      fileName: '',
      title: 'Movement of the Day',
      titleDhivehi: 'މިއަދުގެ ހަރަކާތް',
      caption: '',
      captionDhivehi: '',
      intervalMinutes: 60, // default: every 1 hour
      photoDurationSeconds: 60, // default: disappear after 1 min
      videoDurationSeconds: 0,
      playVideoFullLength: true,
      autoPlayMuted: false,
      active: true,
    });
    setIsFormOpen(true);
  };

  const handleEdit = (item: DailyMedia) => {
    setEditingId(item.id);
    setFormData({
      type: item.type,
      mediaUrl: item.mediaUrl,
      thumbnailUrl: item.thumbnailUrl || '',
      fileName: item.fileName || '',
      title: item.title,
      titleDhivehi: item.titleDhivehi || '',
      caption: item.caption || '',
      captionDhivehi: item.captionDhivehi || '',
      intervalMinutes: item.intervalMinutes || 60,
      photoDurationSeconds: item.photoDurationSeconds || 60,
      videoDurationSeconds: item.videoDurationSeconds || 0,
      playVideoFullLength: item.playVideoFullLength ?? true,
      autoPlayMuted: item.autoPlayMuted ?? false,
      active: item.active,
    });
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.mediaUrl.trim()) {
      alert('Please upload a photo or video or specify a media URL.');
      return;
    }

    try {
      await saveDailyMedia(
        {
          ...(editingId ? { id: editingId } : {}),
          ...formData,
          date: todayStr, // Locked to current day
        },
        currentUser?.email || 'admin@mhc.gov.mv',
        isDemoMode
      );
      setIsFormOpen(false);
      await loadData();
      showNotification(
        editingId
          ? 'Updated Movement of the Day settings successfully!'
          : 'Published Movement of the Day! It will now appear on TV display screens.'
      );
    } catch (err: any) {
      console.error('Error saving media:', err);
      alert(`Failed to save media of the day: ${err?.message || err || 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This will stop it from displaying on TV screens.`)) {
      return;
    }
    try {
      await deleteDailyMedia(id, currentUser?.email || 'admin@mhc.gov.mv', isDemoMode);
      await loadData();
      showNotification(`Deleted "${title}".`);
    } catch (err) {
      console.error('Error deleting media:', err);
    }
  };

  const handleManualPurge = async () => {
    try {
      const purged = await purgeExpiredDailyMedia(todayStr, isDemoMode);
      await loadData();
      showNotification(
        purged > 0
          ? `Purged ${purged} expired media items older than today (${todayStr}).`
          : 'Database is clean. No expired previous day media found.'
      );
    } catch (err) {
      console.error('Manual purge error:', err);
    }
  };

  const todayMedia = mediaList.find((m) => m.date === todayStr);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-md">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Photo & Video (Movements) of the Day
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-xs font-bold font-faruma" dir="rtl">
                  މިއަދުގެ ހަރަކާތް / ފޮޓޯ އަދި ވީޑިއޯ
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Upload today’s highlight photo or movement video to appear on TV screens every 1 hour (default) for 1 minute (or full video length).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleManualPurge}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 transition flex items-center gap-1.5"
            title="Clean up media from previous days"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>Clean Expired Days</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNew}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-sm transition"
          >
            <Upload className="w-4 h-4" />
            <span>{todayMedia ? 'Upload / Replace Today’s Media' : 'Upload Movement of the Day'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {feedback && (
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-sm font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {purgedMessage && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-500" />
            {purgedMessage}
          </span>
          <button
            onClick={() => setPurgedMessage(null)}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Auto-Delete Rules Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-900 via-slate-900 to-slate-900 text-white shadow-md border border-teal-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0">
            <Clock className="w-5 h-5 text-teal-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">System Lifecycle Automation</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                Auto-Delete Active
              </span>
            </div>
            <p className="text-slate-300 text-xs mt-0.5">
              Today is <strong>{formatDate(todayStr, tz)}</strong> ({todayStr}). Previous day media is automatically purged upon midnight rollover so only fresh daily movements are displayed.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 font-mono">
            Default Interval: <strong>1 hr (60m)</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 font-mono">
            Duration: <strong>1 min / Full Video</strong>
          </div>
        </div>
      </div>

      {/* Active Today's Spotlight Card */}
      {todayMedia ? (
        <div className="bg-white rounded-2xl border-2 border-teal-500/40 shadow-lg overflow-hidden transition">
          <div className="px-6 py-4 bg-teal-50 border-b border-teal-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
              </span>
              <span className="text-teal-900 font-bold text-sm">
                Active On TV Screens Today ({todayMedia.date})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewMedia(todayMedia)}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Test Fullscreen Modal Now</span>
              </button>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Media Preview Box */}
            <div className="lg:col-span-1 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center min-h-[220px] max-h-[300px] border border-slate-200 relative group">
              {todayMedia.type === 'video' ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    src={todayMedia.mediaUrl}
                    controls
                    className="w-full h-full max-h-[300px] object-contain"
                  />
                  {/* Title overlay on top in fit one line without text background */}
                  <div className="absolute top-2 inset-x-0 flex items-center justify-center px-3 pointer-events-none select-none z-20">
                    <div className="flex items-center justify-center gap-1.5 max-w-full overflow-hidden whitespace-nowrap">
                      <p className="text-xs sm:text-sm font-black text-white tracking-tight truncate [text-shadow:_0_2px_8px_rgb(0_0_0_/_95%),_0_1px_3px_rgb(0_0_0_/_95%)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                        {todayMedia.title}
                      </p>
                      {todayMedia.titleDhivehi && (
                        <span className="text-[11px] sm:text-xs font-bold text-teal-300 font-faruma truncate shrink-0 [text-shadow:_0_2px_8px_rgb(0_0_0_/_95%)]" dir="rtl">
                          • {todayMedia.titleDhivehi}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={todayMedia.mediaUrl}
                    alt={todayMedia.title}
                    className="w-full h-full max-h-[300px] object-contain"
                  />
                  {/* Title overlay on top in fit one line without text background */}
                  <div className="absolute top-2 inset-x-0 flex items-center justify-center px-3 pointer-events-none select-none z-20">
                    <div className="flex items-center justify-center gap-1.5 max-w-full overflow-hidden whitespace-nowrap">
                      <p className="text-xs sm:text-sm font-black text-white tracking-tight truncate [text-shadow:_0_2px_8px_rgb(0_0_0_/_95%),_0_1px_3px_rgb(0_0_0_/_95%)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                        {todayMedia.title}
                      </p>
                      {todayMedia.titleDhivehi && (
                        <span className="text-[11px] sm:text-xs font-bold text-teal-300 font-faruma truncate shrink-0 [text-shadow:_0_2px_8px_rgb(0_0_0_/_95%)]" dir="rtl">
                          • {todayMedia.titleDhivehi}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/70 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-xs flex items-center gap-1 z-10">
                {todayMedia.type === 'video' ? <Film className="w-3.5 h-3.5 text-teal-400" /> : <Camera className="w-3.5 h-3.5 text-teal-400" />}
                {todayMedia.type}
              </span>
            </div>

            {/* Content & Rules Detail */}
            <div className="lg:col-span-2 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${todayMedia.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {todayMedia.active ? 'Broadcasting Active' : 'Paused / Inactive'}
                  </span>
                  <span className="text-xs text-slate-400">
                    Uploaded: {new Date(todayMedia.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <h3 className="text-xl font-black text-slate-900 mt-2">
                  {todayMedia.title}
                </h3>
                {todayMedia.titleDhivehi && (
                  <h4 className="text-lg font-bold text-teal-700 font-faruma mt-0.5" dir="rtl">
                    {todayMedia.titleDhivehi}
                  </h4>
                )}

                {todayMedia.caption && (
                  <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                    {todayMedia.caption}
                  </p>
                )}
                {todayMedia.captionDhivehi && (
                  <p className="text-slate-600 text-sm mt-1 font-faruma leading-relaxed" dir="rtl">
                    {todayMedia.captionDhivehi}
                  </p>
                )}
              </div>

              {/* Timing Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs text-slate-500 font-medium block">Repeat Interval</span>
                  <span className="text-sm font-black text-slate-800 flex items-center gap-1 mt-0.5">
                    <Clock className="w-4 h-4 text-teal-600" />
                    Every {todayMedia.intervalMinutes} min
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 font-medium block">Fullscreen Duration</span>
                  <span className="text-sm font-black text-slate-800 flex items-center gap-1 mt-0.5">
                    {todayMedia.type === 'video' && todayMedia.playVideoFullLength ? (
                      <span className="text-teal-700">Full Video Length (~{todayMedia.videoDurationSeconds || '?'}s)</span>
                    ) : (
                      <span>{todayMedia.photoDurationSeconds} seconds</span>
                    )}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-500 font-medium block">Audio Setting</span>
                  <span className="text-sm font-black text-slate-800 flex items-center gap-1 mt-0.5">
                    {todayMedia.autoPlayMuted ? <VolumeX className="w-4 h-4 text-amber-500" /> : <Volume2 className="w-4 h-4 text-teal-600" />}
                    {todayMedia.autoPlayMuted ? 'Muted Default' : 'Sound Enabled'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleEdit(todayMedia)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition border border-slate-300"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Configure Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(todayMedia.id, todayMedia.title)}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition border border-rose-200"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Media</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-teal-100 text-teal-600 flex items-center justify-center mx-auto shadow-inner">
            <Camera className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">No Movement of the Day uploaded yet for today</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto mt-1">
              Upload a photo or video clip of today's health camps, surgeries, emergency drills, or patient care highlights to broadcast on all connected TV screens.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenNew}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 shadow-sm transition"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Photo / Video Now</span>
          </button>
        </div>
      )}

      {/* Upload / Edit Modal Form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-teal-700 to-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Film className="w-5 h-5 text-teal-300" />
                <h3 className="text-lg font-bold">
                  {editingId ? 'Configure Movement of the Day' : 'Upload Movement of the Day (Photo / Video)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg text-teal-200 hover:text-white hover:bg-teal-600/50 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSave} className="p-6 space-y-6">
              {/* Media Upload Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Select Photo or Video File
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {formData.mediaUrl ? (
                  <div className="relative rounded-xl border border-slate-300 overflow-hidden bg-slate-900 p-2 flex flex-col items-center">
                    {formData.type === 'video' ? (
                      <video
                        src={formData.mediaUrl}
                        controls
                        className="max-h-64 w-auto rounded-lg"
                      />
                    ) : (
                      <img
                        src={formData.mediaUrl}
                        alt="Preview"
                        className="max-h-64 w-auto object-contain rounded-lg"
                      />
                    )}
                    <div className="w-full flex items-center justify-between mt-2 px-2 text-xs text-slate-300">
                      <span className="truncate max-w-xs">{formData.fileName || 'Selected media'}</span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-teal-400 hover:text-teal-300 font-bold underline ml-2"
                      >
                        Change File
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-teal-50/30 transition cursor-pointer"
                  >
                    <div className="h-12 w-12 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center mx-auto mb-3">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-slate-800 block">
                      Click to choose Photo or Video from device
                    </span>
                    <span className="text-xs text-slate-500 mt-1 block">
                      Supports PNG, JPG, WEBP, or MP4, WebM video clips
                    </span>
                    {uploading && (
                      <span className="text-xs font-bold text-teal-600 animate-pulse mt-3 block">
                        Processing & preparing media...
                      </span>
                    )}
                  </div>
                )}

                {/* Or Direct URL option */}
                <div className="mt-3">
                  <span className="text-xs text-slate-500 font-medium block mb-1">
                    Or paste external Image / Video URL:
                  </span>
                  <input
                    type="url"
                    value={formData.mediaUrl.startsWith('data:') ? '' : formData.mediaUrl}
                    onChange={(e) => {
                      const url = e.target.value;
                      const isVid = url.endsWith('.mp4') || url.endsWith('.webm') || url.includes('video');
                      setFormData((prev) => ({
                        ...prev,
                        mediaUrl: url,
                        type: isVid ? 'video' : prev.type,
                      }));
                    }}
                    placeholder="https://example.com/daily-highlight.mp4"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Title & Dhivehi Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Title (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Community Health Camp Highlights"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Title (Dhivehi / Thaana)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={formData.titleDhivehi}
                    onChange={(e) => setFormData({ ...formData, titleDhivehi: e.target.value })}
                    placeholder="މިއަދުގެ ހަރަކާތް: އާންމު ސިއްޙަތު ޕްރޮގްރާމް"
                    className="w-full px-3 py-2 text-sm font-faruma border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Caption & Dhivehi Caption */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Caption / Description (English)
                  </label>
                  <textarea
                    rows={2}
                    value={formData.caption}
                    onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                    placeholder="Brief description of today's event or milestone..."
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Caption (Dhivehi / Thaana)
                  </label>
                  <textarea
                    rows={2}
                    dir="rtl"
                    value={formData.captionDhivehi}
                    onChange={(e) => setFormData({ ...formData, captionDhivehi: e.target.value })}
                    placeholder="މަޑުއްވަރީ ސިއްޙީ މަރުކަޒުގައި ކުރިއަށްދިޔަ މިއަދުގެ ހަރަކާތް..."
                    className="w-full px-3 py-2 text-xs sm:text-sm font-faruma border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* TIMING CONFIGURATION (Every 1hr default, disappear after 1min / video length) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-teal-600" />
                  Timing & Display Interval Controls
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Interval */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Appear on full screen every:
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={formData.intervalMinutes}
                        onChange={(e) => setFormData({ ...formData, intervalMinutes: Number(e.target.value) })}
                        className="px-3 py-2 text-sm font-bold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                      >
                        <option value={15}>Every 15 minutes</option>
                        <option value={30}>Every 30 minutes</option>
                        <option value={45}>Every 45 minutes</option>
                        <option value={60}>Every 1 hour (Default)</option>
                        <option value={90}>Every 1.5 hours (90m)</option>
                        <option value={120}>Every 2 hours (120m)</option>
                      </select>
                    </div>
                    <span className="text-xs text-slate-500 mt-1 block">
                      Controls how often the TV display triggers fullscreen takeover.
                    </span>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Photo Display Duration (Disappear after):
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={formData.photoDurationSeconds}
                        onChange={(e) => setFormData({ ...formData, photoDurationSeconds: Number(e.target.value) })}
                        className="px-3 py-2 text-sm font-bold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                      >
                        <option value={15}>15 seconds</option>
                        <option value={30}>30 seconds</option>
                        <option value={45}>45 seconds</option>
                        <option value={60}>1 minute (60s - Default)</option>
                        <option value={90}>1.5 minutes (90s)</option>
                        <option value={120}>2 minutes (120s)</option>
                      </select>
                    </div>
                    <span className="text-xs text-slate-500 mt-1 block">
                      Applies when photo is active.
                    </span>
                  </div>
                </div>

                {/* Video specific controls */}
                {formData.type === 'video' && (
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-teal-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.playVideoFullLength}
                        onChange={(e) => setFormData({ ...formData, playVideoFullLength: e.target.checked })}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span>Video appearance duration according to video length (auto-close when video ends)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-teal-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.autoPlayMuted}
                        onChange={(e) => setFormData({ ...formData, autoPlayMuted: e.target.checked })}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span>Mute audio by default (staff can unmute via on-screen button)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Enable Broadcast</span>
                  <span className="text-xs text-slate-500">
                    When active, TV screens will pop up this media every {formData.intervalMinutes}m.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-xs transition"
                >
                  {editingId ? 'Save Configuration' : 'Publish Movement of the Day'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Test Preview Modal */}
      {previewMedia && (
        <MovementOfTheDayModal
          media={previewMedia}
          onClose={() => setPreviewMedia(null)}
          timezone={tz}
        />
      )}
    </div>
  );
};
