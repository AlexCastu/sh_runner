export interface Script {
  id: string;
  name: string;
  path: string;
  lastExecution: string | null;
  lastDuration: number | null; // milliseconds
  running: boolean;
  exitCode: number | null;
  lastOutput: string | null;
  lastError: string | null;
  favorite: boolean;
  icon: string | null; // emoji or null
  runCount: number;
}

export interface AppSettings {
  scriptsFolder: string;
  additionalFolders: string[];
  theme: 'light' | 'dark' | 'system';
  defaultTimeout: number; // seconds, 0 = no timeout
  sortBy: 'name' | 'recent' | 'frequent' | 'favorite';
}

export interface ScriptData {
  path: string;
  lastExecution: string | null;
  lastDuration: number | null;
  lastOutput: string | null;
  lastError: string | null;
  favorite: boolean;
  icon: string | null;
  runCount: number;
  envVars: Record<string, string>;
}

export interface StoreData {
  settings: AppSettings;
  scripts: ScriptData[];
}

export type SortOption = 'name' | 'recent' | 'frequent' | 'favorite';
