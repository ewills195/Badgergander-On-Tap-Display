import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Settings, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import taproomBackdrop from './assets/images/taproom_backdrop_1795141095071.jpg';
import { BreweryLogo } from './components/BreweryLogo';
import { TapCard } from './components/TapCard';
import { FermentingCard } from './components/FermentingCard';
import { PlanningCard } from './components/PlanningCard';
import { BatchDetailModal } from './components/BatchDetailModal';
import { SettingsModal } from './components/SettingsModal';
import { createSampleTaproomData } from './data/sampleBatches';
import { fetchAllTaproomData } from './services/brewfatherApi';
import type {
  BrewfatherBatch,
  SectionFilter,
  TapAssignment,
  TaproomData,
  TaproomSettings,
} from './types/brewfather';
import {
  getCredentials,
  getSettings,
  getTapAssignments,
  saveCredentials,
  saveSettings,
  saveTapAssignments,
} from './utils/storage';

export default function App() {
  const [creds, setCreds] = useState(() => getCredentials());
  const [settings, setSettings] = useState<TaproomSettings>(() => getSettings());
  const [assignments, setAssignments] = useState<Record<string, TapAssignment>>(() =>
    getTapAssignments()
  );

  const [data, setData] = useState<TaproomData | null>(null);
  const [isSampleMode, setIsSampleMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<SectionFilter>('all');
  const [selectedBatch, setSelectedBatch] = useState<BrewfatherBatch | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const hasCredentials = Boolean(creds.userId && creds.apiKey);

  const loadLiveData = useCallback(
    async (userId: string, apiKey: string) => {
      if (!userId || !apiKey) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAllTaproomData(userId, apiKey);
        setData(result);
        setIsSampleMode(false);

        // Prune stale assignments for batches no longer returned (except sample IDs)
        const activeIds = new Set([
          ...result.completed.map((b) => b._id),
          ...result.conditioning.map((b) => b._id),
        ]);
        setAssignments((prev) => {
          let changed = false;
          const next: Record<string, TapAssignment> = {};
          for (const [id, val] of Object.entries(prev)) {
            if (activeIds.has(id) || id.startsWith('sample-')) {
              next[id] = val;
            } else {
              changed = true;
            }
          }
          if (changed) saveTapAssignments(next);
          return changed ? next : prev;
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to reach Brewfather API.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial load & auto-refresh timer
  useEffect(() => {
    if (!hasCredentials) return;
    loadLiveData(creds.userId, creds.apiKey);

    if (settings.refreshMinutes > 0) {
      const intervalMs = settings.refreshMinutes * 60 * 1000;
      const timer = setInterval(() => {
        loadLiveData(creds.userId, creds.apiKey);
      }, intervalMs);
      return () => clearInterval(timer);
    }
  }, [hasCredentials, creds.userId, creds.apiKey, settings.refreshMinutes, loadLiveData]);

  const handleLoadSample = () => {
    const sample = createSampleTaproomData();
    setData(sample);
    setIsSampleMode(true);
    setError(null);
    // Pre-assign sample taps if none set yet
    setAssignments((prev) => {
      if (prev['sample-tap-1']) return prev;
      const next: Record<string, TapAssignment> = {
        ...prev,
        'sample-tap-1': 'tap:0',
        'sample-tap-2': 'tap:1',
        'sample-tap-3': 'on-deck',
      };
      saveTapAssignments(next);
      return next;
    });
  };

  const handleAssignTap = (batchId: string, assignment: TapAssignment | null) => {
    setAssignments((prev) => {
      const next = { ...prev };
      if (assignment == null) {
        delete next[batchId];
      } else {
        next[batchId] = assignment;
      }
      saveTapAssignments(next);
      return next;
    });
  };

  const handleCycleTapAssignment = (batchId: string) => {
    const tapSlots = settings.tapLabels.map((_, idx) => `tap:${idx}`);
    const cycleOrder: Array<TapAssignment | null> = [
      ...tapSlots,
      'on-deck',
      null,
    ];
    const current = assignments[batchId] ?? null;
    const currentIdx = cycleOrder.indexOf(current);
    const nextVal =
      currentIdx === -1
        ? cycleOrder[0]
        : cycleOrder[(currentIdx + 1) % cycleOrder.length];
    handleAssignTap(batchId, nextVal);
  };

  const handleSaveSettings = (
    userId: string,
    apiKey: string,
    nextSettings: TaproomSettings
  ) => {
    saveSettings(nextSettings);
    setSettings(nextSettings);

    if (userId && apiKey) {
      saveCredentials(userId, apiKey);
      setCreds({ userId, apiKey });
      loadLiveData(userId, apiKey);
    }
  };

  const handleImportComplete = () => {
    const updatedCreds = getCredentials();
    const updatedSettings = getSettings();
    const updatedAssignments = getTapAssignments();
    setCreds(updatedCreds);
    setSettings(updatedSettings);
    setAssignments(updatedAssignments);
    if (updatedCreds.userId && updatedCreds.apiKey) {
      loadLiveData(updatedCreds.userId, updatedCreds.apiKey);
    }
  };

  // Compute sorted tap batches
  const tapBatches = useMemo(() => {
    if (!data) return [];
    const pool = settings.includeConditioningOnTap
      ? [...data.completed, ...data.conditioning]
      : [...data.completed];

    const visible = pool.filter((b) =>
      settings.showHiddenBatches ? true : assignments[b._id] !== 'hidden'
    );

    const rankOf = (id: string): number => {
      const a = assignments[id];
      if (!a) return 900;
      if (a.startsWith('tap:')) {
        const idx = Number(a.slice(4));
        return Number.isFinite(idx) ? idx : 800;
      }
      if (a === 'on-deck') return 500;
      if (a === 'hidden') return 999;
      return 850;
    };

    return visible.sort((a, b) => {
      const rA = rankOf(a._id);
      const rB = rankOf(b._id);
      if (rA !== rB) return rA - rB;
      const dateA = a.bottlingDate || a.brewDate || 0;
      const dateB = b.bottlingDate || b.brewDate || 0;
      return dateB - dateA;
    });
  }, [data, assignments, settings.includeConditioningOnTap, settings.showHiddenBatches]);

  // Fermenting batches (plus conditioning if not shown only on tap, or if it has readings)
  const fermentingBatches = useMemo(() => {
    if (!data) return [];
    const list = [...data.fermenting];
    // Include conditioning batches in Fermenting if they have active hydrometer readings
    for (const cond of data.conditioning) {
      const readings = data.readingsByBatch[cond._id] || [];
      if (readings.length >= 2 && !list.some((b) => b._id === cond._id)) {
        list.push(cond);
      }
    }
    return list;
  }, [data]);

  // Brewing + Upcoming Planned batches
  const upcomingBatches = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    const activeBrewing = [...data.brewing];
    const planned = [...data.planning]
      .filter((b) => !b.brewDate || b.brewDate >= now - 24 * 3600 * 1000)
      .sort((a, b) => (a.brewDate || Infinity) - (b.brewDate || Infinity));
    return [...activeBrewing, ...planned];
  }, [data]);

  const isPortraitMode = settings.layoutMode === 'portrait';

  const showTap = activeSection === 'all' || activeSection === 'tap';
  const showFermenting =
    (activeSection === 'all' || activeSection === 'fermenting') &&
    fermentingBatches.length > 0;
  const showPlanning =
    (activeSection === 'all' || activeSection === 'planning') &&
    upcomingBatches.length > 0;

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-[#090d16] text-slate-100 overflow-x-hidden">
      {/* Backdrop Image + Measured Scrim */}
      <div
        className="fixed inset-0 z-0 pointer-events-none bg-cover bg-center"
        style={{ backgroundImage: `url(${taproomBackdrop})` }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#090d16]/85 via-[#090d16]/82 to-[#090d16]/95"
        aria-hidden="true"
      />

      {/* Top Bar Contract: Zone 1 Brand — Zone 2 Filter Links — Zone 3 Primary Action */}
      <header className="relative z-10 border-b border-white/10 bg-slate-950/65 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand */}
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <BreweryLogo className="w-9 h-9 shrink-0" />
            <span className="text-lg font-extrabold tracking-tight text-white">
              {settings.breweryName}
            </span>
          </div>

          {/* Zone 2: Section Nav Links */}
          <nav
            className="hidden md:flex items-center gap-6 text-sm font-medium"
            aria-label="Taproom sections"
          >
            {(
              [
                { id: 'all', label: 'Overview' },
                { id: 'tap', label: 'On Tap' },
                { id: 'fermenting', label: 'Fermenting' },
                { id: 'planning', label: 'Up Next' },
              ] as Array<{ id: SectionFilter; label: string }>
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`py-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeSection === item.id
                    ? 'border-rose-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {hasCredentials && (
              <button
                type="button"
                onClick={() => loadLiveData(creds.userId, creds.apiKey)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 bg-slate-900/75 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                title="Refresh Brewfather data"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                />
                <span className="hidden sm:inline">Sync</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Taproom Content */}
      <main className="relative z-10 flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-7">
        {/* Sample Preview Notice */}
        {isSampleMode && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-950/35 px-4 py-2.5 text-xs text-amber-100 backdrop-blur-sm">
            <span>
              Viewing sample taproom batches. Connect your Brewfather User ID and API Key to pull live taps and hydrometer curves.
            </span>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="px-3 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Connect Brewfather
            </button>
          </div>
        )}

        {/* API Error Notice */}
        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/35 bg-rose-950/45 px-4 py-3 text-sm text-rose-100">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadLiveData(creds.userId, creds.apiKey)}
                className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/15 text-xs font-semibold cursor-pointer"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-xs font-semibold cursor-pointer"
              >
                Check API Key
              </button>
            </div>
          </div>
        )}

        {/* Unconfigured First-Visit State */}
        {!hasCredentials && !data && !loading && (
          <section className="my-auto mx-auto max-w-xl w-full rounded-2xl border border-white/12 bg-slate-900/80 p-8 backdrop-blur-md text-center">
            <BreweryLogo className="w-14 h-14 mx-auto mb-4" />
            <h1 className="text-2xl font-extrabold text-white tracking-tight text-balance">
              Connect Your Brewfather Brewery
            </h1>
            <p className="mt-2.5 text-sm text-slate-300 leading-relaxed">
              Pull your active taps, live Tilt/iSpindel/RAPT fermentation telemetry curves, and upcoming brew schedule directly from the Brewfather v2 API. Runs 100% client-side for GitHub Pages.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-sm font-semibold text-white transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Connect Brewfather API
              </button>
              <button
                type="button"
                onClick={handleLoadSample}
                className="px-5 py-2.5 rounded-lg border border-white/15 bg-slate-800/70 hover:bg-slate-800 text-sm font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                Preview Sample Taplist
              </button>
            </div>
          </section>
        )}

        {/* Loading Skeleton */}
        {loading && !data && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-48 rounded-xl border border-white/10 bg-slate-900/60 animate-pulse"
                />
              ))}
            </div>
            <div className="h-72 rounded-xl border border-white/10 bg-slate-900/60 animate-pulse" />
          </div>
        )}

        {/* Populated Taproom Sections */}
        {data && (
          <>
            {/* ON TAP SECTION */}
            {showTap && (
              <section aria-labelledby="section-ontap">
                <div className="flex items-baseline justify-between gap-4 mb-3.5">
                  <div className="flex items-baseline gap-3">
                    <h2
                      id="section-ontap"
                      className="text-lg font-bold text-white tracking-tight"
                    >
                      On Tap
                    </h2>
                    <span className="text-xs font-mono text-slate-400">
                      {tapBatches.length} {tapBatches.length === 1 ? 'beer' : 'beers'}
                    </span>
                  </div>
                  <span className="hidden sm:inline text-xs text-slate-400">
                    Click tap button to assign slots · Click card for recipe
                  </span>
                </div>

                {tapBatches.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/15 bg-slate-900/50 p-6 text-center text-sm text-slate-400">
                    No Completed or Conditioning batches found. Update batch statuses in Brewfather or adjust Settings.
                  </div>
                ) : (
                  <div
                    className={`grid gap-4 ${
                      isPortraitMode
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                    }`}
                  >
                    {tapBatches.map((batch) => (
                      <TapCard
                        key={batch._id}
                        batch={batch}
                        assignment={assignments[batch._id]}
                        tapLabels={settings.tapLabels}
                        onCycleAssignment={handleCycleTapAssignment}
                        onSelectBatch={setSelectedBatch}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* FERMENTING + UP NEXT GRID */}
            {(showFermenting || showPlanning) && (
              <div
                className={`grid gap-6 ${
                  isPortraitMode || !showFermenting || !showPlanning
                    ? 'grid-cols-1'
                    : 'grid-cols-1 lg:grid-cols-12 items-start'
                }`}
              >
                {/* FERMENTING */}
                {showFermenting && (
                  <section
                    aria-labelledby="section-fermenting"
                    className={
                      !isPortraitMode && showPlanning
                        ? 'lg:col-span-8'
                        : 'col-span-1'
                    }
                  >
                    <div className="flex items-baseline gap-3 mb-3.5">
                      <h2
                        id="section-fermenting"
                        className="text-lg font-bold text-white tracking-tight"
                      >
                        Fermenting
                      </h2>
                      <span className="text-xs font-mono text-slate-400">
                        {fermentingBatches.length} active
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {fermentingBatches.map((batch) => (
                        <FermentingCard
                          key={batch._id}
                          batch={batch}
                          readings={data.readingsByBatch[batch._id] || []}
                          tempUnit={settings.tempUnit}
                          compact={isPortraitMode}
                          onSelectBatch={setSelectedBatch}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* UP NEXT / PLANNING */}
                {showPlanning && (
                  <section
                    aria-labelledby="section-planning"
                    className={
                      !isPortraitMode && showFermenting
                        ? 'lg:col-span-4'
                        : 'col-span-1'
                    }
                  >
                    <div className="flex items-baseline gap-3 mb-3.5">
                      <h2
                        id="section-planning"
                        className="text-lg font-bold text-white tracking-tight"
                      >
                        Up Next
                      </h2>
                      <span className="text-xs font-mono text-slate-400">
                        {upcomingBatches.length} scheduled
                      </span>
                    </div>

                    <div
                      className={`grid gap-3.5 ${
                        !isPortraitMode && showFermenting
                          ? 'grid-cols-1'
                          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                      }`}
                    >
                      {upcomingBatches.map((batch) => (
                        <PlanningCard
                          key={batch._id}
                          batch={batch}
                          onSelectBatch={setSelectedBatch}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="relative z-10 border-t border-white/8 bg-slate-950/60 backdrop-blur-sm">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>{settings.breweryName} · Brewfather API v2</span>
          <span className="font-mono">
            {data
              ? `${isSampleMode ? 'Sample preview' : 'Synced'} ${new Date(
                  data.fetchedAt
                ).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}`
              : 'Not connected'}
          </span>
        </div>
      </footer>

      {/* Modals */}
      <BatchDetailModal
        batch={selectedBatch}
        readings={
          selectedBatch && data
            ? data.readingsByBatch[selectedBatch._id] || []
            : []
        }
        assignment={selectedBatch ? assignments[selectedBatch._id] : undefined}
        tapLabels={settings.tapLabels}
        tempUnit={settings.tempUnit}
        onAssignTap={handleAssignTap}
        onClose={() => setSelectedBatch(null)}
      />

      <SettingsModal
        key={settingsOpen ? 'open' : 'closed'}
        isOpen={settingsOpen}
        initialUserId={creds.userId}
        initialApiKey={creds.apiKey}
        initialSettings={settings}
        onSave={handleSaveSettings}
        onImportComplete={handleImportComplete}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
