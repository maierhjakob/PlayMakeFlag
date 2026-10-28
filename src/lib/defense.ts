import { S, getPos, clampPoint } from '@/lib/constants';
import type { Coverage, Defender, DefenderZone, Play, PlayDefense, Player } from '@/types';

// Defenders are stored in field coordinates like the offense (offense attacks upwards, smaller y = deeper).

export const COVERAGES: { value: Coverage; label: string; description: string }[] = [
    { value: 'man', label: 'Man', description: 'Rusher + man on every receiver' },
    { value: 'cover-1', label: 'Cover 1', description: 'Rusher + man on the wide receivers + deep safety' },
    { value: 'cover-2', label: 'Cover 2', description: 'Rusher + 2 underneath + 2 deep halves' },
    { value: 'cover-2-invert', label: 'Cover 2 Inv', description: 'Cover 2 inverted on both sides: the corners deep, the safeties underneath' },
    // Left / right as seen in the defense view (the field is turned, so that's the offense's right / left)
    { value: 'cover-2-invert-left', label: 'Cover 2 Inv L', description: 'Cover 2, inverted on the left: the outside defender deep, the inside one underneath' },
    { value: 'cover-2-invert-right', label: 'Cover 2 Inv R', description: 'Cover 2, inverted on the right: the outside defender deep, the inside one underneath' },
    { value: 'cover-3', label: 'Cover 3', description: 'Rusher + 1 underneath + 3 deep thirds' },
];

// Depths in yards from the LOS
const RUSH_DEPTH = 7; // rushers must start 7 yd off the line
const MAN_DEPTH = 4;
const UNDERNEATH_DEPTH = 5;
const DEEP_DEPTH = 12;

/** Ellipse around the defender, in yards; positive dy is deeper (downfield). */
const zone = (dxYards: number, dyYards: number, rxYards: number, ryYards: number): DefenderZone => ({
    dx: dxYards * S, dy: -dyYards * S, rx: rxYards * S, ry: ryYards * S,
});

const newDefender = (xYards: number, depthYards: number, extra: Partial<Defender> = {}): Defender => ({
    id: crypto.randomUUID(),
    position: clampPoint(getPos(xYards, depthYards)),
    ...extra,
});

/** Where an offensive player lines up at the snap (after motion). */
export const alignedPosition = (player: Player) => player.motion ?? player.position;

/** Spot for a coverage: where a defender stands and what he does there. */
type CoverageSpot = Pick<Defender, 'position' | 'manTargetId'>;

const spot = (xYards: number, depthYards: number, extra: Partial<CoverageSpot> = {}): CoverageSpot => ({
    position: clampPoint(getPos(xYards, depthYards)),
    ...extra,
});

/** Where the rusher starts: 7 yd off the ball, in front of the quarterback. */
const rushSpot = (play: Play) => {
    const qb = play.players.find(p => p.role === 'QB');
    return clampPoint(getPos(qb ? (alignedPosition(qb).x - getPos(0, 0).x) / S : 0, RUSH_DEPTH));
};

/**
 * The spots of the defenders besides the rusher: each one lines up across from a receiver (left to right,
 * where the receiver stands at the snap); the coverage decides how deep and whether he plays man.
 */
const coverageSpots = (play: Play, coverage: Coverage): CoverageSpot[] => {
    const centerX = getPos(0, 0).x;
    const receivers = play.players
        .filter(p => p.role !== 'QB')
        .sort((a, b) => alignedPosition(a).x - alignedPosition(b).x);
    const xs = receivers.map(r => (alignedPosition(r).x - centerX) / S);
    const last = receivers.length - 1;
    const isOutside = (i: number) => i === 0 || i === last;
    const over = (i: number, depth: number, extra: Partial<CoverageSpot> = {}) => spot(xs[i], depth, extra);

    // Cover 2: the outside two underneath, the inside two deep
    const cover2 = () => receivers.map((_, i) => over(i, isOutside(i) ? UNDERNEATH_DEPTH : DEEP_DEPTH));
    // Inverted on one side (sign of the offense's x): there the outside defender plays deep and the inside one
    // underneath, the other side stays Cover 2
    const cover2Invert = (side: 1 | -1) => {
        const outside = side > 0 ? last : 0;
        const inside = side > 0 ? last - 1 : 1;
        return receivers.map((_, i) => {
            if (i === outside) return over(i, DEEP_DEPTH);
            if (i === inside) return over(i, UNDERNEATH_DEPTH);
            return over(i, isOutside(i) ? UNDERNEATH_DEPTH : DEEP_DEPTH);
        });
    };

    switch (coverage) {
        case 'man':
            return receivers.map((r, i) => over(i, MAN_DEPTH, { manTargetId: r.id }));
        case 'cover-1':
            // Man on the wide receivers, the center's defender plays deep safety
            return receivers.map((r, i) => r.role === 'C' ? over(i, DEEP_DEPTH) : over(i, MAN_DEPTH, { manTargetId: r.id }));
        case 'cover-2':
            return cover2();
        case 'cover-2-invert':
            return receivers.map((_, i) => over(i, isOutside(i) ? DEEP_DEPTH : UNDERNEATH_DEPTH));
        // Left in the defense view = the offense's right (positive x)
        case 'cover-2-invert-left':
            return cover2Invert(1);
        case 'cover-2-invert-right':
            return cover2Invert(-1);
        case 'cover-3': {
            // Three deep (the outside two and the inside one closest to the middle), one underneath
            const middle = receivers
                .map((_, i) => i)
                .filter(i => !isOutside(i))
                .sort((a, b) => Math.abs(xs[a]) - Math.abs(xs[b]))[0];
            return receivers.map((_, i) => over(i, isOutside(i) || i === middle ? DEEP_DEPTH : UNDERNEATH_DEPTH));
        }
    }
};

