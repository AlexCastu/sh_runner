import React, { useState } from 'react';
import type { SortOption, ViewMode } from '../types';

interface HeaderProps {
  scriptsFolder: string;
  searchQuery: string;
  sortBy: SortOption;
  viewMode: ViewMode;
  onSearchChange: (query: string) => void;
  onSortChange: (sort: SortOption) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onRefresh: () => void;
  onSettings: () => void;
  onQuit: () => void;
  onCreateScript: (name: string) => void;
  onOpenCommandPalette: () => void;
  isRefreshing: boolean;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  queueInfo: { running: number; queued: number };
  allTags: string[];
  activeTagFilters: string[];
  onTagFilterChange: (tags: string[]) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'favorite', label: 'Favorites first' },
  { value: 'name', label: 'Name' },
  { value: 'recent', label: 'Recently run' },
  { value: 'frequent', label: 'Most used' },
];

export const Header: React.FC<HeaderProps> = ({
  scriptsFolder,
  searchQuery,
  sortBy,
  viewMode,
  onSearchChange,
  onSortChange,
  onViewModeChange,
  onRefresh,
  onSettings,
  onQuit,
  onCreateScript,
  onOpenCommandPalette,
  isRefreshing,
  searchInputRef,
  queueInfo,
  allTags,
  activeTagFilters,
  onTagFilterChange,
}) => {
  const [showSort, setShowSort] = useState(false);
  const [showNewScript, setShowNewScript] = useState(false);
  const [newScriptName, setNewScriptName] = useState('');
  const displayPath = scriptsFolder ? scriptsFolder.replace(/^\/Users\/[^/]+/, '~') : 'No folder selected';

  const handleTagToggle = (tag: string) => {
    if (activeTagFilters.includes(tag)) {
      onTagFilterChange(activeTagFilters.filter(t => t !== tag));
    } else {
      onTagFilterChange([...activeTagFilters, tag]);
    }
  };

  return (
    <div className="app-header px-3 py-2">
      {/* Search button — opens Command Palette */}
      <button
        onClick={onOpenCommandPalette}
        className="w-full flex items-center gap-2 px-2.5 py-2 mb-2 rounded-md text-sm app-input text-left cursor-pointer hover:border-[color:var(--accent)] transition-colors"
      >
        <svg
          className="w-3.5 h-3.5 text-muted flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="flex-1 text-muted">
          {searchQuery ? `Filter: ${searchQuery}` : 'Search scripts...'}
        </span>
        <kbd className="text-[10px] text-muted px-1.5 py-0.5 rounded border border-[color:var(--border)] bg-[color:var(--bg-secondary)] font-mono">
          ⌘P
        </kbd>
      </button>

      {/* Hidden input for inline ⌘F filter */}
      <input
        ref={searchInputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto scrollbar-hide pb-0.5">
          {activeTagFilters.length > 0 && (
            <button
              onClick={() => onTagFilterChange([])}
              className="flex-shrink-0 px-2 py-0.5 text-[10px] rounded-full border border-[color:var(--error)] text-[color:var(--error)] hover:bg-[rgba(255,92,92,0.12)] transition-colors"
            >
              Clear
            </button>
          )}
          {allTags.map(tag => {
            const isActive = activeTagFilters.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => handleTagToggle(tag)}
                className={`flex-shrink-0 px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                  isActive
                    ? 'border-[color:var(--accent)] text-[color:var(--accent)] bg-[rgba(94,158,250,0.15)]'
                    : 'border-[color:var(--border)] text-secondary hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-secondary truncate">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="truncate">{displayPath}</span>
          {(queueInfo.running > 0 || queueInfo.queued > 0) && (
            <span className="text-muted">• {queueInfo.running} running / {queueInfo.queued} queued</span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {/* View mode toggle */}
          <button
            onClick={() => onViewModeChange(viewMode === 'flat' ? 'grouped' : 'flat')}
            className={`app-icon-btn ${viewMode === 'grouped' ? 'active' : ''}`}
            title={viewMode === 'flat' ? 'Group by folder' : 'Flat list'}
          >
            {viewMode === 'flat' ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowSort((prev) => !prev)}
              className="app-icon-btn"
              title="Sort"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            </button>

            {showSort && (
              <div className="absolute right-0 top-full mt-1 z-50 app-dropdown min-w-[150px] py-1">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onSortChange(option.value);
                      setShowSort(false);
                    }}
                    className={`app-dropdown-item ${sortBy === option.value ? 'active' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* New Script button */}
          <button
            onClick={() => setShowNewScript(true)}
            className="app-icon-btn"
            title="New Script"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="app-icon-btn disabled:opacity-50"
            title="Refresh"
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          <button
            onClick={onSettings}
            className="app-icon-btn"
            title="Settings"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>

          <button
            onClick={onQuit}
            className="app-icon-btn hover:text-[color:var(--error)]"
            title="Quit Application"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* New script inline prompt */}
      {showNewScript && (
        <div className="mt-2 flex gap-1.5">
          <input
            type="text"
            value={newScriptName}
            onChange={(e) => setNewScriptName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newScriptName.trim()) {
                onCreateScript(newScriptName.trim());
                setNewScriptName('');
                setShowNewScript(false);
              }
              if (e.key === 'Escape') {
                setNewScriptName('');
                setShowNewScript(false);
              }
            }}
            placeholder="Script name..."
            className="flex-1 px-2.5 py-1.5 rounded-md text-xs app-input focus:outline-none focus:border-[color:var(--accent)]"
            autoFocus
          />
          <button
            onClick={() => {
              if (newScriptName.trim()) {
                onCreateScript(newScriptName.trim());
                setNewScriptName('');
                setShowNewScript(false);
              }
            }}
            disabled={!newScriptName.trim()}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-[color:var(--accent)] hover:bg-[color:var(--accent-hover)] disabled:opacity-40"
          >
            Create
          </button>
          <button
            onClick={() => { setNewScriptName(''); setShowNewScript(false); }}
            className="app-icon-btn"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
