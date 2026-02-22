# Scripts Runner - Plan de Mejoras Exhaustivo

## Resumen del Estado Actual

**App:** Menu bar Tauri (360x520px) para ejecutar scripts `.sh`  
**Stack:** Tauri 2 + React 18 + TypeScript + Tailwind 3 + Vite 5  
**Funcionalidad actual:**
- Escanea carpetas (nivel raíz) buscando archivos `.sh`
- Lista plana de scripts con favoritos, iconos emoji, búsqueda
- Ejecución en background con timeout o en Terminal.app
- Sistema de cola (max concurrent configurable)  
- Historial de ejecuciones con logs stdout/stderr
- Notificaciones del sistema, hotkey global
- Tray icon con show/hide al clic
- Temas dark/light
- File watcher para auto-refresh

---

## Mejoras a Implementar (Orden de Ejecución)

### Feature 1: Scan Recursivo de Subcarpetas
**Archivo:** `src/lib/scripts.ts`  
**Impacto:** Bajo riesgo, fundacional para Feature 2

**Cambios:**
- Modificar `scanScriptsFolder()` para escanear recursivamente subcarpetas
- Cada script guarda su ruta completa (ya lo hace) + la carpeta relativa desde la raíz
- Actualizar `scanMultipleFolders()` para manejar duplicados cross-folder

**Verificación:**
- [ ] Crear estructura de test: `~/scripts/deploy/a.sh`, `~/scripts/backup/b.sh`
- [ ] Verificar que ambos aparecen en la lista
- [ ] Verificar que no hay duplicados cuando una subcarpeta también es "additional folder"

---

### Feature 2: Agrupación Visual por Carpetas
**Archivos:** `src/components/ScriptList.tsx`, `src/App.tsx`, `src/types/index.ts`  
**Impacto:** Mayor cambio visual

**Cambios:**
- Nuevo tipo `GroupedScripts = { folder: string; scripts: Script[]; collapsed: boolean }[]`
- Nuevo componente `FolderGroup` con header colapsable
- Estado `viewMode: 'flat' | 'grouped'` con toggle en Header
- En modo grouped: agrupar por carpeta padre, mostrar headers con nombre de carpeta
- En modo flat: comportamiento actual
- La búsqueda funciona en ambos modos (filtra across groups en modo grouped)
- Persistir estado de collapse y viewMode en store

**Verificación:**
- [ ] Toggle flat/grouped funciona
- [ ] Headers de carpeta se muestran correctamente
- [ ] Colapsar/expandir funciona
- [ ] Búsqueda filtra correctamente en modo grouped
- [ ] Sorting funciona dentro de cada grupo
- [ ] La keyboard navigation sigue funcionando

---

### Feature 3: Sección de Favoritos/Pinned Separada
**Archivos:** `src/components/ScriptList.tsx`  
**Impacto:** Mejora visual media

**Cambios:**
- Cuando hay favoritos, mostrar sección "Pinned" con divider visual arriba de la lista
- Solo activo cuando `sortBy === 'favorite'` o en modo grouped
- Divider visual claro entre pinned y el resto
- En modo grouped: pinned primero (sin importar carpeta), luego grupos por carpeta

**Verificación:**
- [ ] Sección pinned aparece cuando hay favoritos
- [ ] Toggling favorito mueve script entre secciones
- [ ] No aparece sección vacía si no hay favoritos

---

### Feature 4: Quick Actions Bar (Barra Inferior)
**Archivos:** nuevo `src/components/ActionBar.tsx`, `src/App.tsx`  
**Impacto:** Gran mejora de discoverability

**Cambios:**
- Barra fija en la parte inferior con acciones del script seleccionado
- Muestra atajos: `⏎ Run`, `⇧⏎ Terminal`, `⌘L Logs`, `⌘E Edit`
- Cambia dinámicamente según estado del script (running → Cancel, queued → Dequeue)
- Fondo translúcido + border top
- Si no hay script seleccionado, mostrar hints generales (⌘K Search, ⌘R Refresh)

**Verificación:**
- [ ] Bar muestra atajos correctos según estado
- [ ] Clic en cada acción funciona igual que el atajo
- [ ] Se actualiza al cambiar selección
- [ ] Se actualiza en tiempo real cuando script empieza/termina

