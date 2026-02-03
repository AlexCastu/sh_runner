import React from 'react';
import type { Script } from '../types';
import { formatDuration } from '../lib/scripts';

interface LogsModalProps {
  script: Script | null;
  onClose: () => void;
}

export const LogsModal: React.FC<LogsModalProps> = ({ script, onClose }) => {
  if (!script) return null;

  const hasOutput = script.lastOutput && script.lastOutput.length > 0;
  const hasError = script.lastError && script.lastError.length > 0;

  return (
    <div className="absolute inset-0 bg-zinc-900 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm">{script.icon || '📄'}</span>
          <span className="text-sm text-zinc-200 truncate">{script.name}</span>
          {script.lastDuration !== null && (
            <span className="text-xs text-zinc-500">
              {formatDuration(script.lastDuration)}
            </span>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            script.exitCode === 0
              ? 'bg-green-900 text-green-400'
              : 'bg-red-900 text-red-400'
          }`}>
            {script.exitCode === 0 ? 'Success' : `Exit ${script.exitCode}`}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {hasOutput && (
          <div className="mb-3">
            <div className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              stdout
            </div>
            <pre className="text-xs text-zinc-300 bg-zinc-800 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all font-mono">
              {script.lastOutput}
            </pre>
          </div>
        )}

        {hasError && (
          <div>
            <div className="text-xs text-red-400 mb-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              stderr
            </div>
            <pre className="text-xs text-red-300 bg-red-950 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all font-mono">
              {script.lastError}
            </pre>
          </div>
        )}

        {!hasOutput && !hasError && (
          <div className="text-center text-zinc-500 text-sm py-8">
            No output recorded
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-zinc-700 text-xs text-zinc-600">
        {script.lastExecution && (
          <span>Last run: {new Date(script.lastExecution).toLocaleString()}</span>
        )}
      </div>
    </div>
  );
};
