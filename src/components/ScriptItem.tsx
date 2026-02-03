import React, { useState } from 'react';
import type { Script } from '../types';
import { formatTimestamp, formatDuration } from '../lib/scripts';

interface ScriptItemProps {
  script: Script;
  index: number;
  onRun: (script: Script) => void;
  onCancel: (script: Script) => void;
  onForceReset: (script: Script) => void;
  onToggleFavorite: (script: Script) => void;
  onShowLogs: (script: Script) => void;
  onSetIcon: (script: Script, icon: string | null) => void;
}

const EMOJI_OPTIONS = ['🚀', '⚡', '🔧', '📦', '🎯', '💾', '🔄', '📊', '🧹', '🔒', null];

export const ScriptItem: React.FC<ScriptItemProps> = ({
  script,
  index,
  onRun,
  onCancel,
  onForceReset,
  onToggleFavorite,
  onShowLogs,
  onSetIcon,
}) => {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const hasRun = script.lastExecution !== null;
  const shortcutKey = index < 9 ? index + 1 : null;

  return (
    <div className="group relative">
      <div className="flex items-center justify-between px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors">
        {/* Icon / Status */}
        <button
          onClick={() => setShowIconPicker(!showIconPicker)}
          className="w-6 h-6 flex items-center justify-center flex-shrink-0 hover:bg-zinc-700 rounded transition-colors"
          title="Change icon"
        >
          {script.running ? (
            <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
          ) : script.icon ? (
            <span className="text-sm">{script.icon}</span>
          ) : hasRun ? (
            <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
          )}
        </button>

        {/* Script info */}
        <div className="flex-1 min-w-0 ml-2">
          <div className="flex items-center gap-2">
            <p className="text-sm text-zinc-200 truncate">{script.name}</p>
            {script.favorite && (
              <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
            {shortcutKey && (
              <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                ⌘{shortcutKey}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            {script.running ? (
              <span className="text-amber-500">Running...</span>
            ) : (
              <>
                {hasRun && <span>{formatTimestamp(script.lastExecution)}</span>}
                {script.lastDuration !== null && (
                  <span className="text-zinc-600">• {formatDuration(script.lastDuration)}</span>
                )}
                {script.runCount > 0 && (
                  <span className="text-zinc-600">• {script.runCount}×</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 ml-2">
          {/* Favorite */}
          <button
            onClick={() => onToggleFavorite(script)}
            className={`p-1.5 rounded-md transition-colors ${
              script.favorite
                ? 'text-amber-500 hover:text-amber-400'
                : 'text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100'
            }`}
            title={script.favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <svg className="w-3.5 h-3.5" fill={script.favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>

          {/* Logs */}
          {hasRun && (
            <button
              onClick={() => onShowLogs(script)}
              className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-colors"
              title="View logs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          )}

          {/* Run / Cancel */}
          {script.running ? (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onCancel(script)}
                className="p-1.5 rounded-md text-zinc-400 hover:text-amber-400 hover:bg-zinc-700 transition-colors"
                title="Cancel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </button>
              <button
                onClick={() => onForceReset(script)}
                className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-colors"
                title="Force stop (reset stuck state)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => onRun(script)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
              title="Run script"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Icon Picker */}
      {showIconPicker && (
        <div className="absolute left-8 top-full mt-1 z-10 bg-zinc-800 border border-zinc-600 rounded-lg p-2 shadow-lg">
          <div className="flex gap-1 flex-wrap max-w-[160px]">
            {EMOJI_OPTIONS.map((emoji, i) => (
              <button
                key={i}
                onClick={() => {
                  onSetIcon(script, emoji);
                  setShowIconPicker(false);
                }}
                className={`w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-700 transition-colors ${
                  script.icon === emoji ? 'bg-zinc-700' : ''
                }`}
              >
                {emoji || (
                  <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
