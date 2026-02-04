import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { Script, SortOption, FolderProfile, ExecutionEntry } from './types';
import { useStore } from './hooks/useStore';
import {
  scanMultipleFolders,
  getScriptName,
  executeScript,
  cancelScript,
  getDefaultScriptsPath,
  watchFolder,
  runScriptInTerminal,
  revealInFinder,
  openInEditor,
  getHomeDir,
  expandPath,
} from './lib/scripts';
import { exit } from '@tauri-apps/plugin-process';
import { Header } from './components/Header';
import { ScriptList } from './components/ScriptList';
import { SettingsModal } from './components/SettingsModal';
import { LogsModal } from './components/LogsModal';
import { ToastContainer, ToastData } from './components/Toast';

function matchProfile(scriptPath: string, profiles: Array<FolderProfile & { expandedPath: string }>): FolderProfile | null {
  let best: FolderProfile | null = null;
  let bestLen = -1;
  for (const profile of profiles) {
    if (scriptPath.startsWith(profile.expandedPath) && profile.expandedPath.length > bestLen) {
      best = profile;
      bestLen = profile.expandedPath.length;
    }
  }
  return best;
}

function App() {
  const {
    isLoading: isStoreLoading,
    settings,
    saveSettings,
    getScriptData,
    toggleFavorite,
    setScriptIcon,
    clearScriptHistory,
    recordExecution,
    addFolder,
    removeFolder,
  } = useStore();

  const [scripts, setScripts] = useState<Script[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogs, setShowLogs] = useState<Script | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('favorite');
  const [queue, setQueue] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const unwatchRefs = useRef<(() => void)[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scriptsRef = useRef<Script[]>([]);

  useEffect(() => {
    scriptsRef.current = scripts;
  }, [scripts]);



  useEffect(() => {
    if (!showLogs) return;
    const updated = scripts.find(s => s.id === showLogs.id);
    if (updated && updated !== showLogs) {
      setShowLogs(updated);
    }
  }, [scripts, showLogs]);


  useEffect(() => {
    const root = document.body;
    if (!root) return;

    const applyLight = (isLight: boolean) => {
      root.classList.toggle('theme-light', isLight);
    };

    if (settings.theme === 'light') {
      applyLight(true);
      return;
    }

    if (settings.theme === 'dark') {
      applyLight(false);
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: light)');
    applyLight(media.matches);
    const handleChange = (event: MediaQueryListEvent) => applyLight(event.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [settings.theme]);

  const addToast = useCallback((message: string, type: ToastData['type']) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Sort scripts based on current sort option
  const sortScripts = useCallback((scriptList: Script[], sort: SortOption): Script[] => {
    const sorted = [...scriptList];

    switch (sort) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'recent':
        return sorted.sort((a, b) => {
          if (!a.lastExecution && !b.lastExecution) return 0;
          if (!a.lastExecution) return 1;
          if (!b.lastExecution) return -1;
          return new Date(b.lastExecution).getTime() - new Date(a.lastExecution).getTime();
        });
      case 'frequent':
        return sorted.sort((a, b) => b.runCount - a.runCount);
      case 'favorite':
      default:
        return sorted.sort((a, b) => {
          if (a.favorite && !b.favorite) return -1;
          if (!a.favorite && b.favorite) return 1;
          return a.name.localeCompare(b.name);
        });
    }
  }, []);

  const filteredScripts = useMemo(() => {
    let result = scripts;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(query));
    }

    return sortScripts(result, sortBy);
  }, [scripts, searchQuery, sortBy, sortScripts]);

  const runningCount = scripts.filter(s => s.running).length;
  const queuedCount = queue.length;

  const scanScripts = useCallback(async () => {
    if (!settings.scriptsFolder) return;

    setIsScanning(true);
    setError(null);

    try {
      const allFolders = [settings.scriptsFolder, ...settings.additionalFolders];
      const paths = await scanMultipleFolders(allFolders);
      const homeDir = await getHomeDir();
      const profiles = (settings.folderProfiles || []).map((profile) => ({
        ...profile,
        expandedPath: expandPath(profile.path, homeDir),
      }));

      const scriptList: Script[] = paths.map((path) => {
        const data = getScriptData(path);
        const profile = matchProfile(path, profiles);
        const mergedEnvVars = { ...(profile?.envVars || {}), ...(data?.envVars || {}) };
        const args = data?.args ?? profile?.defaultArgs ?? '';
        const timeoutSeconds = data?.timeoutSeconds && data.timeoutSeconds > 0
          ? data.timeoutSeconds
          : (profile?.timeoutSeconds || 0);
        const previousState = scriptsRef.current.find(s => s.id === path);

        return {
          id: path,
          name: getScriptName(path),
          path,
          lastExecution: data?.lastExecution || null,
          lastDuration: data?.lastDuration || null,
          running: previousState?.running || false,
          queued: queue.includes(path),
          exitCode: data?.lastExitCode ?? null,
          timedOut: data?.lastTimedOut ?? false,
          lastOutput: data?.lastOutput || null,
          lastError: data?.lastError || null,
          favorite: data?.favorite || false,
          icon: data?.icon || null,
          runCount: data?.runCount || 0,
          args,
          timeoutSeconds,
          tags: data?.tags || [],
          envVars: mergedEnvVars,
          history: data?.history || [],
        };
      });

      setQueue(prev => prev.filter(id => paths.includes(id)));
      setScripts(scriptList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan folder';
      setError(message);
      setScripts([]);
    } finally {
      setIsScanning(false);
    }
  }, [settings.scriptsFolder, settings.additionalFolders, settings.folderProfiles, getScriptData, queue]);

  // Setup file watcher
  useEffect(() => {
    async function setupWatcher() {
      if (!initialized || !settings.scriptsFolder) return;

      // Cleanup previous watchers
      if (unwatchRefs.current.length > 0) {
        unwatchRefs.current.forEach((unwatch) => unwatch());
        unwatchRefs.current = [];
      }

      const folders = [settings.scriptsFolder, ...settings.additionalFolders].filter(Boolean);
      const unwatchers = await Promise.all(
        folders.map((folder) => watchFolder(folder, () => {
          scanScripts();
        }))
      );
      unwatchRefs.current = unwatchers;
    }

    setupWatcher();

    return () => {
      if (unwatchRefs.current.length > 0) {
        unwatchRefs.current.forEach((unwatch) => unwatch());
        unwatchRefs.current = [];
      }
    };
  }, [initialized, settings.scriptsFolder, settings.additionalFolders, scanScripts]);

  // Initialize on mount
  useEffect(() => {
    let mounted = true;

    async function init() {
      if (isStoreLoading || initialized) return;

      // Request notification permission
      try {
        const permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          await requestPermission();
        }
      } catch {
        // Ignore notification permission errors
      }

      // If no folder is set, use default and prompt for settings
      if (!settings.scriptsFolder && mounted) {
        const defaultPath = await getDefaultScriptsPath();
        setShowSettings(true);
        await saveSettings({ scriptsFolder: defaultPath });
      }

      if (mounted) {
        setInitialized(true);
        setSortBy(settings.sortBy);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [isStoreLoading, settings.scriptsFolder, settings.sortBy, saveSettings, initialized]);

  // Scan when initialized or folders change
  useEffect(() => {
    if (initialized && settings.scriptsFolder) {
      scanScripts();
    }
  }, [initialized, settings.scriptsFolder, settings.additionalFolders, settings.folderProfiles]);

  // Global hotkey
  useEffect(() => {
    let active = true;
    async function setupHotkey() {
      try {
        await unregisterAll();
        if (!settings.globalHotkey) return;
        await register(settings.globalHotkey, async () => {
          if (!active) return;
          const win = getCurrentWebviewWindow();
          const isVisible = await win.isVisible();
          if (isVisible) {
            await win.hide();
          } else {
            await win.show();
            await win.setFocus();
          }
        });
      } catch (e) {
        console.warn('Failed to register global hotkey', e);
      }
    }

    setupHotkey();

    return () => {
      active = false;
      unregisterAll().catch(() => {});
    };
  }, [settings.globalHotkey]);

  const runScriptNow = useCallback(async (script: Script, mode: 'background' | 'terminal') => {
    if (mode === 'terminal') {
      try {
        await runScriptInTerminal(script.path, script.envVars || {}, script.args || '');
        const entry: ExecutionEntry = {
          at: new Date().toISOString(),
          duration: 0,
          exitCode: null,
          stdout: '',
          stderr: '',
          timedOut: false,
          args: script.args || '',
          mode: 'terminal',
        };
        await recordExecution(script.path, entry);
        setScripts((prev) =>
          prev.map((s) =>
            s.id === script.id
              ? {
                  ...s,
                  lastExecution: entry.at,
                  lastDuration: entry.duration,
                  exitCode: entry.exitCode,
                  timedOut: entry.timedOut,
                  lastOutput: entry.stdout,
                  lastError: entry.stderr,
                  runCount: s.runCount + 1,
                }
              : s
          )
        );
        addToast(`${script.name} opened in Terminal`, 'info');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to open Terminal';
        addToast(message, 'error');
      }
      return;
    }

    // Mark as running
    setScripts((prev) =>
      prev.map((s) =>
        s.id === script.id ? { ...s, running: true, queued: false } : s
      )
    );

    try {
      const envVars = script.envVars || {};
      const args = script.args || '';
      const timeoutSeconds = script.timeoutSeconds && script.timeoutSeconds > 0
        ? script.timeoutSeconds
        : settings.defaultTimeout;

      const result = await executeScript(
        script.path,
        envVars,
        args,
        timeoutSeconds
      );

      // Update script state
      setScripts((prev) =>
        prev.map((s) =>
          s.id === script.id
            ? {
                ...s,
                running: false,
                lastExecution: new Date().toISOString(),
                lastDuration: result.duration,
                exitCode: result.exitCode,
                timedOut: result.timedOut,
                lastOutput: result.stdout,
                lastError: result.stderr,
                runCount: s.runCount + 1,
              }
            : s
        )
      );

      // Record execution in store
      const entry: ExecutionEntry = {
        at: new Date().toISOString(),
        duration: result.duration,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        timedOut: result.timedOut,
        args: args,
        mode: 'background',
      };
      await recordExecution(script.path, entry);

      // Show notification
      try {
        const notificationGranted = await isPermissionGranted();
        if (notificationGranted) {
          let body = `${script.name} `;
          if (result.timedOut) {
            body += 'timed out';
          } else if (result.success) {
            body += 'finished';
          } else {
            body += `failed (exit ${result.exitCode})`;
          }

          await sendNotification({
            title: result.success ? 'Completed' : 'Failed',
            body,
          });
        }
      } catch {
        // Ignore notification errors
      }

      // Show toast
      if (result.timedOut) {
        addToast(`${script.name} timed out`, 'error');
      } else if (result.success) {
        addToast(`${script.name} completed`, 'success');
      } else {
        addToast(`${script.name} failed`, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution failed';

      setScripts((prev) =>
        prev.map((s) =>
          s.id === script.id ? { ...s, running: false, exitCode: -1 } : s
        )
      );

      addToast(`Error: ${message}`, 'error');
    }
  }, [settings.defaultTimeout, recordExecution, addToast]);

  const requestRun = useCallback((script: Script, mode: 'background' | 'terminal') => {
    if (script.running || script.queued) return;
    if (mode === 'terminal') {
      runScriptNow(script, 'terminal');
      return;
    }
    const maxConcurrent = Math.max(1, settings.maxConcurrent || 1);
    const running = scriptsRef.current.filter(s => s.running).length;
    if (running >= maxConcurrent) {
      setQueue(prev => (prev.includes(script.id) ? prev : [...prev, script.id]));
      setScripts(prev => prev.map(s => s.id === script.id ? { ...s, queued: true } : s));
      addToast(`${script.name} queued`, 'info');
      return;
    }
    runScriptNow(script, 'background');
  }, [settings.maxConcurrent, addToast, runScriptNow]);

  const handleRunScript = useCallback((script: Script) => {
    requestRun(script, 'background');
  }, [requestRun]);

  const handleRunInTerminal = useCallback((script: Script) => {
    requestRun(script, 'terminal');
  }, [requestRun]);

  // Queue processor
  useEffect(() => {
    const maxConcurrent = Math.max(1, settings.maxConcurrent || 1);
    if (queue.length === 0) return;
    if (runningCount >= maxConcurrent) return;

    const nextId = queue[0];
    const nextScript = scripts.find(s => s.id === nextId);
    if (!nextScript) {
      setQueue(prev => prev.slice(1));
      return;
    }

    setQueue(prev => prev.slice(1));
    setScripts(prev => prev.map(s => s.id === nextId ? { ...s, queued: false } : s));
    runScriptNow(nextScript, 'background');
  }, [queue, runningCount, settings.maxConcurrent, scripts, runScriptNow]);

  const handleCancelScript = useCallback(async (script: Script) => {
    const cancelled = await cancelScript(script.path);

    if (cancelled) {
      setScripts((prev) =>
        prev.map((s) =>
          s.id === script.id ? { ...s, running: false } : s
        )
      );
      addToast(`${script.name} cancelled`, 'info');
    }
  }, [addToast]);

  const handleForceReset = useCallback((script: Script) => {
    setScripts((prev) =>
      prev.map((s) =>
        s.id === script.id ? { ...s, running: false, queued: false, exitCode: -1 } : s
      )
    );
    setQueue(prev => prev.filter(id => id !== script.id));
    addToast(`${script.name} force stopped`, 'info');
  }, [addToast]);

  const handleDequeue = useCallback((script: Script) => {
    setQueue(prev => prev.filter(id => id !== script.id));
    setScripts(prev => prev.map(s => s.id === script.id ? { ...s, queued: false } : s));
    addToast(`${script.name} removed from queue`, 'info');
  }, [addToast]);

  const handleToggleFavorite = useCallback(async (script: Script) => {
    await toggleFavorite(script.path);
    setScripts((prev) =>
      prev.map((s) =>
        s.id === script.id ? { ...s, favorite: !s.favorite } : s
      )
    );
  }, [toggleFavorite]);

  const handleSetIcon = useCallback(async (script: Script, icon: string | null) => {
    await setScriptIcon(script.path, icon);
    setScripts((prev) =>
      prev.map((s) =>
        s.id === script.id ? { ...s, icon } : s
      )
    );
  }, [setScriptIcon]);

  const handleSaveSettings = useCallback(async (newSettings: Partial<typeof settings>) => {
    await saveSettings(newSettings);
    // Rescan if folder changed
    if (newSettings.scriptsFolder && newSettings.scriptsFolder !== settings.scriptsFolder) {
      scanScripts();
    }
  }, [saveSettings, settings.scriptsFolder, scanScripts]);

  const handleSortChange = useCallback((sort: SortOption) => {
    setSortBy(sort);
    saveSettings({ sortBy: sort });
  }, [saveSettings]);

  const handleClearHistory = useCallback(async (script: Script) => {
    await clearScriptHistory(script.path);
    setScripts((prev) =>
      prev.map((s) =>
        s.id === script.id
          ? {
              ...s,
              history: [],
              lastOutput: null,
              lastError: null,
              lastExecution: null,
              lastDuration: null,
              exitCode: null,
              timedOut: false,
            }
          : s
      )
    );
    setShowLogs((prev) => {
      if (!prev || prev.id !== script.id) return prev;
      return {
        ...prev,
        history: [],
        lastOutput: null,
        lastError: null,
        lastExecution: null,
        lastDuration: null,
        exitCode: null,
        timedOut: false,
      };
    });
  }, [clearScriptHistory]);

  // Keep selection in sync
  useEffect(() => {
    if (filteredScripts.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredScripts.some(s => s.id === selectedId)) {
      setSelectedId(filteredScripts[0].id);
    }
  }, [filteredScripts, selectedId]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Close modals on Escape
      if (e.key === 'Escape') {
        if (showLogs) {
          setShowLogs(null);
          return;
        }
        if (showSettings) {
          setShowSettings(false);
          return;
        }
      }

      // Cmd+K or Cmd+F to focus search
      if ((e.metaKey && e.key === 'k') || (e.metaKey && e.key === 'f')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Cmd+R to refresh
      if (e.metaKey && e.key === 'r') {
        e.preventDefault();
        scanScripts();
        return;
      }

      // Arrow navigation
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredScripts.length === 0) return;
        const index = filteredScripts.findIndex(s => s.id === selectedId);
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = index === -1
          ? 0
          : (index + delta + filteredScripts.length) % filteredScripts.length;
        setSelectedId(filteredScripts[nextIndex].id);
        return;
      }

      // Enter to run / Shift+Enter to run in terminal
      if (e.key === 'Enter' && selectedId) {
        e.preventDefault();
        const script = filteredScripts.find(s => s.id === selectedId);
        if (script) {
          if (e.shiftKey) {
            handleRunInTerminal(script);
          } else {
            handleRunScript(script);
          }
        }
        return;
      }

      // Cmd+L logs
      if (e.metaKey && e.key === 'l' && selectedId) {
        e.preventDefault();
        const script = filteredScripts.find(s => s.id === selectedId);
        if (script && script.lastExecution) {
          setShowLogs(script);
        }
        return;
      }

      // Cmd+E edit
      if (e.metaKey && e.key === 'e' && selectedId) {
        e.preventDefault();
        const script = filteredScripts.find(s => s.id === selectedId);
        if (script) {
          openInEditor(script.path, settings.editorApp).catch(() => {});
        }
        return;
      }

      // Cmd+O reveal
      if (e.metaKey && e.key === 'o' && selectedId) {
        e.preventDefault();
        const script = filteredScripts.find(s => s.id === selectedId);
        if (script) {
          revealInFinder(script.path).catch(() => {});
        }
        return;
      }

      // Cmd+1-9 to run scripts
      if (e.metaKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < filteredScripts.length) {
          handleRunScript(filteredScripts[index]);
        }
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogs, showSettings, filteredScripts, scanScripts, selectedId, handleRunScript, handleRunInTerminal, settings.editorApp]);

  const activeView = showSettings ? 'settings' : showLogs ? 'logs' : 'main';

  if (isStoreLoading) {
    return (
      <div className="h-screen app-shell flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[rgba(255,255,255,0.2)] border-t-[color:var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  if (activeView !== 'main') {
    return (
      <div className="h-screen flex flex-col overflow-hidden app-shell">
        {activeView === 'settings' && (
          <SettingsModal
            isOpen={showSettings}
            settings={settings}
            onClose={() => setShowSettings(false)}
            onSave={handleSaveSettings}
            onAddFolder={addFolder}
            onRemoveFolder={removeFolder}
          />
        )}
        {activeView === 'logs' && (
          <LogsModal
            script={showLogs}
            onClose={() => setShowLogs(null)}
            onClearHistory={handleClearHistory}
          />
        )}
        <ToastContainer toasts={toasts} onClose={removeToast} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden app-shell">
      <Header
        scriptsFolder={settings.scriptsFolder}
        searchQuery={searchQuery}
        sortBy={sortBy}
        onSearchChange={setSearchQuery}
        onSortChange={handleSortChange}
        onRefresh={scanScripts}
        onSettings={() => setShowSettings(true)}
        onQuit={() => exit(0)}
        isRefreshing={isScanning}
        searchInputRef={searchInputRef}
        queueInfo={{ running: runningCount, queued: queuedCount }}
      />

      <ScriptList
        scripts={filteredScripts}
        isLoading={isScanning && scripts.length === 0}
        error={error}
        selectedId={selectedId}
        onRunScript={handleRunScript}
        onRunInTerminal={handleRunInTerminal}
        onCancelScript={handleCancelScript}
        onForceReset={handleForceReset}
        onDequeue={handleDequeue}
        onToggleFavorite={handleToggleFavorite}
        onShowLogs={setShowLogs}
        onSetIcon={handleSetIcon}
        onReveal={(script) => { revealInFinder(script.path).catch(() => {}); }}
        onOpenInEditor={(script) => { openInEditor(script.path, settings.editorApp).catch(() => {}); }}
        onSelect={(script) => setSelectedId(script.id)}
      />

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

export default App;
