import React from 'react';
import type { Play } from '@/types';

interface MiniPlayPreviewProps {
    play: Play;
    width?: number;
    height?: number;
    strokeWidth?: number;
    className?: string;
}

export const MiniPlayPreview: React.FC<MiniPlayPreviewProps> = ({
    play,
    width = 51,
    height = 70,
    strokeWidth = 1.2,
    className = ''
}) => {
    // Field dimensions (25 yards wide @ 25px/yard)
    const VIRTUAL_WIDTH = 625;
    const VIRTUAL_HEIGHT = 575; // Cropped field depth: 25y - 2y = 23y
    const Y_START = 50; // Start 2 yards (50px) from the top

    // Scale factors
    const SCALE_X = width / VIRTUAL_WIDTH;
    const SCALE_Y = height / VIRTUAL_HEIGHT;

    // Helper to get scaled and shifted coordinates
    const getX = (x: number) => x * SCALE_X;
    const getY = (y: number) => (y - Y_START) * SCALE_Y;

    // Field positions (following constants.ts logic)
    const getYFromLOS = (yardsFromLOS: number) => {
        // LOS is 5 yards from bottom. Total height is 25y.
        // yardsFromBottom = 5 + yardsFromLOS
        // yardsFromTop = 25 - yardsFromBottom
        const yardsFromBottom = 5 + yardsFromLOS;
        const yardsFromTop = 25 - yardsFromBottom;
        return getY(yardsFromTop * 25); // 25px per yard in virtual space
    };

    const LOS_Y = getYFromLOS(0);

    // Flatten all routes to sort them by type (primary routes on top)
    const allRoutes = play.players.flatMap(player =>
        player.routes.map(route => ({ route, player }))
    ).sort((a, b) => {
        const order = { 'check': 0, 'option': 1, 'endzone': 2, 'primary': 3 };
        return (order[a.route.type as keyof typeof order] || 0) - (order[b.route.type as keyof typeof order] || 0);
    });

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className={className}
        >
            {/* Field background */}
            <rect x="0" y="0" width={width} height={height} fill="white" rx="1" />

            {/* Yard Markings (Matching Field.tsx) */}
            {/* 10 Yard Line (Full Width) */}
            <line
                x1="0" y1={getYFromLOS(10)} x2={width} y2={getYFromLOS(10)}
                stroke="#94a3b8" strokeWidth="0.5"
            />

            {/* 7 Yard Marks (Side lines) */}
            <line x1="0" y1={getYFromLOS(7)} x2={getX(30)} y2={getYFromLOS(7)} stroke="#94a3b8" strokeWidth="0.5" />
            <line x1={getX(625 - 30)} y1={getYFromLOS(7)} x2={width} y2={getYFromLOS(7)} stroke="#94a3b8" strokeWidth="0.5" />

            {/* 5 Yard Marks (Side lines) */}
            <line x1="0" y1={getYFromLOS(5)} x2={getX(15)} y2={getYFromLOS(5)} stroke="#94a3b8" strokeWidth="0.5" />
            <line x1={getX(625 - 15)} y1={getYFromLOS(5)} x2={width} y2={getYFromLOS(5)} stroke="#94a3b8" strokeWidth="0.5" />

            {/* Line of scrimmage (Black) */}
            <line
                x1="0" y1={LOS_Y} x2={width} y2={LOS_Y}
                stroke="#000000" strokeWidth="0.5"
            />

            {/* 1. Motion paths */}
            {play.players.map(player => {
                if (!player.motion) return null;

                const startX = getX(player.position.x);
                const startY = getY(player.position.y);
                const endX = getX(player.motion.x);
                const endY = getY(player.motion.y);

                return (
                    <polyline
                        key={`motion-${player.id}`}
                        points={[
                            `${startX},${startY}`,
                            `${startX},${endY}`,
                            `${endX},${endY}`
                        ].join(' ')}
                        stroke={player.color}
                        strokeWidth={strokeWidth}
                        strokeOpacity="0.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                );
            })}

            {/* 2. Routes */}
            {allRoutes.map(({ route, player }) => {
                const lastPoint = route.points[route.points.length - 1];
                const secondLast = route.points[route.points.length - 2];

                let arrowhead = null;
                const routeColor = route.type === 'check' ? '#000000' :
                    route.type === 'endzone' ? '#f472b6' : player.color;

                if (secondLast && lastPoint) {
                    const lpx = getX(lastPoint.x);
                    const lpy = getY(lastPoint.y);
                    const slx = getX(secondLast.x);
                    const sly = getY(secondLast.y);

                    const dx = lpx - slx;
                    const dy = lpy - sly;
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    const length = Math.sqrt(dx * dx + dy * dy);

                    const arrowPush = strokeWidth * 1.25;
                    const ux = dx / length;
                    const uy = dy / length;
                    const tipX = lpx + (ux * arrowPush);
                    const tipY = lpy + (uy * arrowPush);

                    const arrowSize = strokeWidth * 2.5;
                    arrowhead = (
                        <path
                            d={`M -${arrowSize} -${arrowSize / 2} L 0 0 L -${arrowSize} ${arrowSize / 2} Z`}
                            fill={route.type === 'option' ? 'white' : routeColor}
                            stroke={routeColor}
                            strokeWidth={strokeWidth * 0.66}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            transform={`translate(${tipX}, ${tipY}) rotate(${angle})`}
                        />
                    );
                }

                const pathData = route.points
                    .map((point, idx) => idx === 0 ? `M ${getX(point.x)} ${getY(point.y)}` : `L ${getX(point.x)} ${getY(point.y)}`)
                    .join(' ');

                const strokeDasharray = route.type === 'option' ? `${strokeWidth * 1},${strokeWidth * 2}` :
                    route.type === 'endzone' ? `${strokeWidth * 1.5},${strokeWidth * 2.5}` : 'none';

                return (
                    <g key={route.id}>
                        <path
                            d={pathData}
                            stroke={routeColor}
                            strokeWidth={strokeWidth}
                            fill="none"
                            opacity={route.type === 'check' ? 0.7 : 1}
                            strokeDasharray={strokeDasharray}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {arrowhead}
                    </g>
                );
            })}

            {/* 3. Player dots */}
            {play.players.map(player => (
                <circle
                    key={`player-${player.id}`}
                    cx={getX(player.position.x)}
                    cy={getY(player.position.y)}
                    r={strokeWidth * 1.5}
                    fill={player.color}
                    stroke="#000000"
                    strokeWidth={strokeWidth * 0.4}
                />
            ))}
        </svg>
    );
};
