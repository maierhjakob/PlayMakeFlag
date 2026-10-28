import { S, FIELD_PIXEL_WIDTH, getPos } from '@/lib/constants';
import type { Play, PlayFolder, Player } from '@/types';

// Plays are grouped automatically: first by formation, then by how many players run a primary
// route past the 10 yard line.

// ============================================
// FORMATION
// ============================================

// A receiver within this many yards of the center (left or right) is "tight"
const TIGHT_YARDS = 4;
// Two receivers on the same side within this many yards of each other form a "Double"
const DOUBLE_YARDS = 3;

// In folder order
export const FORMATIONS = ['spread', 'twins', 'trips', 'tight', 'double', 'overload'] as const;
export type Formation = typeof FORMATIONS[number];

export const FORMATION_NAMES: Record<Formation, string> = {
    spread: 'Spread',
    twins: 'Twins',
    trips: 'Trips',
    tight: 'Tight',
    double: 'Double',
    overload: 'Overload',
};

/**
 * Receiver alignments (yards from the center, left to right) for each formation, strong side right.
 * Each one is detected as its own formation by detectFormation; mirror the x for strong side left.
 */
export const FORMATION_ALIGNMENTS: Record<Formation, number[]> = {
    // Spread / Twins / Double: weak side receiver on the quarter of the field (6.25 yd, on the 0.5 yd grid)
    spread: [-6.5, 5, 10],
    twins: [-6.5, 2, 10],
    trips: [-2, 2, 10],
    // Same 2 yd spacing as the inside receivers in Trips
    tight: [-2, 2, 4],
    // Strong side pair side by side around the quarter of the field (5.5 / 7, centered on 6.25)
    double: [-6.5, 5.5, 7],
    // The weak side receiver (farthest from its usual spot) 2 yd from the center like in Tight,
    // the slot halfway between it and the outside receiver
    overload: [2, 6, 10],
};

/** Formation from where the receivers stand after motion, relative to the center. */
export const detectFormation = (play: Play): Formation => {
    const alignedX = (p: Player) => (p.motion ?? p.position).x;
    const center = play.players.find(p => p.role === 'C');
    const centerX = center ? alignedX(center) : FIELD_PIXEL_WIDTH / 2;
    const receivers = play.players
        .filter(p => p.role !== 'QB' && p.role !== 'C')
        .map(p => (alignedX(p) - centerX) / S);
    if (receivers.length === 0) return 'spread';

    const tightCount = receivers.filter(x => Math.abs(x) <= TIGHT_YARDS).length;
    if (tightCount === receivers.length) return 'tight';
    if (tightCount >= 2) return 'trips';
    if (receivers.every(x => x < 0) || receivers.every(x => x > 0)) return 'overload';
    if (tightCount === 1) return 'twins';

    const sameSideClose = receivers.some((a, i) =>
        receivers.some((b, j) => i < j && Math.sign(a) === Math.sign(b) && Math.abs(a - b) <= DOUBLE_YARDS)
    );
    return sameSideClose ? 'double' : 'spread';
};

// ============================================
// DEPTH
// ============================================

const TEN_YARD_LINE_Y = getPos(0, 10).y;

export const countPlayersOver10 = (play: Play): number =>
    play.players.filter(player =>
        player.routes.some(r => r.type === 'primary' && r.points.some(p => p.y < TEN_YARD_LINE_Y))
    ).length;

const depthFolderName = (count: number) =>
    count === 0 ? 'No player over 10yd' : `${count} ${count === 1 ? 'player' : 'players'} over 10yd`;

// ============================================
// FOLDERS
// ============================================

const formationFolderId = (formation: Formation) => `formation-${formation}`;

/** The (depth) sub-folder a play belongs in. */
export const playFolderId = (play: Play) =>
    `${formationFolderId(detectFormation(play))}/deep-${countPlayersOver10(play)}`;

/** Formation folders (in FORMATIONS order) with a depth sub-folder per player count that occurs. */
export const buildPlayFolders = (plays: Play[], collapsedIds: Set<string>): PlayFolder[] => {
    const folder = (id: string, name: string, order: number, parentId?: string): PlayFolder => ({
        id, name, order, isExpanded: !collapsedIds.has(id), ...(parentId ? { parentId } : {}),
    });

    const countsByFormation = new Map<Formation, Set<number>>();
    for (const play of plays) {
        const formation = detectFormation(play);
        if (!countsByFormation.has(formation)) countsByFormation.set(formation, new Set());
        countsByFormation.get(formation)!.add(countPlayersOver10(play));
    }

    return FORMATIONS.filter(f => countsByFormation.has(f)).flatMap((formation, order) => {
        const parentId = formationFolderId(formation);
        const counts = [...countsByFormation.get(formation)!].sort((a, b) => a - b);
        return [
            folder(parentId, FORMATION_NAMES[formation], order),
            ...counts.map(count => folder(`${parentId}/deep-${count}`, depthFolderName(count), count, parentId)),
        ];
    });
};
