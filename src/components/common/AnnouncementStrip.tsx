import React from 'react';
import { useApp } from '../../context/AppContext';
import { Megaphone } from 'lucide-react';

export const AnnouncementStrip: React.FC = () => {
  const { settings, language } = useApp();
  const isNightMode = settings.themeMode === 'night';

  if (!settings.announcementStripEnabled) return null;

  const text =
    language === 'dv' && settings.announcementTextDhivehi
      ? settings.announcementTextDhivehi
      : settings.announcementText;

  if (!text || text.trim() === '') return null;

  return (
    <div
      id="announcement-strip"
      className={`px-4 py-1.5 flex items-center gap-3 overflow-hidden border-t shadow-md select-none shrink-0 transition-colors duration-200 ${
        isNightMode ? 'bg-slate-950 text-white border-slate-800' : 'bg-white text-slate-900 border-slate-200'
      }`}
    >
      <div className="flex items-center gap-2 bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider shrink-0 shadow-xs">
        <Megaphone className="w-3.5 h-3.5" />
        <span>NOTICE</span>
      </div>

      <div className="overflow-hidden whitespace-nowrap flex-1">
        <div className={`inline-block animate-ticker text-sm md:text-base font-semibold tracking-wide ${
          isNightMode ? 'text-slate-100' : 'text-slate-800'
        }`}>
          <span className="mr-12">{text}</span>
          <span className="mr-12 text-amber-500 font-bold">•</span>
          <span className="mr-12">{text}</span>
          <span className="mr-12 text-amber-500 font-bold">•</span>
          <span className="mr-12">{text}</span>
        </div>
      </div>
    </div>
  );
};
