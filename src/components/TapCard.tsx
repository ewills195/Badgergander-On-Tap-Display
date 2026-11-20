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
      onClick={() => onSelectBatch(batch)}
      className={`group relative flex flex-col justify-between rounded-xl border p-5 transition-colors duration-200 cursor-pointer backdrop-blur-md ${
        isOnDeck
          ? 'bg-slate-950/55 border-white/8 opacity-85 hover:opacity-100 hover:border-white/20'
          : 'bg-slate-900/70 border-white/12 hover:border-rose-400/40'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-white tracking-tight truncate group-hover:text-rose-200 transition-colors">
            {name}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400 truncate">
            <span className={isOnDeck ? 'text-slate-300 font-medium' : 'text-rose-300 font-medium'}>
              {style}
            </span>
            {batch.batchNo != null && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-slate-600">
                  ·
                </span>
                <span className="font-mono">Batch #{batch.batchNo}</span>
              </>
            )}
            {batch.status === 'Conditioning' && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-slate-600">
                  ·
                </span>
                <span className="text-sky-300">Conditioning</span>
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCycleAssignment(batch._id);
          }}
          title="Click to cycle tap assignment"
          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
            isAssignedTap
              ? 'bg-rose-600 text-white border-rose-400/50 hover:bg-rose-500'
              : isOnDeck
              ? 'bg-slate-800 text-slate-200 border-slate-600/60 hover:bg-slate-700'
              : 'bg-slate-900/80 text-slate-400 border-white/10 hover:text-white hover:border-white/25'
          }`}
        >
          {tapLabel}
        </button>
      </div>

      {/* Hairline metric strip (no nested sub-cards) */}
      <div className="grid grid-cols-3 divide-x divide-white/10 border-y border-white/10 py-3 my-1">
        <div className="pr-3">
          <div className="text-[11px] font-medium text-slate-400">ABV</div>
          <div className="mt-0.5 text-lg font-bold text-white font-mono">
            {abv != null ? `${abv.toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="px-3">
          <div className="text-[11px] font-medium text-slate-400">IBU</div>
          <div className="mt-0.5 text-lg font-bold text-white font-mono">
            {ibu != null ? Math.round(ibu) : '—'}
          </div>
        </div>
        <div className="pl-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-medium text-slate-400">SRM</div>
            <div className="mt-0.5 text-lg font-bold text-white font-mono">
              {srm != null ? srm.toFixed(1) : '—'}
            </div>
          </div>
          <BeerGlassIcon srm={srm} className="w-6 h-8 shrink-0" />
        </div>
      </div>

      {/* Tasting note preview or footer line */}
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
        <span className="truncate">
          {batch.tastingNotes
            ? batch.tastingNotes
            : packagedDate
            ? `Packaged ${formatShortDate(packagedDate)}`
            : 'Taproom pour'}
        </span>
        <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap shrink-0 group-hover:text-slate-300 transition-colors">
          Details →
        </span>
      </div>
    </article>
  );
}
