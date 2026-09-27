import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  getMemoriesList,
  saveMemory,
  deleteMemory,
} from '../../services/db';
import { HospitalMemory } from '../../types';
import { getTodayString, formatDate } from '../../utils/dateUtils';
import {
  Image,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Sparkles,
  CheckCircle2,
  Eye,
  Tag,
  Camera,
  ExternalLink,
} from 'lucide-react';

export const MemoriesPage: React.FC = () => {
  const { isDemoMode, currentUser, settings } = useApp();
  const tz = settings.timezone || 'Indian/Maldives';

  const [memories, setMemories] = useState<HospitalMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<HospitalMemory | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    titleDhivehi: '',
    caption: '',
    captionDhivehi: '',
    imageUrl: '',
    date: getTodayString(tz),
    category: 'Community Health',
    author: 'Maduvvari Health Centre',
    active: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getMemoriesList(isDemoMode);
      setMemories(data);
    } catch (err) {
      console.error('Error loading memories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemoMode]);

  const showFeedback = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleOpenModal = (item?: HospitalMemory) => {
    if (item) {
      setEditingMemory(item);
      setFormData({
        title: item.title,
        titleDhivehi: item.titleDhivehi || '',
        caption: item.caption,
        captionDhivehi: item.captionDhivehi || '',
        imageUrl: item.imageUrl,
        date: item.date,
        category: item.category,
        author: item.author || 'Maduvvari Health Centre',
        active: item.active,
      });
    } else {
      setEditingMemory(null);
      setFormData({
        title: '',
        titleDhivehi: '',
        caption: '',
        captionDhivehi: '',
        imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=900&auto=format&fit=crop&q=80',
        date: getTodayString(tz),
        category: 'Community Health',
        author: 'Maduvvari Health Centre',
        active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.imageUrl.trim()) return;

    try {
      await saveMemory(
        {
          ...(editingMemory ? { id: editingMemory.id } : {}),
          ...formData,
        },
        currentUser?.email || 'admin@mhc.gov.mv',
        isDemoMode
      );
      setIsModalOpen(false);
      await loadData();
      showFeedback(editingMemory ? `Updated memory post "${formData.title}"` : `Published memory post "${formData.title}"`);
    } catch (err) {
      console.error('Error saving memory:', err);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete memory post "${title}"?`)) return;
    try {
      await deleteMemory(id, currentUser?.email || 'admin@mhc.gov.mv', isDemoMode);
      await loadData();
      showFeedback(`Deleted memory post "${title}"`);
    } catch (err) {
      console.error('Error deleting memory:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Hospital Memories & Milestone Posts
              </h1>
              <p className="text-sm font-medium text-slate-500">
                Showcase health camp photos, team recognitions, awards, and community outreach on the TV display.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Memory Post</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-semibold shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Grid of Memories */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <div className="h-10 w-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-bold text-slate-600">Loading hospital memories...</p>
        </div>
      ) : memories.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border-2 border-dashed border-slate-300 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="h-16 w-16 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
            <Camera className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-slate-900">No Memories or Posts Published Yet</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            Publish health centre achievements, medical drills, and staff recognitions to rotate on the TV display.
          </p>
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="mt-6 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Memory Post</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {memories.map((mem) => (
            <div
              key={mem.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md transition"
            >
              <div>
                <div className="relative h-48 bg-slate-100 overflow-hidden">
                  <img
                    src={mem.imageUrl}
                    alt={mem.title}
                    className="w-full h-full object-cover transition duration-300 hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 bg-slate-950/70 backdrop-blur-xs text-white px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider">
                    {mem.category}
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider backdrop-blur-xs ${
                        mem.active ? 'bg-emerald-500/90 text-white' : 'bg-slate-700/90 text-slate-200'
                      }`}
                    >
                      {mem.active ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>{formatDate(mem.date, tz, 'medium')}</span>
                    <span>•</span>
                    <span>{mem.author}</span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                    {mem.title}
                  </h3>
                  {mem.titleDhivehi && (
                    <p className="text-xs text-slate-600 font-thaana font-medium leading-relaxed">
                      {mem.titleDhivehi}
                    </p>
                  )}

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {mem.caption}
                  </p>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-[11px] font-bold text-teal-700">
                  Rotates on TV Carousel
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenModal(mem)}
                    className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-200 rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(mem.id, mem.title)}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create/Edit Memory Post */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-slate-900">
              {editingMemory ? 'Edit Hospital Memory Post' : 'Create New Hospital Memory Post'}
            </h2>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Highlight clinical achievements, community health outreach, and staff recognitions on the TV screen.
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                  Image URL *
                </label>
                <input
                  type="url"
                  required
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500"
                  placeholder="https://images.unsplash.com/..."
                />
                {formData.imageUrl && (
                  <div className="mt-2 h-32 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Post Title (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g. Free Community NCD Screening Camp"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Title in Dhivehi (Thaana)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={formData.titleDhivehi}
                    onChange={(e) => setFormData({ ...formData, titleDhivehi: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 font-thaana focus:ring-2 focus:ring-teal-500"
                    placeholder="ހިލޭ ޞިއްޙީ ޗެކަޕް ކޭމްޕް"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Category Tag
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                    placeholder="e.g. Community Health, Award"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                    Author / Department
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                    placeholder="e.g. Public Health Unit"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                  Caption / Narrative (English) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.caption}
                  onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-500"
                  placeholder="Describe the milestone or memorable event..."
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1">
                  Caption in Dhivehi (Thaana)
                </label>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={formData.captionDhivehi}
                  onChange={(e) => setFormData({ ...formData, captionDhivehi: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 font-thaana focus:ring-2 focus:ring-teal-500"
                  placeholder="ދިވެހި ބަހުން ޚުލާޞާ..."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeMemoryCheck"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="h-4 w-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                />
                <label htmlFor="activeMemoryCheck" className="text-xs font-bold text-slate-700">
                  Visible on TV Carousel rotation
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-xs transition"
                >
                  Publish Memory Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
