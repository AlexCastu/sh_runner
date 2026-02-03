import { useEffect, useState, useCallback, useRef } from 'react';
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import type { Script, SortOption } from './types';
import { useStore } from './hooks/useStore';
import {
  scanMultipleFolders,
  getScriptName,
  executeScript,
  cancelScript,
  getDefaultScriptsPath,
  watchFolder,
} from './lib/scripts';
import { exit } from '@tauri-apps/plugin-process';
import { Header } from './components/Header';
import { ScriptList } from './components/ScriptList';
import { SettingsModal } from './components/SettingsModal';
import { LogsModal } from './components/LogsModal';
import { ToastContainer, ToastData } from './components/Toast';

function App() {
  const {
    isLoading: isStoreLoading,
    settings,
    saveSettings,
    getScriptData,
    toggleFavorite,
    setScriptIcon,
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

  const unwatchRef = useRef<(() => void) | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Filter scripts by search query
  const filteredScripts = useCallback(() => {
    let result = scripts;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = scripts.filter(s => s.name.toLowerCase().includes(query));
    }

    return sortScripts(result, sortBy);
  }, [scripts, searchQuery, sortBy, sortScripts]);

  const scanScripts = useCallback(async () => {
    if (!settings.scriptsFolder) return;

    setIsScanning(true);
    setError(null);

    try {
      const allFolders = [settings.scriptsFolder, ...settings.additionalFolders];
      const paths = await scanMultipleFolders(allFolders);

      const scriptList: Script[] = paths.map((path) => {
        const data = getScriptData(path);
        return {
          id: path,
          name: getScriptName(path),
          path,
          lastExecution: data?.lastExecution || null,
          lastDuration: data?.lastDuration || null,
          running: false,
          exitCode: null,
          lastOutput: data?.lastOutput || null,
          lastError: data?.lastError || null,
          favorite: data?.favorite || false,
          icon: data?.icon || null,
          runCount: data?.runCount || 0,
        };
      });

      setScripts(scriptList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan folder';
      setError(message);
      setScripts([]);
    } finally {
      setIsScanning(false);
    }
  }, [settings.scriptsFolder, settings.additionalFolders, getScriptData]);

  // Setup file watcher
  useEffect(() => {
    async function setupWatcher() {
      if (!initialized || !settings.scriptsFolder) return;

      // Cleanup previous watcher
      if (unwatchRef.current) {
        unwatchRef.current();
        unwatchRef.current = null;
      }

      // Watch main folder
      unwatchRef.current = await watchFolder(settings.scriptsFolder, () => {
        scanScripts();
      });
    }

    setupWatcher();

    return () => {
      if (unwatchRef.current) {
        unwatchRef.current();
        unwatchRef.current = null;
      }
    };
  }, [initialized, settings.scriptsFolder, scanScripts]);

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
  }, [initialized, settings.scriptsFolder, settings.additionalFolders]);

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

      // Cmd+F to focus search
      if (e.metaKey && e.key === 'f') {
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

      // Cmd+1-9 to run scripts
      if (e.metaKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        const sorted = filteredScripts();
        if (index < sorted.length) {
          handleRunScript(sorted[index]);
        }
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogs, showSettings, filteredScripts, scanScripts]);

  const handleRunScript = useCallback(async (script: Script) => {
    // Prevent running if already running
    if (script.running) {
      return;
    }

    // Mark as running
    setScripts((prev) =>
      prev.map((s) =>
        s.id === script.id ? { ...s, running: true } : s
      )
    );

    try {
      const scriptData = getScriptData(script.path);
      const envVars = scriptData?.envVars || {};

      const result = await executeScript(
        script.path,
        envVars,
        settings.defaultTimeout
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
                lastOutput: result.stdout,
                lastError: result.stderr,
                runCount: s.runCount + 1,
              }
            : s
        )
      );

      // Record execution in store
      await recordExecution(
        script.path,
        result.duration,
        result.stdout,
        result.stderr,
        result.exitCode
      );

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
  }, [settings.defaultTimeout, getScriptData, recordExecution, addToast]);

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
        s.id === script.id ? { ...s, running: false, exitCode: -1 } : s
      )
    );
    addToast(`${script.name} force stopped`, 'info');
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

  if (isStoreLoading) {
    return (
      <div className="h-screen bg-zinc-900 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-900 flex flex-col overflow-hidden rounded-xl border border-zinc-700">
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
      />

      <ScriptList
        scripts={filteredScripts()}
        isLoading={isScanning && scripts.length === 0}
        error={error}
        onRunScript={handleRunScript}
        onCancelScript={handleCancelScript}
        onForceReset={handleForceReset}
        onToggleFavorite={handleToggleFavorite}
        onShowLogs={setShowLogs}
        onSetIcon={handleSetIcon}
      />

      <SettingsModal
        isOpen={showSettings}
        settings={settings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveSettings}
        onAddFolder={addFolder}
        onRemoveFolder={removeFolder}
      />

      <LogsModal
        script={showLogs}
        onClose={() => setShowLogs(null)}
      />

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

export default App;
