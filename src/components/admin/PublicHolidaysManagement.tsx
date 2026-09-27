import React, { useState, useEffect } from 'react';
import { PublicHoliday } from '../../types';
import {
  getPublicHolidaysList,
  savePublicHoliday,
  deletePublicHoliday,
  restoreDefaultPublicHolidays,
} from '../../services/db';
import {
  Calendar,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Search,
  Filter,
  Check,
  X,
  Clock,
  Download,
} from 'lucide-react';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface PublicHolidaysManagementProps {
  isDemoMode: boolean;
  currentUserEmail?: string;
}

export const PublicHolidaysManagement: React.FC<PublicHolidaysManagementProps> = ({
  isDemoMode,
  currentUserEmail = 'admin@mhc.gov.mv',
}) => {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    nameDhivehi: '',
    date: '2026-09-22',
    isRecurring: false,
    description: '',
    active: true,
  });
  const [saving, setSaving] = useState(false);

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const list = await getPublicHolidaysList(isDemoMode);
      setHolidays(list);
    } catch (err) {
      console.error('Error loading public holidays:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, [isDemoMode]);

  const showNotification = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleOpenAddModal = () => {
    setEditingHoliday(null);
    setFormData({
      name: '',
      nameDhivehi: '',
      date: '2026-09-22',
      isRecurring: false,
      description: 'Official Government Public Holiday',
      active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (hol: PublicHoliday) => {
    setEditingHoliday(hol);
    setFormData({
      name: hol.name,
      nameDhivehi: hol.nameDhivehi || '',
      date: hol.date,
      isRecurring: hol.isRecurring || false,
      description: hol.description || '',
      active: hol.active,
    });
    setIsModalOpen(true);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.date) {
      alert('Please fill in holiday name and date.');
      return;
    }

    setSaving(true);
    try {
      await savePublicHoliday(
        {
          ...(editingHoliday ? { id: editingHoliday.id } : {}),
          ...formData,
        },
        currentUserEmail,
        isDemoMode
      );
      setIsModalOpen(false);
      await loadHolidays();
      showNotification(
        editingHoliday
          ? `Updated holiday: ${formData.name}`
          : `Added new public holiday: ${formData.name}`
      );
    } catch (err: any) {
      alert(err.message || 'Failed to save public holiday');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove the public holiday "${name}"?`)) return;
    try {
      await deletePublicHoliday(id, currentUserEmail, isDemoMode);
      await loadHolidays();
      showNotification(`Deleted public holiday: ${name}`);
    } catch (err) {
      console.error('Error deleting holiday:', err);
      alert('Failed to delete holiday');
    }
  };

  const handleToggleActive = async (hol: PublicHoliday) => {
    try {
      await savePublicHoliday(
        {
          ...hol,
          active: !hol.active,
        },
        currentUserEmail,
        isDemoMode
      );
      await loadHolidays();
      showNotification(`Holiday "${hol.name}" is now ${!hol.active ? 'active' : 'inactive'}`);
    } catch (err) {
      console.error('Error toggling holiday active:', err);
    }
  };

  const handleRestoreDefaults = async () => {
    if (
      !confirm(
        'Restore the official Maldives public holidays (New Year, Eid al-Fitr, Labour Day, Eid al-Adha, Independence Day, National Day 22-Sep-2026, Victory Day, Republic Day)?'
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const list = await restoreDefaultPublicHolidays(currentUserEmail, isDemoMode);
      setHolidays(list);
      showNotification('Restored official Maldives public holidays successfully!');
    } catch (err) {
      console.error('Error restoring default holidays:', err);
      alert('Failed to restore default holidays');
    } finally {
      setLoading(false);
    }
  };

  // Filter holidays
  const filteredHolidays = holidays.filter((h) => {
    const matchesSearch =
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.nameDhivehi && h.nameDhivehi.includes(searchQuery)) ||
      h.date.includes(searchQuery);

    const matchesYear =
      selectedYear === 'all' || h.date.startsWith(selectedYear) || h.isRecurring;

    return matchesSearch && matchesYear;
  });

  return (
    <div className="space-y-6">
      {/* Banner / Explanation Header */}
      <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 rounded-2xl p-5 border border-amber-600/40 text-slate-100 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                Roaster Settings &amp; Public Holidays Management
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed mt-0.5">
                Maintain official public holidays for Maduvvari Health Centre. When supervisors create or view duty roasters,{' '}
                <span className="text-amber-300 font-bold">these day columns are automatically highlighted</span> with special holiday badges, and holiday shifts are calculated for duty allowances.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
              title="Reset list with official Maldives National Day, Independence Day, and Islamic holidays"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Restore Maldives Holidays</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Public Holiday</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {feedback && (
        <div className="bg-emerald-900/60 border border-emerald-500 text-emerald-200 px-4 py-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search holidays by English or Dhivehi name or date..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Year Filter:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Years &amp; Recurring</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
        </div>
      </div>

      {/* Holidays Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs font-extrabold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="p-3.5 w-12 text-center">#</th>
                <th className="p-3.5 w-40">Date</th>
                <th className="p-3.5">Holiday Name</th>
                <th className="p-3.5">Dhivehi Name</th>
                <th className="p-3.5">Description</th>
                <th className="p-3.5 w-24 text-center">Highlight</th>
                <th className="p-3.5 w-28 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-semibold">
              {filteredHolidays.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-500 opacity-60" />
                    <p className="font-bold">No public holidays found.</p>
                    <p className="text-[11px] mt-1">
                      Click "Add Public Holiday" or "Restore Maldives Holidays" above.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredHolidays.map((hol, idx) => (
                  <tr
                    key={hol.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3.5 text-center text-slate-400 font-bold">{idx + 1}</td>

                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                        <span>{hol.date}</span>
                      </div>
                      {hol.isRecurring && (
                        <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">
                          Annual Recurring
                        </span>
                      )}
                    </td>

                    <td className="p-3.5">
                      <div className="font-black text-slate-900 dark:text-white text-sm">
                        {hol.name}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-thaana text-teal-700 dark:text-teal-400 text-sm font-bold">
                        {hol.nameDhivehi || '-'}
                      </div>
                    </td>

                    <td className="p-3.5 text-slate-500 dark:text-slate-400">
                      {hol.description || 'Public Holiday'}
                    </td>

                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(hol)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black transition cursor-pointer ${
                          hol.active
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-500/60'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {hol.active ? 'ACTIVE' : 'INACTIVE'}
                      </button>
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(hol)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Edit Holiday"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteHoliday(hol.id, hol.name)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                          title="Delete Holiday"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Web Application Installation Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Install MHC Notice Board Web Application</h3>
            <p className="text-xs text-slate-400">
              Install MHC Notice Board for standalone kiosk mode, desktop shortcuts, and mobile access.
            </p>
          </div>
        </div>

        <PWAInstallButton variant="banner" />
      </div>

      {/* Add / Edit Holiday Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  {editingHoliday ? 'Edit Public Holiday' : 'Add New Public Holiday'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Holiday Name (English) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. National Day / Qaumee Dhuvas"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Holiday Name in Dhivehi (Thaana Script)
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={formData.nameDhivehi}
                  onChange={(e) => setFormData({ ...formData, nameDhivehi: e.target.value })}
                  placeholder="ދިވެހިރާއްޖޭގެ ޤައުމީ ދުވަސް"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-thaana font-medium focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Holiday Date (YYYY-MM-DD) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-amber-300/80 mt-1">
                  Note: Sample roster week includes <strong>2026-09-22</strong> (National Day).
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Description / Category</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Official Government Holiday"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-recurring"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="chk-recurring" className="font-semibold text-slate-300 cursor-pointer">
                  Recurring Annually on this month &amp; day
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chk-active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="chk-active" className="font-semibold text-slate-300 cursor-pointer">
                  Active (Highlight day column across duty roasters)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black shadow-md cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Public Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
