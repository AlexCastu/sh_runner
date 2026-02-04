export interface Script {
  id: string;
  name: string;
  path: string;
  lastExecution: string | null;
  lastDuration: number | null; // milliseconds
  running: boolean;
  queued?: boolean;
  exitCode: number | null;
  timedOut?: boolean;
  lastOutput: string | null;
  lastError: string | null;
  favorite: boolean;
  icon: string | null; // emoji or null
  runCount: number;
  args?: string;
  timeoutSeconds?: number;
  tags?: string[];
  envVars?: Record<string, string>;
  history?: ExecutionEntry[];
}

export interface ExecutionEntry {
  at: string;
  duration: number;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  args: string;
  mode: 'background' | 'terminal';
}

export interface FolderProfile {
  path: string;
  defaultArgs: string;
  envVars: Record<string, string>;
  tags: string[];
  timeoutSeconds: number;
}

export interface AppSettings {
  scriptsFolder: string;
  additionalFolders: string[];
  theme: 'light' | 'dark' | 'system';
  defaultTimeout: number; // seconds, 0 = no timeout
  sortBy: 'name' | 'recent' | 'frequent' | 'favorite';
  maxConcurrent: number;
  editorApp: string;
  globalHotkey: string;
  historyLimit: number;
  folderProfiles: FolderProfile[];
}

export interface ScriptData {
  path: string;
  lastExecution: string | null;
  lastDuration: number | null;
  lastOutput: string | null;
  lastError: string | null;
  lastExitCode: number | null;
  lastTimedOut: boolean;
  favorite: boolean;
  icon: string | null;
  runCount: number;
  envVars: Record<string, string>;
  args: string;
  timeoutSeconds: number;
  tags: string[];
  history: ExecutionEntry[];
}

export interface StoreData {
  settings: AppSettings;
  scripts: ScriptData[];
}

export type SortOption = 'name' | 'recent' | 'frequent' | 'favorite';
