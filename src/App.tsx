import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Beer,
  CalendarClock,
  LayoutGrid,
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings,
  SlidersHorizontal,
} from 'lucide-react';
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

const KIOSK_IDLE_MS = 60_000;

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

  const [isPortraitViewport, setIsPortraitViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const hasCredentials = Boolean(creds.userId && creds.apiKey);

  // Track viewport orientation for Auto layout mode
  useEffect(() => {
    const updateOrientation = () => {
      setIsPortraitViewport(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  // Track fullscreen state
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  // Keep touchscreen awake via Screen Wake Lock API while in fullscreen kiosk mode
  useEffect(() => {
    let cancelled = false;

    const requestLock = async () => {
      if (
        !isFullscreen ||
        !('wakeLock' in navigator) ||
        document.visibilityState !== 'visible'
      ) {
        return;
      }
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await sentinel.release().catch(() => {});
          return;
        }
        wakeLockRef.current = sentinel;
      } catch {
        // Wake Lock may be unsupported or blocked by iframe/browser policy
      }
    };

    const releaseLock = () => {
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        wakeLockRef.current.release().catch(() => {});
      }
      wakeLockRef.current = null;
    };

    if (isFullscreen) {
      requestLock();
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          requestLock();
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      return () => {
        cancelled = true;
        document.removeEventListener('visibilitychange', onVisibilityChange);
        releaseLock();
      };
    }

    releaseLock();
    return undefined;
  }, [isFullscreen]);

  // 60-second kiosk auto-return: prevents guests from leaving the wall display stuck on a modal or filtered tab
  useEffect(() => {
    if (settingsOpen) return;
    if (selectedBatch === null && activeSection === 'all') return;

    let timer = window.setTimeout(() => {
      setSelectedBatch(null);
      setActiveSection('all');
    }, KIOSK_IDLE_MS);

    const resetIdleTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setSelectedBatch(null);
        setActiveSection('all');
      }, KIOSK_IDLE_MS);
    };

    window.addEventListener('pointerdown', resetIdleTimer, { passive: true });
    window.addEventListener('touchstart', resetIdleTimer, { passive: true });
    window.addEventListener('wheel', resetIdleTimer, { passive: true });
    window.addEventListener('keydown', resetIdleTimer);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
      window.removeEventListener('wheel', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
    };
  }, [settingsOpen, selectedBatch, activeSection]);

  const handleToggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };

  const loadLiveData = useCallback(async (userId: string, apiKey: string) => {
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
        err instanceof Error ? err.message : 'Unable to reach Brewfather API.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [
    hasCredentials,
    creds.userId,
    creds.apiKey,
    settings.refreshMinutes,
    loadLiveData,
  ]);

  const handleLoadSample = () => {
    const sample = createSampleTaproomData();
    setData(sample);
    setIsSampleMode(true);
    setError(null);
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
  }, [
    data,
    assignments,
    settings.includeConditioningOnTap,
    settings.showHiddenBatches,
  ]);

  // Fermenting batches (plus conditioning with active hydrometer readings)
  const fermentingBatches = useMemo(() => {
    if (!data) return [];
    const list = [...data.fermenting];
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

  const isPortraitKiosk =
    settings.layoutMode === 'portrait' ||
    (settings.layoutMode === 'auto' && isPortraitViewport);

  const showTap = activeSection === 'all' || activeSection === 'tap';
  const showFermenting =
    (activeSection === 'all' || activeSection === 'fermenting') &&
    fermentingBatches.length > 0;
  const showPlanning =
    (activeSection === 'all' || activeSection === 'planning') &&
    upcomingBatches.length > 0;

  const syncSummaryText = data
    ? `${isSampleMode ? 'Sample preview' : 'Synced'} ${new Date(
        data.fetchedAt
      ).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : 'Not connected';

  const navItems: Array<{
    id: SectionFilter;
    label: string;
    icon: typeof LayoutGrid;
  }> = [
    { id: 'all', label: 'Overview', icon: LayoutGrid },
    { id: 'tap', label: 'On Tap', icon: Beer },
    { id: 'fermenting', label: 'Fermenting', icon: Activity },
    { id: 'planning', label: 'Up Next', icon: CalendarClock },
  ];

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-[#090d16] text-slate-100 overflow-x-hidden">
      {/* Backdrop Image + Measured Scrim */}
      <div
        className="fixed inset-0 z-0 pointer-events-none bg-cover bg-center"
        style={{ backgroundImage: `url(${taproomBackdrop})` }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#090d16]/86 via-[#090d16]/82 to-[#090d16]/96"
        aria-hidden="true"
      />

      {/* HEADER: Centered Masthead in Portrait Kiosk Mode (hard-to-reach top zone) vs. 3-Zone Bar in Landscape */}
      {isPortraitKiosk ? (
        <header className="relative z-10 border-b border-white/10 bg-slate-950/65 backdrop-blur-md">
          <div className="max-w-[1024px] mx-auto px-5 py-4 flex flex-col items-center text-center">
            <div className="flex items-center justify-center gap-3.5">
              <BreweryLogo className="w-14 h-14 sm:w-16 sm:h-16 shrink-0" />
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-none">
                {settings.breweryName}
              </h1>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm font-mono text-slate-400">
              {loading ? 'Syncing Brewfather…' : syncSummaryText}
            </p>
          </div>
        </header>
      ) : (
        <header className="relative z-10 border-b border-white/10 bg-slate-950/65 backdrop-blur-md">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 min-h-[68px] py-2 flex items-center justify-between gap-6">
            {/* Zone 1: Single-line Brand */}
            <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
              <BreweryLogo className="w-11 h-11 shrink-0" />
              <span className="text-xl font-extrabold tracking-tight text-white">
                {settings.breweryName}
              </span>
            </div>

            {/* Zone 2: Section Nav Links */}
            <nav
              className="hidden md:flex items-center gap-6 text-sm font-semibold"
              aria-label="Taproom sections"
            >
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`min-h-[44px] px-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeSection === item.id
                      ? 'border-rose-500 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Zone 3: Touch-Sized Utility Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {hasCredentials && (
                <button
                  type="button"
                  onClick={() => loadLiveData(creds.userId, creds.apiKey)}
                  disabled={loading}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 rounded-lg border border-white/12 bg-slate-900/75 hover:bg-slate-800 active:scale-95 text-sm font-semibold text-slate-200 transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                  title="Refresh Brewfather data"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                  />
                  <span className="hidden sm:inline">Sync</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 rounded-lg border border-white/12 bg-slate-900/75 hover:bg-slate-800 active:scale-95 text-slate-200 transition-all cursor-pointer shrink-0"
                title={isFullscreen ? 'Exit fullscreen' : 'Enter kiosk fullscreen'}
                aria-label={
                  isFullscreen ? 'Exit fullscreen' : 'Enter kiosk fullscreen'
                }
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-95 text-sm font-semibold text-white transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Taproom Content */}
      <main
        className={`relative z-10 flex-1 w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 flex flex-col gap-7 ${
          isPortraitKiosk ? 'max-w-[1024px]' : 'max-w-[1440px]'
        }`}
      >
        {/* Sample Preview Notice */}
        {isSampleMode && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-950/35 px-4 py-3 text-sm text-amber-100 backdrop-blur-sm">
            <span>
              Viewing sample taproom batches. Connect your Brewfather User ID and API Key to pull live taps and hydrometer curves.
            </span>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="min-h-[44px] px-4 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 border border-amber-400/40 text-amber-100 font-semibold transition-all cursor-pointer whitespace-nowrap"
            >
              Connect Brewfather
            </button>
          </div>
        )}

        {/* API Error Notice */}
        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/35 bg-rose-950/45 px-4 py-3 text-sm text-rose-100">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadLiveData(creds.userId, creds.apiKey)}
                className="min-h-[44px] px-4 rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 text-sm font-semibold cursor-pointer transition-all"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="min-h-[44px] px-4 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-95 text-sm font-semibold cursor-pointer transition-all"
              >
                Check API Key
              </button>
            </div>
          </div>
        )}

        {/* Unconfigured First-Visit State */}
        {!hasCredentials && !data && !loading && (
          <section className="my-auto mx-auto max-w-xl w-full rounded-2xl border border-white/12 bg-slate-900/80 p-8 backdrop-blur-md text-center">
            <BreweryLogo className="w-24 h-24 mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-balance">
              Connect Your Brewfather Brewery
            </h2>
            <p className="mt-3 text-base text-slate-300 leading-relaxed">
              Pull your active taps, live Tilt/iSpindel/RAPT fermentation telemetry curves, and upcoming brew schedule directly from the Brewfather v2 API. Runs 100% client-side for GitHub Pages.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="min-h-[52px] inline-flex items-center gap-2 px-6 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-base font-semibold text-white transition-all cursor-pointer"
              >
                <SlidersHorizontal className="w-5 h-5" />
                Connect Brewfather API
              </button>
              <button
                type="button"
                onClick={handleLoadSample}
                className="min-h-[52px] px-6 rounded-xl border border-white/15 bg-slate-800/70 hover:bg-slate-800 active:scale-95 text-base font-semibold text-slate-200 transition-all cursor-pointer"
              >
                Preview Sample Taplist
              </button>
            </div>
          </section>
        )}

        {/* Loading Skeleton */}
        {loading && !data && (
          <div className="space-y-6">
            <div
              className={`grid gap-4 ${
                isPortraitKiosk
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1 md:grid-cols-3'
              }`}
            >
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className="h-56 rounded-2xl border border-white/10 bg-slate-900/60 animate-pulse"
                />
              ))}
            </div>
            <div className="h-80 rounded-2xl border border-white/10 bg-slate-900/60 animate-pulse" />
          </div>
        )}

        {/* Populated Taproom Sections */}
        {data && (
          <>
            {/* ON TAP SECTION */}
            {showTap && (
              <section aria-labelledby="section-ontap">
                <div className="flex items-baseline justify-between gap-4 mb-4">
                  <div className="flex items-baseline gap-3">
                    <h2
                      id="section-ontap"
                      className="text-xl sm:text-2xl font-extrabold text-white tracking-tight"
                    >
                      On Tap
                    </h2>
                    <span className="text-sm font-mono text-slate-400">
                      {tapBatches.length}{' '}
                      {tapBatches.length === 1 ? 'beer' : 'beers'}
                    </span>
                  </div>
                  <span className="hidden sm:inline text-xs sm:text-sm text-slate-400">
                    Tap slot badge to reassign · Tap card for recipe
                  </span>
                </div>

                {tapBatches.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/50 p-6 text-center text-base text-slate-400">
                    No Completed or Conditioning batches found. Update batch statuses in Brewfather or adjust Settings.
                  </div>
                ) : (
                  <div
                    className={`grid gap-4 sm:gap-5 ${
                      tapBatches.length === 1
                        ? 'grid-cols-1'
                        : isPortraitKiosk
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
                className={`grid gap-7 ${
                  isPortraitKiosk || !showFermenting || !showPlanning
                    ? 'grid-cols-1'
                    : 'grid-cols-1 lg:grid-cols-12 items-start'
                }`}
              >
                {/* FERMENTING */}
                {showFermenting && (
                  <section
                    aria-labelledby="section-fermenting"
                    className={
                      !isPortraitKiosk && showPlanning
                        ? 'lg:col-span-8'
                        : 'col-span-1'
                    }
                  >
                    <div className="flex items-baseline justify-between gap-3 mb-4">
                      <div className="flex items-baseline gap-3">
                        <h2
                          id="section-fermenting"
                          className="text-xl sm:text-2xl font-extrabold text-white tracking-tight"
                        >
                          Fermenting
                        </h2>
                        <span className="text-sm font-mono text-slate-400">
                          {fermentingBatches.length} active
                        </span>
                      </div>
                      <span className="hidden sm:inline text-xs sm:text-sm text-slate-400">
                        Drag graph to inspect readings
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-5">
                      {fermentingBatches.map((batch) => (
                        <FermentingCard
                          key={batch._id}
                          batch={batch}
                          readings={data.readingsByBatch[batch._id] || []}
                          tempUnit={settings.tempUnit}
                          compact={false}
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
                      !isPortraitKiosk && showFermenting
                        ? 'lg:col-span-4'
                        : 'col-span-1'
                    }
                  >
                    <div className="flex items-baseline gap-3 mb-4">
                      <h2
                        id="section-planning"
                        className="text-xl sm:text-2xl font-extrabold text-white tracking-tight"
                      >
                        Up Next
                      </h2>
                      <span className="text-sm font-mono text-slate-400">
                        {upcomingBatches.length} scheduled
                      </span>
                    </div>

                    <div
                      className={`grid gap-4 ${
                        isPortraitKiosk
                          ? upcomingBatches.length === 1
                            ? 'grid-cols-1'
                            : 'grid-cols-1 sm:grid-cols-2'
                          : showFermenting
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

      {/* Quiet Desktop Footer (Landscape only; Portrait Kiosk uses bottom touch dock instead) */}
      {!isPortraitKiosk && (
        <footer className="hidden md:block relative z-10 border-t border-white/8 bg-slate-950/60 backdrop-blur-sm">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>{settings.breweryName} · Brewfather API v2</span>
            <span className="font-mono">{syncSummaryText}</span>
          </div>
        </footer>
      )}

      {/* BOTTOM TOUCH KIOSK DOCK (Natural Reach Zone for Wall-Mounted Portrait Touchscreen & Mobile) */}
      <nav
        aria-label="Kiosk touch controls"
        className={`${
          isPortraitKiosk ? 'block' : 'md:hidden'
        } sticky bottom-0 z-30 border-t border-white/12 bg-slate-950/92 backdrop-blur-md`}
      >
        <div
          className={`mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2 ${
            isPortraitKiosk ? 'max-w-[1024px]' : 'max-w-[1440px]'
          }`}
        >
          {/* Section Navigation Tabs */}
          <div className="flex-1 grid grid-cols-4 gap-1.5 sm:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`min-h-[54px] px-2 py-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer ${
                    isActive
                      ? 'bg-rose-500/18 border-rose-500/45 text-rose-200'
                      : 'bg-slate-900/60 border-white/8 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="text-[11px] sm:text-xs font-bold tracking-tight leading-none whitespace-nowrap">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Utility Cluster */}
          <div className="h-9 w-px bg-white/12 shrink-0 mx-0.5" aria-hidden="true" />

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {hasCredentials && (
              <button
                type="button"
                onClick={() => loadLiveData(creds.userId, creds.apiKey)}
                disabled={loading}
                className="min-h-[54px] min-w-[54px] px-2.5 rounded-xl border border-white/10 bg-slate-900/75 hover:bg-slate-800 active:scale-95 flex flex-col items-center justify-center gap-1 text-slate-200 transition-all cursor-pointer disabled:opacity-50"
                title="Refresh Brewfather data"
              >
                <RefreshCw
                  className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
                />
                <span className="text-[11px] font-semibold leading-none">Sync</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="min-h-[54px] min-w-[54px] px-2.5 rounded-xl border border-white/10 bg-slate-900/75 hover:bg-slate-800 active:scale-95 flex flex-col items-center justify-center gap-1 text-slate-200 transition-all cursor-pointer"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter kiosk fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
              <span className="text-[11px] font-semibold leading-none">
                {isFullscreen ? 'Exit' : 'Full'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="min-h-[54px] min-w-[54px] px-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 flex flex-col items-center justify-center gap-1 text-white transition-all cursor-pointer"
              title="Taproom settings"
            >
              <Settings className="w-5 h-5" />
              <span className="text-[11px] font-semibold leading-none">Setup</span>
            </button>
          </div>
        </div>
      </nav>

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
