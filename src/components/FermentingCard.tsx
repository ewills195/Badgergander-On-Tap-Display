import { FermentationChart } from './FermentationChart';
import {
  calcLiveAbv,
  calcTargetAttenuationProgress,
  daysElapsedSince,
  formatTemp,
  getBatchName,
  getEstFg,
  getOg,
  getStyleName,
} from '../services/brewfatherApi';
import type {
  BrewfatherBatch,
  BrewfatherReading,
  TempUnit,
} from '../types/brewfather';

interface FermentingCardProps {
  batch: BrewfatherBatch;
  readings: BrewfatherReading[];
  tempUnit: TempUnit;
  compact?: boolean;
  onSelectBatch: (batch: BrewfatherBatch) => void;
}

export function FermentingCard({
  batch,
  readings,
  tempUnit,
  compact = false,
  onSelectBatch,
}: FermentingCardProps) {
  const name = getBatchName(batch);
  const style = getStyleName(batch);
  const og = getOg(batch);
  const estFg = getEstFg(batch);

  const latestReading =
    readings.length > 0 ? readings[readings.length - 1] : null;
  const latestSg =
    latestReading?.sg != null ? latestReading.sg : batch.measuredFg ?? null;
  const latestTemp = latestReading?.temp ?? null;

  // Live indicator only when a telemetry device pushed data within the last 60 minutes
  const isLive =
    latestReading != null &&
    latestReading.time > 0 &&
    Date.now() - latestReading.time <= 3600 * 1000;

  const progressPct = calcTargetAttenuationProgress(og, latestSg, estFg);
  const liveAbv = calcLiveAbv(og, latestSg);
  const daysIn = daysElapsedSince(batch.fermentationStartDate || batch.brewDate);

  return (
    <article
      onClick={() => onSelectBatch(batch)}
      className="group flex flex-col justify-between rounded-xl border border-white/12 bg-slate-900/70 p-5 backdrop-blur-md hover:border-sky-400/40 transition-colors duration-200 cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-white tracking-tight truncate group-hover:text-sky-200 transition-colors">
            {name}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400 truncate">
            <span className="text-sky-400 font-medium">{style}</span>
            {batch.batchNo != null && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-slate-600">
                  ·
                </span>
                <span className="font-mono">Batch #{batch.batchNo}</span>
              </>
            )}
            {daysIn != null && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-slate-600">
                  ·
                </span>
                <span className="font-mono">Day {daysIn}</span>
              </>
            )}
            {batch.status === 'Conditioning' && (
              <>
                <span aria-hidden="true" className="mx-1.5 text-slate-600">
                  ·
                </span>
                <span className="text-slate-300">Conditioning</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isLive && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-emerald-400 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live telemetry
            </span>
          )}
        </div>
      </div>

      {/* 4-column hairline telemetry strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10 border-t border-white/10 py-2.5">
        <div className="py-1 sm:py-0 sm:pr-3">
          <div className="text-[11px] font-medium text-slate-400">Current SG</div>
          <div className="mt-0.5 text-base sm:text-lg font-bold text-white font-mono">
            {latestSg != null ? latestSg.toFixed(3) : '—'}
          </div>
        </div>

        <div className="py-1 sm:py-0 sm:px-3">
          <div className="text-[11px] font-medium text-slate-400">Temp</div>
          <div className="mt-0.5 text-base sm:text-lg font-bold text-amber-400 font-mono">
            {formatTemp(latestTemp, tempUnit)}
          </div>
        </div>

        <div className="py-1 sm:py-0 sm:px-3">
          <div className="text-[11px] font-medium text-slate-400">Progress</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-base sm:text-lg font-bold text-sky-400 font-mono">
              {progressPct != null ? `${progressPct.toFixed(0)}%` : '—'}
            </span>
            {liveAbv != null && (
              <span className="text-xs text-slate-400 font-mono">
                {liveAbv.toFixed(1)}% ABV
              </span>
            )}
          </div>
        </div>

        <div className="py-1 sm:py-0 sm:pl-3">
          <div className="text-[11px] font-medium text-slate-400">OG → Est. FG</div>
          <div className="mt-0.5 text-sm sm:text-base font-semibold text-slate-200 font-mono">
            {og != null ? og.toFixed(3) : '—'} → {estFg != null ? estFg.toFixed(3) : '—'}
          </div>
        </div>
      </div>

      {/* Fermentation Curve */}
      <div onClick={(e) => e.stopPropagation()}>
        <FermentationChart
          readings={readings}
          og={og}
          estFg={estFg}
          tempUnit={tempUnit}
          compact={compact}
        />
      </div>
    </article>
  );
}
