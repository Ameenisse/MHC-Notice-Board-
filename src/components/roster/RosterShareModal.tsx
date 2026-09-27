import React, { useState } from 'react';
import { WeeklyDepartmentRoster } from '../../types';
import {
  X,
  Download,
  Share2,
  Copy,
  Check,
  Send,
  MessageSquare,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface RosterShareModalProps {
  roster: WeeklyDepartmentRoster;
  imageBlob?: Blob | null;
  imageUrl?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
}

export const RosterShareModal: React.FC<RosterShareModalProps> = ({
  roster,
  imageBlob,
  imageUrl,
  isOpen,
  onClose,
  onDownload,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyImage = async () => {
    if (!imageBlob) return;
    try {
      if (navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({
            'image/png': imageBlob,
          }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        alert('Image copying is not supported in this browser. Please use the Download Image button.');
      }
    } catch (err) {
      console.warn('Could not copy image to clipboard:', err);
      alert('Could not copy directly to clipboard. Please download the image to share.');
    }
  };

  const shareText = encodeURIComponent(
    `🏥 Maduvvari Health Centre - Duty Roster\n📋 Department: ${roster.categoryName}\n📅 Schedule: ${roster.weekRangeText}\n\nPrepared for MHC Staff Notice Board.`
  );

  const whatsappUrl = `https://api.whatsapp.com/send?text=${shareText}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${shareText}`;
  const viberUrl = `viber://forward?text=${shareText}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Share Duty Roster</h3>
              <p className="text-xs text-slate-400">
                {roster.categoryName} &bull; {roster.weekRangeText}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Image Preview Thumbnail */}
          {imageUrl && (
            <div className="relative rounded-xl border border-slate-700 overflow-hidden bg-slate-950 p-1 group">
              <img
                src={imageUrl}
                alt="Roster Preview"
                className="w-full max-h-48 object-contain rounded-lg"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <span className="text-xs font-bold text-white bg-slate-900/90 px-3 py-1 rounded-lg border border-slate-700 shadow-md">
                  Fit-to-1-Page Format
                </span>
              </div>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onDownload}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Image (PNG)</span>
            </button>

            <button
              type="button"
              onClick={handleCopyImage}
              disabled={!imageBlob}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs transition cursor-pointer disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Copy Image</span>
                </>
              )}
            </button>
          </div>

          {/* Instant Messengers (Popular for MHC Staff Groups) */}
          <div className="pt-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Share to Staff Group Chats
            </span>
            <div className="grid grid-cols-3 gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 text-xs font-bold transition"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>

              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#229ED9]/20 hover:bg-[#229ED9]/30 text-[#229ED9] border border-[#229ED9]/40 text-xs font-bold transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Telegram</span>
              </a>

              <a
                href={viberUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#7360F2]/20 hover:bg-[#7360F2]/30 text-[#A594FD] border border-[#7360F2]/40 text-xs font-bold transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Viber</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
