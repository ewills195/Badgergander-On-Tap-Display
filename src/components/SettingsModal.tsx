import { useState } from 'react';
import { X, Eye, EyeOff, Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { brewfatherFetch } from '../services/brewfatherApi';
import type { BrewfatherBatch, LayoutMode, TaproomSettings, TempUnit } from '../types/brewfather';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Taproom Settings"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/12 bg-slate-900/95 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Taproom Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1 rounded-lg border border-white/10 my-4">
          {[
            { id: 'api' as const, label: 'Brewfather API' },
            { id: 'display' as const, label: 'Taproom Display' },
            { id: 'backup' as const, label: 'Export & GitHub' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                tab === item.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {tab === 'api' && (
            <>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generate a read-only API key in Brewfather under{' '}
                <span className="text-slate-200 font-medium">
                  Settings → API → Generate API Key
                </span>{' '}
                with <span className="font-mono text-slate-200">batches.read</span> scope.
                Credentials are stored locally in your browser.
              </p>

              <div>
                <label
                  htmlFor="bf-user-id"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Brewfather User ID
                </label>
                <input
                  id="bf-user-id"
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter your Brewfather User ID"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-white/12 text-sm text-white font-mono focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label
                  htmlFor="bf-api-key"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
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
                    className="w-full px-3 py-2 pr-10 rounded-lg bg-slate-950/80 border border-white/12 text-sm text-white font-mono focus:outline-none focus:border-rose-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testState.status === 'testing'}
                  className="px-3 py-1.5 rounded-lg border border-white/15 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {testState.status === 'testing' ? 'Testing…' : 'Test Connection'}
                </button>

                {testState.status !== 'idle' && (
                  <div
                    className={`flex items-center gap-1.5 text-xs ${
                      testState.status === 'ok'
                        ? 'text-emerald-400'
                        : testState.status === 'error'
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {testState.status === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    {testState.status === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate max-w-[260px]">{testState.message}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Temperature Unit
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-950/80 p-1 rounded-lg border border-white/10">
                    {(['F', 'C'] as TempUnit[]).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, tempUnit: unit }))}
                        className={`py-1 text-xs font-mono font-semibold rounded transition-colors cursor-pointer ${
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
                    className="block text-xs font-semibold text-slate-300 mb-1.5"
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
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950/80 border border-white/12 text-xs text-white font-mono focus:outline-none focus:border-rose-400"
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
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
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
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-white/12 text-sm text-white focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label
                  htmlFor="tap-labels"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Tap Slot Labels (comma-separated)
                </label>
                <input
                  id="tap-labels"
                  type="text"
                  value={tapLabelsInput}
                  onChange={(e) => setTapLabelsInput(e.target.value)}
                  placeholder="Left Tap, Right Tap, Tap 3"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-white/12 text-sm text-white focus:outline-none focus:border-rose-400"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Clicking the tap button on any beer card cycles through these slots, On Deck, and Unassigned.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Board Layout Mode
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1 rounded-lg border border-white/10">
                  {(
                    [
                      { id: 'auto', label: 'Adaptive' },
                      { id: 'landscape', label: 'Landscape' },
                      { id: 'portrait', label: 'Portrait Kiosk' },
                    ] as Array<{ id: LayoutMode; label: string }>
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() =>
                        setSettings((s) => ({ ...s, layoutMode: mode.id }))
                      }
                      className={`py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                        settings.layoutMode === mode.id
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <label className="flex items-center justify-between gap-3 text-xs text-slate-300 cursor-pointer">
                  <span>Show Conditioning batches in On Tap list</span>
                  <input
                    type="checkbox"
                    checked={settings.includeConditioningOnTap}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        includeConditioningOnTap: e.target.checked,
                      }))
                    }
                    className="accent-rose-500 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 text-xs text-slate-300 cursor-pointer">
                  <span>Show hidden batches (to restore archived taps)</span>
                  <input
                    type="checkbox"
                    checked={settings.showHiddenBatches}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        showHiddenBatches: e.target.checked,
                      }))
                    }
                    className="accent-rose-500 w-4 h-4"
                  />
                </label>
              </div>
            </>
          )}

          {tab === 'backup' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3.5 text-xs text-slate-300 space-y-1.5">
                <div className="font-semibold text-white">GitHub Pages Deployment</div>
                <p className="text-slate-400 leading-relaxed">
                  This app runs 100% client-side with relative asset paths (<span className="font-mono text-slate-300">base: './'</span>). Run{' '}
                  <span className="font-mono text-slate-200">npm run build</span> and publish the{' '}
                  <span className="font-mono text-slate-200">dist/</span> folder to GitHub Pages. Never commit your Brewfather API key to a public repo—configure it in the browser or import via JSON below.
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCredsInExport}
                    onChange={(e) => setIncludeCredsInExport(e.target.checked)}
                    className="accent-rose-500"
                  />
                  <span>Include Brewfather API credentials in exported file</span>
                </label>

                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/15 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Export Taproom Config (.json)
                </button>
              </div>

              <div className="pt-3 border-t border-white/10 space-y-2">
                <label
                  htmlFor="import-json"
                  className="block text-xs font-semibold text-slate-300"
                >
                  Import Config JSON (useful for kiosk TVs / tablets)
                </label>
                <textarea
                  id="import-json"
                  rows={4}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder='Paste exported JSON here...'
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-white/12 text-xs text-slate-200 font-mono focus:outline-none focus:border-rose-400"
                />
                {importError && (
                  <p className="text-xs text-rose-400">{importError}</p>
                )}
                <button
                  type="button"
                  onClick={handleImportJson}
                  disabled={!importText.trim()}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/15 bg-slate-800/80 hover:bg-slate-800 disabled:opacity-40 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  Apply Imported Config
                </button>
              </div>
            </div>
          )}

          {/* Save Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
