import { readDir, exists, watch } from '@tauri-apps/plugin-fs';
import { Command, Child } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';

export async function getDefaultScriptsPath(): Promise<string> {
  try {
    return await invoke<string>('get_default_scripts_path');
  } catch {
    return '~/scripts';
  }
}

export async function getHomeDir(): Promise<string> {
  try {
    return await invoke<string>('get_home_dir');
  } catch {
    return '/Users';
  }
}

export function expandPath(path: string, homeDir: string): string {
  if (path.startsWith('~/')) {
    return path.replace('~', homeDir);
  }
  return path;
}

export async function scanScriptsFolder(folderPath: string): Promise<string[]> {
  const homeDir = await getHomeDir();
  const expandedPath = expandPath(folderPath, homeDir);

  const folderExists = await exists(expandedPath);
  if (!folderExists) {
    throw new Error(`Folder does not exist: ${expandedPath}`);
  }

  const entries = await readDir(expandedPath);
  const scripts: string[] = [];

  for (const entry of entries) {
    if (entry.name && entry.name.endsWith('.sh')) {
      scripts.push(`${expandedPath}/${entry.name}`);
    }
  }

  return scripts.sort((a, b) => a.localeCompare(b));
}

export async function scanMultipleFolders(folders: string[]): Promise<string[]> {
  const allScripts: string[] = [];

  for (const folder of folders) {
    try {
      const scripts = await scanScriptsFolder(folder);
      allScripts.push(...scripts);
    } catch {
      // Skip folders that don't exist
    }
  }

  // Remove duplicates and sort
  return [...new Set(allScripts)].sort((a, b) => a.localeCompare(b));
}

export function getScriptName(path: string): string {
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  return filename.replace(/\.sh$/, '');
}

export async function makeExecutable(scriptPath: string): Promise<void> {
  try {
    const command = Command.create('chmod', ['+x', scriptPath]);
    await command.execute();
  } catch (e) {
    console.warn('Could not chmod script:', e);
  }
}

export interface ExecutionResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number; // milliseconds
  timedOut: boolean;
}

// Store running processes for cancellation
const runningProcesses = new Map<string, Child>();

export async function executeScript(
  scriptPath: string,
  envVars: Record<string, string> = {},
  timeoutSeconds: number = 0,
  onOutput?: (line: string, isError: boolean) => void
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // First make sure it's executable
  await makeExecutable(scriptPath);

  try {
    // Build environment string for bash
    const envString = Object.entries(envVars)
      .map(([k, v]) => `export ${k}="${v}"`)
      .join('; ');

    const fullCommand = envString
      ? `${envString}; bash "${scriptPath}"`
      : `bash "${scriptPath}"`;

    const command = Command.create('bash', ['-c', fullCommand]);

    let stdout = '';
    let stderr = '';

    command.stdout.on('data', (line) => {
      stdout += line + '\n';
      onOutput?.(line, false);
    });

    command.stderr.on('data', (line) => {
      stderr += line + '\n';
      onOutput?.(line, true);
    });

    const child = await command.spawn();
    runningProcesses.set(scriptPath, child);

    // Setup timeout
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (timeoutSeconds > 0) {
      timeoutId = setTimeout(async () => {
        timedOut = true;
        try {
          await child.kill();
        } catch {
          // Ignore kill errors
        }
      }, timeoutSeconds * 1000);
    }

    // Wait for completion
    const result = await new Promise<{ code: number }>((resolve) => {
      command.on('close', (data) => {
        resolve({ code: data.code ?? -1 });
      });
      command.on('error', () => {
        resolve({ code: -1 });
      });
    });

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    runningProcesses.delete(scriptPath);
    const duration = Date.now() - startTime;

    return {
      success: result.code === 0 && !timedOut,
      exitCode: result.code,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      duration,
      timedOut,
    };
  } catch (error) {
    runningProcesses.delete(scriptPath);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      exitCode: -1,
      stdout: '',
      stderr: errorMessage,
      duration: Date.now() - startTime,
      timedOut: false,
    };
  }
}

export async function cancelScript(scriptPath: string): Promise<boolean> {
  const child = runningProcesses.get(scriptPath);
  if (child) {
    try {
      await child.kill();
      runningProcesses.delete(scriptPath);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function isScriptRunning(scriptPath: string): boolean {
  return runningProcesses.has(scriptPath);
}

export function formatTimestamp(isoString: string | null): string {
  if (!isoString) return 'Never';

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return '';

  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

// File watcher for auto-refresh
export async function watchFolder(
  folderPath: string,
  onChange: () => void
): Promise<() => void> {
  const homeDir = await getHomeDir();
  const expandedPath = expandPath(folderPath, homeDir);

  try {
    const unwatch = await watch(expandedPath, onChange, { recursive: false });
    return unwatch;
  } catch {
    // Return no-op if watch fails
    return () => {};
  }
}
