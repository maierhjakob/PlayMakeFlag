import React from 'react';
import type { Play } from '@/types';

interface MiniPlayPreviewProps {
    play: Play;
    width?: number;
    height?: number;
    className?: string;
}

export const MiniPlayPreview: React.FC<MiniPlayPreviewProps> = ({
    play,
    width = 100,
    height = 70,
    className = ''
}) => {
    // Scale factor to fit the field into the mini preview
    // Original field is 625px wide × 625px tall (25 yards @ 25px/yard)
    const SCALE_X = width / 625;
    const SCALE_Y = height / 625;

    // Line of scrimmage position (in original coordinates, LOS is at y=500)
    const LOS_Y = 500 * SCALE_Y;

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className={className}
        >
            {/* Field background */}
            <rect
                x="0"
                y="0"
                width={width}
                height={height}
                fill="white"
                rx="1"
            />

            {/* Line of scrimmage */}
            <line
                x1="0"
                y1={LOS_Y}
                x2={width}
                y2={LOS_Y}
                stroke="#2563eb"
                strokeWidth="1"
            />

            {/* Render players and routes */}
            {play.players.map((player) => {
                const startX = player.position.x * SCALE_X;
                const startY = player.position.y * SCALE_Y;

                return (
                    <g key={player.id}>
                        {/* Routes */}
                        {player.routes.map((route) => {
                            const pathData = route.points
                                .map((point, idx) => {
                                    const x = point.x * SCALE_X;
                                    const y = point.y * SCALE_Y;
                                    return idx === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                                })
                                .join(' ');

                            // Route color follows the same logic as RoutePath.tsx
                            const routeColor =
                                route.type === 'check' ? '#000000' :
                                    route.type === 'endzone' ? '#f472b6' :
                                        player.color;

                            // Dash array logic from RoutePath.tsx
                            const strokeDasharray =
                                route.type === 'option' ? '1.5,1.5' :
                                    route.type === 'endzone' ? '2.5,1.5' : 'none';

                            return (
                                <path
                                    key={route.id}
                                    d={pathData}
                                    stroke={routeColor}
                                    strokeWidth="0.8"
                                    fill="none"
                                    opacity={route.type === 'check' ? 0.6 : 1}
                                    strokeDasharray={strokeDasharray}
                                />
                            );
                        })}

                        {/* Motion path */}
                        {player.motion && (
                            <polyline
                                points={[
                                    `${startX},${startY}`,
                                    `${startX},${startY + 5 * SCALE_Y}`,
                                    `${player.motion.x * SCALE_X},${player.motion.y * SCALE_Y + 5 * SCALE_Y}`,
                                    `${player.motion.x * SCALE_X},${player.motion.y * SCALE_Y}`
                                ].join(' ')}
                                stroke={player.color}
                                strokeWidth="0.8"
                                strokeOpacity="0.5"
                                fill="none"
                            />
                        )}

                        {/* Player dot */}
                        <circle
                            cx={player.motion ? player.motion.x * SCALE_X : startX}
                            cy={player.motion ? player.motion.y * SCALE_Y : startY}
                            r="1.5"
                            fill={player.color}
                            stroke="#1e293b"
                            strokeWidth="0.3"
                        />
                    </g>
                );
            })}
        </svg>
    );
};
