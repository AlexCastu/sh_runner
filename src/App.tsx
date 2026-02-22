import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import type { Script, SortOption, ViewMode, FolderProfile, ExecutionEntry } from './types';
import { useStore } from './hooks/useStore';
import {
  scanMultipleFolders,
  getScriptName,
  getScriptFolder,
  readScriptDescription,
  executeScript,
  cancelScript,
  createScript,
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
import { ActionBar } from './components/ActionBar';
import { ScriptConfigModal } from './components/ScriptConfigModal';
import { CommandPalette } from './components/CommandPalette';
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
    setScriptTags,
    setScriptArgs,
    setScriptEnvVars,
    setScriptTimeout,
    setConfirmBeforeRun,
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
  const [showConfig, setShowConfig] = useState<Script | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('favorite');
  const [viewMode, setViewMode] = useState<ViewMode>(settings.viewMode || 'flat');
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set(settings.collapsedFolders || []));
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>(settings.activeTagFilters || []);
  const [queue, setQueue] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ script: Script; mode: 'background' | 'terminal' } | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

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

    // Filter by active tags
    if (activeTagFilters.length > 0) {
      result = result.filter(s =>
        activeTagFilters.some(tag => (s.tags || []).includes(tag))
      );
    }

    return sortScripts(result, sortBy);
  }, [scripts, searchQuery, sortBy, activeTagFilters, sortScripts]);

  // Collect all unique tags from scripts
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    scripts.forEach(s => (s.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [scripts]);

  // Group scripts by folder
  const groupedScripts = useMemo(() => {
    if (viewMode !== 'grouped') return null;

    const groups = new Map<string, Script[]>();

    // Separate pinned scripts
    const pinned = filteredScripts.filter(s => s.favorite);
    const unpinned = filteredScripts.filter(s => !s.favorite);

    for (const script of unpinned) {
      const folder = script.folder || 'Ungrouped';
      if (!groups.has(folder)) {
        groups.set(folder, []);
      }
      groups.get(folder)!.push(script);
    }

    // Sort group names
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    return {
      pinned,
      groups: sortedGroups.map(([folder, scripts]) => ({
        folder,
        scripts,
        collapsed: collapsedFolders.has(folder),
      })),
    };
  }, [filteredScripts, viewMode, collapsedFolders]);

  const runningCount = scripts.filter(s => s.running).length;
  const queuedCount = queue.length;

  // Update tray tooltip when running count changes
  useEffect(() => {
    const tooltip = runningCount > 0
      ? `Scripts Runner — ${runningCount} running`
      : 'Scripts Runner';
    invoke('set_tray_tooltip', { tooltip }).catch(() => {});
  }, [runningCount]);

  const scanScripts = useCallback(async () => {
    if (!settings.scriptsFolder) return;

    setIsScanning(true);
    setError(null);

    try {
      const allFolders = [settings.scriptsFolder, ...settings.additionalFolders];
      const paths = await scanMultipleFolders(allFolders);
      const homeDir = await getHomeDir();
      const expandedFolders = allFolders.map(f => expandPath(f, homeDir));
      const profiles = (settings.folderProfiles || []).map((profile) => ({
        ...profile,
        expandedPath: expandPath(profile.path, homeDir),
      }));

      const scriptList: Script[] = await Promise.all(paths.map(async (path) => {
        const data = getScriptData(path);
        const profile = matchProfile(path, profiles);
        const mergedEnvVars = { ...(profile?.envVars || {}), ...(data?.envVars || {}) };
        const args = data?.args ?? profile?.defaultArgs ?? '';
        const timeoutSeconds = data?.timeoutSeconds && data.timeoutSeconds > 0
          ? data.timeoutSeconds
          : (profile?.timeoutSeconds || 0);
        const previousState = scriptsRef.current.find(s => s.id === path);
        const description = await readScriptDescription(path);

        return {
          id: path,
          name: getScriptName(path),
          path,
          folder: getScriptFolder(path, expandedFolders),
          description,
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
          startedAt: previousState?.startedAt || undefined,
          liveOutput: previousState?.liveOutput || undefined,
          confirmBeforeRun: data?.confirmBeforeRun || false,
        };
      }));

      setQueue(prev => prev.filter(id => paths.includes(id)));
      setScripts(scriptList);

      // Load descriptions asynchronously (non-blocking)
      Promise.all(
        scriptList.map(async (s) => {
          const desc = await readScriptDescription(s.path);
          return { id: s.id, description: desc };
        })
      ).then((descriptions) => {
        const descMap = new Map(descriptions.filter(d => d.description).map(d => [d.id, d.description]));
        if (descMap.size > 0) {
          setScripts(prev => prev.map(s => descMap.has(s.id) ? { ...s, description: descMap.get(s.id) } : s));
        }
      }).catch(() => {});
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

    // Mark as running with startedAt timestamp
    const startedAt = new Date().toISOString();
    setScripts((prev) =>
      prev.map((s) =>
        s.id === script.id ? { ...s, running: true, queued: false, startedAt, liveOutput: [] } : s
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
        timeoutSeconds,
        // Live output callback
        (line, _isError) => {
          setScripts((prev) =>
            prev.map((s) =>
              s.id === script.id
                ? { ...s, liveOutput: [...(s.liveOutput || []).slice(-9), line] }
                : s
            )
          );
        }
      );

      // Update script state
      setScripts((prev) =>
        prev.map((s) =>
          s.id === script.id
            ? {
                ...s,
                running: false,
                startedAt: undefined,
                liveOutput: undefined,
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
    // Check if confirmation is required
    if (script.confirmBeforeRun) {
      setPendingConfirm({ script, mode });
      return;
    }
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

  const handleConfirmRun = useCallback(() => {
    if (!pendingConfirm) return;
    const { script, mode } = pendingConfirm;
    setPendingConfirm(null);
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
  }, [pendingConfirm, settings.maxConcurrent, addToast, runScriptNow]);

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

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    saveSettings({ viewMode: mode });
  }, [saveSettings]);

  const handleToggleFolderCollapse = useCallback((folder: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      saveSettings({ collapsedFolders: Array.from(next) });
      return next;
    });
  }, [saveSettings]);

  const handleTagFilterChange = useCallback((tags: string[]) => {
    setActiveTagFilters(tags);
    saveSettings({ activeTagFilters: tags });
  }, [saveSettings]);

  const handleSetScriptTags = useCallback(async (script: Script, tags: string[]) => {
    await setScriptTags(script.path, tags);
    setScripts(prev => prev.map(s => s.id === script.id ? { ...s, tags } : s));
  }, [setScriptTags]);

  const handleSaveArgs = useCallback(async (script: Script, args: string) => {
    await setScriptArgs(script.path, args);
    setScripts(prev => prev.map(s => s.id === script.id ? { ...s, args } : s));
  }, [setScriptArgs]);

  const handleSaveEnvVars = useCallback(async (script: Script, envVars: Record<string, string>) => {
    await setScriptEnvVars(script.path, envVars);
    setScripts(prev => prev.map(s => s.id === script.id ? { ...s, envVars } : s));
  }, [setScriptEnvVars]);

  const handleSaveTimeout = useCallback(async (script: Script, timeoutSeconds: number) => {
    await setScriptTimeout(script.path, timeoutSeconds);
    setScripts(prev => prev.map(s => s.id === script.id ? { ...s, timeoutSeconds } : s));
  }, [setScriptTimeout]);

  const handleSaveConfirmBeforeRun = useCallback(async (script: Script, confirmBeforeRun: boolean) => {
    await setConfirmBeforeRun(script.path, confirmBeforeRun);
    setScripts(prev => prev.map(s => s.id === script.id ? { ...s, confirmBeforeRun } : s));
  }, [setConfirmBeforeRun]);

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

  const handleCreateScript = useCallback(async (name: string) => {
    if (!settings.scriptsFolder) return;
    try {
      const path = await createScript(settings.scriptsFolder, name);
      addToast(`Created ${name}`, 'success');
      await scanScripts();
      // Open in editor for immediate editing
      openInEditor(path, settings.editorApp).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create script';
      addToast(msg, 'error');
    }
  }, [settings.scriptsFolder, settings.editorApp, addToast, scanScripts]);

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
        if (pendingConfirm) {
          setPendingConfirm(null);
          return;
        }
        if (showLogs) {
          setShowLogs(null);
          return;
        }
        if (showSettings) {
          setShowSettings(false);
          return;
        }
      }

      // Cmd+P to open command palette
      if (e.metaKey && e.key === 'p') {
        e.preventDefault();
        e.stopPropagation();
        setShowCommandPalette(true);
        return;
      }

      // Cmd+F to focus inline filter
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
  }, [showLogs, showSettings, pendingConfirm, filteredScripts, scanScripts, selectedId, handleRunScript, handleRunInTerminal, settings.editorApp]);

  const activeView = showSettings ? 'settings' : showLogs ? 'logs' : showConfig ? 'config' : 'main';

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
        {activeView === 'config' && showConfig && (
          <ScriptConfigModal
            script={showConfig}
            onClose={() => setShowConfig(null)}
            onSaveArgs={handleSaveArgs}
            onSaveEnvVars={handleSaveEnvVars}
            onSaveTimeout={handleSaveTimeout}
            onSaveConfirmBeforeRun={handleSaveConfirmBeforeRun}
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
        viewMode={viewMode}
        onSearchChange={setSearchQuery}
        onSortChange={handleSortChange}
        onViewModeChange={handleViewModeChange}
        onRefresh={scanScripts}
        onSettings={() => setShowSettings(true)}
        onQuit={() => exit(0)}
        onCreateScript={handleCreateScript}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        isRefreshing={isScanning}
        searchInputRef={searchInputRef}
        queueInfo={{ running: runningCount, queued: queuedCount }}
        allTags={allTags}
        activeTagFilters={activeTagFilters}
        onTagFilterChange={handleTagFilterChange}
      />

      <ScriptList
        scripts={filteredScripts}
        groupedScripts={groupedScripts}
        viewMode={viewMode}
        searchQuery={searchQuery}
        isLoading={isScanning && scripts.length === 0}
        error={error}
        selectedId={selectedId}
        totalCount={scripts.length}
        activeTagFilters={activeTagFilters}
        onRunScript={handleRunScript}
        onRunInTerminal={handleRunInTerminal}
        onCancelScript={handleCancelScript}
        onForceReset={handleForceReset}
        onDequeue={handleDequeue}
        onToggleFavorite={handleToggleFavorite}
        onShowLogs={setShowLogs}
        onSetIcon={handleSetIcon}
        onSetTags={handleSetScriptTags}
        onReveal={(script) => { revealInFinder(script.path).catch(() => {}); }}
        onOpenInEditor={(script) => { openInEditor(script.path, settings.editorApp).catch(() => {}); }}
        onConfigure={(script) => setShowConfig(script)}
        onSelect={(script) => setSelectedId(script.id)}
        onToggleFolderCollapse={handleToggleFolderCollapse}
      />

      <ActionBar
        selectedScript={filteredScripts.find(s => s.id === selectedId) || null}
        onRun={handleRunScript}
        onRunInTerminal={handleRunInTerminal}
        onCancel={handleCancelScript}
        onDequeue={handleDequeue}
        onShowLogs={setShowLogs}
        onOpenInEditor={(script) => { openInEditor(script.path, settings.editorApp).catch(() => {}); }}
      />

      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Command Palette */}
      {showCommandPalette && (
        <CommandPalette
          scripts={scripts}
          onClose={() => setShowCommandPalette(false)}
          onRunScript={handleRunScript}
          onRunInTerminal={handleRunInTerminal}
          onShowLogs={setShowLogs}
          onSelect={(script) => setSelectedId(script.id)}
          onOpenInEditor={(script) => { openInEditor(script.path, settings.editorApp).catch(() => {}); }}
        />
      )}

      {/* Confirm before run dialog */}
      {pendingConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'var(--overlay)' }}>
          <div className="modal-panel p-5 mx-6 max-w-[300px] w-full space-y-4">
            <div className="text-center">
              <p className="text-sm text-primary font-medium">Run "{pendingConfirm.script.name}"?</p>
              <p className="text-xs text-muted mt-1">This script requires confirmation before execution.</p>
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2 rounded-md text-xs font-medium text-secondary border border-[color:var(--border)] hover:bg-[rgba(94,158,250,0.08)]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRun}
                className="px-4 py-2 rounded-md text-xs font-medium text-white bg-[color:var(--accent)] hover:bg-[color:var(--accent-hover)]"
                autoFocus
              >
                Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
