# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # TypeScript check + Vite build
npm run lint      # ESLint validation
npm run preview   # Preview production build
```

No test framework is configured.

## Architecture

**PlayMakerFlag** is a client-side-only 5v5 flag football playbook designer. No backend, no accounts — all data lives in `localStorage`.

Deployed to GitHub Pages at `/PlayMakeFlag/` base path (set in `vite.config.ts`).

### State Management

All state lives in `src/hooks/usePlaybook.ts` — a single custom hook that reads/writes `localStorage`. No Redux, no Context API. `App.tsx` calls this hook and passes state + handlers down via prop drilling.

Data hierarchy: `Playbook → Play → Player → RouteSegment`

### Key Files

- `src/types.ts` — all TypeScript types (Playbook, Play, Player, RouteSegment, etc.)
- `src/hooks/usePlaybook.ts` — central state: CRUD for playbooks, plays, players, routes, grid
- `src/App.tsx` — main orchestrator; manages drawing state, field interaction, modal visibility
- `src/lib/constants.ts` — field dimensions and coordinate math (25px/yard, 25×25 yd field)
- `src/lib/routes.ts` — 17 predefined route presets (Go, Slant, Post, Corner, etc.)
- `src/lib/shareUtils.ts` — minification + deflate compression for export/import

### Field Coordinate System

- Scale: 25px per yard
- Field size: 25 yards × 25 yards
- LOS (line of scrimmage): 5 yards from bottom
- Snap grid: 0.5 yard increments
- Player positions clamped to 1-yard padding from edges

### Drawing System

Routes are drawn by clicking points on the SVG field. Press **Enter** to finalize, **Escape** to cancel. Route points can be dragged after drawing. Players support four route types: `primary`, `option`, `check`, `endzone`.

### Export/Share

`shareUtils.ts` minifies playbook objects into nested arrays (v3 format, ~65% size reduction) then deflate-compresses + Base64URL-encodes them. Shared as embedded data in a standalone HTML file, or via URL hash (`#share=...`).

### Print

`PrintView.tsx` is always in the DOM but hidden; it becomes visible under `@media print`. `PrintModal.tsx` controls per-page play count and other print settings.

### Path Aliases

`@/` maps to `src/` (configured in `tsconfig.app.json` and `vite.config.ts`).
