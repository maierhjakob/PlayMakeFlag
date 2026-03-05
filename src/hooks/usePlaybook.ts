import { useState, useEffect, useCallback } from 'react';
import type { Playbook, PlaybookEntry, Play, Player, Point, RouteSegment, RouteType, PlayTag, PlayFolder, SavedRoute } from '@/types';
import { POSITIONS, getPos, clampPoint, FIELD_PIXEL_WIDTH } from '@/lib/constants';
import { generateRoutePoints } from '@/lib/routes';
import type { RoutePreset } from '@/lib/routes';

// ============================================
// MIGRATION
// ============================================

/**
 * Loads global plays from storage, migrating from the old format where plays
 * were embedded inside each playbook object.
 */
function loadGlobalPlays(): Play[] {
    const saved = localStorage.getItem('global_plays');
    if (saved) return JSON.parse(saved);

    // Migrate: extract plays from old playbooks format
    const savedPlaybooks = localStorage.getItem('playbooks');
    if (savedPlaybooks) {
        const oldPlaybooks: any[] = JSON.parse(savedPlaybooks);
        const plays: Play[] = [];
        const seenIds = new Set<string>();
        for (const pb of oldPlaybooks) {
            if (Array.isArray(pb.plays)) {
                for (const play of pb.plays) {
                    if (!seenIds.has(play.id)) {
                        // Strip gridPosition — it belongs in PlaybookEntry now
                        const { gridPosition: _gp, ...globalPlay } = play;
                        plays.push(globalPlay);
                        seenIds.add(play.id);
                    }
                }
            }
        }
        return plays;
    }

    // Also try legacy migration
    const oldPlays = localStorage.getItem('savedPlays');
    if (oldPlays) {
        return (JSON.parse(oldPlays) as any[]).map(({ gridPosition: _gp, ...p }) => p);
    }

    return [];
}

/**
 * Loads playbooks, migrating from old format (plays: Play[]) to new format
 * (entries: PlaybookEntry[]).
 */
function loadPlaybooks(): Playbook[] {
    const saved = localStorage.getItem('playbooks');
    if (saved) {
        const parsed: any[] = JSON.parse(saved);
        return parsed.map(pb => {
            // Already migrated
            if (pb.entries) return pb as Playbook;

            // Old format: pb.plays is Play[] — convert to entries
            const entries: PlaybookEntry[] = (pb.plays || []).map((p: any) => ({
                playId: p.id,
                ...(p.gridPosition ? { gridPosition: p.gridPosition } : {})
            }));

            const { plays: _plays, ...rest } = pb;
            return { ...rest, entries } as Playbook;
        });
    }

    // Legacy migration: single default playbook
    const oldColumns = localStorage.getItem('playbookGridColumns');
    return [{
        id: crypto.randomUUID(),
        name: 'defaultPlaybook',
        entries: [],
        gridConfig: { columnNames: oldColumns ? JSON.parse(oldColumns) : ['A', 'B', 'C', 'D', 'E'] },
        createdAt: Date.now(),
        updatedAt: Date.now()
    }];
}

// ============================================
// FOLDERS
// ============================================

const FORMATION_KEYWORDS = [
    'four-tight', 'three-tight', 'double', 'spread', 'twins', 'trips', 'run'
];

function detectFormation(name: string): string | undefined {
    const lower = name.toLowerCase();
    return FORMATION_KEYWORDS.find(kw => lower.includes(kw));
}

function loadFolders(): PlayFolder[] {
    const saved = localStorage.getItem('global_folders');
    if (saved) return JSON.parse(saved);
    return [];
}

function loadSavedRoutes(): SavedRoute[] {
    const saved = localStorage.getItem('global_saved_routes');
    if (saved) return JSON.parse(saved);
    return [];
}

// ============================================
// HOOK
// ============================================

