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

export interface Play {
    id: string;
    name: string;
    description?: string;
    players: Player[];
    gridPosition?: {
        row: number;    // 0-3 (for rows 1-4)
        column: number; // 0-4 (for columns A-E)
    };
    ballPosition?: Point;
    tags?: PlayTag[];
}

export interface PlaybookGrid {
    columnNames: string[]; // Default: ['A', 'B', 'C', 'D', 'E']
}

export interface Playbook {
    id: string;
    name: string;
    plays: Play[];
    gridConfig: {
        columnNames: string[];
    };
    createdAt: number;
    updatedAt: number;
}
