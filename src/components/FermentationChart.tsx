import { useMemo, useState } from 'react';
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
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (readings.length === 0) return [];
    if (range === 'all') return readings;
    const latestTime = readings[readings.length - 1].time;
    const windowMs = range === '7d' ? 7 * 24 * 3600 * 1000 : 48 * 3600 * 1000;
    const cutoff = latestTime - windowMs;
    const subset = readings.filter((r) => r.time >= cutoff);
    return subset.length >= 2 ? subset : readings;
  }, [readings, range]);

  const width = 640;
  const height = compact ? 165 : 215;
  const pad = { top: 14, right: 44, bottom: 26, left: 48 };
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

    const tempMinRaw = tempValues.length > 0 ? Math.min(...tempValues) : tempUnit === 'F' ? 60 : 15;
    const tempMaxRaw = tempValues.length > 0 ? Math.max(...tempValues) : tempUnit === 'F' ? 75 : 24;
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
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    const sgPath = buildPath(sgPoints);
    const sgAreaPath =
      sgPoints.length > 1
        ? `${sgPath} L ${sgPoints[sgPoints.length - 1].x.toFixed(1)} ${(pad.top + plotH).toFixed(1)} L ${sgPoints[0].x.toFixed(1)} ${(pad.top + plotH).toFixed(1)} Z`
        : '';
    const tempPath = buildPath(tempPoints);

    // 4 clean horizontal grid ticks for SG
    const sgTicks = [0, 0.33, 0.66, 1].map((f) => {
      const val = sgMax - f * sgSpan;
      return { val, y: pad.top + f * plotH };
    });

    const tempTicks = [0, 0.5, 1].map((f) => {
      const val = tempMax - f * tempSpan;
      return { val, y: pad.top + f * plotH };
    });

    // 4 x-axis date ticks
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
      <div className="flex items-center justify-center h-36 border-t border-white/8 text-xs text-slate-400 font-mono">
        Waiting for Brewfather hydrometer readings…
      </div>
    );
  }

  const hoveredReading =
    hoverIdx != null && filtered[hoverIdx] ? filtered[hoverIdx] : null;
  const hoveredX = hoveredReading ? chartData.xFor(hoveredReading.time) : null;
  const hoveredAtten =
    hoveredReading?.sg != null
      ? calcTargetAttenuationProgress(og, hoveredReading.sg, estFg)
      : null;

  const handlePointerMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
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
    setHoverIdx(nearest);
  };

  return (
    <div className="flex flex-col gap-2 pt-2.5 border-t border-white/8">
      {/* Chart toolbar */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="inline-flex items-center gap-1.5 font-medium text-sky-400">
            <span className="w-2.5 h-0.5 bg-sky-400 inline-block" />
            Gravity (SG)
          </span>
          <button
            type="button"
            onClick={() => setShowTemp((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 font-medium transition-opacity cursor-pointer whitespace-nowrap shrink-0 ${
              showTemp ? 'text-amber-400 opacity-100' : 'text-slate-500 opacity-60 hover:opacity-90'
            }`}
            title="Toggle temperature series"
          >
            <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
            Temp (°{tempUnit})
          </button>
          {estFg != null && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-slate-400 font-mono">
              <span className="w-2.5 border-t border-dashed border-emerald-400/70 inline-block" />
              Target {estFg.toFixed(3)}
            </span>
          )}
        </div>

        {/* Range switcher */}
        <div className="flex items-center gap-0.5 bg-slate-950/70 p-0.5 rounded-md border border-white/10">
          {(['all', '7d', '48h'] as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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

      {/* SVG Canvas */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
          onMouseMove={handlePointerMove}
          onMouseLeave={() => setHoverIdx(null)}
          role="img"
          aria-label="Fermentation specific gravity and temperature curve"
        >
          <defs>
            <linearGradient id="sgAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.01" />
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
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
              <text
                x={pad.left - 6}
                y={tick.y + 3.5}
                textAnchor="end"
                className="fill-sky-400/90 text-[10px] font-mono"
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
                x={width - pad.right + 6}
                y={tick.y + 3.5}
                textAnchor="start"
                className="fill-amber-400/90 text-[10px] font-mono"
              >
                {tick.val.toFixed(0)}°
              </text>
            ))}

          {/* X-axis labels */}
          {chartData.xTicks.map((tick, i) => (
            <text
              key={i}
              x={tick.x}
              y={height - 6}
              textAnchor={i === 0 ? 'start' : i === chartData.xTicks.length - 1 ? 'end' : 'middle'}
              className="fill-slate-400 text-[10px] font-mono"
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
                stroke="rgba(52, 211, 153, 0.55)"
                strokeDasharray="4 4"
                strokeWidth="1.25"
              />
            )}

          {/* SG area & line */}
          {chartData.sgAreaPath && (
            <path d={chartData.sgAreaPath} fill="url(#sgAreaGrad)" />
          )}
          {chartData.sgPath && (
            <path
              d={chartData.sgPath}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.2"
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
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.9"
            />
          )}

          {/* Interactive hover crosshair */}
          {hoveredReading && hoveredX != null && (
            <g>
              <line
                x1={hoveredX}
                x2={hoveredX}
                y1={pad.top}
                y2={pad.top + plotH}
                stroke="rgba(255,255,255,0.28)"
                strokeWidth="1"
              />
              {hoveredReading.sg != null && (
                <circle
                  cx={hoveredX}
                  cy={chartData.ySgFor(hoveredReading.sg)}
                  r="4"
                  fill="#38bdf8"
                  stroke="#090d16"
                  strokeWidth="1.5"
                />
              )}
              {showTemp && hoveredReading.temp != null && (
                <circle
                  cx={hoveredX}
                  cy={chartData.yTempFor(convertTempValue(hoveredReading.temp, tempUnit))}
                  r="3.5"
                  fill="#fb923c"
                  stroke="#090d16"
                  strokeWidth="1.5"
                />
              )}
            </g>
          )}
        </svg>

        {/* Live hover readout strip */}
        {hoveredReading && (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-slate-950/90 border border-white/10 text-[11px] font-mono text-slate-300">
            <span className="text-slate-400">
              {new Date(hoveredReading.time).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
            <div className="flex items-center gap-3">
              {hoveredReading.sg != null && (
                <span className="text-sky-400">
                  SG {hoveredReading.sg.toFixed(3)}
                </span>
              )}
              {hoveredReading.temp != null && (
                <span className="text-amber-400">
                  {formatTemp(hoveredReading.temp, tempUnit)}
                </span>
              )}
              {hoveredAtten != null && (
                <span className="text-emerald-400">
                  {hoveredAtten.toFixed(0)}% Atten.
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
