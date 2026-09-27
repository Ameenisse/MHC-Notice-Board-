import React, { useState } from 'react';
import { Download, Share2, X, Monitor, Smartphone, CheckCircle } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'tv' | 'admin' | 'banner';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'tv', className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (!success) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const buttonContent = (
    <>
      <Download className={`w-3.5 h-3.5 ${isInstallable ? 'animate-bounce' : ''}`} />
      <span>{variant === 'tv' ? 'Install App' : 'Install MHC App'}</span>
    </>
  );

  return (
    <>
      {variant === 'tv' ? (
        <button
          type="button"
          onClick={handleClick}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs bg-teal-600 hover:bg-teal-700 text-white border-teal-500 hover:border-teal-400 cursor-pointer ${className}`}
          title="Install MHC Notice Board app for standalone kiosk / desktop / mobile"
        >
          {buttonContent}
        </button>
      ) : variant === 'banner' ? (
        <button
          type="button"
          onClick={handleClick}
          className={`flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer ${className}`}
        >
          <Download className="w-4 h-4" />
          <span>Install Web Application</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className={`flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition cursor-pointer ${className}`}
          title="Install MHC Notice Board on this device"
        >
          {buttonContent}
        </button>
      )}

      {/* Install Guidance Modal for Browsers */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-teal-300">Install MHC Notice Board</h3>
                  <p className="text-xs text-slate-400">Fast, offline-capable progressive web application</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-slate-300">
              {isInstallable ? (
                <div className="bg-teal-950/60 border border-teal-700/60 rounded-xl p-3 text-teal-200">
                  <p className="font-semibold mb-2">Browser install prompt is ready!</p>
                  <button
                    type="button"
                    onClick={async () => {
                      await install();
                      setShowGuideModal(false);
                    }}
                    className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg shadow-sm transition"
                  >
                    Click to Launch System Install
                  </button>
                </div>
              ) : isIOS ? (
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-teal-300">
                    <Smartphone className="w-4 h-4" />
                    <span>iPhone / iPad (Safari)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed pl-1">
                    <li>Tap the <strong>Share</strong> icon (square with arrow pointing up) at the bottom or top of Safari.</li>
                    <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                    <li>Tap <strong>Add</strong> in the top-right corner to launch in full standalone mode.</li>
                  </ol>
                </div>
              ) : (
                <>
                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-teal-300">
                      <Monitor className="w-4 h-4" />
                      <span>Chrome / Edge / Desktop</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed pl-1">
                      <li>Look at the right side of the address bar for the <strong>Install MHC Notice Board</strong> icon (<Download className="w-3 h-3 inline text-teal-400" />).</li>
                      <li>Or click the browser menu (<strong>&vellip;</strong>) &rarr; <strong>Save and share</strong> &rarr; <strong>Install MHC Notice Board</strong>.</li>
                      <li>Click <strong>Install</strong> to add it to your desktop and taskbar.</li>
                    </ol>
                  </div>

                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-teal-300">
                      <Smartphone className="w-4 h-4" />
                      <span>Android / Mobile</span>
                    </div>
                    <p className="leading-relaxed">
                      Tap the browser menu (<strong>&vellip;</strong>) in the top-right &rarr; select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                    </p>
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 text-[11px] text-teal-400/90 pt-1">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Runs full screen without browser bars, supports offline caching and instant load.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-bold text-white transition border border-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
