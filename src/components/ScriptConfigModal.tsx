import React, { useState, useEffect } from 'react';
import type { Script } from '../types';

interface ScriptConfigModalProps {
  script: Script;
  onClose: () => void;
  onSaveArgs: (script: Script, args: string) => void;
  onSaveEnvVars: (script: Script, envVars: Record<string, string>) => void;
  onSaveTimeout: (script: Script, timeoutSeconds: number) => void;
  onSaveConfirmBeforeRun: (script: Script, confirm: boolean) => void;
}

export const ScriptConfigModal: React.FC<ScriptConfigModalProps> = ({
  script,
  onClose,
  onSaveArgs,
  onSaveEnvVars,
  onSaveTimeout,
  onSaveConfirmBeforeRun,
}) => {
  const [args, setArgs] = useState(script.args || '');
  const [envPairs, setEnvPairs] = useState<Array<{ key: string; value: string }>>([]);
  const [timeout, setTimeout] = useState(script.timeoutSeconds || 0);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [confirmRun, setConfirmRun] = useState(script.confirmBeforeRun ?? false);

  useEffect(() => {
    const pairs = Object.entries(script.envVars || {}).map(([key, value]) => ({ key, value }));
    setEnvPairs(pairs);
    setArgs(script.args || '');
    setTimeout(script.timeoutSeconds || 0);
    setConfirmRun(script.confirmBeforeRun ?? false);
  }, [script.id]);

  const handleSave = () => {
    onSaveArgs(script, args);
    const envMap: Record<string, string> = {};
    envPairs.forEach(({ key, value }) => {
      if (key.trim()) envMap[key.trim()] = value;
    });
    onSaveEnvVars(script, envMap);
    onSaveTimeout(script, timeout);
    onSaveConfirmBeforeRun(script, confirmRun);
    onClose();
  };

  const handleAddEnv = () => {
    if (newEnvKey.trim()) {
      setEnvPairs((prev) => [...prev, { key: newEnvKey.trim(), value: newEnvValue }]);
      setNewEnvKey('');
      setNewEnvValue('');
    }
  };

  const handleRemoveEnv = (index: number) => {
    setEnvPairs((prev) => prev.filter((_, i) => i !== index));
  };

  const inputClass =
    'w-full px-3 py-2 rounded-md text-sm app-input focus:outline-none focus:border-[color:var(--accent)]';

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[color:var(--border)]">
        <button onClick={onClose} className="app-icon-btn" title="Back">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{script.icon || '⚙️'}</span>
          <span className="text-base text-primary font-medium truncate">{script.name}</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-[color:var(--accent)] hover:bg-[color:var(--accent-hover)]"
        >
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Arguments */}
        <div>
          <label className="block text-sm text-secondary mb-1.5">Arguments</label>
          <input
            type="text"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            placeholder="--flag value"
            className={inputClass}
          />
          <p className="text-xs text-muted mt-1">Passed after the script path</p>
        </div>

        {/* Timeout */}
        <div>
          <label className="block text-sm text-secondary mb-1.5">Timeout Override</label>
          <select
            value={timeout}
            onChange={(e) => setTimeout(Number(e.target.value))}
            className={inputClass}
          >
            <option value={0}>Use default</option>
            <option value={10}>10 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
            <option value={300}>5 minutes</option>
            <option value={600}>10 minutes</option>
            <option value={1800}>30 minutes</option>
            <option value={3600}>1 hour</option>
          </select>
        </div>

        {/* Confirm before run toggle */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmRun}
              onChange={(e) => setConfirmRun(e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <span className="text-sm text-secondary">Confirm before run</span>
              <p className="text-xs text-muted">Show a confirmation dialog before executing</p>
            </div>
          </label>
        </div>

        {/* Environment Variables */}
        <div>
          <label className="block text-sm text-secondary mb-1.5">Environment Variables</label>
          {envPairs.length > 0 ? (
            <div className="space-y-1.5 mb-2">
              {envPairs.map((pair, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={pair.key}
                    onChange={(e) => {
                      const next = [...envPairs];
                      next[idx] = { ...next[idx], key: e.target.value };
                      setEnvPairs(next);
                    }}
                    className="flex-1 px-2 py-1.5 rounded-md text-xs app-input focus:outline-none"
                    placeholder="KEY"
                  />
                  <span className="text-muted text-xs">=</span>
                  <input
                    type="text"
                    value={pair.value}
                    onChange={(e) => {
                      const next = [...envPairs];
                      next[idx] = { ...next[idx], value: e.target.value };
                      setEnvPairs(next);
                    }}
                    className="flex-1 px-2 py-1.5 rounded-md text-xs app-input focus:outline-none"
                    placeholder="value"
                  />
                  <button
                    onClick={() => handleRemoveEnv(idx)}
                    className="app-icon-btn hover:text-[color:var(--error)]"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted mb-2">No environment variables set</p>
          )}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={newEnvKey}
              onChange={(e) => setNewEnvKey(e.target.value)}
              placeholder="KEY"
              className="flex-1 px-2 py-1.5 rounded-md text-xs app-input focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleAddEnv()}
            />
            <input
              type="text"
              value={newEnvValue}
              onChange={(e) => setNewEnvValue(e.target.value)}
              placeholder="value"
              className="flex-1 px-2 py-1.5 rounded-md text-xs app-input focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleAddEnv()}
            />
            <button
              onClick={handleAddEnv}
              disabled={!newEnvKey.trim()}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-[color:var(--accent)] hover:bg-[color:var(--accent-hover)] disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>

        {/* Script path info */}
        <div className="pt-2 border-t border-[color:var(--border)]">
          <p className="text-xs text-muted break-all">{script.path}</p>
        </div>
      </div>
    </div>
  );
};
