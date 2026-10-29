export type Point = {
    x: number;
    y: number;
};

export type RouteType = 'primary' | 'option' | 'check' | 'endzone';

export type RouteSegment = {
    id: string;
    type: RouteType;
    points: Point[];
    preset?: string;
};

export type PlayerRole = 'QB' | 'C' | 'WR-L' | 'WR-R' | 'RB' | 'R' | 'BR'; // Example roles

export type Player = {
    id: string;
    role: string;
    label: string;
    color: string;
    position: Point;
    routes: RouteSegment[];
    motion?: Point | null;
};

export type PlayTag = {
    id: string;
    text: string;
    color: string;
};

/** Zone a defender covers: an ellipse relative to the defender's position (px). */
export type DefenderZone = {
    dx: number;
    dy: number;
    rx: number;
    ry: number;
};

export type Defender = {
    id: string;
    position: Point;
    zone?: DefenderZone | null;
    /** Offensive player this defender covers in man coverage */
    manTargetId?: string | null;
    /** Rushes the quarterback */
    rush?: boolean;
    color?: string;
    /** Arrow the defender runs: points after its position */
    path?: Point[];
    /** The arrow was set by a coverage (replaced when the coverage changes); drawn or edited arrows are kept */
    pathFromCoverage?: boolean;
};

export type Coverage = 'man' | 'cover-1' | 'cover-2' | 'cover-2-invert' | 'cover-2-invert-left' | 'cover-2-invert-right' | 'cover-3';

export type PlayDefense = {
    coverage?: Coverage | null;
    defenders: Defender[];
};

export interface Play {
    id: string;
    name: string;
    /** Extra note on the play, shown in the PNG export (not printed) */
    comment?: string;
    players: Player[];
    // gridPosition is NOT stored on Play — it lives in PlaybookEntry.
    // It may be attached at read-time for component convenience.
    gridPosition?: {
        row: number;    // 0-3 (for rows 1-4)
        column: number; // 0-4 (for columns A-E)
    };
    ballPosition?: Point;
    tags?: PlayTag[];
    folderId?: string;
    /** Defense to check the play against (defense view) */
    defense?: PlayDefense;
}

export interface SavedRoute {
    id: string;
    name: string;
    /** Points relative to the route start (first point is always {x:0, y:0}). */
    relativePoints: Point[];
}

export interface PlayFolder {
    id: string;
    name: string;
    isExpanded: boolean;
    order: number;
    parentId?: string; // if set, this is a sub-folder inside another folder
}

export interface PlaybookEntry {
    playId: string;
    gridPosition?: {
        row: number;
        column: number;
    };
}

export interface PlaybookGrid {
    columnNames: string[]; // Default: ['A', 'B', 'C', 'D', 'E']
}

export interface Playbook {
    id: string;
    name: string;
    /** References to global plays, with per-playbook grid positions. */
    entries: PlaybookEntry[];
    gridConfig: {
        columnNames: string[];
    };
    createdAt: number;
    updatedAt: number;
}
