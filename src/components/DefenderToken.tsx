import React from 'react';
import { cn } from '@/lib/utils';
import type { Defender } from '@/types';

interface DefenderTokenProps {
    defender: Defender;
    color: string;
    isSelected?: boolean;
    /** Press on the token: select it and start dragging */
    onPress: (id: string) => void;
}

/** A defender on the editor field: a colored circle like the offense's players, draggable. */
export const DefenderToken: React.FC<DefenderTokenProps> = ({ defender, color, isSelected, onPress }) => (
    <div
        onMouseDown={(e) => { e.stopPropagation(); onPress(defender.id); }}
        onTouchStart={(e) => { e.stopPropagation(); onPress(defender.id); }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
            "absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-700 shadow-md cursor-move z-20",
            isSelected && "ring-2 ring-cyan-400 border-white"
        )}
        style={{ left: defender.position.x, top: defender.position.y, backgroundColor: color }}
        title={defender.rush ? 'Rusher' : defender.manTargetId ? 'Man coverage' : defender.zone ? 'Zone coverage' : 'Defender'}
    />
);
