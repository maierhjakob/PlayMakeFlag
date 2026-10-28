import React from 'react';
import { defenderColor } from '@/lib/defense';
import type { Play, PlayDefense, Point } from '@/types';

interface DefenseLayerProps {
    play: Play;
    defense: PlayDefense;
    /** Field coordinates (px, 25 per yard) → drawing coordinates */
    toCanvas: (p: Point) => Point;
    /** Drawing units per yard */
    yard: number;
    selectedDefenderId?: string | null;
}

/** An arrowhead (open V) at `tip`, pointing along (ux, uy). */
const Arrowhead: React.FC<{ tip: Point; ux: number; uy: number; size: number; color: string; width: number }> = ({ tip, ux, uy, size, color, width }) => (
    <path
        d={`M ${-size} ${-size / 2} L 0 0 L ${-size} ${size / 2}`}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`translate(${tip.x}, ${tip.y}) rotate(${Math.atan2(uy, ux) * 180 / Math.PI})`}
    />
);

/**
 * Zones, rush arrows and drawn arrows of a play's defense, drawn inside an <svg>.
 * The defenders themselves are drawn by the caller (tokens in the editor, dots in the previews).
 */
export const DefenseLayer: React.FC<DefenseLayerProps> = ({ play, defense, toCanvas, yard, selectedDefenderId }) => {
    const qb = play.players.find(p => p.role === 'QB');
    const lineWidth = yard * 0.08;
    const arrowWidth = yard * 0.14;

    return (
        <g>
            {/* Zones */}
            {defense.defenders.map((d, i) => {
                if (!d.zone) return null;
                const c = toCanvas({ x: d.position.x + d.zone.dx, y: d.position.y + d.zone.dy });
                const color = defenderColor(d, i);
                return (
                    <ellipse
                        key={`zone-${d.id}`}
                        cx={c.x}
                        cy={c.y}
                        rx={d.zone.rx / 25 * yard}
                        ry={d.zone.ry / 25 * yard}
                        fill={color}
                        fillOpacity={selectedDefenderId === d.id ? 0.28 : 0.16}
                        stroke={color}
                        strokeOpacity={0.7}
                        strokeWidth={lineWidth}
                        strokeDasharray={`${yard * 0.3},${yard * 0.2}`}
                    />
                );
            })}

            {/* Rush: arrow towards the quarterback, stopping short of him */}
            {qb && defense.defenders.map((d, i) => {
                if (!d.rush) return null;
                const a = toCanvas(d.position);
                const q = toCanvas(qb.position);
                const len = Math.hypot(q.x - a.x, q.y - a.y);
                if (len < yard * 2) return null;
                const ux = (q.x - a.x) / len;
                const uy = (q.y - a.y) / len;
                const tip = { x: q.x - ux * yard * 1.2, y: q.y - uy * yard * 1.2 };
                const color = defenderColor(d, i);
                return (
                    <g key={`rush-${d.id}`}>
                        <line x1={a.x} y1={a.y} x2={tip.x} y2={tip.y} stroke={color} strokeWidth={lineWidth * 1.5} strokeLinecap="round" />
                        <Arrowhead tip={tip} ux={ux} uy={uy} size={yard * 0.45} color={color} width={lineWidth * 1.5} />
                    </g>
                );
            })}

            {/* Drawn arrows */}
            {defense.defenders.map((d, i) => {
                if (!d.path?.length) return null;
                const points = [d.position, ...d.path].map(toCanvas);
                const last = points[points.length - 1];
                const prev = points[points.length - 2];
                const len = Math.hypot(last.x - prev.x, last.y - prev.y) || 1;
                const color = defenderColor(d, i);
                return (
                    <g key={`path-${d.id}`}>
                        <polyline
                            points={points.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="none"
                            stroke={color}
                            strokeWidth={arrowWidth}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <Arrowhead tip={last} ux={(last.x - prev.x) / len} uy={(last.y - prev.y) / len} size={yard * 0.5} color={color} width={arrowWidth} />
                    </g>
                );
            })}

        </g>
    );
};
