# Implementation Plan V2 — Scripts Runner Enhancements

## Feature 1: Script Description from Comments
**Goal:** Parse the first `#` comment lines from each `.sh` file (after shebang) and display as a subtitle.

### Files to modify
- `src/lib/scripts.ts` — New `readScriptDescription(path)` function using `@tauri-apps/plugin-fs` `readTextFile`
- `src/types/index.ts` — Add `description?: string` to `Script`
- `src/App.tsx` — Call `readScriptDescription` during `scanScripts` and store in script object
- `src/components/ScriptItem.tsx` — Display description below name in a muted text line
- `src-tauri/capabilities/default.json` — Add `fs:allow-read-text-file` permission if needed

### Verification
- [ ] Scripts with `# Description here` show subtitle
- [ ] Scripts without comments show nothing extra
- [ ] Shebang lines (`#!/bin/bash`) are skipped

---

## Feature 2: Per-Script Args/Env/Timeout Editor UI
**Goal:** The data model already supports `args`, `envVars`, `timeoutSeconds` per script. Add a UI modal to edit them.

### Files to modify
- `src/components/ScriptConfigModal.tsx` — **NEW** component with form for args, env key/value pairs, timeout override
- `src/App.tsx` — Add state for `showConfig`, handler `handleSaveScriptConfig`, wire to ScriptItem
- `src/components/ScriptItem.tsx` — Add "Configure" option to context menu
- `src/hooks/useStore.ts` — Already has `setScriptArgs`, `setScriptEnvVars`, `setScriptTimeout` (unused until now)

### Verification
- [ ] "Configure" appears in context menu
- [ ] Modal lets user edit args, env vars, timeout
- [ ] Values persist and are used in execution
- [ ] Changes appear in the script's next run

---

## Feature 3: Recursive File Watching Fix
**Goal:** `watchFolder` currently uses `recursive: false` but scanning is recursive. Fix to detect new scripts in subdirectories.

### Files to modify
- `src/lib/scripts.ts` — Change `watchFolder` to use `recursive: true`

### Verification
- [ ] Adding a new `.sh` in a subdirectory triggers auto-refresh
- [ ] Deleting a script in a subdirectory triggers auto-refresh

---

## Feature 4: Scroll Selected Into View
**Goal:** Arrow-key navigation should auto-scroll the selected script into the visible area.

### Files to modify
- `src/components/ScriptItem.tsx` — Add `ref` forwarding + `scrollIntoView` when selected
- `src/components/ScriptList.tsx` — Pass ref or use data attributes

### Verification
- [ ] Arrow Down past visible area scrolls list
- [ ] Arrow Up past top scrolls up
- [ ] Clicking a script doesn't trigger unwanted scroll

---

## Feature 5: Script Creation (New Script Button)
**Goal:** Create new `.sh` files from within the app with a template.

### Files to modify
- `src/lib/scripts.ts` — New `createScript(folderPath, name)` function using `writeTextFile`
- `src/components/Header.tsx` — Add "+" button next to refresh
- `src/App.tsx` — Add `handleCreateScript` handler with name prompt, calls `createScript` then rescans
- `src-tauri/capabilities/default.json` — Add `fs:allow-write-text-file` permission

### Verification
- [ ] "+" button appears in header
- [ ] Prompt asks for script name
- [ ] File is created with shebang template
- [ ] Script appears in list after creation
- [ ] File is executable (chmod +x)

---

## Feature 6: Confirm Before Run Mode
**Goal:** Optional per-script flag that shows a confirmation dialog before execution.

### Files to modify
- `src/types/index.ts` — Add `confirmBeforeRun?: boolean` to `ScriptData`
- `src/hooks/useStore.ts` — Add `setConfirmBeforeRun` helper
- `src/App.tsx` — Check flag in `requestRun`, show confirmation dialog
- `src/components/ScriptItem.tsx` — Show a shield/lock icon when confirm mode is active
- `src/components/ScriptConfigModal.tsx` — Add toggle for "Confirm before run"

### Verification
- [ ] Toggle appears in config modal
- [ ] When enabled, running script shows dialog asking "Run {name}?"
- [ ] Cancel aborts, Confirm proceeds
- [ ] Shield icon visible on script item

---

## Feature 7: Improved Empty States
**Goal:** Clear feedback when filtered results are empty (search, tags, grouped view).

### Files to modify
- `src/components/ScriptList.tsx` — Add specific empty states for search-no-match and tag-filter-no-match

### Verification
- [ ] Searching for nonexistent script shows "No scripts match '{query}'"
- [ ] Tag filter with no matches shows "No scripts with tag '{tag}'"
- [ ] Generic empty state still shows for truly empty folders

---

## Feature 8: Tray Icon Running Badge
**Goal:** Update tray tooltip/title to show running script count.

### Files to modify
- `src-tauri/src/lib.rs` — Add `set_tray_tooltip` command
- `src/App.tsx` — Call Rust command when running count changes

### Verification
- [ ] Tray tooltip shows "Scripts Runner — 2 running" when scripts execute
- [ ] Reverts to "Scripts Runner" when idle

---

## Dependency Graph
```
Feature 3 (watch fix)     → independent, one-line change
Feature 4 (scroll)        → independent
Feature 7 (empty states)  → independent
Feature 1 (descriptions)  → independent
Feature 8 (tray badge)    → independent
Feature 2 (config modal)  → before Feature 6
Feature 6 (confirm mode)  → depends on Feature 2 (config modal)
Feature 5 (create script) → independent
```

## Implementation Order
1. Feature 3 (trivial fix)
2. Feature 4 (scroll into view)
3. Feature 7 (empty states)
4. Feature 1 (descriptions)
5. Feature 5 (create script)
6. Feature 2 (config modal)
7. Feature 6 (confirm mode)
8. Feature 8 (tray badge)
