import { BeerGlassIcon } from './BeerGlassIcon';
import {
  formatShortDate,
  getAbv,
  getBatchName,
  getIbu,
  getSrm,
  getStyleName,
} from '../services/brewfatherApi';
import type { BrewfatherBatch } from '../types/brewfather';

interface PlanningCardProps {
  batch: BrewfatherBatch;
  onSelectBatch: (batch: BrewfatherBatch) => void;
}

function getRelativeBrewTiming(batch: BrewfatherBatch): string {
  if (batch.status === 'Brewing') return 'Brewing today';
  if (!batch.brewDate) return 'Scheduled';
  const diffDays = Math.ceil((batch.brewDate - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Brew day';
  if (diffDays === 1) return 'Tomorrow';
  return `In ${diffDays} days`;
}

export function PlanningCard({ batch, onSelectBatch }: PlanningCardProps) {
  const name = getBatchName(batch);
  const style = getStyleName(batch);
  const abv = getAbv(batch);
  const ibu = getIbu(batch);
  const srm = getSrm(batch);
  const primaryYeast = batch.recipe?.yeasts?.[0];

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
      className="group flex flex-col justify-between rounded-2xl border border-white/12 bg-slate-900/72 p-5 backdrop-blur-md hover:border-violet-400/50 transition-all duration-150 cursor-pointer select-none active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-violet-400"
    >
      <div className="flex items-center gap-3.5 mb-4">
        <BeerGlassIcon srm={srm} className="w-7 h-10 shrink-0 opacity-95" />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug truncate group-hover:text-violet-200 transition-colors">
            {name}
          </h3>
          <p className="mt-0.5 text-sm text-slate-400 truncate">
            <span className="text-violet-300 font-semibold">{style}</span>
            {batch.batchNo != null && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-slate-600">
                  ·
                </span>
                <span className="font-mono">Batch #{batch.batchNo}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-white/12 border-t border-white/12 pt-3 text-center">
        <div className="px-2">
          <div className="text-xs font-semibold text-slate-400">Brew Date</div>
          <div className="mt-1 text-base sm:text-lg font-bold text-white font-mono leading-tight">
            {batch.brewDate ? formatShortDate(batch.brewDate) : 'TBD'}
          </div>
          <div className="text-xs text-violet-300 font-medium mt-0.5">
            {getRelativeBrewTiming(batch)}
          </div>
        </div>

        <div className="px-2">
          <div className="text-xs font-semibold text-slate-400">Est. ABV</div>
          <div className="mt-1 text-base sm:text-lg font-bold text-white font-mono leading-tight">
            {abv != null ? `${abv.toFixed(1)}%` : '—'}
          </div>
          <div className="text-xs text-slate-400 font-mono mt-0.5">
            {ibu != null ? `${Math.round(ibu)} IBU` : '—'}
          </div>
        </div>

        <div className="px-2 min-w-0">
          <div className="text-xs font-semibold text-slate-400">Yeast</div>
          <div className="mt-1 text-sm sm:text-base font-semibold text-slate-100 truncate">
            {primaryYeast ? primaryYeast.name : '—'}
          </div>
          {primaryYeast?.productId && (
            <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">
              {primaryYeast.productId}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
