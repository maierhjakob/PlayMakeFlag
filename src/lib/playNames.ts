import { S, FIELD_PIXEL_WIDTH } from '@/lib/constants';
import { ROUTE_PRESETS, generateRoutePoints, type RoutePreset } from '@/lib/routes';
import type { Play, RouteSegment } from '@/types';

// Names used in generated play names; 'hitch' (button "Stop") reads better as "Hook" in a play name
const PRESET_NAMES: Record<string, string> = {
    ...Object.fromEntries(ROUTE_PRESETS.map(p => [p.value, p.label])),
    hitch: 'Hook',
};

/** The preset's name if the route still has exactly the preset's shape (not edited afterwards). */
const presetName = (route: RouteSegment): string | null => {
    if (!route.preset) return null;
    const expected = generateRoutePoints(route.points[0], route.preset as RoutePreset);
    const unchanged = expected.length === route.points.length &&
        expected.every((p, i) => Math.abs(p.x - route.points[i].x) < 0.5 && Math.abs(p.y - route.points[i].y) < 0.5);
    return unchanged ? PRESET_NAMES[route.preset] ?? null : null;
};

/** Classify a drawn or edited route by its shape, based mostly on its last line. */
const shapeName = (route: RouteSegment): string => {
    // Drop zero-length lines (e.g. a break squeezed against the sideline)
    const points = route.points.filter((p, i, all) => i === 0 || p.x !== all[i - 1].x || p.y !== all[i - 1].y);
    const start = points[0];
    // Forward = yards downfield, inside = yards toward the middle of the field
    const dirIn = start.x <= FIELD_PIXEL_WIDTH / 2 ? 1 : -1;
    const pts = points.map(p => ({
        forward: (start.y - p.y) / S,
        inside: (p.x - start.x) / S * dirIn,
    }));
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const dF = last.forward - prev.forward;
    const dI = last.inside - prev.inside;
    const breakDepth = prev.forward;

    if (pts.length === 1) return 'Stop';
    if (pts.length === 2) {
        if (Math.abs(dI) <= 1) return dF >= 8 ? 'Go' : 'Stop';
        if (Math.abs(dF) < Math.abs(dI)) return dI > 0 ? 'Drag' : 'Flat';
        return dI > 0 ? 'Slant' : 'Fade';
    }
    if (dF < -0.5) return dI >= 0 ? 'Hook' : 'Comeback';
    if (Math.abs(dI) <= dF / 4) return 'Go';
    if (Math.abs(dF) <= Math.abs(dI) / 2) return dI >= 10 ? 'Cross' : dI > 0 ? 'In' : 'Out';
    if (dI > 0) return breakDepth >= 5 ? 'Post' : 'Slant';
    return breakDepth >= 5 ? 'Corner' : 'Fade';
};

/**
 * Suggest a play name from the primary routes, e.g. "All Hook" or "Slant / Go / Out" (left to right).
 * Returns null when no player has a primary route.
 */
export const generatePlayName = (play: Play): string | null => {
    const names = play.players
        .filter(p => p.role !== 'QB')
        .map(p => ({ x: p.position.x, route: p.routes.find(r => r.type === 'primary') }))
        .filter((p): p is { x: number; route: RouteSegment } => !!p.route && p.route.points.length >= 2)
        .sort((a, b) => a.x - b.x)
        .map(p => presetName(p.route) ?? shapeName(p.route));

    if (names.length === 0) return null;
    if (names.length > 1 && names.every(n => n === names[0])) return `All ${names[0]}`;
    return names.join(' / ');
};
