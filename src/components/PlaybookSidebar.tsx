import React from 'react';
import { Plus, Trash2, Save, FolderOpen, MousePointer2 } from 'lucide-react';
import { ROUTE_PRESETS } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { Play, Player } from '@/types';

interface PlaybookSidebarProps {
    plays: Play[];
    currentPlayId: string | null;
    selectedPlayer: Player | null;
    onSelectPlay: (id: string) => void;
    onNewPlay: () => void;
    onSavePlay: () => void;
    onDeletePlay: (id: string) => void;
    onStartDrawing: (type: 'primary' | 'option' | 'check' | 'endzone') => void;
    onClearRoutes: () => void;
    onAddPlayer: () => void;
    onUpdatePlayer: (id: string, updates: Partial<Player>) => void;
    onSetFormation: (type: 'strong-left' | 'strong-right') => void;
    onSetPosition: (role: string) => void;
    onApplyRoute: (preset: any) => void;
    activeRouteType: 'primary' | 'option' | 'check' | 'endzone';
    onSetActiveRouteType: (type: 'primary' | 'option' | 'check' | 'endzone') => void;
    isDrawing: boolean;
    onFinishDrawing: () => void;
    className?: string;
}

export const PlaybookSidebar: React.FC<PlaybookSidebarProps> = ({
    plays,
    currentPlayId,
    selectedPlayer,
    onSelectPlay,
    onNewPlay,
    onSavePlay,
    onDeletePlay,
    onStartDrawing,
    onClearRoutes,
    onAddPlayer,
    onUpdatePlayer,
    onSetFormation,
    onSetPosition,
    onApplyRoute,
    activeRouteType,
    onSetActiveRouteType,
    isDrawing,
    onFinishDrawing,
    className
}) => {
    return (
        <div className={cn("flex flex-col h-full bg-slate-900 text-white w-72 border-r border-slate-700 font-sans", className)}>
            <div className="p-4 border-b border-slate-700 bg-slate-950/50">
                <h2 className="text-xl font-bold flex items-center gap-2 text-blue-400">
                    <FolderOpen size={20} /> Playbook
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {plays.length === 0 && (
                    <div className="text-slate-500 text-center py-8 text-sm italic">
                        No plays saved yet.
                        <br />Click "New Play" to start.
                    </div>
                )}
                {plays.map((play) => (
                    <button
                        key={play.id}
                        onClick={() => onSelectPlay(play.id)}
                        className={cn(
                            "w-full text-left p-3 rounded-md transition-all flex items-center justify-between group border border-transparent",
                            currentPlayId === play.id
                                ? "bg-blue-600/20 border-blue-500/50 text-white shadow-sm"
                                : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                        )}
                    >
                        <span className="truncate font-medium text-sm">{play.name}</span>
                        <span
                            className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 transition-opacity z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeletePlay(play.id);
                            }}
                        >
                            <Trash2 size={14} />
                        </span>
                    </button>
                ))}
            </div>

            {selectedPlayer && (
                <div className="p-4 bg-slate-800/50 border-t border-slate-700 space-y-3">
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                        Selected Player
                    </div>

                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">Label</label>
                            <input
                                type="text"
                                value={selectedPlayer.label}
                                onChange={(e) => onUpdatePlayer(selectedPlayer.id, { label: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="w-12">
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">Color</label>
                            <input
                                type="color"
                                value={selectedPlayer.color}
                                onChange={(e) => onUpdatePlayer(selectedPlayer.id, { color: e.target.value })}
                                className="w-full h-[26px] bg-slate-900 border border-slate-700 rounded cursor-pointer p-0.5"
                            />
                        </div>
                    </div>

                    {/* Position Selector */}
                    <div>
                        <label className="text-[10px] text-slate-500 uppercase font-semibold">Position Role</label>
                        <select
                            value={Object.entries({
                                'C': 'Center',
                                'QB': 'Quarterback',
                                'WR-L': 'Wide Left',
                                'WR-R': 'Wide Right',
                                'SL': 'Slot Left',
                                'SR': 'Slot Right'
                            }).find(([key]) => key === selectedPlayer.role)?.[0] || ''}
                            onChange={(e) => onSetPosition(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                        >
                            <option value="" disabled>Select Position...</option>
                            <option value="C">Center</option>
                            <option value="QB">Quarterback</option>
                            <option value="WR-L">Wide Left</option>
                            <option value="WR-R">Wide Right</option>
                            <option value="SL">Slot Left</option>
                            <option value="SR">Slot Right</option>
                        </select>
                    </div>

                    {/* Positioning Controls */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">Alignment (Yds)</label>
                            <input
                                type="number"
                                step="0.5"
                                value={(selectedPlayer.position.x / 25 - 12.5).toFixed(1)}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    const newX = (12.5 + val) * 25;
                                    onUpdatePlayer(selectedPlayer.id, {
                                        position: { ...selectedPlayer.position, x: newX }
                                    });
                                }}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                            />
                            <div className="text-[9px] text-slate-600 text-right pr-1">(- Left / + Right)</div>
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">Depth (Yds)</label>
                            <input
                                type="number"
                                step="0.5"
                                value={(selectedPlayer.position.y / 25 - 20).toFixed(1)}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    const newY = (20 + val) * 25;
                                    onUpdatePlayer(selectedPlayer.id, {
                                        position: { ...selectedPlayer.position, y: newY }
                                    });
                                }}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                            />
                            <div className="text-[9px] text-slate-600 text-right pr-1">(+ Back)</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/50">
                        {/* Route Type Toggle */}
                        <div className="col-span-2">
                            <div className="text-[10px] text-slate-500 uppercase font-semibold mb-2 text-center">Active Route Layer</div>
                            <div className="flex bg-slate-900 rounded p-1 border border-slate-700">
                                <button
                                    onClick={() => onSetActiveRouteType('primary')}
                                    className={cn(
                                        "flex-1 py-1 rounded text-[10px] font-medium transition-all",
                                        activeRouteType === 'primary' ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
                                    )}
                                >
                                    Primary (Solid)
                                </button>
                                <button
                                    onClick={() => onSetActiveRouteType('option')}
                                    className={cn(
                                        "flex-1 py-1 rounded text-[10px] font-medium transition-all",
                                        activeRouteType === 'option' ? "bg-amber-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
                                    )}
                                >
                                    Option
                                </button>
                                <button
                                    onClick={() => onSetActiveRouteType('check')}
                                    className={cn(
                                        "flex-1 py-1 rounded text-[10px] font-medium transition-all",
                                        activeRouteType === 'check' ? "bg-slate-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
                                    )}
                                >
                                    Check
                                </button>
                                <button
                                    onClick={() => onSetActiveRouteType('endzone')}
                                    className={cn(
                                        "flex-1 py-1 rounded text-[10px] font-medium transition-all",
                                        activeRouteType === 'endzone' ? "bg-pink-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
                                    )}
                                >
                                    Endzone
                                </button>
                            </div>
                        </div>

                        {/* Route Presets */}
                        <div className="col-span-2 mt-1">
                            <div className="text-[10px] text-slate-500 uppercase font-semibold mb-2">Preset Routes</div>
                            <div className="grid grid-cols-3 gap-1.5">
                                {ROUTE_PRESETS.map(preset => (
                                    <button
                                        key={preset.value}
                                        onClick={() => onApplyRoute(preset.value)}
                                        className="bg-slate-700 hover:bg-slate-600 px-1 py-1.5 rounded text-[10px] text-slate-200 border border-slate-600 transition-colors truncate"
                                        title={preset.label}
                                    >
                                        {preset.label.replace(' (5)', '')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="col-span-2 pt-2 border-t border-slate-700/50 flex gap-2">
                            {isDrawing ? (
                                <button
                                    onClick={onFinishDrawing}
                                    className="flex-1 bg-emerald-900/30 hover:bg-emerald-900/50 px-2 py-1.5 rounded text-xs text-emerald-300 border border-emerald-800 transition-colors flex items-center justify-center gap-1 animate-pulse"
                                >
                                    <MousePointer2 size={12} /> Finish
                                </button>
                            ) : (
                                <button
                                    onClick={() => onStartDrawing('primary')}
                                    className="flex-1 bg-blue-900/30 hover:bg-blue-900/50 px-2 py-1.5 rounded text-xs text-blue-300 border border-blue-800 transition-colors flex items-center justify-center gap-1"
                                >
                                    <MousePointer2 size={12} /> Draw
                                </button>
                            )}
                            <button
                                onClick={onClearRoutes}
                                className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-2 py-1.5 rounded text-xs border border-red-900/30 transition-colors"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 border-t border-slate-700 space-y-2 bg-slate-950/30">
                {currentPlayId && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => onSetFormation('strong-left')}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 py-1.5 px-2 rounded text-[10px] text-slate-400 border border-slate-700"
                        >
                            Strong Left
                        </button>
                        <button
                            onClick={() => onSetFormation('strong-right')}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 py-1.5 px-2 rounded text-[10px] text-slate-400 border border-slate-700"
                        >
                            Strong Right
                        </button>
                    </div>
                )}
                {currentPlayId && (
                    <button
                        onClick={onAddPlayer}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 py-2 px-4 rounded-md flex items-center justify-center gap-2 text-sm font-medium border border-slate-700 transition-all mb-2"
                    >
                        <Plus size={16} /> Add Player
                    </button>
                )}

                <button
                    onClick={onNewPlay}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-md flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Plus size={18} /> New Play
                </button>
                <button
                    onClick={onSavePlay}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 px-4 rounded-md flex items-center justify-center gap-2 text-sm font-medium border border-slate-700 transition-all"
                >
                    <Save size={18} /> Save Changes
                </button>
            </div>
        </div>
    );
};
