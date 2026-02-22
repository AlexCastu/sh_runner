import { readDir, exists, watch, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
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

  const scripts: string[] = [];

  async function scanDir(dirPath: string) {
    const entries = await readDir(dirPath);
    for (const entry of entries) {
      if (!entry.name) continue;
      const fullPath = `${dirPath}/${entry.name}`;
      if (entry.name.endsWith('.sh')) {
        scripts.push(fullPath);
      } else if (entry.isDirectory) {
        try {
          await scanDir(fullPath);
        } catch {
          // Skip directories we can't read
        }
      }
    }
  }

  await scanDir(expandedPath);
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

/** Get the folder that contains this script, relative to a root folder. */
export function getScriptFolder(scriptPath: string, rootFolders: string[]): string {
  // Find which root folder this script belongs to
  let bestRoot = '';
  for (const root of rootFolders) {
    if (scriptPath.startsWith(root) && root.length > bestRoot.length) {
      bestRoot = root;
    }
  }
  if (!bestRoot) {
    // Fallback: use parent directory name
    const parts = scriptPath.split('/');
    return parts.length >= 2 ? parts[parts.length - 2] : '';
  }
  // Get relative path from root to the script's parent directory
  const relative = scriptPath.slice(bestRoot.length + 1); // +1 for trailing /
  const parts = relative.split('/');
  if (parts.length <= 1) {
    // Script is directly in root
    const rootParts = bestRoot.split('/');
    return rootParts[rootParts.length - 1] || bestRoot;
  }
  // Script is in a subdirectory
  const rootName = bestRoot.split('/').pop() || bestRoot;
  const subPath = parts.slice(0, -1).join('/');
  return `${rootName}/${subPath}`;
}

/**
 * Read the first comment lines from a .sh file (after shebang) to use as description.
 * Returns up to 2 comment lines joined, or empty string if none found.
 */
export async function readScriptDescription(scriptPath: string): Promise<string> {
  try {
    const content = await readTextFile(scriptPath);
    const lines = content.split('\n');
    const descLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines at the top
      if (trimmed === '') continue;
      // Skip shebang
      if (trimmed.startsWith('#!')) continue;
      // Collect comment lines (strip the # prefix)
      if (trimmed.startsWith('#')) {
        const text = trimmed.replace(/^#+\s*/, '').trim();
        if (text) descLines.push(text);
        if (descLines.length >= 2) break;
        continue;
      }
      // Stop at first non-comment/non-empty line
      break;
    }

    return descLines.join(' — ');
  } catch {
    return '';
  }
}

/**
 * Create a new .sh script file with a basic template.
 * Returns the full path of the created file.
 */
export async function createScript(folderPath: string, name: string): Promise<string> {
  const homeDir = await getHomeDir();
  const expandedFolder = expandPath(folderPath, homeDir);
  // Sanitize name: strip extension if user typed it, ensure .sh
  const sanitized = name.replace(/\.sh$/i, '').replace(/[^a-zA-Z0-9_\-. ]/g, '_');
  if (!sanitized) throw new Error('Invalid script name');
  const fileName = `${sanitized}.sh`;
  const fullPath = `${expandedFolder}/${fileName}`;

  const fileExists = await exists(fullPath);
  if (fileExists) throw new Error(`Script "${fileName}" already exists`);

  const template = `#!/bin/bash
# ${sanitized}
# Created on ${new Date().toISOString().split('T')[0]}

set -euo pipefail

echo "Hello from ${sanitized}"
`;

  await writeTextFile(fullPath, template);
  await makeExecutable(fullPath);
  return fullPath;
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

function buildEnvString(envVars: Record<string, string>): string {
  return Object.entries(envVars)
    .map(([k, v]) => `export ${k}="${v.replace(/\"/g, '\\"')}"`)
    .join('; ');
}

function buildCommand(scriptPath: string, envVars: Record<string, string>, args: string): string {
  const envString = buildEnvString(envVars);
  const argString = args.trim();
  const base = `bash "${scriptPath}"${argString ? ` ${argString}` : ''}`;
  return envString ? `${envString}; ${base}` : base;
}

export async function executeScript(
  scriptPath: string,
  envVars: Record<string, string> = {},
  args: string = '',
  timeoutSeconds: number = 0,
  onOutput?: (line: string, isError: boolean) => void
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // First make sure it's executable
  await makeExecutable(scriptPath);

  try {
    const fullCommand = buildCommand(scriptPath, envVars, args);
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

export async function runScriptInTerminal(
  scriptPath: string,
  envVars: Record<string, string> = {},
  args: string = ''
): Promise<void> {
  await makeExecutable(scriptPath);
  const fullCommand = buildCommand(scriptPath, envVars, args);
  const osaScript = `tell application "Terminal" to do script ${JSON.stringify(fullCommand)}`;
  const command = Command.create('osascript', ['-e', osaScript]);
  await command.execute();
}

export async function revealInFinder(scriptPath: string): Promise<void> {
  const command = Command.create('open', ['-R', scriptPath]);
  await command.execute();
}

export async function openInEditor(scriptPath: string, editorApp?: string): Promise<void> {
  if (editorApp && editorApp.trim().length > 0) {
    const command = Command.create('open', ['-a', editorApp, scriptPath]);
    await command.execute();
    return;
  }
  const fallback = Command.create('open', [scriptPath]);
  await fallback.execute();
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
    const unwatch = await watch(expandedPath, onChange, { recursive: true });
    return unwatch;
  } catch {
    // Return no-op if watch fails
    return () => {};
  }
}