---

### Feature 5: Timer en Tiempo Real
**Archivos:** `src/components/ScriptItem.tsx`, nuevo hook `useElapsedTimer`  
**Impacto:** Feedback visual inmediato

**Cambios:**
- Nuevo hook `useElapsedTimer(startTime)` que retorna elapsed string actualizado cada segundo
- Cuando `script.running === true`, guardar `startedAt` timestamp
- Mostrar `⏱ 0:42` al lado del nombre en vez de solo "Running..."  
- Actualizar tipo `Script` con campo `startedAt?: string`

**Verificación:**
- [ ] Timer aparece cuando script está running
- [ ] Timer incrementa cada segundo
- [ ] Timer desaparece al terminar
- [ ] No hay memory leaks (cleanup de interval)

---

### Feature 6: Output Inline en Tiempo Real
**Archivos:** `src/components/ScriptItem.tsx`, `src/App.tsx`  
**Impacto:** Power user feature

**Cambios:**
- Área expandible debajo del ScriptItem que muestra últimas 3-5 líneas de output
- Solo visible cuando el script está running y el usuario hace clic para expandir
- Usar el callback `onOutput` ya existente en `executeScript()`
- Buffer circular de últimas N líneas en el componente
- Botón para expandir/colapsar output area
- Auto-scroll al último output

**Verificación:**
- [ ] Output aparece en tiempo real mientras script corre
- [ ] Solo últimas 5 líneas visibles (no crece infinitamente)
- [ ] Expand/collapse funciona
- [ ] Output se limpia al re-ejecutar
- [ ] No afecta rendimiento con output rápido

---

### Feature 7: Sistema de Tags con Filtrado
**Archivos:** `src/components/Header.tsx`, `src/components/ScriptItem.tsx`, nuevo `src/components/TagFilter.tsx`  
**Impacto:** Organización avanzada

**Cambios:**
- Componente `TagFilter` con chips horizontales scrollables bajo el search
- Recolectar tags únicos de todos los scripts
- Al clic en tag, filtra la lista (multi-select: AND o OR)
- En menú contextual del script: nueva opción "Edit Tags" con input inline
- Tags se muestran como pills junto al nombre del script
- Persistir tags en store (ya existe en ScriptData)

**Verificación:**
- [ ] Tags se muestran como pills en el ScriptItem
- [ ] Chip filter funciona y filtra correctamente
- [ ] Editar tags desde menú contextual funciona
- [ ] Tags se persisten entre reinicios
- [ ] Compatible con búsqueda y con agrupación por carpetas

---

### Feature 8: Highlight de Búsqueda
**Archivos:** `src/components/ScriptItem.tsx`  
**Impacto:** Polish visual

**Cambios:**
- Cuando hay `searchQuery`, resaltar la porción del nombre que coincide
- Función `highlightMatch(text, query)` que retorna fragmentos JSX
- Estilo: background accent con opacity baja

**Verificación:**
- [ ] Match se resalta visualmente
- [ ] Funciona case-insensitive
- [ ] No rompe el layout del nombre
- [ ] Se limpia al borrar búsqueda

---

## Orden de Implementación

```
Feature 1 (Recursive scan)     ← fundacional
    ↓
Feature 2 (Folder grouping)    ← depende de 1
    ↓
Feature 3 (Pinned section)     ← depende de 2
    ↓
Feature 5 (Timer)              ← independiente
    ↓
Feature 4 (Action Bar)         ← independiente
    ↓
Feature 6 (Inline output)      ← depende de 5
    ↓
Feature 7 (Tags)               ← independiente
    ↓
Feature 8 (Search highlight)   ← independiente
```

## Verificación Final

- [ ] `pnpm build` sin errores TypeScript
- [ ] `cargo build` sin errores Rust
- [ ] App inicia correctamente desde tray
- [ ] Todas las features funcionan con tema dark y light
- [ ] No hay regresiones en funcionalidad existente
- [ ] Keyboard navigation OK en todos los modos
- [ ] Performance OK con 50+ scripts
