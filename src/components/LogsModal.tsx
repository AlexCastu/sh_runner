import React, { useMemo, useState, useEffect } from 'react';
import type { Script, ExecutionEntry } from '../types';
import { formatDuration } from '../lib/scripts';

interface LogsModalProps {
  script: Script | null;
  onClose: () => void;
  onClearHistory: (script: Script) => void;
}

function entryLabel(entry: ExecutionEntry): string {
  const date = new Date(entry.at);
  return `${date.toLocaleString()} • ${formatDuration(entry.duration)} • ${entry.exitCode === null ? 'Terminal' : `Exit ${entry.exitCode}`}`;
}

export const LogsModal: React.FC<LogsModalProps> = ({ script, onClose, onClearHistory }) => {
  const [tab, setTab] = useState<'output' | 'history'>('output');
  const [showStdout, setShowStdout] = useState(true);
  const [showStderr, setShowStderr] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!script) return;
    setTab('output');
    setShowStdout(true);
    setShowStderr(true);
    setSelectedIndex(0);
  }, [script?.id]);

  const history = script?.history || [];
  const hasOutput = !!(script?.lastOutput && script.lastOutput.length > 0);
  const hasError = !!(script?.lastError && script.lastError.length > 0);

  const selected = useMemo(() => {
    if (history.length === 0) return null;
    const clampedIndex = Math.max(0, Math.min(selectedIndex, history.length - 1));
    return history[clampedIndex];
  }, [history, selectedIndex]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  if (!script) return null;

  const statusLabel = script.exitCode === null ? 'No runs yet' : script.exitCode === 0 ? 'Success' : `Exit ${script.exitCode}`;
  const statusClass = script.exitCode === null
    ? 'text-secondary border-[color:var(--border)] bg-[color:var(--bg)]'
    : script.exitCode === 0
      ? 'text-[color:var(--success)] border-[color:var(--success)] bg-[rgba(56,252,112,0.12)]'
      : 'text-[color:var(--error)] border-[color:var(--error)] bg-[rgba(255,92,92,0.12)]';

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[color:var(--border)]">
        <button onClick={onClose} className="app-icon-btn" title="Back">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{script.icon || '📄'}</span>
          <span className="text-base text-primary font-medium truncate">{script.name}</span>
          {script.lastDuration !== null && (
            <span className="text-xs text-secondary">{formatDuration(script.lastDuration)}</span>
          )}
          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${statusClass}`}>{statusLabel}</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => onClearHistory(script)}
          className="px-2 py-1 text-xs text-secondary hover:text-[color:var(--error)]"
          title="Clear logs"
        >
          Clear
        </button>
      </div>

      <div className="px-4 py-2 border-b border-[color:var(--border)] flex items-center gap-2">
        <button
          onClick={() => setTab('output')}
          className={`px-3 py-1.5 text-xs rounded-full border ${tab === 'output' ? 'border-[color:var(--accent)] text-[color:var(--accent)] bg-[rgba(94,158,250,0.12)]' : 'border-transparent text-secondary hover:text-primary'}`}
        >
          Output
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-3 py-1.5 text-xs rounded-full border ${tab === 'history' ? 'border-[color:var(--accent)] text-[color:var(--accent)] bg-[rgba(94,158,250,0.12)]' : 'border-transparent text-secondary hover:text-primary'}`}
        >
          History ({history.length})
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {tab === 'output' && (
          <div>
            <div className="flex items-center gap-4 mb-4 text-xs text-secondary">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showStdout}
                  onChange={(e) => setShowStdout(e.target.checked)}
                />
                stdout
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showStderr}
                  onChange={(e) => setShowStderr(e.target.checked)}
                />
                stderr
              </label>
            </div>

            {showStdout && hasOutput && (
              <div className="mb-4">
                <div className="text-xs text-secondary mb-1 flex items-center gap-2">
                  <span>stdout</span>
                  <button
                    onClick={() => handleCopy(script.lastOutput || '')}
                    className="text-[11px] text-muted hover:text-primary"
                  >
                    Copy
                  </button>
                </div>
                <pre className="code-block text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
                  {script.lastOutput}
                </pre>
              </div>
            )}

            {showStderr && hasError && (
              <div>
                <div className="text-xs text-[color:var(--error)] mb-1 flex items-center gap-2">
                  <span>stderr</span>
                  <button
                    onClick={() => handleCopy(script.lastError || '')}
                    className="text-[11px] text-[color:var(--error)] hover:opacity-80"
                  >
                    Copy
                  </button>
                </div>
                <pre className="code-block text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono border-[color:var(--error)] text-[color:var(--error)]">
                  {script.lastError}
                </pre>
              </div>
            )}

            {!hasOutput && !hasError && (
              <div className="text-center text-secondary text-sm py-12 space-y-3">
                <div>No output recorded yet</div>
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {history.length === 0 && (
                <div className="text-sm text-secondary">No history yet</div>
              )}
              {history.map((entry, idx) => (
                <button
                  key={`${entry.at}-${idx}`}
                  onClick={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-3 py-2 rounded-lg border ${idx === selectedIndex ? 'border-[color:var(--accent)] bg-[rgba(94,158,250,0.08)]' : 'border-[color:var(--border)] hover:border-[color:var(--accent)]'}`}
                >
                  <div className="text-xs text-primary">{entryLabel(entry)}</div>
                  <div className="text-[11px] text-secondary mt-1">Args: {entry.args || '—'} • {entry.mode}</div>
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {selected ? (
                <>
                  <div className="text-xs text-secondary">{entryLabel(selected)}</div>
                  {selected.stdout && (
                    <div>
                      <div className="text-xs text-secondary mb-1 flex items-center gap-2">
                        <span>stdout</span>
                        <button
                          onClick={() => handleCopy(selected.stdout)}
                          className="text-[11px] text-muted hover:text-primary"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="code-block text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
                        {selected.stdout}
                      </pre>
                    </div>
                  )}
                  {selected.stderr && (
                    <div>
                      <div className="text-xs text-[color:var(--error)] mb-1 flex items-center gap-2">
                        <span>stderr</span>
                        <button
                          onClick={() => handleCopy(selected.stderr)}
                          className="text-[11px] text-[color:var(--error)] hover:opacity-80"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="code-block text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono border-[color:var(--error)] text-[color:var(--error)]">
                        {selected.stderr}
                      </pre>
                    </div>
                  )}
                  {!selected.stdout && !selected.stderr && (
                    <div className="text-sm text-secondary">No output captured for this run.</div>
                  )}
                </>
              ) : (
                <div className="text-sm text-secondary">Select a run to view output.</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-[color:var(--border)] text-xs text-secondary">
        {script.lastExecution && (
          <span>Last run: {new Date(script.lastExecution).toLocaleString()}</span>
        )}
      </div>
    </div>
  );
};
