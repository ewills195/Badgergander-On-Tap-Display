import { BeerGlassIcon } from './BeerGlassIcon';
import {
  formatShortDate,
  getAbv,
  getBatchName,
  getIbu,
  getSrm,
  getStyleName,
} from '../services/brewfatherApi';
import type { BrewfatherBatch, TapAssignment } from '../types/brewfather';

interface TapCardProps {
  batch: BrewfatherBatch;
  assignment: TapAssignment | undefined;
  tapLabels: string[];
  onCycleAssignment: (batchId: string) => void;
  onSelectBatch: (batch: BrewfatherBatch) => void;
}

export function getAssignmentDisplay(
  assignment: TapAssignment | undefined,
  tapLabels: string[]
): { label: string; isAssignedTap: boolean; isOnDeck: boolean; isHidden: boolean } {
  if (!assignment) {
    return { label: 'Assign Tap', isAssignedTap: false, isOnDeck: false, isHidden: false };
  }
  if (assignment === 'on-deck') {
    return { label: 'On Deck', isAssignedTap: false, isOnDeck: true, isHidden: false };
  }
  if (assignment === 'hidden') {
    return { label: 'Hidden', isAssignedTap: false, isOnDeck: false, isHidden: true };
  }
  if (assignment.startsWith('tap:')) {
    const idx = Number(assignment.slice(4));
    const customName = tapLabels[idx];
    return {
      label: customName || `Tap ${idx + 1}`,
      isAssignedTap: true,
      isOnDeck: false,
      isHidden: false,
    };
  }
  return { label: assignment, isAssignedTap: true, isOnDeck: false, isHidden: false };
}

export function TapCard({
  batch,
  assignment,
  tapLabels,
  onCycleAssignment,
  onSelectBatch,
}: TapCardProps) {
  const name = getBatchName(batch);
  const style = getStyleName(batch);
  const abv = getAbv(batch);
  const ibu = getIbu(batch);
  const srm = getSrm(batch);
  const { label: tapLabel, isAssignedTap, isOnDeck } = getAssignmentDisplay(
    assignment,
    tapLabels
  );

  const packagedDate = batch.bottlingDate || batch.brewDate;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelectBatch(batch)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectBatch(batch);
        }
      }}
      className={`group relative flex flex-col justify-between rounded-2xl border p-5 sm:p-6 transition-all duration-150 cursor-pointer backdrop-blur-md select-none active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-rose-400 ${
        isOnDeck
          ? 'bg-slate-950/60 border-white/10 opacity-85 hover:opacity-100 hover:border-white/20'
          : 'bg-slate-900/78 border-white/14 hover:border-rose-400/50'
      }`}
    >
      {/* Top Action & Batch Row */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCycleAssignment(batch._id);
          }}
          title="Tap to cycle tap slot"
          className={`min-h-[44px] px-4 rounded-xl text-sm font-bold tracking-tight transition-all cursor-pointer whitespace-nowrap shrink-0 border active:scale-95 ${
            isAssignedTap
              ? 'bg-rose-600 text-white border-rose-400/60 hover:bg-rose-500'
              : isOnDeck
              ? 'bg-slate-800 text-slate-200 border-slate-600/70 hover:bg-slate-700'
              : 'bg-slate-900/90 text-slate-300 border-white/15 hover:text-white hover:border-white/30'
          }`}
        >
          {tapLabel}
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 font-mono whitespace-nowrap">
          {batch.status === 'Conditioning' && (
            <>
              <span className="text-sky-300 font-sans font-semibold">Conditioning</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
            </>
          )}
          {batch.batchNo != null && <span>Batch #{batch.batchNo}</span>}
        </div>
      </div>

      {/* Hero Beer Identity (SRM Glass + Distance-Readable Name & Style) */}
      <div className="flex items-center gap-4 mb-5">
        <BeerGlassIcon srm={srm} className="w-10 h-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-2xl sm:text-[1.7rem] font-extrabold text-white tracking-tight leading-[1.15] line-clamp-2 group-hover:text-rose-100 transition-colors">
            {name}
          </h3>
          <p
            className={`mt-1 text-sm sm:text-base font-semibold truncate ${
              isOnDeck ? 'text-slate-300' : 'text-rose-300'
            }`}
          >
            {style}
          </p>
        </div>
      </div>

      {/* Centered Instrument Metric Strip — readable from 3-4 feet */}
      <div className="grid grid-cols-3 divide-x divide-white/12 border-y border-white/12 py-3.5 text-center">
        <div className="px-2">
          <div className="text-xs sm:text-[13px] font-semibold text-slate-400">ABV</div>
          <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-white font-mono leading-none">
            {abv != null ? `${abv.toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="px-2">
          <div className="text-xs sm:text-[13px] font-semibold text-slate-400">IBU</div>
          <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-white font-mono leading-none">
            {ibu != null ? Math.round(ibu) : '—'}
          </div>
        </div>
        <div className="px-2">
          <div className="text-xs sm:text-[13px] font-semibold text-slate-400">SRM</div>
          <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-white font-mono leading-none">
            {srm != null ? srm.toFixed(1) : '—'}
          </div>
        </div>
      </div>

      {/* Tasting Notes / Touch Disclosure Footer */}
      <div className="mt-3.5 flex items-end justify-between gap-3 text-sm text-slate-300">
        <p className="line-clamp-2 leading-snug text-slate-300">
          {batch.tastingNotes
            ? batch.tastingNotes
            : packagedDate
            ? `Packaged ${formatShortDate(packagedDate)}`
            : 'Tap for recipe details'}
        </p>
        <span className="font-mono text-xs text-slate-400 whitespace-nowrap shrink-0 group-hover:text-white transition-colors">
          Recipe →
        </span>
      </div>
    </article>
  );
}
