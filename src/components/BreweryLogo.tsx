import { useState } from 'react';

const LOGO_SRC = `${import.meta.env.BASE_URL}assets/aistudio/badgergander_final_258968b1.svg`;

export function BreweryLogo({ className = 'w-11 h-11' }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${className} rounded-full bg-slate-900 border border-white/15 flex items-center justify-center text-xs font-extrabold text-white select-none`}
        aria-label="Badgergander Homebrewery Logo"
      >
        BG
      </div>
    );
  }

  return (
    <img
      src={LOGO_SRC}
      alt="Badgergander Homebrewery Logo"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} rounded-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] ring-1 ring-white/10`}
    />
  );
}
