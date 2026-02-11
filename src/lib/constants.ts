// Field Dimensions
export const S = 25; // Scale: px per yard
export const TOTAL_H = 25; // Total height in yards
export const LOS_OFFSET = 5; // yards from bottom

// Helper to get logic Y from yards relative to LOS
export const getPos = (xYards: number, yYardsFromLOS: number) => {
    // Center X (Field width 25y)
    const cx = (25 / 2) * S;
    const pxX = cx + xYards * S;

    // Y: 
    const yardsFromTop = TOTAL_H - (LOS_OFFSET + yYardsFromLOS);
    const pxY = yardsFromTop * S;

    return { x: pxX, y: pxY };
};

export const FIELD_WIDTH_YARDS = 25;
export const FIELD_HEIGHT_YARDS = 25;
export const FIELD_PIXEL_WIDTH = FIELD_WIDTH_YARDS * S;
export const FIELD_PIXEL_HEIGHT = FIELD_HEIGHT_YARDS * S;

// Add padding to keep routes away from edges (1 yard = 25px)
export const BOUNDARY_PADDING = S * 1; // 1 yard buffer

export const clampPoint = (p: { x: number, y: number }) => {
    return {
        x: Math.max(BOUNDARY_PADDING, Math.min(p.x, FIELD_PIXEL_WIDTH - BOUNDARY_PADDING)),
        y: Math.max(BOUNDARY_PADDING, Math.min(p.y, FIELD_PIXEL_HEIGHT - BOUNDARY_PADDING))
    };
};

/* Player Positions Constants */
export const POSITIONS = {
    'C': { role: 'C', label: '', x: 0, depth: -1, color: '#eab308' }, // Yellow
    'QB': { role: 'QB', label: '', x: 0, depth: -4, color: '#999999' }, // Gray
    'WR-L': { role: 'WR-L', label: '', x: -10, depth: -1, color: '#3b82f6' }, // Blue (LR)
    'WR-R': { role: 'WR-R', label: '', x: 10, depth: -1, color: '#ef4444' }, // Red (RR)
    'SL': { role: 'SL', label: '', x: -5, depth: -1, color: '#22c55e' }, // Green (Slot)
    'SR': { role: 'SR', label: '', x: 5, depth: -1, color: '#22c55e' }, // Green (SR)
} as const;
