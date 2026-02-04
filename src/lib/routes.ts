import { S as YARD_TO_PX, FIELD_WIDTH_YARDS, TOTAL_H as TOTAL_LENGTH_YARDS, clampPoint } from '@/lib/constants';
import type { Point } from '@/types';

export type RoutePreset =
    | 'hitch'
    | 'out-5'
    | 'in-5'
    | 'out-10'
    | 'in-10'
    | 'ir-in-5'
    | 'slant'
    | 'post'
    | 'corner'
    | 'go'
    | 'comeback'
    | 'post-in'
    | 'cross';

export const ROUTE_PRESETS: { label: string; value: RoutePreset }[] = [
    { label: 'Stop', value: 'hitch' },
    { label: '5-Out', value: 'out-5' },
    { label: '5-In', value: 'in-5' },
    { label: 'IR-5-In', value: 'ir-in-5' },
    { label: '10-Out', value: 'out-10' },
    { label: '10-In', value: 'in-10' },
    { label: 'Slant', value: 'slant' },
    { label: 'Post', value: 'post' },
    { label: 'Go', value: 'go' },
    { label: 'Comeback', value: 'comeback' },
    { label: 'Corner', value: 'corner' },
    { label: 'Cross', value: 'cross' },
    { label: 'PostIn', value: 'post-in' },
];

export const generateRoutePoints = (start: Point, preset: RoutePreset): Point[] => {
    const points: Point[] = [start];
    const S = YARD_TO_PX;
    const CENTER_X = (FIELD_WIDTH_YARDS * S) / 2;

    // LOS Calculations
    // LOS is 5 yards from bottom. Total 25. LOS Y = (25 - 5) * S = 20 * S.
    // SVG Y reduces as we go up field.
    const LOS_YARD_FROM_TOP = TOTAL_LENGTH_YARDS - 5;


    // Helper to get pixels for a target "Yards Gained" (positive is downfield)
    // Yard 5 = LOS - 5 yards = (20 - 5) * S = 15 * S.
    const getY = (yardsGained: number) => {
        return (LOS_YARD_FROM_TOP - yardsGained) * S;
    };

    // Determine side relative to center
    const isLeft = start.x < CENTER_X;
    const dirIn = isLeft ? 1 : -1;
    const dirOut = isLeft ? -1 : 1;

    // Helper to add point relative to LAST point
    const addRel = (dxYards: number, dyYards: number) => {
        const last = points[points.length - 1];
        points.push(clampPoint({
            x: last.x + (dxYards * S),
            y: last.y - (dyYards * S) // Y is inverted in SVG
        }));
    };

    // Helper to add point at ABSOLUTE yards gained depth, but relative/absolute X
    // Uses last X as base, adds dxYards. Sets Y to exact yard line.
    const addAbsDepth = (dxYards: number, depthYards: number) => {
        const last = points[points.length - 1];
        points.push(clampPoint({
            x: last.x + (dxYards * S),
            y: getY(depthYards)
        }));
    };

    switch (preset) {
        case 'cross':
            addAbsDepth(0, 1);
            addRel(20 * dirIn, 3);
            break;
        case 'hitch':
            // Go to 5 yards depth directly
            addAbsDepth(0, 6);
            addRel(1 * dirIn, -1);
            break;
        case 'out-5':
            addAbsDepth(0, 5); // To 5y line
            addRel(5 * dirOut, 0); // Cut out
            break;
        case 'out-10':
            addAbsDepth(0, 10); // To 10y line
            addRel(5 * dirOut, 0); // Cut out
            break;
        case 'in-5':
            addAbsDepth(0, 5); // To 5y line
            addRel(5 * dirIn, 0); // Cut in
            break;
        case 'ir-in-5':
            addAbsDepth(2 * dirIn, 5); // To 5y line
            addRel(15 * dirIn, 0); // Cut in
            break;
        case 'in-10':
            addAbsDepth(0, 10); // To 10y line
            addRel(5 * dirIn, 0); // Cut in
            break;
        case 'slant':
            addAbsDepth(0, 1);
            addRel(3 * dirIn, 2); // Diagonal
            break;
        case 'post':
            addAbsDepth(0, 7); // Break at 7y (standard deep post break?)
            addRel(5 * dirIn, 7); // Deep middle
            break;
        case 'post-in':
            addAbsDepth(0, 7);
            addRel(2 * dirIn, 3.2);
            addRel(10 * dirIn, 0);
            break;
        case 'corner':
            addAbsDepth(0, 7);
            addRel(5 * dirOut, 5); // Deep corner
            break;
        case 'go':
            addAbsDepth(0, 7); // Just go deep
            addRel(1 * dirOut, 8); // Deep corner
            break;
        case 'comeback':
            addAbsDepth(0, 7);
            addRel(1 * dirOut, 7);
            addRel(1 * dirOut, -2);
            break;
    }

    return points;
};
