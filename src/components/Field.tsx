import React from 'react';
import { cn } from '@/lib/utils';

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
    showRaster?: boolean;
}

export const FIELD_WIDTH_YARDS = 25; // Standard width
export const TOTAL_LENGTH_YARDS = 25; // Compact field: 5yd backfield + 20yd play area
export const YARD_TO_PX = 25; // Larger scale since field is smaller dimensions

export const Field: React.FC<FieldProps> = ({ className, children, showRaster, ...props }) => {
    const widthPx = FIELD_WIDTH_YARDS * YARD_TO_PX;
    const heightPx = TOTAL_LENGTH_YARDS * YARD_TO_PX;

    // LOS is 5 yards from the bottom
    const LOS_YARD_FROM_BOTTOM = 5;

    // Helper: Convert "Yards from LOS" to SVG Y coordinate
    // SVG Y=0 is TOP. Y=height is BOTTOM.
    // LOS is at `height - 5 * scale`.
    // +10 yards (up) is `height - (5 + 10) * scale`.
    const getLineY = (yardsFromLOS: number) => {
        const fieldYardsFromBottom = LOS_YARD_FROM_BOTTOM + yardsFromLOS;
        // Invert for SVG (0 is top)
        const yardsFromTop = TOTAL_LENGTH_YARDS - fieldYardsFromBottom;
        return yardsFromTop * YARD_TO_PX;
    };

    return (
        <div
            className={cn("relative bg-white border-4 border-slate-900 overflow-hidden shadow-2xl rounded-lg", className)}
            style={{ width: widthPx, height: heightPx }}
            {...props}
        >
            {/* Field Markings */}
            <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none opacity-80">
                <defs>
                    <pattern id="yardGrid" width={YARD_TO_PX} height={YARD_TO_PX} patternUnits="userSpaceOnUse">
                        <path d={`M ${YARD_TO_PX} 0 L 0 0 0 ${YARD_TO_PX}`} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
                    </pattern>
                </defs>

                {showRaster && (
                    <rect width="100%" height="100%" fill="url(#yardGrid)" />
                )}

                {/* Line of Scrimmage (LOS) - Blue Line */}
                <line x1="0" y1={getLineY(0)} x2="100%" y2={getLineY(0)} stroke="#2563eb" strokeWidth="3" />
                {/* Label for LOS? */}
                <text x="5" y={getLineY(0) - 5} fill="#2563eb" fontSize="12" fontWeight="bold">LOS</text>

                {/* 10 Yard Line (Full Gray Line) */}
                <line x1="0" y1={getLineY(10)} x2="100%" y2={getLineY(10)} stroke="gray" strokeWidth="2" />

                {/* 7 Yard Marks (Side Lines) */}
                <line x1="0" y1={getLineY(7)} x2="30" y2={getLineY(7)} stroke="#0f172a" strokeWidth="2" />
                <line x1={widthPx - 30} y1={getLineY(7)} x2={widthPx} y2={getLineY(7)} stroke="#0f172a" strokeWidth="2" />

                {/* 5 Yard Marks (Smaller Side Lines) */}
                <line x1="0" y1={getLineY(5)} x2="15" y2={getLineY(5)} stroke="#0f172a" strokeWidth="1" />
                <line x1={widthPx - 15} y1={getLineY(5)} x2={widthPx} y2={getLineY(5)} stroke="#0f172a" strokeWidth="1" />

                {/* Optional: Top of Play Area (20 Yards) boundary? */}
                {/* <line x1="0" y1={getLineY(20)} x2="100%" y2={getLineY(20)} stroke="#0f172a" strokeWidth="1" strokeDasharray="5,5" /> */}

            </svg>

            {/* Interaction Layer */}
            <div className="absolute inset-0 z-10">
                {children}
            </div>
        </div>
    );
};