// 5v5: the defense always has five players
export const DEFENDER_COUNT = 5;

/** Until a coverage is picked: a rusher in front of the quarterback and a defender 5 yd off each receiver. */
const startingDefenders = (play: Play): Defender[] => {
    const defenders: Defender[] = [
        { ...newDefender(0, RUSH_DEPTH, { rush: true }), position: rushSpot(play) },
        ...coverageSpots(play, 'cover-2').map(s => ({ id: crypto.randomUUID(), position: { ...s.position, y: getPos(0, UNDERNEATH_DEPTH).y } })),
    ];
    // Fewer receivers than defenders: the rest start in the middle
    while (defenders.length < DEFENDER_COUNT) defenders.push(newDefender(0, UNDERNEATH_DEPTH));
    return defenders.map((d, i) => ({ ...d, color: DEFENDER_COLORS[i % DEFENDER_COLORS.length] }));
};

/** The play's defense with all five defenders (missing ones are added across from the receivers). */
export const completeDefense = (play: Play, defense: PlayDefense | undefined): PlayDefense => {
    const defenders = defense?.defenders ?? [];
    if (defenders.length >= DEFENDER_COUNT) return defense!;
    return {
        coverage: defense?.coverage ?? null,
        defenders: [...defenders, ...startingDefenders(play).slice(defenders.length, DEFENDER_COUNT)],
    };
};

/** A defender moved to a spot; his arrow moves along. */
const moveTo = (d: Defender, position: Defender['position']): Defender => {
    const dx = position.x - d.position.x;
    const dy = position.y - d.position.y;
    return { ...d, position, path: d.path?.map(p => clampPoint({ x: p.x + dx, y: p.y + dy })) };
};

/**
 * Line the defenders up in a coverage, like the offense's formation buttons: the rusher stays where he is,
 * the other four keep their left-to-right order and colors and move to the coverage's spots (arrows move along).
 */
export const applyCoverage = (play: Play, defense: PlayDefense, coverage: Coverage): PlayDefense => {
    const defenders = defense.defenders;
    // The rusher: the defender marked as one, otherwise the one closest to the rush spot (who moves there)
    const target = rushSpot(play);
    let rusherIndex = defenders.findIndex(d => d.rush);
    const rusherMoves = rusherIndex < 0;
    if (rusherMoves) {
        const dist = (d: Defender) => Math.hypot(d.position.x - target.x, d.position.y - target.y);
        rusherIndex = defenders.reduce((best, d, i) => (dist(d) < dist(defenders[best]) ? i : best), 0);
    }

    const spots = coverageSpots(play, coverage).sort((a, b) => a.position.x - b.position.x);
    const others = defenders
        .map((d, i) => ({ d, i }))
        .filter(({ i }) => i !== rusherIndex)
        .sort((a, b) => a.d.position.x - b.d.position.x);
    const spotOf = new Map(others.map(({ i }, order) => [i, spots[order]]));

    return {
        coverage,
        defenders: defenders.map((d, i) => {
            if (i === rusherIndex) {
                const own = d.pathFromCoverage ? { ...d, path: undefined, pathFromCoverage: undefined } : d;
                return { ...(rusherMoves ? moveTo(own, target) : own), rush: true, zone: null, manTargetId: null };
            }
            // Arrows set by earlier coverage versions are dropped; drawn arrows move along
            const own = d.pathFromCoverage ? { ...d, path: undefined, pathFromCoverage: undefined } : d;
            const s = spotOf.get(i);
            // More defenders than spots (e.g. fewer receivers to cover): he stays, without assignment
            if (!s) return { ...own, rush: false, zone: null, manTargetId: null };
            const moved = moveTo(own, s.position);
            return {
                ...moved,
                rush: false,
                zone: null,
                manTargetId: s.manTargetId ?? null,
            };
        }),
    };
};

/** A new zone for a defender that had none (medium-sized, around the defender). */
export const defaultZone = (): DefenderZone => zone(0, 0.5, 4, 3);

export const mirrorDefense = (defense: PlayDefense, mirrorX: (x: number) => number): PlayDefense => ({
    ...defense,
    defenders: defense.defenders.map(d => ({
        ...d,
        position: { ...d.position, x: mirrorX(d.position.x) },
        zone: d.zone ? { ...d.zone, dx: -d.zone.dx } : d.zone,
        path: d.path?.map(p => ({ ...p, x: mirrorX(p.x) })),
    })),
});

/** Copy with new defender ids; man assignments follow the copied players (old id → new id). */
export const copyDefense = (defense: PlayDefense, playerIds: Map<string, string>): PlayDefense => ({
    ...defense,
    defenders: defense.defenders.map(d => ({
        ...d,
        id: crypto.randomUUID(),
        manTargetId: d.manTargetId ? playerIds.get(d.manTargetId) ?? null : d.manTargetId,
    })),
});

// The offense is drawn in this color while the defense is shown
export const NEUTRAL_OFFENSE_COLOR = '#64748b';

// Default defender colors (by index); a defender's zone, man line and arrows use its color
export const DEFENDER_COLORS = ['#f97316', '#a855f7', '#06b6d4', '#84cc16', '#ec4899'];

export const defenderColor = (defender: Defender, index: number) =>
    defender.color ?? DEFENDER_COLORS[index % DEFENDER_COLORS.length];
