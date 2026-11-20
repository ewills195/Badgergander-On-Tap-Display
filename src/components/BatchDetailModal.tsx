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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} recipe and batch details`}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/12 bg-slate-900/95 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-4 min-w-0">
            <BeerGlassIcon srm={srm} className="w-8 h-11 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-white tracking-tight truncate">
                {name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                <span className="text-rose-300 font-medium">{style}</span>
                {batch.batchNo != null && (
                  <>
                    <span className="mx-1.5 text-slate-600">·</span>
                    <span className="font-mono">Batch #{batch.batchNo}</span>
                  </>
                )}
                <span className="mx-1.5 text-slate-600">·</span>
                <span>{batch.status}</span>
                {batch.brewDate && (
                  <>
                    <span className="mx-1.5 text-slate-600">·</span>
                    <span className="font-mono">Brewed {formatShortDate(batch.brewDate)}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Core Vital Specs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-white/10 border-b border-white/10 py-3.5 text-xs">
          <div className="py-1 sm:py-0 sm:pr-3">
            <div className="text-slate-400">ABV</div>
            <div className="mt-0.5 text-base font-bold text-white font-mono">
              {abv != null ? `${abv.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="py-1 sm:py-0 sm:px-3">
            <div className="text-slate-400">IBU</div>
            <div className="mt-0.5 text-base font-bold text-white font-mono">
              {ibu != null ? Math.round(ibu) : '—'}
            </div>
          </div>
          <div className="py-1 sm:py-0 sm:px-3">
            <div className="text-slate-400">SRM</div>
            <div className="mt-0.5 text-base font-bold text-white font-mono">
              {srm != null ? srm.toFixed(1) : '—'}
            </div>
          </div>
          <div className="py-1 sm:py-0 sm:px-3">
            <div className="text-slate-400">OG</div>
            <div className="mt-0.5 text-base font-bold text-white font-mono">
              {og != null ? og.toFixed(3) : '—'}
            </div>
          </div>
          <div className="py-1 sm:py-0 sm:pl-3">
            <div className="text-slate-400">FG</div>
            <div className="mt-0.5 text-base font-bold text-white font-mono">
              {measuredFg != null
                ? measuredFg.toFixed(3)
                : estFg != null
                ? estFg.toFixed(3)
                : '—'}
            </div>
          </div>
        </div>

        {/* Direct Tap Assignment Controls for Completed / Conditioning batches */}
        {canAssignToTap && (
          <div className="py-4 border-b border-white/10">
            <div className="text-xs font-medium text-slate-400 mb-2">
              Taproom Slot Assignment
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {tapLabels.map((label, idx) => {
                const slot = `tap:${idx}`;
                const active = assignment === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onAssignTap(batch._id, active ? null : slot)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-rose-600 text-white border-rose-400/60'
                        : 'bg-slate-800/70 text-slate-300 border-white/10 hover:border-white/25 hover:text-white'
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  assignment === 'on-deck'
                    ? 'bg-slate-700 text-white border-slate-500'
                    : 'bg-slate-800/70 text-slate-300 border-white/10 hover:border-white/25 hover:text-white'
                }`}
              >
                On Deck
              </button>

              <button
                type="button"
                onClick={() =>
                  onAssignTap(batch._id, assignment === 'hidden' ? null : 'hidden')
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  assignment === 'hidden'
                    ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800/70 text-slate-400 border-white/10 hover:text-slate-200'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                {assignment === 'hidden' ? 'Hidden from Taplist' : 'Hide Batch'}
              </button>
            </div>
          </div>
        )}

        {/* Fermentation readings if available */}
        {readings.length >= 2 && (
          <div className="py-3 border-b border-white/10">
            <div className="text-xs font-medium text-slate-300 mb-1">
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
          <div className="py-4 border-b border-white/10 space-y-2">
            {batch.tastingNotes && (
              <div>
                <div className="text-xs font-medium text-slate-400">Tasting Notes</div>
                <p className="mt-1 text-sm text-slate-200 leading-relaxed">
                  {batch.tastingNotes}
                </p>
              </div>
            )}
            {(batch.batchNotes || batch.recipe?.notes) && (
              <div>
                <div className="text-xs font-medium text-slate-400">Brewer Notes</div>
                <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                  {batch.batchNotes || batch.recipe?.notes}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Recipe Bill (Fermentables / Hops / Yeast) */}
        {(fermentables.length > 0 || hops.length > 0 || yeasts.length > 0) && (
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {fermentables.length > 0 && (
              <div>
                <div className="font-semibold text-slate-300 mb-1.5">Fermentables</div>
                <ul className="space-y-1 text-slate-400">
                  {fermentables.map((f, idx) => (
                    <li key={`${f._id || f.name}-${idx}`} className="flex justify-between gap-2">
                      <span className="truncate">{f.name}</span>
                      {f.percentage != null && (
                        <span className="font-mono text-slate-300 shrink-0">
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
                <div className="font-semibold text-slate-300 mb-1.5">Hops</div>
                <ul className="space-y-1 text-slate-400">
                  {hops.map((h, idx) => (
                    <li key={`${h._id || h.name}-${idx}`} className="flex justify-between gap-2">
                      <span className="truncate">{h.name}</span>
                      <span className="font-mono text-slate-300 shrink-0">
                        {h.use || ''} {h.time != null ? `${h.time}${h.use === 'Dry Hop' ? 'd' : 'm'}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {yeasts.length > 0 && (
              <div>
                <div className="font-semibold text-slate-300 mb-1.5">Yeast</div>
                <ul className="space-y-1 text-slate-400">
                  {yeasts.map((y, idx) => (
                    <li key={`${y._id || y.name}-${idx}`}>
                      <div className="text-slate-200">{y.name}</div>
                      {(y.laboratory || y.productId) && (
                        <div className="font-mono text-[11px] text-slate-500">
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
