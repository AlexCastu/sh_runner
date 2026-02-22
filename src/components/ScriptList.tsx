import React from 'react';
import type { Script, ViewMode } from '../types';
import { ScriptItem } from './ScriptItem';

interface FolderGroupData {
  folder: string;
  scripts: Script[];
  collapsed: boolean;
}

interface GroupedData {
  pinned: Script[];
  groups: FolderGroupData[];
}

interface ScriptListProps {
  scripts: Script[];
  groupedScripts: GroupedData | null;
  viewMode: ViewMode;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  selectedId: string | null;
  totalCount: number;
  activeTagFilters: string[];
  onRunScript: (script: Script) => void;
  onRunInTerminal: (script: Script) => void;
  onCancelScript: (script: Script) => void;
  onForceReset: (script: Script) => void;
  onDequeue: (script: Script) => void;
  onToggleFavorite: (script: Script) => void;
  onShowLogs: (script: Script) => void;
  onSetIcon: (script: Script, icon: string | null) => void;
  onSetTags: (script: Script, tags: string[]) => void;
  onReveal: (script: Script) => void;
  onOpenInEditor: (script: Script) => void;
  onConfigure: (script: Script) => void;
  onSelect: (script: Script) => void;
  onToggleFolderCollapse: (folder: string) => void;
}

// Track global index for keyboard shortcuts across groups
let globalIndex = 0;

const ScriptItemRow: React.FC<{
  script: Script;
  index: number;
  selectedId: string | null;
  searchQuery: string;
  props: ScriptListProps;
}> = ({ script, index, selectedId, searchQuery, props }) => (
  <ScriptItem
    key={script.id}
    script={script}
    index={index}
    isSelected={selectedId === script.id}
    searchQuery={searchQuery}
    onRun={props.onRunScript}
    onRunInTerminal={props.onRunInTerminal}
    onCancel={props.onCancelScript}
    onForceReset={props.onForceReset}
    onDequeue={props.onDequeue}
    onToggleFavorite={props.onToggleFavorite}
    onShowLogs={props.onShowLogs}
    onSetIcon={props.onSetIcon}
    onSetTags={props.onSetTags}
    onReveal={props.onReveal}
    onOpenInEditor={props.onOpenInEditor}
    onConfigure={props.onConfigure}
    onSelect={props.onSelect}
  />
);

const FolderGroupSection: React.FC<{
  group: FolderGroupData;
  startIndex: number;
  selectedId: string | null;
  searchQuery: string;
  onToggleCollapse: (folder: string) => void;
  props: ScriptListProps;
}> = ({ group, startIndex, selectedId, searchQuery, onToggleCollapse, props }) => (
  <div className="mb-1">
    <button
      onClick={() => onToggleCollapse(group.folder)}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-secondary hover:text-primary transition-colors"
    >
      <svg
        className={`w-3 h-3 transition-transform ${group.collapsed ? '' : 'rotate-90'}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      <svg className="w-3 h-3 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
      <span className="truncate">{group.folder}</span>
      <span className="text-muted ml-auto">{group.scripts.length}</span>
    </button>
    {!group.collapsed && (
      <div className="space-y-1 mt-1">
        {group.scripts.map((script, idx) => (
          <ScriptItemRow
            key={script.id}
            script={script}
            index={startIndex + idx}
            selectedId={selectedId}
            searchQuery={searchQuery}
            props={props}
          />
        ))}
      </div>
    )}
  </div>
);

export const ScriptList: React.FC<ScriptListProps> = (props) => {
  const {
    scripts,
    groupedScripts,
    viewMode,
    searchQuery,
    isLoading,
    error,
    selectedId,
    totalCount,
    activeTagFilters,
  } = props;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 mx-auto border-2 border-[rgba(255,255,255,0.15)] border-t-[color:var(--accent)] rounded-full animate-spin" />
          <p className="mt-3 text-xs text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <svg className="w-8 h-8 mx-auto text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="mt-2 text-sm text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  if (scripts.length === 0) {
    // Determine which empty state to show
    const isFiltered = totalCount > 0 && (searchQuery.trim() !== '' || activeTagFilters.length > 0);

    if (isFiltered) {
      return (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery.trim() ? (
              <>
                <p className="mt-3 text-sm text-secondary">No scripts match</p>
                <p className="text-xs text-muted mt-1">"{searchQuery}"</p>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-secondary">No scripts with selected tags</p>
                <p className="text-xs text-muted mt-1">{activeTagFilters.join(', ')}</p>
              </>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <svg className="w-10 h-10 mx-auto text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="mt-3 text-sm text-secondary">No scripts found</p>
          <p className="text-xs text-muted mt-1">Add .sh files to your folder</p>
        </div>
      </div>
    );
  }

  // Grouped view
  if (viewMode === 'grouped' && groupedScripts) {
    globalIndex = 0;
    const pinnedCount = groupedScripts.pinned.length;

    return (
      <div className="flex-1 overflow-y-auto px-2 py-2 relative z-0">
        {/* Pinned section */}
        {pinnedCount > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-[color:var(--accent)]">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="font-medium">Pinned</span>
              <span className="text-muted">{pinnedCount}</span>
            </div>
            <div className="space-y-1">
              {groupedScripts.pinned.map((script, idx) => (
                <ScriptItemRow
                  key={script.id}
                  script={script}
                  index={idx}
                  selectedId={selectedId}
                  searchQuery={searchQuery}
                  props={props}
                />
              ))}
            </div>
            {groupedScripts.groups.length > 0 && (
              <div className="mx-3 my-2 border-t border-[color:var(--border)]" />
            )}
          </div>
        )}

        {/* Folder groups */}
        {groupedScripts.groups.map((group) => {
          const startIdx = pinnedCount + globalIndex;
          globalIndex += group.scripts.length;
          return (
            <FolderGroupSection
              key={group.folder}
              group={group}
              startIndex={startIdx}
              selectedId={selectedId}
              searchQuery={searchQuery}
              onToggleCollapse={props.onToggleFolderCollapse}
              props={props}
            />
          );
        })}
      </div>
    );
  }

  // Flat view with pinned section
  const pinned = scripts.filter(s => s.favorite);
  const unpinned = scripts.filter(s => !s.favorite);
  const showPinnedSection = pinned.length > 0 && unpinned.length > 0;

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2 relative z-0">
      {showPinnedSection && (
        <>
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-[color:var(--accent)]">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="font-medium">Pinned</span>
          </div>
          <div className="space-y-1 mb-1">
            {pinned.map((script, index) => (
              <ScriptItemRow
                key={script.id}
                script={script}
                index={index}
                selectedId={selectedId}
                searchQuery={searchQuery}
                props={props}
              />
            ))}
          </div>
          <div className="mx-3 my-2 border-t border-[color:var(--border)]" />
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-secondary">
            <span>All Scripts</span>
          </div>
        </>
      )}
      <div className="space-y-1">
        {(showPinnedSection ? unpinned : scripts).map((script, index) => (
          <ScriptItemRow
            key={script.id}
            script={script}
            index={showPinnedSection ? pinned.length + index : index}
            selectedId={selectedId}
            searchQuery={searchQuery}
            props={props}
          />
        ))}
      </div>
    </div>
  );
};
