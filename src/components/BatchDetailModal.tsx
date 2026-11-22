import { X, EyeOff } from 'lucide-react';
import { BeerGlassIcon } from './BeerGlassIcon';
import { FermentationChart } from './FermentationChart';
import {
  formatShortDate,
  getAbv,
  getBatchName,
  getEstFg,
  getIbu,
  getOg,
  getSrm,
  getStyleName,
} from '../services/brewfatherApi';
import type {
  BrewfatherBatch,
  BrewfatherReading,
  TapAssignment,
  TempUnit,
} from '../types/brewfather';

interface BatchDetailModalProps {
  batch: BrewfatherBatch | null;
  readings: BrewfatherReading[];
  assignment: TapAssignment | undefined;
  tapLabels: string[];
  tempUnit: TempUnit;
  onAssignTap: (batchId: string, assignment: TapAssignment | null) => void;
  onClose: () => void;
}

export function BatchDetailModal({
  batch,
  readings,
  assignment,
  tapLabels,
  tempUnit,
  onAssignTap,
  onClose,
}: BatchDetailModalProps) {
  if (!batch) return null;

  const name = getBatchName(batch);
  const style = getStyleName(batch);
  const abv = getAbv(batch);
  const ibu = getIbu(batch);
  const srm = getSrm(batch);
  const og = getOg(batch);
  const estFg = getEstFg(batch);
  const measuredFg = batch.measuredFg;

  const fermentables = batch.recipe?.fermentables || [];
  const hops = batch.recipe?.hops || [];
  const yeasts = batch.recipe?.yeasts || [];
  const canAssignToTap = batch.status === 'Completed' || batch.status === 'Conditioning';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/82 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} recipe and batch details`}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/15 bg-slate-900/98 p-6 sm:p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle drag-sheet affordance on portrait touch screens */}
        <div
          className="sm:hidden w-12 h-1.5 rounded-full bg-slate-700 mx-auto mb-5"
          aria-hidden="true"
        />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-white/12">
          <div className="flex items-center gap-4 min-w-0">
            <BeerGlassIcon srm={srm} className="w-10 h-14 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-2xl font-extrabold text-white tracking-tight leading-tight">
                {name}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                <span className="text-rose-300 font-semibold">{style}</span>
                {batch.batchNo != null && (
                  <>
                    <span className="mx-2 text-slate-600">·</span>
                    <span className="font-mono">Batch #{batch.batchNo}</span>
                  </>
                )}
                <span className="mx-2 text-slate-600">·</span>
                <span>{batch.status}</span>
                {batch.brewDate && (
                  <>
                    <span className="mx-2 text-slate-600">·</span>
                    <span className="font-mono">Brewed {formatShortDate(batch.brewDate)}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/12 transition-colors cursor-pointer shrink-0 active:scale-95"
            aria-label="Close details"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Centered Vital Specs */}
        <div className="grid grid-cols-3 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-white/12 border-b border-white/12 py-4 text-center">
          <div className="py-1.5 sm:py-0 px-2">
            <div className="text-xs font-semibold text-slate-400">ABV</div>
            <div className="mt-1 text-xl font-extrabold text-white font-mono">
              {abv != null ? `${abv.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="py-1.5 sm:py-0 px-2">
            <div className="text-xs font-semibold text-slate-400">IBU</div>
            <div className="mt-1 text-xl font-extrabold text-white font-mono">
              {ibu != null ? Math.round(ibu) : '—'}
            </div>
          </div>
          <div className="py-1.5 sm:py-0 px-2">
            <div className="text-xs font-semibold text-slate-400">SRM</div>
            <div className="mt-1 text-xl font-extrabold text-white font-mono">
              {srm != null ? srm.toFixed(1) : '—'}
            </div>
          </div>
          <div className="py-1.5 sm:py-0 px-2">
            <div className="text-xs font-semibold text-slate-400">OG</div>
            <div className="mt-1 text-xl font-extrabold text-white font-mono">
              {og != null ? og.toFixed(3) : '—'}
            </div>
          </div>
          <div className="py-1.5 sm:py-0 px-2">
            <div className="text-xs font-semibold text-slate-400">FG</div>
            <div className="mt-1 text-xl font-extrabold text-white font-mono">
              {measuredFg != null
                ? measuredFg.toFixed(3)
                : estFg != null
                ? estFg.toFixed(3)
                : '—'}
            </div>
          </div>
        </div>

        {/* Touch-sized Direct Tap Assignment Controls */}
        {canAssignToTap && (
          <div className="py-5 border-b border-white/12">
            <div className="text-xs font-semibold text-slate-400 mb-3">
              Taproom Slot Assignment
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {tapLabels.map((label, idx) => {
                const slot = `tap:${idx}`;
                const active = assignment === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onAssignTap(batch._id, active ? null : slot)}
                    className={`min-h-[48px] px-4 rounded-xl text-sm font-bold border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                      active
                        ? 'bg-rose-600 text-white border-rose-400/60'
                        : 'bg-slate-800/80 text-slate-200 border-white/12 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() =>
                  onAssignTap(batch._id, assignment === 'on-deck' ? null : 'on-deck')
                }
                className={`min-h-[48px] px-4 rounded-xl text-sm font-bold border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  assignment === 'on-deck'
                    ? 'bg-slate-700 text-white border-slate-500'
                    : 'bg-slate-800/80 text-slate-200 border-white/12 hover:border-white/30 hover:text-white'
                }`}
              >
                On Deck
              </button>

              <button
                type="button"
                onClick={() =>
                  onAssignTap(batch._id, assignment === 'hidden' ? null : 'hidden')
                }
                className={`min-h-[48px] inline-flex items-center gap-2 px-4 rounded-xl text-sm font-semibold border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  assignment === 'hidden'
                    ? 'bg-amber-950/80 text-amber-200 border-amber-500/45'
                    : 'bg-slate-800/80 text-slate-300 border-white/12 hover:text-white'
                }`}
              >
                <EyeOff className="w-4 h-4" />
                {assignment === 'hidden' ? 'Hidden from Taplist' : 'Hide Batch'}
              </button>
            </div>
          </div>
        )}

        {/* Fermentation readings if available */}
        {readings.length >= 2 && (
          <div className="py-4 border-b border-white/12">
            <div className="text-sm font-semibold text-slate-200 mb-1">
              Fermentation Telemetry
            </div>
            <FermentationChart
              readings={readings}
              og={og}
              estFg={estFg}
              tempUnit={tempUnit}
            />
          </div>
        )}

        {/* Tasting & Batch Notes */}
        {(batch.tastingNotes || batch.batchNotes || batch.recipe?.notes) && (
          <div className="py-5 border-b border-white/12 space-y-3">
            {batch.tastingNotes && (
              <div>
                <div className="text-xs font-semibold text-slate-400">Tasting Notes</div>
                <p className="mt-1 text-base text-slate-100 leading-relaxed">
                  {batch.tastingNotes}
                </p>
              </div>
            )}
            {(batch.batchNotes || batch.recipe?.notes) && (
              <div>
                <div className="text-xs font-semibold text-slate-400">Brewer Notes</div>
                <p className="mt-1 text-sm sm:text-base text-slate-300 leading-relaxed">
                  {batch.batchNotes || batch.recipe?.notes}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Recipe Bill (Fermentables / Hops / Yeast) */}
        {(fermentables.length > 0 || hops.length > 0 || yeasts.length > 0) && (
          <div className="pt-5 grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm">
            {fermentables.length > 0 && (
              <div>
                <div className="font-bold text-slate-200 mb-2">Fermentables</div>
                <ul className="space-y-1.5 text-slate-300">
                  {fermentables.map((f, idx) => (
                    <li
                      key={`${f._id || f.name}-${idx}`}
                      className="flex justify-between gap-2"
                    >
                      <span className="truncate">{f.name}</span>
                      {f.percentage != null && (
                        <span className="font-mono text-slate-200 shrink-0">
                          {f.percentage.toFixed(0)}%
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hops.length > 0 && (
              <div>
                <div className="font-bold text-slate-200 mb-2">Hops</div>
                <ul className="space-y-1.5 text-slate-300">
                  {hops.map((h, idx) => (
                    <li
                      key={`${h._id || h.name}-${idx}`}
                      className="flex justify-between gap-2"
                    >
                      <span className="truncate">{h.name}</span>
                      <span className="font-mono text-slate-200 shrink-0">
                        {h.use || ''}{' '}
                        {h.time != null
                          ? `${h.time}${h.use === 'Dry Hop' ? 'd' : 'm'}`
                          : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {yeasts.length > 0 && (
              <div>
                <div className="font-bold text-slate-200 mb-2">Yeast</div>
                <ul className="space-y-1.5 text-slate-300">
                  {yeasts.map((y, idx) => (
                    <li key={`${y._id || y.name}-${idx}`}>
                      <div className="text-slate-100 font-medium">{y.name}</div>
                      {(y.laboratory || y.productId) && (
                        <div className="font-mono text-xs text-slate-400">
                          {[y.laboratory, y.productId].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