export function usePlaybook() {
    // Undo/redo history — in-memory only, scoped to current play
    const [undoStack, setUndoStack] = useState<Play[]>([]);
    const [redoStack, setRedoStack] = useState<Play[]>([]);

    // Global plays — shared across all playbooks
    const [globalPlays, setGlobalPlays] = useState<Play[]>(loadGlobalPlays);

    const [playbooks, setPlaybooks] = useState<Playbook[]>(loadPlaybooks);

    const [currentPlaybookId, setCurrentPlaybookId] = useState<string>(() => {
        const saved = localStorage.getItem('currentPlaybookId');
        const books = loadPlaybooks();
        return saved || books[0]?.id || '';
    });

    const [currentPlayId, setCurrentPlayId] = useState<string | null>(null);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [isSettingMotion, setIsSettingMotion] = useState(false);
    const [folders, setFolders] = useState<PlayFolder[]>(loadFolders);
    const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(loadSavedRoutes);

    const currentPlaybook = playbooks.find(pb => pb.id === currentPlaybookId) || playbooks[0] || null;

    // All global plays, with grid positions from the current playbook merged in.
    // A play's gridPosition is per-playbook — only set if it's been assigned to a cell here.
    const plays: Play[] = globalPlays.map(play => {
        const entry = currentPlaybook?.entries.find(e => e.playId === play.id);
        return entry?.gridPosition ? { ...play, gridPosition: entry.gridPosition } : { ...play, gridPosition: undefined };
    });

    const currentPlay = globalPlays.find(p => p.id === currentPlayId) || null;
    const selectedPlayer = currentPlay?.players.find(p => p.id === selectedPlayerId) || null;
    const columnNames = currentPlaybook?.gridConfig.columnNames || ['A', 'B', 'C', 'D', 'E'];

    // Persist to localStorage
    useEffect(() => {
        localStorage.setItem('global_plays', JSON.stringify(globalPlays));
    }, [globalPlays]);

    useEffect(() => {
        localStorage.setItem('playbooks', JSON.stringify(playbooks));
    }, [playbooks]);

    useEffect(() => {
        localStorage.setItem('currentPlaybookId', currentPlaybookId);
    }, [currentPlaybookId]);

    useEffect(() => {
        localStorage.setItem('global_folders', JSON.stringify(folders));
    }, [folders]);

    useEffect(() => {
        localStorage.setItem('global_saved_routes', JSON.stringify(savedRoutes));
    }, [savedRoutes]);

    // ============================================
    // CORE UPDATERS
    // ============================================

    const updateCurrentPlaybook = (updater: (pb: Playbook) => Playbook) => {
        setPlaybooks(prev => prev.map(pb =>
            pb.id === currentPlaybookId ? { ...updater(pb), updatedAt: Date.now() } : pb
        ));
    };

    /** Updates the play in global storage. Strips any transient gridPosition. */
    const updateCurrentPlay = (updatedPlay: Play) => {
        const { gridPosition: _gp, ...globalPlay } = updatedPlay as Play & { gridPosition?: any };
        setGlobalPlays(prev => prev.map(p => p.id === globalPlay.id ? globalPlay : p));
    };

    // ============================================
    // UNDO / REDO
    // ============================================

    useEffect(() => {
        setUndoStack([]);
        setRedoStack([]);
    }, [currentPlayId]);

    const pushToUndoStack = () => {
        if (!currentPlay) return;
        setUndoStack(prev => [...prev.slice(-49), currentPlay]);
        setRedoStack([]);
    };

    const undo = () => {
        if (undoStack.length === 0 || !currentPlay) return;
        const prev = undoStack[undoStack.length - 1];
        setRedoStack(r => [...r, currentPlay]);
        setUndoStack(u => u.slice(0, -1));
        updateCurrentPlay(prev);
    };

    const redo = () => {
        if (redoStack.length === 0 || !currentPlay) return;
        const next = redoStack[redoStack.length - 1];
        setUndoStack(u => [...u, currentPlay]);
        setRedoStack(r => r.slice(0, -1));
        updateCurrentPlay(next);
    };

    // ============================================
    // PLAYBOOK MANAGEMENT
    // ============================================

    const handleNewPlaybook = (name?: string) => {
        const newPlaybook: Playbook = {
            id: crypto.randomUUID(),
            name: name || `Playbook ${playbooks.length + 1}`,
            entries: [],
            gridConfig: { columnNames: ['A', 'B', 'C', 'D', 'E'] },
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        setPlaybooks(prev => [...prev, newPlaybook]);
        setCurrentPlaybookId(newPlaybook.id);
        setCurrentPlayId(null);
        setSelectedPlayerId(null);
        return newPlaybook;
    };

    const handleDeletePlaybook = (id: string) => {
        if (playbooks.length <= 1) {
            alert('Cannot delete the last playbook');
            return;
        }
        setPlaybooks(prev => prev.filter(pb => pb.id !== id));
        if (currentPlaybookId === id) {
            const remaining = playbooks.filter(pb => pb.id !== id);
            setCurrentPlaybookId(remaining[0]?.id || '');
            setCurrentPlayId(null);
            setSelectedPlayerId(null);
        }
    };

    const handleRenamePlaybook = (id: string, name: string) => {
        setPlaybooks(prev => prev.map(pb =>
            pb.id === id ? { ...pb, name, updatedAt: Date.now() } : pb
        ));
    };

    // ============================================
    // PLAY MANAGEMENT
    // ============================================

    const handleNewPlay = () => {
        const defaultPlayers: Player[] = [
            { id: crypto.randomUUID(), role: 'C',    label: '', color: POSITIONS['C'].color,    position: getPos(0,   -1), routes: [] },
            { id: crypto.randomUUID(), role: 'QB',   label: '', color: POSITIONS['QB'].color,   position: getPos(0,   -4), routes: [] },
            { id: crypto.randomUUID(), role: 'WR-L', label: '', color: POSITIONS['WR-L'].color, position: getPos(-10, -1), routes: [] },
            { id: crypto.randomUUID(), role: 'WR-R', label: '', color: POSITIONS['WR-R'].color, position: getPos(10,  -1), routes: [] },
            { id: crypto.randomUUID(), role: 'SR',   label: '', color: POSITIONS['SR'].color,   position: getPos(5,   -1), routes: [] },
        ];

        const newPlay: Play = {
            id: crypto.randomUUID(),
            name: `Play ${globalPlays.length + 1}`,
            players: defaultPlayers
        };

        setGlobalPlays(prev => [...prev, newPlay]);

        setCurrentPlayId(newPlay.id);
        setSelectedPlayerId(null);
        return newPlay;
    };

    const handleDeletePlay = (id: string) => {
        // Plays are global — delete from the pool and all playbook entries
        setGlobalPlays(prev => prev.filter(p => p.id !== id));
        setPlaybooks(prev => prev.map(pb => ({
            ...pb,
            entries: pb.entries.filter(e => e.playId !== id),
            updatedAt: Date.now()
        })));
        if (currentPlayId === id) setCurrentPlayId(null);
    };

    const handleMirrorPlay = (id: string) => {
        const src = globalPlays.find(p => p.id === id);
        if (!src) return;
        const mx = (x: number) => FIELD_PIXEL_WIDTH - x;
        const mirroredPlay: Play = {
            ...src,
            id: crypto.randomUUID(),
            name: `${src.name} (Mirror)`,
            players: src.players.map(player => ({
                ...player,
                id: crypto.randomUUID(),
                position: { ...player.position, x: mx(player.position.x) },
                motion: player.motion ? { ...player.motion, x: mx(player.motion.x) } : null,
                routes: player.routes.map(route => ({
                    ...route,
                    id: crypto.randomUUID(),
                    points: route.points.map(pt => ({ ...pt, x: mx(pt.x) }))
                }))
            }))
        };
        setGlobalPlays(prev => [...prev, mirroredPlay]);
        setCurrentPlayId(mirroredPlay.id);
        setSelectedPlayerId(null);
    };

    const handleCopyPlay = (id: string) => {
        const playToCopy = globalPlays.find(p => p.id === id);
        if (!playToCopy) return;

        const copiedPlay: Play = {
            ...playToCopy,
            id: crypto.randomUUID(),
            name: `${playToCopy.name} (Copy)`,
            players: playToCopy.players.map(player => ({
                ...player,
                id: crypto.randomUUID(),
                routes: player.routes.map(route => ({
                    ...route,
                    id: crypto.randomUUID()
                }))
            }))
        };

        setGlobalPlays(prev => [...prev, copiedPlay]);
        updateCurrentPlaybook(pb => ({
            ...pb,
            entries: [...pb.entries, { playId: copiedPlay.id }]
        }));
        setCurrentPlayId(copiedPlay.id);
    };

    const handleUpdatePlayName = (id: string, name: string) => {
        setGlobalPlays(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    };

    const handleUpdatePlayTags = (id: string, tags: PlayTag[]) => {
        setGlobalPlays(prev => prev.map(p => p.id === id ? { ...p, tags } : p));
    };

    // ============================================
    // PLAYER MANAGEMENT
    // ============================================

    const handleUpdatePlayer = (id: string, updates: Partial<Player>) => {
        if (!currentPlay) return;

        const player = currentPlay.players.find(p => p.id === id);
        if (!player) return;

        const updatedPlayer = { ...player, ...updates };

        if (updates.position && player.routes.length > 0) {
            const dx = updates.position.x - player.position.x;
            const dy = updates.position.y - player.position.y;
            updatedPlayer.routes = player.routes.map(r => ({
                ...r,
                points: r.points.map(pt => clampPoint({ x: pt.x + dx, y: pt.y + dy }))
            }));
        }

        updateCurrentPlay({
            ...currentPlay,
            players: currentPlay.players.map(p => p.id === id ? updatedPlayer : p)
        });
    };

    const handleSetPosition = (role: string) => {
        if (!selectedPlayer || !currentPlay) return;
        const positionData = POSITIONS[role as keyof typeof POSITIONS];
        if (!positionData) return;
        pushToUndoStack();
        handleUpdatePlayer(selectedPlayer.id, {
            role,
            position: getPos(positionData.x, positionData.depth),
            color: positionData.color
        });
    };

    const handleFormation = (type: 'strong-left' | 'strong-right') => {
        if (!currentPlay) return;
        pushToUndoStack();

        const formations = {
            'strong-left': [
                { role: 'C',    x: 0,   y: -1 },
                { role: 'QB',   x: 0,   y: -4 },
                { role: 'WR-L', x: -10, y: -1 },
                { role: 'WR-R', x: 10,  y: -1 },
                { role: 'SR',   x: -5,  y: -1 },
            ],
            'strong-right': [
                { role: 'C',    x: 0,   y: -1 },
                { role: 'QB',   x: 0,   y: -4 },
                { role: 'WR-L', x: -10, y: -1 },
                { role: 'WR-R', x: 10,  y: -1 },
                { role: 'SR',   x: 5,   y: -1 },
            ]
        };

        const formation = formations[type];
        const updatedPlayers = currentPlay.players.map((player, index) => {
            const formationPos = formation[index];
            if (!formationPos) return player;
            return {
                ...player,
                role: formationPos.role,
                position: getPos(formationPos.x, formationPos.y),
                color: POSITIONS[formationPos.role as keyof typeof POSITIONS]?.color || player.color,
                routes: [],
                motion: null
            };
        });

        updateCurrentPlay({ ...currentPlay, players: updatedPlayers });
    };

    // ============================================
    // ROUTE MANAGEMENT
    // ============================================

    const calculateRouteStart = (player: Player): Point => {
        return player.motion || player.position;
    };

    const handleApplyRoute = (preset: RoutePreset, routeType: RouteType) => {
        if (!selectedPlayer || !currentPlay) return;
        pushToUndoStack();

        const existingRoute = selectedPlayer.routes.find(r => r.type === routeType);
        if (existingRoute?.preset === preset) {
            updateCurrentPlay({
                ...currentPlay,
                players: currentPlay.players.map(p =>
                    p.id === selectedPlayer.id
                        ? { ...p, routes: p.routes.filter(r => r.type !== routeType) }
                        : p
                )
            });
            return;
        }

        const startPos = calculateRouteStart(selectedPlayer);
        const points = generateRoutePoints(startPos, preset);

        const newRoute: RouteSegment = {
            id: crypto.randomUUID(),
            type: routeType,
            points,
            preset
        };

        updateCurrentPlay({
            ...currentPlay,
            players: currentPlay.players.map(p =>
                p.id === selectedPlayer.id
                    ? { ...p, routes: [...p.routes.filter(r => r.type !== routeType), newRoute] }
                    : p
            )
        });
    };

    const clearRoutes = () => {
        if (!selectedPlayer || !currentPlay) return;
        pushToUndoStack();
        updateCurrentPlay({
            ...currentPlay,
            players: currentPlay.players.map(p =>
                p.id === selectedPlayer.id ? { ...p, routes: [] } : p
            )
        });
    };

    // ============================================
    // MOTION MANAGEMENT
    // ============================================

    const handleMotionSet = (targetPlayerId: string) => {
        if (!selectedPlayer || !currentPlay || selectedPlayer.id === targetPlayerId) {
            setIsSettingMotion(false);
            return;
        }
        pushToUndoStack();

        const targetPlayer = currentPlay.players.find(p => p.id === targetPlayerId);
        if (!targetPlayer) return;

        const motionTarget = clampPoint(targetPlayer.position);
        const dx = motionTarget.x - (selectedPlayer.motion?.x || selectedPlayer.position.x);
        const dy = motionTarget.y - (selectedPlayer.motion?.y || selectedPlayer.position.y);

        updateCurrentPlay({
            ...currentPlay,
            players: currentPlay.players.map(p =>
                p.id === selectedPlayer.id
                    ? {
                        ...p,
                        motion: motionTarget,
                        routes: p.routes.map(r => ({
                            ...r,
                            points: r.points.map(pt => clampPoint({ x: pt.x + dx, y: pt.y + dy }))
                        }))
                    }
                    : p
            )
        });

        setIsSettingMotion(false);
    };

    const handleClearMotion = () => {
        if (!selectedPlayer || !currentPlay || !selectedPlayer.motion) return;
        pushToUndoStack();

        const dx = selectedPlayer.position.x - selectedPlayer.motion.x;
        const dy = selectedPlayer.position.y - selectedPlayer.motion.y;

        updateCurrentPlay({
            ...currentPlay,
            players: currentPlay.players.map(p =>
                p.id === selectedPlayer.id
                    ? {
                        ...p,
                        motion: null,
                        routes: p.routes.map(r => ({
                            ...r,
                            points: r.points.map(pt => clampPoint({ x: pt.x + dx, y: pt.y + dy }))
                        }))
                    }
                    : p
            )
        });
    };

    // ============================================
    // FOLDER MANAGEMENT
    // ============================================

    const handleCreateFolder = (name: string, parentId?: string) => {
        const maxOrder = folders.filter(f => f.parentId === parentId).reduce((m, f) => Math.max(m, f.order), -1);
        const newFolder: PlayFolder = {
            id: crypto.randomUUID(),
            name,
            isExpanded: true,
            order: maxOrder + 1,
            ...(parentId ? { parentId } : {})
        };
        setFolders(prev => [...prev, newFolder]);
    };

    const handleDeleteFolder = (id: string) => {
        // Collect ids to remove: the folder itself + all sub-folders
        setFolders(prev => {
            const toRemove = new Set<string>([id]);
            prev.forEach(f => { if (f.parentId === id) toRemove.add(f.id); });
            // Clear folderId on plays that belonged to removed folders
            setGlobalPlays(gp => gp.map(p =>
                p.folderId && toRemove.has(p.folderId) ? { ...p, folderId: undefined } : p
            ));
            return prev.filter(f => !toRemove.has(f.id));
        });
    };

    const handleRenameFolder = (id: string, name: string) => {
        setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
    };

    const handleToggleFolder = (id: string) => {
        setFolders(prev => prev.map(f => f.id === id ? { ...f, isExpanded: !f.isExpanded } : f));
    };

    const handleAssignPlayToFolder = (playId: string, folderId: string | undefined) => {
        setGlobalPlays(prev => prev.map(p =>
            p.id === playId ? { ...p, folderId } : p
        ));
    };

    const handleReorderPlayInFolder = (draggedId: string, targetId: string, folderId: string | undefined) => {
        setGlobalPlays(prev => {
            const arr = [...prev];
            const draggedIdx = arr.findIndex(p => p.id === draggedId);
            const targetIdx = arr.findIndex(p => p.id === targetId);
            if (draggedIdx === -1 || targetIdx === -1 || draggedIdx === targetIdx) return prev;
            const [dragged] = arr.splice(draggedIdx, 1);
            const insertAt = arr.findIndex(p => p.id === targetId);
            arr.splice(insertAt, 0, { ...dragged, folderId });
            return arr;
        });
    };

    const handleAutoSortByTags = () => {
        // Collect unique tag texts across all plays
        const tagSet = new Set<string>();
        globalPlays.forEach(p => (p.tags || []).forEach(t => tagSet.add(t.text)));
        const tagNames = Array.from(tagSet);

        // Create one top-level folder per tag text (if not already existing with same name)
        const existingNames = new Map(folders.filter(f => !f.parentId).map(f => [f.name, f.id]));
        const tagFolderIds = new Map<string, string>();
        const newFolders: PlayFolder[] = [];
        let order = folders.filter(f => !f.parentId).reduce((m, f) => Math.max(m, f.order), -1) + 1;

        tagNames.forEach(tag => {
            if (existingNames.has(tag)) {
                tagFolderIds.set(tag, existingNames.get(tag)!);
            } else {
                const id = crypto.randomUUID();
                newFolders.push({ id, name: tag, isExpanded: true, order: order++ });
                tagFolderIds.set(tag, id);
            }
        });

        setFolders(prev => [...prev, ...newFolders]);

        // Assign plays to first matched tag folder
        setGlobalPlays(prev => prev.map(p => {
            const firstTag = (p.tags || [])[0];
            if (!firstTag) return p;
            const fid = tagFolderIds.get(firstTag.text);
            return fid ? { ...p, folderId: fid } : p;
        }));
    };

    const handleAutoSortByFormation = () => {
        const detected = new Set<string>();
        globalPlays.forEach(p => {
            const kw = detectFormation(p.name);
            if (kw) detected.add(kw);
        });
        const keywords = Array.from(detected);

        const existingNames = new Map(folders.filter(f => !f.parentId).map(f => [f.name, f.id]));
        const kwFolderIds = new Map<string, string>();
        const newFolders: PlayFolder[] = [];
        let order = folders.filter(f => !f.parentId).reduce((m, f) => Math.max(m, f.order), -1) + 1;

        keywords.forEach(kw => {
            if (existingNames.has(kw)) {
                kwFolderIds.set(kw, existingNames.get(kw)!);
            } else {
                const id = crypto.randomUUID();
                newFolders.push({ id, name: kw, isExpanded: true, order: order++ });
                kwFolderIds.set(kw, id);
            }
        });

        setFolders(prev => [...prev, ...newFolders]);

        setGlobalPlays(prev => prev.map(p => {
            const kw = detectFormation(p.name);
            if (!kw) return p;
            const fid = kwFolderIds.get(kw);
            return fid ? { ...p, folderId: fid } : p;
        }));
    };

    // ============================================
    // SAVED ROUTES
    // ============================================

    const handleSaveRoute = (name: string, routeType: RouteType) => {
        if (!selectedPlayer) return;
        const route = selectedPlayer.routes.find(r => r.type === routeType);
        if (!route || route.points.length < 2) return;
        const start = route.points[0];
        const relativePoints = route.points.map(p => ({ x: p.x - start.x, y: p.y - start.y }));
        setSavedRoutes(prev => [...prev, { id: crypto.randomUUID(), name, relativePoints }]);
    };

    const handleDeleteSavedRoute = (id: string) => {
        setSavedRoutes(prev => prev.filter(r => r.id !== id));
    };

    const handleApplySavedRoute = (savedRouteId: string, routeType: RouteType) => {
        if (!selectedPlayer || !currentPlay) return;
        const saved = savedRoutes.find(r => r.id === savedRouteId);
        if (!saved) return;
        pushToUndoStack();
        const startPos = calculateRouteStart(selectedPlayer);
        const points = saved.relativePoints.map(p =>
            clampPoint({ x: startPos.x + p.x, y: startPos.y + p.y })
        );
        const newRoute: RouteSegment = { id: crypto.randomUUID(), type: routeType, points };
        updateCurrentPlay({
            ...currentPlay,
            players: currentPlay.players.map(p =>
                p.id === selectedPlayer.id
                    ? { ...p, routes: [...p.routes.filter(r => r.type !== routeType), newRoute] }
                    : p
            )
        });
    };

    // ============================================
    // IMPORT / EXPORT
    // ============================================

    const handleImportData = useCallback((data: string) => {
        try {
            const imported = JSON.parse(data);

            const importPlaybook = (pb: any) => {
                const newId = crypto.randomUUID();

                // Extract plays into global store
                const incomingPlays: Play[] = (pb.plays || []).map((p: any) => {
                    const { gridPosition: _gp, ...globalPlay } = p;
                    return { ...globalPlay, id: p.id || crypto.randomUUID() };
                });

                const entries: PlaybookEntry[] = (pb.plays || []).map((p: any) => ({
                    playId: p.id,
                    ...(p.gridPosition ? { gridPosition: p.gridPosition } : {})
                }));

                setGlobalPlays(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    return [...prev, ...incomingPlays.filter(p => !existingIds.has(p.id))];
                });

                const newPlaybook: Playbook = {
                    id: newId,
                    name: pb.name || 'Imported Playbook',
                    entries: pb.entries || entries,
                    gridConfig: pb.gridConfig || { columnNames: ['A', 'B', 'C', 'D', 'E'] },
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                setPlaybooks(prev => [...prev, newPlaybook]);
            };

            if (Array.isArray(imported)) {
                if (imported.length === 0) return true;
                const isPlaybookArray = 'plays' in imported[0] || 'entries' in imported[0];
                if (isPlaybookArray) {
                    imported.forEach(importPlaybook);
                } else {
                    // Array of plays — wrap in a playbook
                    const fakePlaybook = { name: 'Imported Plays', plays: imported };
                    importPlaybook(fakePlaybook);
                }
            } else if (typeof imported === 'object' && imported !== null) {
                if ('plays' in imported || 'entries' in imported) {
                    importPlaybook(imported);
                } else if ('players' in imported) {
                    importPlaybook({ name: imported.name || 'Imported Play', plays: [imported] });
                }
            }
            return true;
        } catch (error) {
            console.error('Failed to import playbook:', error);
            alert('Failed to import playbook. Please check the data format.');
            return false;
        }
    }, []);

    const handleImportPlaybook = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            handleImportData(e.target?.result as string);
        };
        reader.readAsText(file);
    };

    // ============================================
    // GRID MANAGEMENT
    // ============================================

    const handleUpdateColumnName = (index: number, name: string) => {
        updateCurrentPlaybook(pb => ({
            ...pb,
            gridConfig: {
                ...pb.gridConfig,
                columnNames: pb.gridConfig.columnNames.map((col, i) => i === index ? name : col)
            }
        }));
    };

    const handleAddColumn = () => {
        updateCurrentPlaybook(pb => {
            const nextCharCode = 65 + pb.gridConfig.columnNames.length;
            return {
                ...pb,
                gridConfig: {
                    ...pb.gridConfig,
                    columnNames: [...pb.gridConfig.columnNames, String.fromCharCode(nextCharCode)]
                }
            };
        });
    };

    const handleRemoveColumn = (index: number) => {
        updateCurrentPlaybook(pb => ({
            ...pb,
            gridConfig: {
                ...pb.gridConfig,
                columnNames: pb.gridConfig.columnNames.filter((_, i) => i !== index)
            },
            entries: pb.entries.map(e => {
                if (!e.gridPosition) return e;
                if (e.gridPosition.column === index) {
                    const { gridPosition: _gp, ...rest } = e;
                    return rest;
                }
                if (e.gridPosition.column > index) {
                    return { ...e, gridPosition: { ...e.gridPosition, column: e.gridPosition.column - 1 } };
                }
                return e;
            })
        }));
    };

    const handleAssignPlayToCell = (playId: string, row: number, col: number) => {
        updateCurrentPlaybook(pb => {
            // Evict any play already in this cell, and remove existing position for this play
            const cleaned = pb.entries
                .filter(e => e.playId !== playId)
                .map(e => {
                    if (e.gridPosition?.row === row && e.gridPosition?.column === col) {
                        const { gridPosition: _gp, ...rest } = e;
                        return rest;
                    }
                    return e;
                });
            return {
                ...pb,
                entries: [...cleaned, { playId, gridPosition: { row, column: col } }]
            };
        });
    };

    const handleRemovePlayFromCell = (row: number, col: number) => {
        updateCurrentPlaybook(pb => ({
            ...pb,
            entries: pb.entries.map(e => {
                if (e.gridPosition?.row === row && e.gridPosition?.column === col) {
                    const { gridPosition: _gp, ...rest } = e;
                    return rest;
                }
                return e;
            })
        }));
    };

    return {
        // Playbook state
        playbooks,
        currentPlaybook,
        currentPlaybookId,
        setCurrentPlaybookId,

        // Play state
        plays,
        currentPlay,
        currentPlayId,
        setCurrentPlayId,

        // Player state
        selectedPlayer,
        selectedPlayerId,
        setSelectedPlayerId,
        isSettingMotion,
        setIsSettingMotion,

        // Playbook actions
        handleNewPlaybook,
        handleDeletePlaybook,
        handleRenamePlaybook,

        // Play actions
        handleNewPlay,
        handleDeletePlay,
        handleCopyPlay,
        handleMirrorPlay,
        handleUpdatePlayName,
        handleUpdatePlayTags,

        // Player actions
        handleUpdatePlayer,
        handleSetPosition,
        handleFormation,

        // Route actions
        handleApplyRoute,
        clearRoutes,
        calculateRouteStart,

        // Motion actions
        handleMotionSet,
        handleClearMotion,

        // Import/Export
        handleImportPlaybook,
        handleImportData,

        // Undo/Redo
        pushToUndoStack,
        undo,
        redo,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,

        // Helpers
        updateCurrentPlay,

        // Grid
        columnNames,
        handleUpdateColumnName,
        handleAddColumn,
        handleRemoveColumn,
        handleAssignPlayToCell,
        handleRemovePlayFromCell,

        // Saved routes
        savedRoutes,
        handleSaveRoute,
        handleDeleteSavedRoute,
        handleApplySavedRoute,

        // Folders
        folders,
        handleCreateFolder,
        handleDeleteFolder,
        handleRenameFolder,
        handleToggleFolder,
        handleAssignPlayToFolder,
        handleReorderPlayInFolder,
        handleAutoSortByTags,
        handleAutoSortByFormation,
    };
}
