import { useState, useEffect } from 'react';
import type { Playbook, Play, Player, Point, RouteSegment, RouteType, PlayTag } from '@/types';
import { POSITIONS, getPos, clampPoint } from '@/lib/constants';
import { generateRoutePoints } from '@/lib/routes';
import type { RoutePreset } from '@/lib/routes';

// Migration helper: Convert old format to new format
function migrateOldData(): Playbook[] {
    const oldPlays = localStorage.getItem('savedPlays');
    const oldColumns = localStorage.getItem('playbookGridColumns');

    if (oldPlays) {
        const plays: Play[] = JSON.parse(oldPlays);
        const columnNames = oldColumns ? JSON.parse(oldColumns) : ['A', 'B', 'C', 'D', 'E'];

        const defaultPlaybook: Playbook = {
            id: crypto.randomUUID(),
            name: 'defaultPlaybook',
            plays,
            gridConfig: { columnNames },
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // Clear old data
        localStorage.removeItem('savedPlays');
        localStorage.removeItem('playbookGridColumns');

        return [defaultPlaybook];
    }

    return [];
}

export function usePlaybook() {
    // Initialize playbooks with migration
    const [playbooks, setPlaybooks] = useState<Playbook[]>(() => {
        const saved = localStorage.getItem('playbooks');
        if (saved) {
            return JSON.parse(saved);
        }

        // Try to migrate old data
        const migrated = migrateOldData();
        if (migrated.length > 0) {
            return migrated;
        }

        // Create default playbook
        return [{
            id: crypto.randomUUID(),
            name: 'defaultPlaybook',
            plays: [],
            gridConfig: { columnNames: ['A', 'B', 'C', 'D', 'E'] },
            createdAt: Date.now(),
            updatedAt: Date.now()
        }];
    });

    const [currentPlaybookId, setCurrentPlaybookId] = useState<string>(() => {
        const saved = localStorage.getItem('currentPlaybookId');
        return saved || playbooks[0]?.id || '';
    });

    const [currentPlayId, setCurrentPlayId] = useState<string | null>(null);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [isSettingMotion, setIsSettingMotion] = useState(false);

    const currentPlaybook = playbooks.find(pb => pb.id === currentPlaybookId) || playbooks[0] || null;
    const plays = currentPlaybook?.plays || [];
    const currentPlay = plays.find(p => p.id === currentPlayId) || null;
    const selectedPlayer = currentPlay?.players.find(p => p.id === selectedPlayerId) || null;
    const columnNames = currentPlaybook?.gridConfig.columnNames || ['A', 'B', 'C', 'D', 'E'];

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem('playbooks', JSON.stringify(playbooks));
    }, [playbooks]);

    useEffect(() => {
        localStorage.setItem('currentPlaybookId', currentPlaybookId);
    }, [currentPlaybookId]);

    // Update current playbook
    const updateCurrentPlaybook = (updater: (pb: Playbook) => Playbook) => {
        setPlaybooks(prev => prev.map(pb =>
            pb.id === currentPlaybookId ? { ...updater(pb), updatedAt: Date.now() } : pb
        ));
    };

    const updateCurrentPlay = (updatedPlay: Play) => {
        updateCurrentPlaybook(pb => ({
            ...pb,
            plays: pb.plays.map(p => p.id === updatedPlay.id ? updatedPlay : p)
        }));
    };

    // ============================================
    // PLAYBOOK MANAGEMENT
    // ============================================

    const handleNewPlaybook = (name?: string) => {
        const newPlaybook: Playbook = {
            id: crypto.randomUUID(),
            name: name || `Playbook ${playbooks.length + 1}`,
            plays: [],
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
            { id: crypto.randomUUID(), role: 'C', label: '', color: POSITIONS['C'].color, position: getPos(0, -1), routes: [] },
            { id: crypto.randomUUID(), role: 'QB', label: '', color: POSITIONS['QB'].color, position: getPos(0, -4), routes: [] },
            { id: crypto.randomUUID(), role: 'WR-L', label: '', color: POSITIONS['WR-L'].color, position: getPos(-10, -1), routes: [] },
            { id: crypto.randomUUID(), role: 'WR-R', label: '', color: POSITIONS['WR-R'].color, position: getPos(10, -1), routes: [] },
            { id: crypto.randomUUID(), role: 'SR', label: '', color: POSITIONS['SR'].color, position: getPos(5, -1), routes: [] },
        ];

        const newPlay: Play = {
            id: crypto.randomUUID(),
            name: `Play ${plays.length + 1}`,
            players: defaultPlayers
        };

        updateCurrentPlaybook(pb => ({
            ...pb,
            plays: [...pb.plays, newPlay]
        }));

        setCurrentPlayId(newPlay.id);
        setSelectedPlayerId(null);
        return newPlay;
    };

    const handleDeletePlay = (id: string) => {
        updateCurrentPlaybook(pb => ({
            ...pb,
            plays: pb.plays.filter(p => p.id !== id)
        }));

        if (currentPlayId === id) {
            setCurrentPlayId(null);
        }
    };

    const handleCopyPlay = (id: string) => {
        const playToCopy = plays.find(p => p.id === id);
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
            })),
            gridPosition: undefined // Don't copy grid position
        };

        updateCurrentPlaybook(pb => ({
            ...pb,
            plays: [...pb.plays, copiedPlay]
        }));

        setCurrentPlayId(copiedPlay.id);
    };

    const handleUpdatePlayName = (id: string, name: string) => {
        updateCurrentPlaybook(pb => ({
            ...pb,
            plays: pb.plays.map(p => p.id === id ? { ...p, name } : p)
        }));
    };

    const handleUpdatePlayTags = (id: string, tags: PlayTag[]) => {
        updateCurrentPlaybook(pb => ({
            ...pb,
            plays: pb.plays.map(p => p.id === id ? { ...p, tags } : p)
        }));
    };

    // ============================================
    // PLAYER MANAGEMENT
    // ============================================

    const handleUpdatePlayer = (id: string, updates: Partial<Player>) => {
        if (!currentPlay) return;

        const player = currentPlay.players.find(p => p.id === id);
        if (!player) return;

        const updatedPlayer = { ...player, ...updates };

        // If position changed and player has routes, shift them
        if (updates.position && player.routes.length > 0) {
            const dx = updates.position.x - player.position.x;
            const dy = updates.position.y - player.position.y;

            // Calculate route shift based on motion
            const routeShift = player.motion
                ? { x: dx, y: dy }
                : { x: dx, y: dy };

            updatedPlayer.routes = player.routes.map(r => ({
                ...r,
                points: r.points.map(pt => clampPoint({
                    x: pt.x + routeShift.x,
                    y: pt.y + routeShift.y
                }))
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

        handleUpdatePlayer(selectedPlayer.id, {
            role,
            position: getPos(positionData.x, positionData.depth),
            color: positionData.color
        });
    };

    const handleFormation = (type: 'strong-left' | 'strong-right') => {
        if (!currentPlay) return;

        const formations = {
            'strong-left': [
                { role: 'C', x: 0, y: -1 },
                { role: 'QB', x: 0, y: -4 },
                { role: 'WR-L', x: -10, y: -1 },
                { role: 'WR-R', x: 10, y: -1 },
                { role: 'SR', x: -5, y: -1 },
            ],
            'strong-right': [
                { role: 'C', x: 0, y: -1 },
                { role: 'QB', x: 0, y: -4 },
                { role: 'WR-L', x: -10, y: -1 },
                { role: 'WR-R', x: 10, y: -1 },
                { role: 'SR', x: 5, y: -1 },
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

        updateCurrentPlay({
            ...currentPlay,
            players: updatedPlayers
        });
    };

    // ============================================
    // ROUTE MANAGEMENT
    // ============================================

    const calculateRouteStart = (player: Player): Point => {
        return player.motion || player.position;
    };

    const handleApplyRoute = (preset: RoutePreset, routeType: RouteType) => {
        if (!selectedPlayer || !currentPlay) return;

        // Toggle: If this preset is already applied to this specific route type, remove it
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
            preset // Store the preset ID for highlighting/toggling
        };

        const updatedPlayer = {
            ...selectedPlayer,
            routes: [...selectedPlayer.routes.filter(r => r.type !== routeType), newRoute]
        };

        updateCurrentPlay({
            ...currentPlay,
            players: currentPlay.players.map(p =>
                p.id === selectedPlayer.id ? updatedPlayer : p
            )
        });
    };

    const clearRoutes = () => {
        if (!selectedPlayer || !currentPlay) return;

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

        const targetPlayer = currentPlay.players.find(p => p.id === targetPlayerId);
        if (!targetPlayer) return;

        const motionTarget = clampPoint(targetPlayer.position);
        const dx = motionTarget.x - (selectedPlayer.motion?.x || selectedPlayer.position.x);
        const dy = motionTarget.y - (selectedPlayer.motion?.y || selectedPlayer.position.y);

        const updatedPlayer = {
            ...selectedPlayer,
            motion: motionTarget,
            routes: selectedPlayer.routes.map(r => ({
                ...r,
                points: r.points.map(pt => clampPoint({ x: pt.x + dx, y: pt.y + dy }))
            }))
        };

        updateCurrentPlay({
            ...currentPlay,
            players: currentPlay.players.map(p =>
                p.id === selectedPlayer.id ? updatedPlayer : p
            )
        });

        setIsSettingMotion(false);
    };

    const handleClearMotion = () => {
        if (!selectedPlayer || !currentPlay || !selectedPlayer.motion) return;

        const dx = selectedPlayer.position.x - selectedPlayer.motion.x;
        const dy = selectedPlayer.position.y - selectedPlayer.motion.y;

        const updatedPlayer = {
            ...selectedPlayer,
            motion: null,
            routes: selectedPlayer.routes.map(r => ({
                ...r,
                points: r.points.map(pt => clampPoint({ x: pt.x + dx, y: pt.y + dy }))
            }))
        };

        updateCurrentPlay({
            ...currentPlay,
            players: currentPlay.players.map(p =>
                p.id === selectedPlayer.id ? updatedPlayer : p
            )
        });
    };

    // ============================================
    // IMPORT/EXPORT
    // ============================================

    const handleImportData = (data: string) => {
        try {
            const imported = JSON.parse(data);

            // 1. Array handling
            if (Array.isArray(imported)) {
                if (imported.length === 0) return true;

                // Check if it's an array of Playbooks or an array of Plays
                const isPlaybookArray = 'plays' in imported[0];

                if (isPlaybookArray) {
                    // New format: array of multiple playbooks
                    const importedPlaybooks: Playbook[] = imported.map(pb => ({
                        ...pb,
                        id: crypto.randomUUID(),
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    }));
                    setPlaybooks(prev => [...prev, ...importedPlaybooks]);
                } else {
                    // Old format: array of plays export
                    const newPlaybook: Playbook = {
                        id: crypto.randomUUID(),
                        name: 'Imported Plays',
                        plays: imported.map((p: any) => ({ ...p, id: crypto.randomUUID() })),
                        gridConfig: { columnNames: ['A', 'B', 'C', 'D', 'E'] },
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    };
                    setPlaybooks(prev => [...prev, newPlaybook]);
                }
            }
            // 2. Single object handling
            else if (typeof imported === 'object' && imported !== null) {
                if ('plays' in imported) {
                    // Single Playbook object
                    const newPlaybook: Playbook = {
                        ...imported,
                        id: crypto.randomUUID(),
                        name: imported.name || 'Imported Playbook',
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    };
                    setPlaybooks(prev => [...prev, newPlaybook]);
                } else if ('players' in imported) {
                    // Single Play object
                    const newPlaybook: Playbook = {
                        id: crypto.randomUUID(),
                        name: imported.name || 'Imported Play',
                        plays: [{ ...imported, id: crypto.randomUUID() }],
                        gridConfig: { columnNames: ['A', 'B', 'C', 'D', 'E'] },
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    };
                    setPlaybooks(prev => [...prev, newPlaybook]);
                }
            }
            return true;
        } catch (error) {
            console.error('Failed to import playbook:', error);
            alert('Failed to import playbook. Please check the data format.');
            return false;
        }
    };

    const handleImportPlaybook = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result as string;
            handleImportData(data);
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

    const handleAssignPlayToCell = (playId: string, row: number, col: number) => {
        updateCurrentPlaybook(pb => ({
            ...pb,
            plays: pb.plays.map(p => {
                if (p.id === playId) {
                    return { ...p, gridPosition: { row, column: col } };
                }
                // Remove any other play from this cell
                if (p.gridPosition?.row === row && p.gridPosition?.column === col) {
                    const { gridPosition, ...rest } = p;
                    return rest as Play;
                }
                return p;
            })
        }));
    };

    const handleRemovePlayFromCell = (row: number, col: number) => {
        updateCurrentPlaybook(pb => ({
            ...pb,
            plays: pb.plays.map(p => {
                if (p.gridPosition?.row === row && p.gridPosition?.column === col) {
                    const { gridPosition, ...rest } = p;
                    return rest as Play;
                }
                return p;
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

        // Helpers
        updateCurrentPlay,

        // Grid
        columnNames,
        handleUpdateColumnName,
        handleAssignPlayToCell,
        handleRemovePlayFromCell,
    };
}
