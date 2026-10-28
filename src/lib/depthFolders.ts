import { getPos } from '@/lib/constants';
import type { Play, PlayFolder } from '@/types';

// Plays are grouped automatically by how many players run a primary route past the 10 yard line.
const TEN_YARD_LINE_Y = getPos(0, 10).y;

export const countPlayersOver10 = (play: Play): number =>
    play.players.filter(player =>
        player.routes.some(r => r.type === 'primary' && r.points.some(p => p.y < TEN_YARD_LINE_Y))
    ).length;

export const depthFolderId = (count: number) => `deep-${count}`;

const depthFolderName = (count: number) =>
    count === 0 ? 'No player over 10yd' : `${count} ${count === 1 ? 'player' : 'players'} over 10yd`;

/** One folder per player count that occurs, in ascending order. */
export const buildDepthFolders = (counts: number[], collapsedIds: Set<string>): PlayFolder[] =>
    [...new Set(counts)].sort((a, b) => a - b).map(count => ({
        id: depthFolderId(count),
        name: depthFolderName(count),
        isExpanded: !collapsedIds.has(depthFolderId(count)),
        order: count,
    }));
