import React from 'react';
import { MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COVERAGES, defaultZone, defenderColor } from '@/lib/defense';
import { ColorSwatches } from '@/components/ColorSwatches';
import type { Coverage, Defender, Play, PlayDefense } from '@/types';

interface DefenseControlsProps {
    play: Play | null;
    defense: PlayDefense | null;
    selectedDefenderId: string | null;
    onApplyCoverage: (coverage: Coverage) => void;
    onUpdateDefender: (id: string, updates: Partial<Defender>) => void;
    isDrawingArrow: boolean;
    onStartArrow: () => void;
    onFinishArrow: () => void;
    className?: string;
    style?: React.CSSProperties;
}

/** Coverage presets and the selected defender's assignment — shown below the field in the defense view. */
export const DefenseControls: React.FC<DefenseControlsProps> = ({
    play,
    defense,
    selectedDefenderId,
    onApplyCoverage,
    onUpdateDefender,
    isDrawingArrow,
    onStartArrow,
    onFinishArrow,
    className,
    style
}) => {
    const defenders = defense?.defenders ?? [];
    const selectedIndex = defenders.findIndex(d => d.id === selectedDefenderId);
    const selected = selectedIndex >= 0 ? defenders[selectedIndex] : null;
    const selectedColor = selected ? defenderColor(selected, selectedIndex) : '#000000';

    const toggleButton = (active: boolean, activeClass: string) => cn(
        "px-2 py-1 big:py-1.5 rounded text-[10px] big:text-sm font-medium border transition-all",
        active ? `${activeClass} text-white` : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
    );

    return (
        <div
            style={style}
            className={cn(
                "p-2 big:p-3 rounded-lg bg-slate-900 border border-red-900/60 text-white flex flex-col gap-1.5 big:gap-2.5",
                !play && "opacity-40 pointer-events-none select-none",
                className
            )}
        >
            {/* Coverage presets */}
            <div className="flex gap-1.5 big:gap-2">
                <div className="flex-1 grid grid-cols-7 gap-1 big:gap-1.5">
                    {COVERAGES.map(c => (
                        <button
                            key={c.value}
                            onClick={() => onApplyCoverage(c.value)}
                            className={cn(
                                "px-1 py-1 big:py-2 rounded text-[10px] big:text-sm border transition-all truncate",
                                defense?.coverage === c.value
                                    ? "bg-red-700 border-red-500 text-white shadow-sm"
                                    : "bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600"
                            )}
                            title={c.description}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Selected defender: color and arrow, then rush, zone or man on one of the offensive players */}
            <div className="min-h-[60px] big:min-h-[76px] flex flex-col justify-center gap-1.5">
                {selected ? (
                    <>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] big:text-xs text-slate-500 uppercase font-semibold mr-1">Defender</span>
                            <input
                                type="color"
                                value={selectedColor}
                                onChange={(e) => onUpdateDefender(selected.id, { color: e.target.value })}
                                className="w-8 h-6 bg-slate-900 border border-slate-700 rounded cursor-pointer p-0.5"
                                title="Defender color"
                            />
                            <ColorSwatches value={selectedColor} onChange={(color) => onUpdateDefender(selected.id, { color })} />
                            <div className="ml-auto flex items-center gap-1.5">
                                {isDrawingArrow ? (
                                    <button
                                        onClick={onFinishArrow}
                                        className="bg-emerald-900/30 hover:bg-emerald-900/50 px-2 py-1 big:py-1.5 rounded text-xs big:text-sm text-emerald-300 border border-emerald-800 flex items-center gap-1 animate-pulse"
                                    >
                                        <MousePointer2 size={12} /> Finish
                                    </button>
                                ) : (
                                    <button
                                        onClick={onStartArrow}
                                        className="bg-blue-900/30 hover:bg-blue-900/50 px-2 py-1 big:py-1.5 rounded text-xs big:text-sm text-blue-300 border border-blue-800 flex items-center gap-1"
                                        title="Draw an arrow for this defender: tap points on the field, then Finish (or Enter)"
                                    >
                                        <MousePointer2 size={12} /> {selected.path?.length ? 'Redraw' : 'Draw'}
                                    </button>
                                )}
                                {selected.path?.length && !isDrawingArrow ? (
                                    <button
                                        onClick={() => onUpdateDefender(selected.id, { path: undefined })}
                                        className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-2 py-1 big:py-1.5 rounded text-xs big:text-sm border border-red-900/30"
                                        title="Remove the arrow"
                                    >
                                        Clear arrow
                                    </button>
                                ) : null}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <button
                                onClick={() => onUpdateDefender(selected.id, { rush: !selected.rush, manTargetId: null, zone: null })}
                                className={toggleButton(!!selected.rush, 'bg-red-700 border-red-500')}
                            >
                                Rush
                            </button>
                            <button
                                onClick={() => onUpdateDefender(selected.id, { zone: selected.zone ? null : defaultZone(), rush: false, manTargetId: null })}
                                className={toggleButton(!!selected.zone, 'bg-violet-700 border-violet-500')}
                            >
                                Zone
                            </button>
                            <span className={cn(
                                "px-2 py-1 big:py-1.5 rounded text-[10px] big:text-sm font-medium border",
                                selected.manTargetId ? "bg-red-900/60 border-red-700 text-white" : "border-transparent text-slate-500"
                            )}>
                                {selected.manTargetId ? 'Man · tap the receiver again to remove' : 'Man: tap a receiver on the field'}
                            </span>
                        </div>
                    </>
                ) : (
                    <span className="text-[10px] big:text-xs text-slate-500">
                        {defense?.coverage
                            ? 'Select a defender to change its color, arrow and assignment · drag inside its zone to move it, the corner square to resize it'
                            : 'Pick a coverage to line the defenders up against this formation, or drag them yourself'}
                    </span>
                )}
            </div>
        </div>
    );
};
