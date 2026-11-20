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
      onClick={() => onSelectBatch(batch)}
      className="group flex flex-col justify-between rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md hover:border-violet-400/40 transition-colors duration-200 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white tracking-tight truncate group-hover:text-violet-200 transition-colors">
            {name}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400 truncate">
            <span className="text-violet-300 font-medium">{style}</span>
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

        <BeerGlassIcon srm={srm} className="w-5 h-7 shrink-0 opacity-90" />
      </div>

      <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-2.5 text-xs">
        <div className="pr-2.5">
          <div className="text-[11px] text-slate-400">Brew Date</div>
          <div className="mt-0.5 font-semibold text-white font-mono">
            {batch.brewDate ? formatShortDate(batch.brewDate) : 'TBD'}
          </div>
          <div className="text-[11px] text-violet-300/90 mt-0.5">
            {getRelativeBrewTiming(batch)}
          </div>
        </div>

        <div className="px-2.5">
          <div className="text-[11px] text-slate-400">Est. ABV</div>
          <div className="mt-0.5 font-semibold text-white font-mono">
            {abv != null ? `${abv.toFixed(1)}%` : '—'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            {ibu != null ? `${Math.round(ibu)} IBU` : '—'}
          </div>
        </div>

        <div className="pl-2.5 min-w-0">
          <div className="text-[11px] text-slate-400">Yeast</div>
          <div className="mt-0.5 font-medium text-slate-200 truncate">
            {primaryYeast ? primaryYeast.name : '—'}
          </div>
          {primaryYeast?.productId && (
            <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
              {primaryYeast.productId}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
