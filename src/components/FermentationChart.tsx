import { useMemo, useRef, useState } from 'react';
import type { BrewfatherReading, TempUnit } from '../types/brewfather';
import {
  calcTargetAttenuationProgress,
  convertTempValue,
  formatTemp,
} from '../services/brewfatherApi';

interface FermentationChartProps {
  readings: BrewfatherReading[];
  og: number | null;
  estFg: number | null;
  tempUnit: TempUnit;
  compact?: boolean;
}

type RangeKey = 'all' | '7d' | '48h';

export function FermentationChart({
  readings,
  og,
  estFg,
  tempUnit,
  compact = false,
}: FermentationChartProps) {
  const [range, setRange] = useState<RangeKey>('all');
  const [showTemp, setShowTemp] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const isPointerScrubbing = useRef(false);

  const filtered = useMemo(() => {
    if (readings.length === 0) return [];
    if (range === 'all') return readings;
    const latestTime = readings[readings.length - 1].time;
    const windowMs = range === '7d' ? 7 * 24 * 3600 * 1000 : 48 * 3600 * 1000;
    const cutoff = latestTime - windowMs;
    const subset = readings.filter((r) => r.time >= cutoff);
    return subset.length >= 2 ? subset : readings;
  }, [readings, range]);

  const width = 680;
  const height = compact ? 225 : 250;
  const pad = { top: 18, right: 54, bottom: 34, left: 62 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const chartData = useMemo(() => {
    if (filtered.length === 0) return null;

    const minTime = filtered[0].time;
    const maxTime = filtered[filtered.length - 1].time;
    const timeSpan = Math.max(1, maxTime - minTime);

    const sgValues = filtered
      .map((r) => r.sg)
      .filter((v): v is number => v != null && !Number.isNaN(v));
    if (og != null) sgValues.push(og);
    if (estFg != null) sgValues.push(estFg);

    const sgMinRaw = sgValues.length > 0 ? Math.min(...sgValues) : 1.0;
    const sgMaxRaw = sgValues.length > 0 ? Math.max(...sgValues) : 1.06;
    const sgPad = Math.max(0.003, (sgMaxRaw - sgMinRaw) * 0.12);
    const sgMin = Math.max(0.99, sgMinRaw - sgPad);
    const sgMax = sgMaxRaw + sgPad;
    const sgSpan = Math.max(0.005, sgMax - sgMin);

    const tempValues = filtered
      .map((r) => (r.temp != null ? convertTempValue(r.temp, tempUnit) : null))
      .filter((v): v is number => v != null && !Number.isNaN(v));

    const tempMinRaw =
      tempValues.length > 0 ? Math.min(...tempValues) : tempUnit === 'F' ? 60 : 15;
    const tempMaxRaw =
      tempValues.length > 0 ? Math.max(...tempValues) : tempUnit === 'F' ? 75 : 24;
    const tempPad = Math.max(1.5, (tempMaxRaw - tempMinRaw) * 0.18);
    const tempMin = tempMinRaw - tempPad;
    const tempMax = tempMaxRaw + tempPad;
    const tempSpan = Math.max(2, tempMax - tempMin);

    const xFor = (t: number) => pad.left + ((t - minTime) / timeSpan) * plotW;
    const ySgFor = (sg: number) => pad.top + ((sgMax - sg) / sgSpan) * plotH;
    const yTempFor = (temp: number) => pad.top + ((tempMax - temp) / tempSpan) * plotH;

    const sgPoints = filtered
      .filter((r): r is BrewfatherReading & { sg: number } => r.sg != null)
      .map((r) => ({ x: xFor(r.time), y: ySgFor(r.sg), r }));

    const tempPoints = filtered
      .filter((r): r is BrewfatherReading & { temp: number } => r.temp != null)
      .map((r) => ({
        x: xFor(r.time),
        y: yTempFor(convertTempValue(r.temp, tempUnit)),
        r,
      }));

    const buildPath = (pts: Array<{ x: number; y: number }>) =>
      pts
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');

    const sgPath = buildPath(sgPoints);
    const sgAreaPath =
      sgPoints.length > 1
        ? `${sgPath} L ${sgPoints[sgPoints.length - 1].x.toFixed(1)} ${(pad.top + plotH).toFixed(1)} L ${sgPoints[0].x.toFixed(1)} ${(pad.top + plotH).toFixed(1)} Z`
        : '';
    const tempPath = buildPath(tempPoints);

    const sgTicks = [0, 0.33, 0.66, 1].map((f) => {
      const val = sgMax - f * sgSpan;
      return { val, y: pad.top + f * plotH };
    });

    const tempTicks = [0, 0.5, 1].map((f) => {
      const val = tempMax - f * tempSpan;
      return { val, y: pad.top + f * plotH };
    });

    const xTicks = [0, 0.33, 0.66, 1].map((f) => {
      const ts = minTime + f * timeSpan;
      return {
        x: pad.left + f * plotW,
        label: new Date(ts).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
      };
    });

    const estFgY = estFg != null ? ySgFor(estFg) : null;

    return {
      minTime,
      maxTime,
      timeSpan,
      sgPoints,
      tempPoints,
      sgPath,
      sgAreaPath,
      tempPath,
      sgTicks,
      tempTicks,
      xTicks,
      estFgY,
      xFor,
      ySgFor,
      yTempFor,
    };
  }, [filtered, og, estFg, tempUnit, plotW, plotH, pad.left, pad.top]);

  if (!chartData || filtered.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 border-t border-white/10 text-sm text-slate-400 font-mono">
        Waiting for Brewfather hydrometer readings…
      </div>
    );
  }

  const activeReading =
    selectedIdx != null && filtered[selectedIdx] ? filtered[selectedIdx] : null;
  const activeX = activeReading ? chartData.xFor(activeReading.time) : null;
  const activeAtten =
    activeReading?.sg != null
      ? calcTargetAttenuationProgress(og, activeReading.sg, estFg)
      : null;

  const updateIndexFromClientX = (clientX: number, svgEl: SVGSVGElement) => {
    const rect = svgEl.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * width;
    const clampedX = Math.max(pad.left, Math.min(width - pad.right, relX));
    const ratio = (clampedX - pad.left) / plotW;
    const targetTime = chartData.minTime + ratio * chartData.timeSpan;

    let nearest = 0;
    let bestDist = Infinity;
    for (let i = 0; i < filtered.length; i++) {
      const d = Math.abs(filtered[i].time - targetTime);
      if (d < bestDist) {
        bestDist = d;
        nearest = i;
      }
    }
    setSelectedIdx(nearest);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    isPointerScrubbing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateIndexFromClientX(e.clientX, e.currentTarget);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' || isPointerScrubbing.current) {
      updateIndexFromClientX(e.clientX, e.currentTarget);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    isPointerScrubbing.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className="flex flex-col gap-3 pt-3.5 border-t border-white/10">
      {/* Touch-sized Chart Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-sm">
        <div className="flex flex-wrap items-center gap-3 text-slate-300">
          <span className="inline-flex items-center gap-2 font-semibold text-sky-400">
            <span className="w-3.5 h-1 rounded-full bg-sky-400 inline-block" />
            Gravity (SG)
          </span>
          <button
            type="button"
            onClick={() => setShowTemp((prev) => !prev)}
            className={`min-h-[44px] px-3 rounded-lg inline-flex items-center gap-2 font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95 ${
              showTemp
                ? 'text-amber-300 border-amber-400/35 bg-amber-950/35'
                : 'text-slate-400 border-white/10 bg-slate-950/50 opacity-75 hover:opacity-100'
            }`}
            title="Toggle temperature line"
          >
            <span className="w-3.5 h-1 rounded-full bg-amber-400 inline-block" />
            Temp (°{tempUnit})
          </button>
          {estFg != null && (
            <span className="hidden sm:inline-flex items-center gap-2 text-slate-300 font-mono text-xs sm:text-sm">
              <span className="w-3.5 border-t-2 border-dashed border-emerald-400/80 inline-block" />
              Target {estFg.toFixed(3)}
            </span>
          )}
        </div>

        {/* Touch Range Switcher (>=44px height) */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-white/12">
          {(['all', '7d', '48h'] as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setRange(key);
                setSelectedIdx(null);
              }}
              className={`min-h-[40px] min-w-[48px] px-3 text-xs sm:text-sm font-mono font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                range === key
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {key === 'all' ? 'All' : key}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Canvas with Pointer/Touch Scrubbing */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onMouseLeave={() => {
            if (!isPointerScrubbing.current) setSelectedIdx(null);
          }}
          role="img"
          aria-label="Fermentation specific gravity and temperature curve. Drag to inspect readings."
        >
          <defs>
            <linearGradient id="sgAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines + SG labels */}
          {chartData.sgTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={tick.y}
                y2={tick.y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
              <text
                x={pad.left - 8}
                y={tick.y + 4.5}
                textAnchor="end"
                className="fill-sky-300 text-[13px] font-mono font-semibold"
              >
                {tick.val.toFixed(3)}
              </text>
            </g>
          ))}

          {/* Right Y-axis Temp labels */}
          {showTemp &&
            chartData.tempTicks.map((tick, i) => (
              <text
                key={i}
                x={width - pad.right + 8}
                y={tick.y + 4.5}
                textAnchor="start"
                className="fill-amber-300 text-[13px] font-mono font-semibold"
              >
                {tick.val.toFixed(0)}°
              </text>
            ))}

          {/* X-axis labels */}
          {chartData.xTicks.map((tick, i) => (
            <text
              key={i}
              x={tick.x}
              y={height - 8}
              textAnchor={
                i === 0 ? 'start' : i === chartData.xTicks.length - 1 ? 'end' : 'middle'
              }
              className="fill-slate-300 text-[13px] font-mono font-medium"
            >
              {tick.label}
            </text>
          ))}

          {/* Target Est. FG dashed line */}
          {chartData.estFgY != null &&
            chartData.estFgY >= pad.top &&
            chartData.estFgY <= pad.top + plotH && (
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={chartData.estFgY}
                y2={chartData.estFgY}
                stroke="rgba(52, 211, 153, 0.7)"
                strokeDasharray="6 5"
                strokeWidth="1.75"
              />
            )}

          {/* SG area & thicker line for distance legibility */}
          {chartData.sgAreaPath && (
            <path d={chartData.sgAreaPath} fill="url(#sgAreaGrad)" />
          )}
          {chartData.sgPath && (
            <path
              d={chartData.sgPath}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Temperature line */}
          {showTemp && chartData.tempPath && (
            <path
              d={chartData.tempPath}
              fill="none"
              stroke="#fb923c"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.92"
            />
          )}

          {/* Interactive scrub crosshair */}
          {activeReading && activeX != null && (
            <g>
              <line
                x1={activeX}
                x2={activeX}
                y1={pad.top}
                y2={pad.top + plotH}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1.5"
              />
              {activeReading.sg != null && (
                <circle
                  cx={activeX}
                  cy={chartData.ySgFor(activeReading.sg)}
                  r="5.5"
                  fill="#38bdf8"
                  stroke="#090d16"
                  strokeWidth="2"
                />
              )}
              {showTemp && activeReading.temp != null && (
                <circle
                  cx={activeX}
                  cy={chartData.yTempFor(convertTempValue(activeReading.temp, tempUnit))}
                  r="5"
                  fill="#fb923c"
                  stroke="#090d16"
                  strokeWidth="2"
                />
              )}
            </g>
          )}
        </svg>

        {/* Live scrub readout strip */}
        {activeReading && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-slate-950/92 border border-white/15 text-xs sm:text-sm font-mono text-slate-200">
            <span className="text-slate-300">
              {new Date(activeReading.time).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
            <div className="flex flex-wrap items-center gap-4">
              {activeReading.sg != null && (
                <span className="text-sky-300 font-bold">
                  SG {activeReading.sg.toFixed(3)}
                </span>
              )}
              {activeReading.temp != null && (
                <span className="text-amber-300 font-bold">
                  {formatTemp(activeReading.temp, tempUnit)}
                </span>
              )}
              {activeAtten != null && (
                <span className="text-emerald-300 font-bold">
                  {activeAtten.toFixed(0)}% Atten.
                </span>
              )}
              <button
                type="button"
                onClick={() => setSelectedIdx(null)}
                className="min-h-[32px] px-2.5 rounded-md bg-white/10 hover:bg-white/15 text-xs text-slate-200 font-sans font-semibold cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
