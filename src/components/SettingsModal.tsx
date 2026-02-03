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

  useEffect(() => {
    if (isOpen) {
      setMainFolder(settings.scriptsFolder);
      setTimeout(settings.defaultTimeout);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      scriptsFolder: mainFolder.trim(),
      defaultTimeout: timeout,
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
    <div className="absolute inset-0 bg-zinc-900 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
        <h2 className="text-sm font-medium text-zinc-200">Settings</h2>
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
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Main Scripts Folder */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">
            Main Scripts Folder
          </label>
          <input
            type="text"
            value={mainFolder}
            onChange={(e) => setMainFolder(e.target.value)}
            placeholder="~/scripts"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-md text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 text-sm"
          />
          <p className="text-xs text-zinc-600 mt-1">Use ~ for home directory</p>
        </div>

        {/* Additional Folders */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">
            Additional Folders
          </label>
          {settings.additionalFolders.length > 0 ? (
            <div className="space-y-1 mb-2">
              {settings.additionalFolders.map((folder) => (
                <div
                  key={folder}
                  className="flex items-center justify-between px-2 py-1.5 bg-zinc-800 rounded-md text-sm"
                >
                  <span className="text-zinc-300 truncate">{folder}</span>
                  <button
                    onClick={() => onRemoveFolder(folder)}
                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-600 mb-2">No additional folders</p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="Add folder path..."
              className="flex-1 px-3 py-1.5 bg-zinc-800 border border-zinc-600 rounded-md text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
            />
            <button
              onClick={handleAddFolder}
              disabled={!newFolder.trim()}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:hover:bg-zinc-700 text-zinc-200 rounded-md text-sm transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Timeout */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">
            Default Timeout
          </label>
          <select
            value={timeout}
            onChange={(e) => setTimeout(Number(e.target.value))}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-md text-zinc-200 focus:outline-none focus:border-zinc-500 text-sm"
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

        {/* Keyboard Shortcuts Info */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">
            Keyboard Shortcuts
          </label>
          <div className="space-y-1 text-xs text-zinc-500">
            <div className="flex justify-between">
              <span>Run script 1-9</span>
              <span className="text-zinc-600">⌘1 - ⌘9</span>
            </div>
            <div className="flex justify-between">
              <span>Refresh scripts</span>
              <span className="text-zinc-600">⌘R</span>
            </div>
            <div className="flex justify-between">
              <span>Focus search</span>
              <span className="text-zinc-600">⌘F</span>
            </div>
            <div className="flex justify-between">
              <span>Close modal</span>
              <span className="text-zinc-600">Esc</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-zinc-700">
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-md text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-md text-sm transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
