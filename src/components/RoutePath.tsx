import React from 'react';
import type { RouteSegment } from '@/types';

interface RoutePathProps {
    segment: RouteSegment;
    color: string;
    isSelected?: boolean;
}

export const RoutePath: React.FC<RoutePathProps> = ({ segment, color, isSelected }) => {
    if (segment.points.length < 2) return null;

    // Styles based on route type
    const strokeDasharray =
        segment.type === 'primary' ? 'none' :
            segment.type === 'option' ? '8,12' :
                segment.type === 'endzone' ? '12,8' : 'none';
    const baseWidth = segment.type === 'primary' ? 4.5 : 3;
    const strokeWidth = isSelected ? baseWidth + 1.5 : baseWidth;
    const strokeOpacity = (segment.type === 'check' || segment.type === 'endzone') ? 0.8 : 1;
    const strokeColor =
        segment.type === 'check' ? '#000000' :
            segment.type === 'endzone' ? '#f472b6' : color;
    const arrowSize = (segment.type === 'check' || segment.type === 'endzone') ? 12 : 20;

    // Arrowhead calculations helpers
    const lastPoint = segment.points[segment.points.length - 1];
    const secondLast = segment.points[segment.points.length - 2];

    // Calculate angle for marker
    const dx = lastPoint.x - secondLast.x;
    const dy = lastPoint.y - secondLast.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const length = Math.sqrt(dx * dx + dy * dy);

    // Trim the line path so it doesn't poke through the arrow tip
    // Retract based on stroke width and arrow size
    const trim = arrowSize / 4;
    let visualPoints = [...segment.points];

    if (length > trim) {
        // Normalize vector
        const ux = dx / length;
        const uy = dy / length;
        // New end point
        visualPoints[visualPoints.length - 1] = {
            x: lastPoint.x - (ux * trim),
            y: lastPoint.y - (uy * trim)
        };
    }

    const pathData = visualPoints.map((p, i) =>
        i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
    ).join(' ');


    return (
        <g className="pointer-events-none">
            <path
                d={pathData}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={strokeDasharray}
                opacity={strokeOpacity}
            />
            {/* Arrowhead */}
            <path
                d={`M -${arrowSize} -${arrowSize / 2} L 0 0 L -${arrowSize} ${arrowSize / 2} Z`}
                fill={segment.type === 'option' ? 'white' : strokeColor}
                stroke={strokeColor}
                strokeWidth={segment.type === 'option' ? 2 : 0}
                transform={`translate(${lastPoint.x}, ${lastPoint.y}) rotate(${angle})`}
            />
        </g>
    );
};
