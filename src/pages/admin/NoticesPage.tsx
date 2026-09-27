import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  getNoticesList,
  saveNotice,
  archiveNotice,
  compressImage,
  uploadFile,
} from '../../services/db';
import { Notice, NoticePriority, NoticeStatus } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import {
  Bell,
  Search,
  Plus,
  Edit2,
  Trash2,
  Upload,
  FileText,
  AlertTriangle,
  Clock,
  Archive,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Clipboard,
  Sparkles,
} from 'lucide-react';

export const NoticesPage: React.FC = () => {
  const { currentUser, isDemoMode } = useApp();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs: 'active' | 'scheduled' | 'archived'
  const [activeTab, setActiveTab] = useState<'active' | 'scheduled' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | NoticePriority>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [titleDhivehi, setTitleDhivehi] = useState('');
  const [message, setMessage] = useState('');
  const [messageDhivehi, setMessageDhivehi] = useState('');
  const [priority, setPriority] = useState<NoticePriority>('normal');
  const [status, setStatus] = useState<NoticeStatus>('published');
  const [publishStart, setPublishStart] = useState('');
  const [publishEnd, setPublishEnd] = useState('');

  // Attachment State
  const [attachmentType, setAttachmentType] = useState<'none' | 'image' | 'pdf'>('none');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentFileName, setAttachmentFileName] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');

  const [selectedAttachmentFile, setSelectedAttachmentFile] = useState<File | null>(null);
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string>('');
  const [coverPreview, setCoverPreview] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Archive Confirm
  const [archiveTarget, setArchiveTarget] = useState<Notice | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getNoticesList(isDemoMode);
      setNotices(data);
    } catch (err) {
      console.error('Error fetching notices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemoMode]);

  // Handle Clipboard Paste for Notice Images
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file, 'attachment');
          break;
        }
      }
    }
  };

  const processImageFile = async (file: File, target: 'attachment' | 'cover') => {
    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    try {
      const compressedBlob = await compressImage(file, 1200, 0.85);
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });

      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'attachment') {
          setAttachmentType('image');
          setSelectedAttachmentFile(compressedFile);
          setAttachmentPreview(reader.result as string);
          setAttachmentFileName(file.name);
        } else {
          setSelectedCoverFile(compressedFile);
          setCoverPreview(reader.result as string);
        }
      };
      reader.readAsDataURL(compressedBlob);
    } catch (err) {
      setFormError('Failed to process image.');
    }
  };

  const handlePdfFileSelect = (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setFormError('Please select a valid PDF document.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setFormError('PDF exceeds 20MB limit.');
      return;
    }

    setAttachmentType('pdf');
    setSelectedAttachmentFile(file);
    setAttachmentFileName(file.name);
    setAttachmentPreview('');
  };

  const openAddModal = () => {
    setEditingNotice(null);
    setTitle('');
    setTitleDhivehi('');
    setMessage('');
    setMessageDhivehi('');
    setPriority('normal');
    setStatus('published');

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setPublishStart(now.toISOString().slice(0, 16));
    setPublishEnd(nextWeek.toISOString().slice(0, 16));

    setAttachmentType('none');
    setAttachmentUrl('');
    setAttachmentFileName('');
    setCoverImageUrl('');
    setSelectedAttachmentFile(null);
    setSelectedCoverFile(null);
    setAttachmentPreview('');
    setCoverPreview('');
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const openEditModal = (notice: Notice) => {
    setEditingNotice(notice);
    setTitle(notice.title);
    setTitleDhivehi(notice.titleDhivehi || '');
    setMessage(notice.message);
    setMessageDhivehi(notice.messageDhivehi || '');
    setPriority(notice.priority);
    setStatus(notice.status);
    setPublishStart(notice.publishStart ? notice.publishStart.slice(0, 16) : '');
    setPublishEnd(notice.publishEnd ? notice.publishEnd.slice(0, 16) : '');

    setAttachmentType(notice.attachmentType);
    setAttachmentUrl(notice.attachmentUrl || '');
    setAttachmentFileName(notice.attachmentFileName || '');
    setCoverImageUrl(notice.coverImageUrl || '');
    setAttachmentPreview(notice.attachmentType === 'image' ? notice.attachmentUrl || '' : '');
    setCoverPreview(notice.coverImageUrl || '');
    setSelectedAttachmentFile(null);
    setSelectedCoverFile(null);
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setFormError('Title and message body are required.');
      return;
    }

    if (publishStart && publishEnd && publishEnd < publishStart) {
      setFormError('Publish end date and time cannot be earlier than start date and time.');
      return;
    }

    setSaving(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      let finalAttachmentUrl = attachmentUrl;
      let finalCoverUrl = coverImageUrl;

      if (selectedAttachmentFile) {
        finalAttachmentUrl = await uploadFile(
          selectedAttachmentFile,
          'notices',
          `notice_${Date.now()}_${selectedAttachmentFile.name}`,
          isDemoMode
        );
      }

      if (selectedCoverFile) {
        finalCoverUrl = await uploadFile(
          selectedCoverFile,
          'notices/covers',
          `cover_${Date.now()}_${selectedCoverFile.name}`,
          isDemoMode
        );
      }

      await saveNotice(
        {
          id: editingNotice ? editingNotice.id : undefined,
          title: title.trim(),
          titleDhivehi: titleDhivehi.trim() || undefined,
          message: message.trim(),
          messageDhivehi: messageDhivehi.trim() || undefined,
          priority,
          status,
          publishStart: publishStart ? new Date(publishStart).toISOString() : new Date().toISOString(),
          publishEnd: publishEnd ? new Date(publishEnd).toISOString() : undefined,
          attachmentType,
          attachmentUrl: finalAttachmentUrl || undefined,
          attachmentFileName: attachmentFileName || undefined,
          coverImageUrl: finalCoverUrl || undefined,
        },
        currentUser?.email || 'Administrator',
        isDemoMode
      );

      setFormSuccess(
        editingNotice ? 'Notice successfully updated.' : 'New announcement successfully published.'
      );

      await loadData();

      if (!editingNotice) {
        // Reset form for subsequent entries
        setTitle('');
        setTitleDhivehi('');
        setMessage('');
        setMessageDhivehi('');
        setAttachmentType('none');
        setAttachmentUrl('');
        setCoverImageUrl('');
        setAttachmentPreview('');
        setCoverPreview('');
        setSelectedAttachmentFile(null);
        setSelectedCoverFile(null);
      } else {
        setAttachmentUrl(finalAttachmentUrl);
        setCoverImageUrl(finalCoverUrl);
        setSelectedAttachmentFile(null);
        setSelectedCoverFile(null);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save notice.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveNotice = async () => {
    if (!archiveTarget) return;
    try {
      await archiveNotice(
        archiveTarget.id,
        currentUser?.email || 'Administrator',
        isDemoMode
      );
      setArchiveTarget(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to archive notice.');
    }
  };

  // Filtered list
  const filteredNotices = useMemo(() => {
    const now = new Date().toISOString();

    return notices.filter((n) => {
      // Tab categorization
      if (activeTab === 'active') {
        if (n.status !== 'published') return false;
        if (n.publishStart && n.publishStart > now) return false;
        if (n.publishEnd && n.publishEnd < now) return false;
      } else if (activeTab === 'scheduled') {
        if (n.status !== 'published') return false;
        if (!n.publishStart || n.publishStart <= now) return false;
      } else if (activeTab === 'archived') {
        if (n.status === 'archived') return true;
        if (n.publishEnd && n.publishEnd < now) return true;
        return false;
      }

      // Priority filter
      if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.title.toLowerCase().includes(q);
        const matchMsg = n.message.toLowerCase().includes(q);
        if (!matchTitle && !matchMsg) return false;
      }

      return true;
    });
  }, [notices, activeTab, priorityFilter, searchQuery]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Bell className="w-8 h-8 text-indigo-600" />
            <span>Notices & Circulars</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Publish clinical circulars, urgent health advisories, and administrative updates to the TV screen
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Publish New Notice</span>
          </button>
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-bold">
        <button
          onClick={() => setActiveTab('active')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'active'
              ? 'border-indigo-600 text-indigo-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Currently Active</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-900 font-bold">
            {
              notices.filter(
                (n) =>
                  n.status === 'published' &&
                  (!n.publishStart || n.publishStart <= new Date().toISOString()) &&
                  (!n.publishEnd || n.publishEnd >= new Date().toISOString())
              ).length
            }
          </span>
        </button>

        <button
          onClick={() => setActiveTab('scheduled')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'scheduled'
              ? 'border-indigo-600 text-indigo-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Scheduled</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-bold">
            {
              notices.filter(
                (n) => n.status === 'published' && n.publishStart && n.publishStart > new Date().toISOString()
              ).length
            }
          </span>
        </button>

        <button
          onClick={() => setActiveTab('archived')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === 'archived'
              ? 'border-indigo-600 text-indigo-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Archived & Expired</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-bold">
            {
              notices.filter(
                (n) =>
                  n.status === 'archived' ||
                  (n.publishEnd && n.publishEnd < new Date().toISOString())
              ).length
            }
          </span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notice title, content..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-sm focus:outline-none transition"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="normal">Normal</option>
            <option value="important">Important</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Notices Grid */}
      {loading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200">
          <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-sm font-semibold text-slate-600">Loading notices...</p>
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
          <p className="font-bold text-lg text-slate-700">No notices in this view.</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {notices.length === 0
              ? 'No announcements or circulars exist yet. Click below to broadcast an update to the health centre.'
              : 'Click "Publish New Notice" to broadcast an update to the health centre.'}
          </p>
          {notices.length === 0 && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={openAddModal}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Publish New Notice</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotices.map((notice) => {
            const isUrgent = notice.priority === 'urgent';
            const isImportant = notice.priority === 'important';

            return (
              <div
                key={notice.id}
                className={`bg-white rounded-2xl border-2 overflow-hidden shadow-xs flex flex-col justify-between transition-all hover:shadow-sm ${
                  isUrgent
                    ? 'border-rose-500'
                    : isImportant
                    ? 'border-amber-500'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Top Priority Badge */}
                  <div
                    className={`px-4 py-2 flex items-center justify-between text-xs font-black uppercase tracking-wider ${
                      isUrgent
                        ? 'bg-rose-600 text-white'
                        : isImportant
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {isUrgent && <AlertTriangle className="w-3.5 h-3.5" />}
                      <span>{notice.priority}</span>
                    </span>
                    <span className="text-[10px] opacity-85 font-mono">{notice.status}</span>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-3">
                    <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
                      {notice.title}
                    </h3>
                    {notice.titleDhivehi && (
                      <p className="text-xs font-semibold text-slate-500">{notice.titleDhivehi}</p>
                    )}
                    <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                      {notice.message}
                    </p>

                    {/* Attachment Preview thumbnail if present */}
                    {notice.attachmentType === 'image' && notice.attachmentUrl && (
                      <div className="h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                        <img
                          src={notice.attachmentUrl}
                          alt={notice.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {notice.attachmentType === 'pdf' && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-5 h-5 text-rose-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate max-w-[160px]">
                              {notice.attachmentFileName || 'PDF Circular'}
                            </p>
                            <p className="text-[10px] text-slate-500">Official Document</p>
                          </div>
                        </div>
                        {notice.attachmentUrl && (
                          <a
                            href={notice.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-600 hover:text-indigo-600 rounded-lg transition"
                            title="Open Document"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Dates & Actions */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="text-[11px]">
                    <span>Valid: {formatDate(notice.publishEnd?.split('T')[0] || '')}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(notice)}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      title="Edit notice"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {notice.status !== 'archived' && (
                      <button
                        onClick={() => setArchiveTarget(notice)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Archive notice"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Notice Modal */}
      {isModalOpen && (
        <div
          id="notice-modal-overlay"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onPaste={handlePaste}
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-900">
                {editingNotice ? 'Edit Notice or Circular' : 'Publish New Notice'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveNotice} className="mt-5 space-y-4">
              {/* Title Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="notice-title-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Notice Title (English) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="notice-title-input"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Immunization Camp Scheduled"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-indigo-500 rounded-xl text-sm focus:outline-none transition"
                  />
                </div>

                <div>
                  <label htmlFor="notice-dhivehititle-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Notice Title (Dhivehi - Optional)
                  </label>
                  <input
                    id="notice-dhivehititle-input"
                    type="text"
                    dir="rtl"
                    value={titleDhivehi}
                    onChange={(e) => setTitleDhivehi(e.target.value)}
                    placeholder="e.g. ވެކްސިން ޕްރޮގްރާމާ ބެހޭ"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-indigo-500 rounded-xl text-sm focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Message Fields */}
              <div>
                <label htmlFor="notice-message-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Message Body (English) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="notice-message-input"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Detailed public announcement text..."
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-indigo-500 rounded-xl text-sm focus:outline-none transition"
                />
              </div>

              <div>
                <label htmlFor="notice-dhivehimessage-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Message Body (Dhivehi - Optional)
                </label>
                <textarea
                  id="notice-dhivehimessage-input"
                  rows={2}
                  dir="rtl"
                  value={messageDhivehi}
                  onChange={(e) => setMessageDhivehi(e.target.value)}
                  placeholder="ދިވެހި ބަހުން ލިޔުއްވާ..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-indigo-500 rounded-xl text-sm focus:outline-none transition"
                />
              </div>

              {/* Priority & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="notice-priority-select" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Priority
                  </label>
                  <select
                    id="notice-priority-select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as NoticePriority)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-indigo-500 rounded-xl text-sm focus:outline-none cursor-pointer"
                  >
                    <option value="normal">Normal</option>
                    <option value="important">Important (Amber border)</option>
                    <option value="urgent">Urgent (Prominent red border)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="notice-status-select" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Publish Status
                  </label>
                  <select
                    id="notice-status-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as NoticeStatus)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-indigo-500 rounded-xl text-sm focus:outline-none cursor-pointer"
                  >
                    <option value="published">Published (Visible on TV)</option>
                    <option value="draft">Draft (Private draft)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Publishing Window Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="notice-publish-start" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Publish Start Date & Time
                  </label>
                  <input
                    id="notice-publish-start"
                    type="datetime-local"
                    value={publishStart}
                    onChange={(e) => setPublishStart(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-indigo-500 rounded-xl text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="notice-publish-end" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Expiry Date & Time
                  </label>
                  <input
                    id="notice-publish-end"
                    type="datetime-local"
                    value={publishEnd}
                    onChange={(e) => setPublishEnd(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-indigo-500 rounded-xl text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Attachments Section */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Notice Attachment (Optional Image or PDF Circular)
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Hidden inputs */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        if (file.type === 'application/pdf') {
                          handlePdfFileSelect(file);
                        } else {
                          processImageFile(file, 'attachment');
                        }
                      }
                    }}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-indigo-600" />
                    <span>Attach Image or PDF</span>
                  </button>

                  {attachmentType !== 'none' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentType('none');
                        setAttachmentUrl('');
                        setAttachmentFileName('');
                        setAttachmentPreview('');
                        setSelectedAttachmentFile(null);
                      }}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition"
                    >
                      Remove Attachment
                    </button>
                  )}
                </div>

                {/* Attachment Display & Cover for PDF */}
                {attachmentType === 'image' && (attachmentPreview || attachmentUrl) && (
                  <div className="mt-3 relative w-36 h-28 rounded-xl overflow-hidden border border-slate-300">
                    <img
                      src={attachmentPreview || attachmentUrl}
                      alt="Attachment Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {attachmentType === 'pdf' && (
                  <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-6 h-6 text-rose-600 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {attachmentFileName || 'PDF Document Attached'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Viewable via fullscreen viewer on display
                        </p>
                      </div>
                    </div>

                    {/* Optional PDF Cover Image */}
                    <div className="pt-2 border-t border-slate-200">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Optional PDF Cover Image for TV Display
                      </label>
                      <input
                        type="file"
                        ref={coverInputRef}
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            processImageFile(e.target.files[0], 'cover');
                          }
                        }}
                        className="hidden"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => coverInputRef.current?.click()}
                          className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Select Cover Photo
                        </button>
                        {(coverPreview || coverImageUrl) && (
                          <img
                            src={coverPreview || coverImageUrl}
                            alt="Cover"
                            className="w-10 h-10 rounded-lg object-cover border border-slate-300"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  {saving ? 'Publishing...' : editingNotice ? 'Update Notice' : 'Publish Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Confirm Modal */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900">Archive This Notice?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Archiving <span className="font-bold">"{archiveTarget.title}"</span> will immediately stop displaying it on TV terminals. You can review past announcements at any time in the Archived tab.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveNotice}
                className="px-5 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition"
              >
                Archive Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
