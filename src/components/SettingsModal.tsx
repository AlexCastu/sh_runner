import React, { useState, useEffect } from 'react';
import type { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSave: (settings: Partial<AppSettings>) => void;
  onAddFolder: (folder: string) => void;
  onRemoveFolder: (folder: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onSave,
  onAddFolder,
  onRemoveFolder,
}) => {
  const [mainFolder, setMainFolder] = useState(settings.scriptsFolder);
  const [newFolder, setNewFolder] = useState('');
  const [timeout, setTimeout] = useState(settings.defaultTimeout);
  const [themeChoice, setThemeChoice] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (!isOpen) return;
    setMainFolder(settings.scriptsFolder);
    setTimeout(settings.defaultTimeout);
    const initialTheme = settings.theme === 'light'
      ? 'light'
      : settings.theme === 'dark'
        ? 'dark'
        : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    setThemeChoice(initialTheme);
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const inputClass = 'w-full px-3 py-2 rounded-md text-sm app-input focus:outline-none focus:border-[color:var(--accent)]';
  const buttonPrimary = 'px-4 py-2 rounded-md text-sm font-medium text-white bg-[color:var(--accent)] hover:bg-[color:var(--accent-hover)]';

  const handleClose = () => {
    onSave({
      scriptsFolder: mainFolder.trim(),
      defaultTimeout: timeout,
      theme: themeChoice,
    });
    onClose();
  };

  const handleAddFolder = () => {
    if (newFolder.trim()) {
      onAddFolder(newFolder.trim());
      setNewFolder('');
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[color:var(--border)]">
        <button onClick={handleClose} className="app-icon-btn" title="Back">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-base font-medium text-primary">Settings</h2>
        <div className="flex-1" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <label className="block text-sm text-secondary mb-1.5">
            Theme
          </label>
          <div className="w-full inline-flex rounded-full border border-[color:var(--border)] p-1 gap-1 bg-[color:var(--bg-elev)]">
            <button
              onClick={() => {
                setThemeChoice('dark');
                onSave({ theme: 'dark' });
              }}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-full ${themeChoice === 'dark' ? 'bg-[rgba(94,158,250,0.22)] text-primary' : 'text-secondary hover:text-primary'}`}
            >
              Dark
            </button>
            <button
              onClick={() => {
                setThemeChoice('light');
                onSave({ theme: 'light' });
              }}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-full ${themeChoice === 'light' ? 'bg-[rgba(94,158,250,0.22)] text-primary' : 'text-secondary hover:text-primary'}`}
            >
              Light
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm text-secondary mb-1.5">
            Main Scripts Folder
          </label>
          <input
            type="text"
            value={mainFolder}
            onChange={(e) => setMainFolder(e.target.value)}
            onBlur={() => onSave({ scriptsFolder: mainFolder.trim() })}
            placeholder="~/scripts"
            className={inputClass}
          />
          <p className="text-xs text-muted mt-1">Use ~ for home directory</p>
        </div>

        <div>
          <label className="block text-sm text-secondary mb-1.5">
            Additional Folders
          </label>
          {settings.additionalFolders.length > 0 ? (
            <div className="space-y-1 mb-2">
              {settings.additionalFolders.map((folder) => (
                <div
                  key={folder}
                  className="flex items-center justify-between px-2 py-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)]"
                >
                  <span className="text-xs text-primary truncate">{folder}</span>
                  <button
                    onClick={() => onRemoveFolder(folder)}
                    className="app-icon-btn hover:text-[color:var(--error)]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted mb-2">No additional folders</p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="Add folder path..."
              className={`flex-1 ${inputClass}`}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
            />
            <button
              onClick={handleAddFolder}
              disabled={!newFolder.trim()}
              className={`${buttonPrimary} disabled:opacity-50`}
            >
              Add
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm text-secondary mb-1.5">
            Default Timeout
          </label>
          <select
            value={timeout}
            onChange={(e) => {
              const next = Number(e.target.value);
              setTimeout(next);
              onSave({ defaultTimeout: next });
            }}
            className={inputClass}
          >
            <option value={0}>No timeout</option>
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
            <option value={300}>5 minutes</option>
            <option value={600}>10 minutes</option>
            <option value={1800}>30 minutes</option>
            <option value={3600}>1 hour</option>
          </select>
        </div>
      </div>
    </div>
  );
};
