export type Point = {
    x: number;
    y: number;
};

export type RouteType = 'primary' | 'option' | 'check' | 'endzone';

export type RouteSegment = {
    id: string;
    type: RouteType;
    points: Point[];
};

export type PlayerRole = 'QB' | 'C' | 'WR-L' | 'WR-R' | 'RB' | 'R' | 'BR'; // Example roles

export type Player = {
    id: string;
    role: string;
    label: string;
    color: string;
    position: Point;
    routes: RouteSegment[];
};

export type Play = {
    id: string;
    name: string;
    description?: string;
    players: Player[];
    ballPosition?: Point;
};
