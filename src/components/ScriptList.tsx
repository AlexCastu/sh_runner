import React from 'react';
import type { Script } from '../types';
import { ScriptItem } from './ScriptItem';

interface ScriptListProps {
  scripts: Script[];
  isLoading: boolean;
  error: string | null;
  onRunScript: (script: Script) => void;
  onCancelScript: (script: Script) => void;
  onForceReset: (script: Script) => void;
  onToggleFavorite: (script: Script) => void;
  onShowLogs: (script: Script) => void;
  onSetIcon: (script: Script, icon: string | null) => void;
}

export const ScriptList: React.FC<ScriptListProps> = ({
  scripts,
  isLoading,
  error,
  onRunScript,
  onCancelScript,
  onForceReset,
  onToggleFavorite,
  onShowLogs,
  onSetIcon,
}) => {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-900">
        <div className="text-center">
          <div className="w-6 h-6 mx-auto border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
          <p className="mt-3 text-xs text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 bg-zinc-900">
        <div className="text-center">
          <svg className="w-8 h-8 mx-auto text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="mt-2 text-sm text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (scripts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 bg-zinc-900">
        <div className="text-center">
          <svg className="w-10 h-10 mx-auto text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="mt-3 text-sm text-zinc-400">No scripts found</p>
          <p className="text-xs text-zinc-600 mt-1">Add .sh files to your folder</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-1 py-1 bg-zinc-900">
      <div className="space-y-0">
        {scripts.map((script, index) => (
          <ScriptItem
            key={script.id}
            script={script}
            index={index}
            onRun={onRunScript}
            onCancel={onCancelScript}
            onForceReset={onForceReset}
            onToggleFavorite={onToggleFavorite}
            onShowLogs={onShowLogs}
            onSetIcon={onSetIcon}
          />
        ))}
      </div>
    </div>
  );
};
