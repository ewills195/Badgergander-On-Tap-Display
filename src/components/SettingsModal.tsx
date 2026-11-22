import { useState } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { brewfatherFetch } from '../services/brewfatherApi';
import type {
  BrewfatherBatch,
  LayoutMode,
  TaproomSettings,
  TempUnit,
} from '../types/brewfather';
import { exportConfigJson, importConfigJson } from '../utils/storage';

interface SettingsModalProps {
  isOpen: boolean;
  initialUserId: string;
  initialApiKey: string;
  initialSettings: TaproomSettings;
  onSave: (userId: string, apiKey: string, settings: TaproomSettings) => void;
  onImportComplete: () => void;
  onClose: () => void;
}

type SettingsTab = 'api' | 'display' | 'backup';

function TouchToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full min-h-[52px] px-3.5 py-2.5 rounded-xl border border-white/10 bg-slate-950/60 hover:border-white/20 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer active:scale-[0.99]"
    >
      <span className="text-sm text-slate-200 font-medium">{label}</span>
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-rose-600' : 'bg-slate-700'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  );
}

export function SettingsModal({
  isOpen,
  initialUserId,
  initialApiKey,
  initialSettings,
  onSave,
  onImportComplete,
  onClose,
}: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>('api');
  const [userId, setUserId] = useState(initialUserId);
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [showKey, setShowKey] = useState(false);

  const [settings, setSettings] = useState<TaproomSettings>(initialSettings);
  const [tapLabelsInput, setTapLabelsInput] = useState(
    initialSettings.tapLabels.join(', ')
  );

  const [testState, setTestState] = useState<{
    status: 'idle' | 'testing' | 'ok' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });

  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [includeCredsInExport, setIncludeCredsInExport] = useState(false);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!userId.trim() || !apiKey.trim()) {
      setTestState({
        status: 'error',
        message: 'Enter both User ID and API Key first.',
      });
      return;
    }
    setTestState({ status: 'testing', message: 'Connecting to Brewfather API v2…' });
    try {
      const batches = await brewfatherFetch<BrewfatherBatch[]>(
        'batches?limit=5',
        userId,
        apiKey
      );
      setTestState({
        status: 'ok',
        message: `Connected! Found ${batches.length} recent batch${batches.length === 1 ? '' : 'es'}.`,
      });
    } catch (err) {
      setTestState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Connection failed.',
      });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLabels = tapLabelsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const nextSettings: TaproomSettings = {
      ...settings,
      breweryName: settings.breweryName.trim() || 'Badgergander Homebrewery',
      tapLabels: parsedLabels.length > 0 ? parsedLabels : ['Left Tap', 'Right Tap'],
    };

    onSave(userId.trim(), apiKey.trim(), nextSettings);
    onClose();
  };

  const handleDownloadBackup = () => {
    const json = exportConfigJson(includeCredsInExport);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'badgergander-taproom-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = () => {
    setImportError('');
    try {
      const imported = importConfigJson(importText);
      setSettings(imported.settings);
      setTapLabelsInput(imported.settings.tapLabels.join(', '));
      if (imported.credentials) {
        setUserId(imported.credentials.userId);
        setApiKey(imported.credentials.apiKey);
      }
      onImportComplete();
      onClose();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to parse JSON');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/82 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Taproom Settings"
    >
      <div
        className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/15 bg-slate-900/98 p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/12">
          <h2 className="text-xl font-bold text-white">Taproom Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/12 transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Touch-sized Segmented Tabs */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-white/10 my-5">
          {[
            { id: 'api' as const, label: 'Brewfather' },
            { id: 'display' as const, label: 'Kiosk UI' },
            { id: 'backup' as const, label: 'Export / Sync' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`min-h-[44px] px-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                tab === item.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {tab === 'api' && (
            <>
              <p className="text-sm text-slate-400 leading-relaxed">
                Generate a read-only API key in Brewfather under{' '}
                <span className="text-slate-200 font-medium">
                  Settings → API → Generate API Key
                </span>{' '}
                with <span className="font-mono text-slate-200">batches.read</span> scope.
                Credentials stay in this browser&apos;s local storage.
              </p>

              <div>
                <label
                  htmlFor="bf-user-id"
                  className="block text-sm font-semibold text-slate-200 mb-1.5"
                >
                  Brewfather User ID
                </label>
                <input
                  id="bf-user-id"
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter your Brewfather User ID"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/14 text-base text-white font-mono focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label
                  htmlFor="bf-api-key"
                  className="block text-sm font-semibold text-slate-200 mb-1.5"
                >
                  Brewfather API Key
                </label>
                <div className="relative">
                  <input
                    id="bf-api-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Brewfather API Key"
                    className="w-full min-h-[48px] px-4 py-2.5 pr-14 rounded-xl bg-slate-950/80 border border-white/14 text-base text-white font-mono focus:outline-none focus:border-rose-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((prev) => !prev)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white cursor-pointer"
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testState.status === 'testing'}
                  className="min-h-[46px] px-4 rounded-xl border border-white/15 bg-slate-800/80 hover:bg-slate-800 text-sm font-semibold text-slate-100 transition-colors cursor-pointer whitespace-nowrap active:scale-95"
                >
                  {testState.status === 'testing' ? 'Testing…' : 'Test Connection'}
                </button>

                {testState.status !== 'idle' && (
                  <div
                    className={`flex items-center gap-2 text-sm ${
                      testState.status === 'ok'
                        ? 'text-emerald-400'
                        : testState.status === 'error'
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {testState.status === 'ok' && (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    )}
                    {testState.status === 'error' && (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{testState.message}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10">
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-2">
                    Temperature Unit
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-white/10">
                    {(['F', 'C'] as TempUnit[]).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, tempUnit: unit }))}
                        className={`min-h-[42px] text-sm font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                          settings.tempUnit === unit
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        °{unit}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="refresh-interval"
                    className="block text-sm font-semibold text-slate-200 mb-2"
                  >
                    Auto-Refresh
                  </label>
                  <select
                    id="refresh-interval"
                    value={settings.refreshMinutes}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        refreshMinutes: Number(e.target.value),
                      }))
                    }
                    className="w-full min-h-[54px] px-3.5 rounded-xl bg-slate-950/80 border border-white/14 text-sm text-white font-mono focus:outline-none focus:border-rose-400"
                  >
                    <option value={5}>Every 5 min</option>
                    <option value={15}>Every 15 min</option>
                    <option value={30}>Every 30 min</option>
                    <option value={0}>Manual only</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {tab === 'display' && (
            <>
              <div>
                <label
                  htmlFor="brewery-name"
                  className="block text-sm font-semibold text-slate-200 mb-1.5"
                >
                  Brewery Display Title
                </label>
                <input
                  id="brewery-name"
                  type="text"
                  value={settings.breweryName}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, breweryName: e.target.value }))
                  }
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/14 text-base text-white focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label
                  htmlFor="tap-labels"
                  className="block text-sm font-semibold text-slate-200 mb-1.5"
                >
                  Tap Slot Labels (comma-separated)
                </label>
                <input
                  id="tap-labels"
                  type="text"
                  value={tapLabelsInput}
                  onChange={(e) => setTapLabelsInput(e.target.value)}
                  placeholder="Left Tap, Right Tap"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/14 text-base text-white focus:outline-none focus:border-rose-400"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Tapping a card&apos;s tap button cycles through these slots, On Deck, and Unassigned.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">
                  Screen Layout Mode
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-white/10">
                  {(
                    [
                      { id: 'auto', label: 'Auto Detect' },
                      { id: 'portrait', label: 'Portrait Kiosk' },
                      { id: 'landscape', label: 'Landscape' },
                    ] as Array<{ id: LayoutMode; label: string }>
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() =>
                        setSettings((s) => ({ ...s, layoutMode: mode.id }))
                      }
                      className={`min-h-[44px] px-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                        settings.layoutMode === mode.id
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Auto Detect activates the centered Portrait Kiosk &amp; bottom touch dock whenever screen height exceeds width.
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t border-white/10">
                <TouchToggleRow
                  label="Show Conditioning batches in On Tap list"
                  checked={settings.includeConditioningOnTap}
                  onChange={(val) =>
                    setSettings((s) => ({ ...s, includeConditioningOnTap: val }))
                  }
                />

                <TouchToggleRow
                  label="Show hidden batches (to restore archived taps)"
                  checked={settings.showHiddenBatches}
                  onChange={(val) =>
                    setSettings((s) => ({ ...s, showHiddenBatches: val }))
                  }
                />
              </div>
            </>
          )}

          {tab === 'backup' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300 space-y-1.5">
                <div className="font-bold text-white">Kiosk Transfer &amp; GitHub Pages</div>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Export your tap assignments, display settings, and optional Brewfather keys as JSON so you can paste them directly onto your 15&quot; portrait kiosk without typing long keys on a touchscreen.
                </p>
              </div>

              <TouchToggleRow
                label="Include Brewfather API credentials in exported file"
                checked={includeCredsInExport}
                onChange={setIncludeCredsInExport}
              />

              <button
                type="button"
                onClick={handleDownloadBackup}
                className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-5 rounded-xl border border-white/15 bg-slate-800/80 hover:bg-slate-800 text-sm font-semibold text-white transition-colors cursor-pointer active:scale-95"
              >
                <Download className="w-4 h-4" />
                Export Taproom Config (.json)
              </button>

              <div className="pt-4 border-t border-white/10 space-y-2.5">
                <label
                  htmlFor="import-json"
                  className="block text-sm font-semibold text-slate-200"
                >
                  Import Config JSON
                </label>
                <textarea
                  id="import-json"
                  rows={4}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste exported JSON here..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/14 text-sm text-slate-200 font-mono focus:outline-none focus:border-rose-400"
                />
                {importError && <p className="text-sm text-rose-400">{importError}</p>}
                <button
                  type="button"
                  onClick={handleImportJson}
                  disabled={!importText.trim()}
                  className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-5 rounded-xl border border-white/15 bg-slate-800/80 hover:bg-slate-800 disabled:opacity-40 text-sm font-semibold text-white transition-colors cursor-pointer active:scale-95"
                >
                  <Upload className="w-4 h-4" />
                  Apply Imported Config
                </button>
              </div>
            </div>
          )}

          {/* Touch-Sized Save Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/12">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[48px] px-6 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-bold text-white transition-colors cursor-pointer active:scale-95"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
