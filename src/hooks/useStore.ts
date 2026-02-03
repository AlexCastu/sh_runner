import { useCallback, useEffect, useState } from 'react';
import { load, Store } from '@tauri-apps/plugin-store';
import type { AppSettings, ScriptData, SortOption } from '../types';

const STORE_FILE = 'scripts-state.json';

const DEFAULT_SETTINGS: AppSettings = {
  scriptsFolder: '',
  additionalFolders: [],
  theme: 'dark',
  defaultTimeout: 300, // 5 minutes
  sortBy: 'favorite',
};

let storeInstance: Store | null = null;

async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await load(STORE_FILE);
  }
  return storeInstance;
}

export function useStore() {
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [scriptsData, setScriptsData] = useState<Map<string, ScriptData>>(new Map());

  // Load initial data from store
  useEffect(() => {
    async function loadStore() {
      try {
        const store = await getStore();
        const savedSettings = await store.get<AppSettings>('settings');
        const scripts = await store.get<ScriptData[]>('scripts');

        if (savedSettings) {
          setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
        }

        if (scripts) {
          const dataMap = new Map<string, ScriptData>();
          scripts.forEach(s => {
            dataMap.set(s.path, s);
          });
          setScriptsData(dataMap);
        }
      } catch (error) {
        console.error('Failed to load store:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadStore();
  }, []);

  // Save settings
  const saveSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    try {
      const store = await getStore();
      const updated = { ...settings, ...newSettings };
      await store.set('settings', updated);
      await store.save();
      setSettings(updated);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }, [settings]);

  // Update script data
  const updateScriptData = useCallback(async (path: string, data: Partial<ScriptData>) => {
    try {
      const store = await getStore();
      const scripts = await store.get<ScriptData[]>('scripts') || [];

      const existingIndex = scripts.findIndex(s => s.path === path);
      const defaultData: ScriptData = {
        path,
        lastExecution: null,
        lastDuration: null,
        lastOutput: null,
        lastError: null,
        favorite: false,
        icon: null,
        runCount: 0,
        envVars: {},
      };

      if (existingIndex >= 0) {
        scripts[existingIndex] = { ...scripts[existingIndex], ...data };
      } else {
        scripts.push({ ...defaultData, ...data });
      }

      await store.set('scripts', scripts);
      await store.save();

      setScriptsData(prev => {
        const next = new Map(prev);
        const existing = next.get(path) || defaultData;
        next.set(path, { ...existing, ...data });
        return next;
      });
    } catch (error) {
      console.error('Failed to update script data:', error);
    }
  }, []);

  // Get script data
  const getScriptData = useCallback((path: string): ScriptData | null => {
    return scriptsData.get(path) || null;
  }, [scriptsData]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (path: string) => {
    const current = scriptsData.get(path);
    const newFavorite = !(current?.favorite ?? false);
    await updateScriptData(path, { favorite: newFavorite });
  }, [scriptsData, updateScriptData]);

  // Set script icon
  const setScriptIcon = useCallback(async (path: string, icon: string | null) => {
    await updateScriptData(path, { icon });
  }, [updateScriptData]);

  // Set script env vars
  const setScriptEnvVars = useCallback(async (path: string, envVars: Record<string, string>) => {
    await updateScriptData(path, { envVars });
  }, [updateScriptData]);

  // Record execution
  const recordExecution = useCallback(async (
    path: string,
    duration: number,
    output: string,
    errorOutput: string,
    _exitCode: number
  ) => {
    const current = scriptsData.get(path);
    await updateScriptData(path, {
      lastExecution: new Date().toISOString(),
      lastDuration: duration,
      lastOutput: output,
      lastError: errorOutput,
      runCount: (current?.runCount ?? 0) + 1,
    });
  }, [scriptsData, updateScriptData]);

  // Change sort option
  const setSortBy = useCallback(async (sortBy: SortOption) => {
    await saveSettings({ sortBy });
  }, [saveSettings]);

  // Add folder
  const addFolder = useCallback(async (folder: string) => {
    const folders = [...settings.additionalFolders];
    if (!folders.includes(folder)) {
      folders.push(folder);
      await saveSettings({ additionalFolders: folders });
    }
  }, [settings.additionalFolders, saveSettings]);

  // Remove folder
  const removeFolder = useCallback(async (folder: string) => {
    const folders = settings.additionalFolders.filter(f => f !== folder);
    await saveSettings({ additionalFolders: folders });
  }, [settings.additionalFolders, saveSettings]);

  return {
    isLoading,
    settings,
    scriptsData,
    saveSettings,
    updateScriptData,
    getScriptData,
    toggleFavorite,
    setScriptIcon,
    setScriptEnvVars,
    recordExecution,
    setSortBy,
    addFolder,
    removeFolder,
  };
}
