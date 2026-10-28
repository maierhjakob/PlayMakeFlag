import { S, FIELD_PIXEL_WIDTH, getPos } from '@/lib/constants';
import { ROUTE_PRESETS, generateRoutePoints, type RoutePreset } from '@/lib/routes';
import type { Play, Point, RouteSegment } from '@/types';

// Names used in generated play names; 'hitch' (button "Stop") reads better as "Hook" in a play name
const PRESET_NAMES: Record<string, string> = {
    ...Object.fromEntries(ROUTE_PRESETS.map(p => [p.value, p.label])),
    hitch: 'Hook',
};

// Presets named by their actual break depth instead ("7-Out" rather than snapping to 5-Out / 10-Out)
const DEPTH_NAMED_PRESETS: Partial<Record<RoutePreset, 'Out' | 'In'>> = {
    'out-5': 'Out', 'out-10': 'Out', 'in-5': 'In', 'in-10': 'In',
};

// A drawn route counts as a preset when it has the same number of lines and its shape cost stays
// within this tolerance. Cost = ANGLE_WEIGHT × average direction difference of corresponding lines (radians)
//                             + LENGTH_WEIGHT × average log length ratio of corresponding lines
const MATCH_TOLERANCE = 1;
const ANGLE_WEIGHT = 2;
const LENGTH_WEIGHT = 0.75;
// Bends flatter than this are treated as one straight line (e.g. the Go preset's slight drift outside)
const STRAIGHT_BEND_RADIANS = (15 * Math.PI) / 180;
// Routes starting this close to the middle may break either way, so presets are also tried mirrored
const CENTER_ZONE_YARDS = 2;

const LOS_Y = getPos(0, 0).y;
const CENTER_X = FIELD_PIXEL_WIDTH / 2;

/** Points without zero-length lines (e.g. a break squeezed against the sideline). */
const dedupe = (points: Point[]) =>
    points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y);

const angleDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

type Line = { angle: number; length: number };

/** The route's lines (direction + length), with nearly straight bends merged into one line. */
const toLines = (points: Point[]): Line[] => {
    const angle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);
    const corners = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
        if (angleDiff(angle(corners[corners.length - 1], points[i]), angle(points[i], points[i + 1])) > STRAIGHT_BEND_RADIANS) {
            corners.push(points[i]);
        }
    }
    corners.push(points[points.length - 1]);
    return corners.slice(1).map((p, i) => ({ angle: angle(corners[i], p), length: Math.hypot(p.x - corners[i].x, p.y - corners[i].y) }));
};

/** How different two routes' shapes are; Infinity when they have a different number of lines. */
const shapeCost = (a: Line[], b: Line[]) => {
    if (a.length !== b.length) return Infinity;
    const mean = (f: (x: Line, y: Line) => number) => a.reduce((sum, line, i) => sum + f(line, b[i]), 0) / a.length;
    return ANGLE_WEIGHT * mean((x, y) => angleDiff(x.angle, y.angle))
        + LENGTH_WEIGHT * mean((x, y) => Math.abs(Math.log(x.length / y.length)));
};

/** The preset whose shape (generated from the same start) is closest to the route, if close enough. */
const closestPreset = (points: Point[]): RoutePreset | null => {
    const start = points[0];
    const mirror = (p: Point) => ({ x: 2 * start.x - p.x, y: p.y });
    const nearCenter = Math.abs(start.x - CENTER_X) <= CENTER_ZONE_YARDS * S;

    const lines = toLines(points);
    let best: { preset: RoutePreset; cost: number } | null = null;
    for (const { value } of ROUTE_PRESETS) {
        const shape = dedupe(generateRoutePoints(start, value));
        const candidates = nearCenter ? [shape, shape.map(mirror)] : [shape];
        for (const candidate of candidates) {
            const cost = shapeCost(lines, toLines(candidate));
            if (!best || cost < best.cost) best = { preset: value, cost };
        }
    }
    return best && best.cost <= MATCH_TOLERANCE ? best.preset : null;
};

/** "7-Out": the break depth from the LOS, taken from the start of the last line. */
const depthName = (points: Point[], kind: 'Out' | 'In') =>
    `${Math.max(0, Math.round((LOS_Y - points[points.length - 2].y) / S))}-${kind}`;

/** Fallback when no preset is close: classify by the last line and the break depth. */
const shapeName = (points: Point[]): string => {
    const start = points[0];
    // Forward = yards downfield, inside = yards toward the middle of the field
    const dirIn = start.x < CENTER_X ? 1 : -1;
    const pts = points.map(p => ({
        forward: (start.y - p.y) / S,
        inside: (p.x - start.x) / S * dirIn,
    }));
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const dF = last.forward - prev.forward;
    const dI = last.inside - prev.inside;
    const breakDepth = prev.forward;

    if (pts.length === 2) {
        if (Math.abs(dI) <= 1) return dF >= 8 ? 'Go' : 'Stop';
        if (Math.abs(dF) < Math.abs(dI)) return dI > 0 ? 'Drag' : 'Flat';
        return dI > 0 ? 'Slant' : 'Fade';
    }
    if (dF < -0.5) return dI >= 0 ? 'Hook' : 'Comeback';
    if (Math.abs(dI) <= dF / 4) return 'Go';
    if (Math.abs(dF) <= Math.abs(dI) / 2) return dI >= 10 ? 'Cross' : depthName(points, dI > 0 ? 'In' : 'Out');
    if (dI > 0) return breakDepth >= 5 ? 'Post' : 'Slant';
    return breakDepth >= 5 ? 'Corner' : 'Fade';
};

export const routeName = (route: RouteSegment): string => {
    const points = dedupe(route.points);
    if (points.length < 2) return 'Stop';
    const preset = closestPreset(points);
    if (!preset) return shapeName(points);
    const depthKind = DEPTH_NAMED_PRESETS[preset];
    return depthKind ? depthName(points, depthKind) : PRESET_NAMES[preset];
};

/**
 * Suggest a play name from the primary routes, e.g. "All Hook" or "Slant / Go / 5-Out" (left to right).
 * Returns null when no player has a primary route.
 */
export const generatePlayName = (play: Play): string | null => {
    const names = play.players
        .filter(p => p.role !== 'QB')
        .map(p => p.routes.find(r => r.type === 'primary'))
        .filter((r): r is RouteSegment => !!r && r.points.length >= 2)
        // Order by where the route starts (after motion), not where the player lines up
        .sort((a, b) => a.points[0].x - b.points[0].x)
        .map(routeName);

    if (names.length === 0) return null;
    if (names.length > 1 && names.every(n => n === names[0])) return `All ${names[0]}`;
    return names.join(' / ');
};
