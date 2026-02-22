import React from 'react';
import type { Script } from '../types';

interface ActionBarProps {
  selectedScript: Script | null;
  onRun: (script: Script) => void;
  onRunInTerminal: (script: Script) => void;
  onCancel: (script: Script) => void;
  onDequeue: (script: Script) => void;
  onShowLogs: (script: Script) => void;
  onOpenInEditor: (script: Script) => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  selectedScript,
  onRun,
  onRunInTerminal,
  onCancel,
  onDequeue,
  onShowLogs,
  onOpenInEditor,
}) => {
  if (!selectedScript) {
    return (
      <div className="action-bar px-3 py-2 flex items-center justify-center gap-4 text-[10px] text-muted">
        <span>⌘K Search</span>
        <span>⌘R Refresh</span>
        <span>↑↓ Navigate</span>
      </div>
    );
  }

  const s = selectedScript;

  return (
    <div className="action-bar px-3 py-2 flex items-center justify-center gap-1">
      {s.running ? (
        <>
          <button
            onClick={() => onCancel(s)}
            className="action-bar-btn text-[color:var(--error)]"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            <span>Cancel</span>
          </button>
          <ActionDivider />
          <button
            onClick={() => onShowLogs(s)}
            className="action-bar-btn"
          >
            <span className="action-bar-key">⌘L</span>
            <span>Logs</span>
          </button>
        </>
      ) : s.queued ? (
        <>
          <button
            onClick={() => onDequeue(s)}
            className="action-bar-btn text-[color:var(--accent-hover)]"
          >
            <span>Dequeue</span>
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => onRun(s)}
            className="action-bar-btn"
          >
            <span className="action-bar-key">⏎</span>
            <span>Run</span>
          </button>
          <ActionDivider />
          <button
            onClick={() => onRunInTerminal(s)}
            className="action-bar-btn"
          >
            <span className="action-bar-key">⇧⏎</span>
            <span>Terminal</span>
          </button>
          <ActionDivider />
          {s.lastExecution && (
            <>
              <button
                onClick={() => onShowLogs(s)}
                className="action-bar-btn"
              >
                <span className="action-bar-key">⌘L</span>
                <span>Logs</span>
              </button>
              <ActionDivider />
            </>
          )}
          <button
            onClick={() => onOpenInEditor(s)}
            className="action-bar-btn"
          >
            <span className="action-bar-key">⌘E</span>
            <span>Edit</span>
          </button>
        </>
      )}
    </div>
  );
};

const ActionDivider: React.FC = () => (
  <span className="w-px h-3 bg-[color:var(--border)] mx-0.5" />
);
