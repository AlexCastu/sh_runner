import React, { useState } from 'react';
import type { Script } from '../types';
import { formatTimestamp } from '../lib/scripts';

interface ScriptItemProps {
  script: Script;
  index: number;
  isSelected: boolean;
  onRun: (script: Script) => void;
  onRunInTerminal: (script: Script) => void;
  onCancel: (script: Script) => void;
  onForceReset: (script: Script) => void;
  onDequeue: (script: Script) => void;
  onToggleFavorite: (script: Script) => void;
  onShowLogs: (script: Script) => void;
  onSetIcon: (script: Script, icon: string | null) => void;
  onReveal: (script: Script) => void;
  onOpenInEditor: (script: Script) => void;
  onSelect: (script: Script) => void;
}

const EMOJI_OPTIONS = ['🚀', '⚡', '🔧', '📦', '🎯', '💾', '🔄', '📊', '🧹', '🔒', null];

export const ScriptItem: React.FC<ScriptItemProps> = ({
  script,
  index,
  isSelected,
  onRun,
  onRunInTerminal,
  onCancel,
  onForceReset,
  onDequeue,
  onToggleFavorite,
  onShowLogs,
  onSetIcon,
  onReveal,
  onOpenInEditor,
  onSelect,
}) => {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const hasRun = script.lastExecution !== null;
  const shortcutKey = index < 9 ? index + 1 : null;
  const hasError = script.exitCode !== null && script.exitCode !== 0;

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(script.path);
    } catch {
      // ignore
    }
  };

  return (
    <div className="group relative">
      <div
        onClick={() => onSelect(script)}
        className={`app-row ${isSelected ? 'selected' : ''} flex items-center justify-between px-4 py-3 cursor-pointer`}
      >
        <button
          onClick={() => setShowIconPicker(!showIconPicker)}
          className="app-icon-btn w-7 h-7 flex items-center justify-center flex-shrink-0"
          title="Change icon"
        >
          {script.running ? (
            <span className="w-3 h-3 rounded-full bg-[color:var(--accent)] animate-pulse" />
          ) : script.queued ? (
            <span className="w-3 h-3 rounded-full bg-[color:var(--accent-hover)]" />
          ) : script.icon ? (
            <span className="text-sm">{script.icon}</span>
          ) : hasError ? (
            <span className="w-2.5 h-2.5 rounded-full bg-[color:var(--error)]" />
          ) : hasRun ? (
            <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-[color:var(--text-muted)]" />
          )}
        </button>

        <div className="flex-1 min-w-0 ml-2">
          <div className="flex items-center gap-2">
            <p className="text-base text-primary truncate leading-tight">{script.name}</p>
            {script.favorite && (
              <svg className="w-3 h-3 text-[color:var(--accent)] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
            {shortcutKey && (
              <span className="text-[10px] text-muted bg-[rgba(94,158,250,0.16)] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                ⌘{shortcutKey}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-secondary">
            {script.running ? (
              <span className="text-[color:var(--accent)]">Running...</span>
            ) : script.queued ? (
              <span className="text-[color:var(--accent-hover)]">Queued</span>
            ) : (
              <>
                {hasRun ? (
                  <span>Last run {formatTimestamp(script.lastExecution)}</span>
                ) : (
                  <span>Not run yet</span>
                )}
                {script.timedOut && (
                  <span className="text-[color:var(--error)]">• Timed out</span>
                )}
                {hasError && (
                  <span className="text-[color:var(--error)]">• Failed</span>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 ml-2">
          <button
            onClick={() => onToggleFavorite(script)}
            className={`app-icon-btn ${script.favorite ? 'text-[color:var(--accent)]' : 'opacity-0 group-hover:opacity-100'}`}
            title={script.favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <svg className="w-3.5 h-3.5" fill={script.favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>

          {hasRun && (
            <button
              onClick={() => onShowLogs(script)}
              className="app-icon-btn opacity-0 group-hover:opacity-100"
              title="View logs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          )}

          {script.running ? (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onCancel(script)}
                className="app-icon-btn hover:text-[color:var(--accent)]"
                title="Cancel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </button>
              <button
                onClick={() => onForceReset(script)}
                className="app-icon-btn hover:text-[color:var(--error)]"
                title="Force stop (reset stuck state)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : script.queued ? (
            <button
              onClick={() => onDequeue(script)}
              className="app-icon-btn text-[color:var(--accent-hover)]"
              title="Remove from queue"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => onRun(script)}
              className="app-icon-btn"
              title="Run script"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="app-icon-btn opacity-0 group-hover:opacity-100"
              title="More"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 app-dropdown min-w-[190px] py-1">
                <button
                  onClick={() => { onRunInTerminal(script); setShowMenu(false); }}
                  className="app-dropdown-item"
                >
                  Run in Terminal
                </button>
                <button
                  onClick={() => { onReveal(script); setShowMenu(false); }}
                  className="app-dropdown-item"
                >
                  Reveal in Finder
                </button>
                <button
                  onClick={() => { onOpenInEditor(script); setShowMenu(false); }}
                  className="app-dropdown-item"
                >
                  Open in Editor
                </button>
                <button
                  onClick={() => { handleCopyPath(); setShowMenu(false); }}
                  className="app-dropdown-item"
                >
                  Copy Path
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showIconPicker && (
        <div className="absolute left-8 top-full mt-1 z-50 app-dropdown p-2">
          <div className="flex gap-1 flex-wrap max-w-[170px]">
            {EMOJI_OPTIONS.map((emoji, i) => (
              <button
                key={i}
                onClick={() => {
                  onSetIcon(script, emoji);
                  setShowIconPicker(false);
                }}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                  script.icon === emoji ? 'bg-[rgba(94,158,250,0.18)]' : 'hover:bg-[rgba(94,158,250,0.12)]'
                }`}
              >
                {emoji || (
                  <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
