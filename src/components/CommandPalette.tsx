import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Script } from '../types';

interface CommandPaletteProps {
  scripts: Script[];
  onClose: () => void;
  onRunScript: (script: Script) => void;
  onRunInTerminal: (script: Script) => void;
  onShowLogs: (script: Script) => void;
  onSelect: (script: Script) => void;
  onOpenInEditor: (script: Script) => void;
}

function fuzzyMatch(text: string, query: string): { matches: boolean; score: number } {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  // Exact substring match scores highest
  if (lower.includes(q)) {
    const idx = lower.indexOf(q);
    return { matches: true, score: idx === 0 ? 100 : 80 };
  }
  // Fuzzy: all chars in order
  let qi = 0;
  let score = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) {
      qi++;
      score += 1;
    }
  }
  if (qi === q.length) {
    return { matches: true, score: Math.round((score / text.length) * 50) };
  }
  return { matches: false, score: 0 };
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx >= 0) {
    return (
      <>
        {text.slice(0, idx)}
        <span className="text-[color:var(--accent)] font-semibold">{text.slice(idx, idx + q.length)}</span>
        {text.slice(idx + q.length)}
      </>
    );
  }
  return text;
}

function getStatusIcon(script: Script) {
  if (script.running) {
    return (
      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
    );
  }
  if (script.queued) {
    return (
      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-yellow-500" />
    );
  }
  if (script.exitCode === 0) {
    return (
      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500" />
    );
  }
  if (script.exitCode !== null && script.exitCode !== 0) {
    return (
      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500" />
    );
  }
  return (
    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-[color:var(--text-muted)] opacity-40" />
  );
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  scripts,
  onClose,
  onRunScript,
  onRunInTerminal,
  onShowLogs,
  onSelect,
  onOpenInEditor,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      // Show all, favorites first, then alphabetical
      return [...scripts].sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        if (a.running && !b.running) return -1;
        if (b.running && !a.running) return 1;
        return a.name.localeCompare(b.name);
      });
    }
    return scripts
      .map(s => {
        const nameMatch = fuzzyMatch(s.name, query);
        const descMatch = s.description ? fuzzyMatch(s.description, query) : { matches: false, score: 0 };
        const folderMatch = s.folder ? fuzzyMatch(s.folder, query) : { matches: false, score: 0 };
        const tagMatch = (s.tags ?? []).some(t => t.toLowerCase().includes(query.toLowerCase()));
        const matches = nameMatch.matches || descMatch.matches || folderMatch.matches || tagMatch;
        const score = Math.max(nameMatch.score * 2, descMatch.score, folderMatch.score, tagMatch ? 30 : 0);
        return { script: s, matches, score };
      })
      .filter(r => r.matches)
      .sort((a, b) => b.score - a.score)
      .map(r => r.script);
  }, [scripts, query]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % Math.max(filtered.length, 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + filtered.length) % Math.max(filtered.length, 1));
      return;
    }

    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      const script = filtered[selectedIndex];
      if (e.shiftKey) {
        onRunInTerminal(script);
      } else {
        onRunScript(script);
      }
      onClose();
      return;
    }

    // ⌘L to show logs
    if (e.metaKey && e.key === 'l' && filtered.length > 0) {
      e.preventDefault();
      const script = filtered[selectedIndex];
      if (script.lastExecution) {
        onShowLogs(script);
        onClose();
      }
      return;
    }

    // ⌘E to edit
    if (e.metaKey && e.key === 'e' && filtered.length > 0) {
      e.preventDefault();
      onOpenInEditor(filtered[selectedIndex]);
      onClose();
      return;
    }
  }

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col pt-3 px-3"
      style={{ background: 'var(--overlay)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-panel w-full max-w-[340px] mx-auto flex flex-col overflow-hidden" style={{ maxHeight: '420px' }}>
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[color:var(--border)]">
          <svg className="w-4 h-4 text-[color:var(--accent)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search scripts by name..."
            className="flex-1 bg-transparent text-sm text-primary placeholder-[color:var(--text-muted)] focus:outline-none"
          />
          <kbd className="text-[10px] text-muted px-1.5 py-0.5 rounded border border-[color:var(--border)] bg-[color:var(--bg-secondary)] font-mono">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-hide py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted">No scripts found</p>
              <p className="text-xs text-muted mt-1 opacity-60">Try a different search term</p>
            </div>
          ) : (
            filtered.map((script, i) => (
              <button
                key={script.id}
                className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                  i === selectedIndex
                    ? 'bg-[rgba(94,158,250,0.12)]'
                    : 'hover:bg-[rgba(94,158,250,0.06)]'
                }`}
                onClick={() => {
                  onSelect(script);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {/* Status dot */}
                {getStatusIcon(script)}

                {/* Icon */}
                <span className="flex-shrink-0 text-base leading-none">
                  {script.icon || '📄'}
                </span>

                {/* Script info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-primary truncate">
                    {highlightMatch(script.name, query)}
                  </div>
                  {(script.description || script.folder) && (
                    <div className="text-[11px] text-muted truncate mt-0.5">
                      {script.description
                        ? highlightMatch(script.description, query)
                        : script.folder?.replace(/^\/Users\/[^/]+/, '~')
                      }
                    </div>
                  )}
                </div>

                {/* Tags */}
                {(script.tags ?? []).length > 0 && (
                  <div className="flex gap-0.5 flex-shrink-0">
                    {(script.tags ?? []).slice(0, 2).map(tag => (
                      <span key={tag} className="text-[9px] px-1 py-0.5 rounded bg-[rgba(94,158,250,0.1)] text-[color:var(--accent)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Run shortcut hint for selected */}
                {i === selectedIndex && (
                  <span className="flex-shrink-0 text-[9px] text-muted opacity-60">
                    ↵ run
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="px-3 py-1.5 border-t border-[color:var(--border)] flex items-center gap-3 text-[10px] text-muted">
          <span><kbd className="font-mono">↵</kbd> Run</span>
          <span><kbd className="font-mono">⇧↵</kbd> Terminal</span>
          <span><kbd className="font-mono">⌘L</kbd> Logs</span>
          <span><kbd className="font-mono">⌘E</kbd> Edit</span>
        </div>
      </div>
    </div>
  );
};
