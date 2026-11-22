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
    <article className="flex flex-col justify-between rounded-2xl border border-white/14 bg-slate-900/78 p-5 sm:p-6 backdrop-blur-md select-none">
      {/* Tappable Header + Telemetry Strip (keeps chart drag gestures completely separate) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectBatch(batch)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectBatch(batch);
          }
        }}
        className="group cursor-pointer rounded-xl -m-2 p-2 hover:bg-white/[0.03] active:scale-[0.995] transition-all focus-visible:outline-2 focus-visible:outline-sky-400"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-2xl sm:text-[1.65rem] font-extrabold text-white tracking-tight leading-tight truncate group-hover:text-sky-200 transition-colors">
              {name}
            </h3>
            <p className="mt-1 text-sm sm:text-base text-slate-300 truncate">
              <span className="text-sky-400 font-semibold">{style}</span>
              {batch.batchNo != null && (
                <>
                  <span aria-hidden="true" className="mx-2 text-slate-600">
                    ·
                  </span>
                  <span className="font-mono text-slate-400">Batch #{batch.batchNo}</span>
                </>
              )}
              {daysIn != null && (
                <>
                  <span aria-hidden="true" className="mx-2 text-slate-600">
                    ·
                  </span>
                  <span className="font-mono text-slate-200 font-semibold">Day {daysIn}</span>
                </>
              )}
              {batch.status === 'Conditioning' && (
                <>
                  <span aria-hidden="true" className="mx-2 text-slate-600">
                    ·
                  </span>
                  <span className="text-slate-200 font-medium">Conditioning</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 pt-1">
            {isLive && (
              <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono font-semibold text-emerald-400 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
            <span className="hidden sm:inline font-mono text-xs text-slate-400 group-hover:text-white transition-colors">
              Recipe →
            </span>
          </div>
        </div>

        {/* Centered 4-Column Instrument Cluster — glanceable from 3-4 feet */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/12 border-t border-white/12 pt-3.5 pb-3 text-center">
          <div className="py-1.5 sm:py-0 px-2">
            <div className="text-xs sm:text-[13px] font-semibold text-slate-400">
              Current SG
            </div>
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-white font-mono leading-none">
              {latestSg != null ? latestSg.toFixed(3) : '—'}
            </div>
          </div>

          <div className="py-1.5 sm:py-0 px-2">
            <div className="text-xs sm:text-[13px] font-semibold text-slate-400">
              Temp
            </div>
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono leading-none">
              {formatTemp(latestTemp, tempUnit)}
            </div>
          </div>

          <div className="py-1.5 sm:py-0 px-2">
            <div className="text-xs sm:text-[13px] font-semibold text-slate-400">
              Progress
            </div>
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-sky-400 font-mono leading-none">
              {progressPct != null ? `${progressPct.toFixed(0)}%` : '—'}
            </div>
            {liveAbv != null && (
              <div className="mt-1 text-xs font-mono text-slate-400">
                {liveAbv.toFixed(1)}% ABV now
              </div>
            )}
          </div>

          <div className="py-1.5 sm:py-0 px-2 flex flex-col justify-center">
            <div className="text-xs sm:text-[13px] font-semibold text-slate-400">
              OG → Est. FG
            </div>
            <div className="mt-1 text-base sm:text-lg font-bold text-slate-200 font-mono leading-tight">
              {og != null ? og.toFixed(3) : '—'}
              <span className="mx-1 text-slate-500">→</span>
              {estFg != null ? estFg.toFixed(3) : '—'}
            </div>
          </div>
        </div>

        {/* Visual Fermentation Completion Bar */}
        {progressPct != null && (
          <div className="mt-1 mb-2 h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.max(4, progressPct)}%` }}
            />
          </div>
        )}
      </div>

      {/* Interactive Touch-Scrubbable Fermentation Curve */}
      <div className="mt-2">
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
