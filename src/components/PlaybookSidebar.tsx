import React from 'react';
import { Plus, Trash2, FolderOpen, MousePointer2, Copy, MoveRight } from 'lucide-react';
import { ROUTE_PRESETS } from '@/lib/routes';
import { getPos, S } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Play, Player, PlayTag } from '@/types';

interface PlaybookSidebarProps {
    plays: Play[];
    currentPlayId: string | null;
    selectedPlayer: Player | null;
    onSelectPlay: (id: string) => void;
    onNewPlay: () => void;
    onDeletePlay: (id: string) => void;
    onUpdatePlayName: (id: string, name: string) => void;
    onUpdatePlayTags: (id: string, tags: PlayTag[]) => void;
    onStartDrawing: (type: 'primary' | 'option' | 'check' | 'endzone') => void;
    onClearRoutes: () => void;
    onUpdatePlayer: (id: string, updates: Partial<Player>) => void;
    onSetFormation: (type: 'strong-left' | 'strong-right') => void;
    onSetPosition: (role: string) => void;
    onApplyRoute: (preset: any) => void;
    onExportPlaybook: () => void;
    onCopyPlay: (id: string) => void;
    activeRouteType: 'primary' | 'option' | 'check' | 'endzone';
    onSetActiveRouteType: (type: 'primary' | 'option' | 'check' | 'endzone') => void;
    isDrawing: boolean;
    onFinishDrawing: () => void;
    // Motion props
    isSettingMotion: boolean;
    onSetMotionMode: () => void;
    onClearMotion: () => void;
    className?: string;
}

export const PlaybookSidebar: React.FC<PlaybookSidebarProps> = ({
    plays,
    currentPlayId,
    selectedPlayer,
    onSelectPlay,
    onNewPlay,
    onDeletePlay,
    onUpdatePlayName,
    onUpdatePlayTags,
    onStartDrawing,
    onClearRoutes,
    onUpdatePlayer,
    onSetFormation,
    onSetPosition,
    onApplyRoute,
    onExportPlaybook,
    onCopyPlay,
    activeRouteType,
    onSetActiveRouteType,
    isDrawing,
    onFinishDrawing,
    onClearMotion,
    className
}) => {
    return (
        <div className={cn("flex flex-col h-full bg-slate-900 text-white w-72 border-r border-slate-700 font-sans", className)}>
            {/* Fixed Header */}
            <div className="p-4 border-b border-slate-700 bg-slate-950/50">
                <h2 className="text-xl font-bold flex items-center gap-2 text-blue-400 mb-3">
                    <FolderOpen size={20} /> Plays
                </h2>

                {/* Play Selector Dropdown */}
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 uppercase font-semibold">Current Play</label>
                    <select
                        value={currentPlayId || ''}
                        onChange={(e) => onSelectPlay(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    >
                        <option value="" disabled>Select a play...</option>
                        {[...plays].sort((a, b) => a.name.localeCompare(b.name)).map((play) => (
                            <option key={play.id} value={play.id}>
                                {play.name}
                            </option>
                        ))}
                    </select>

                    {/* Play Actions - Delete and Duplicate */}
                    {currentPlayId && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => onCopyPlay(currentPlayId)}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-blue-400 py-1.5 px-2 rounded text-xs font-medium border border-slate-700 transition-all flex items-center justify-center gap-1"
                                title="Duplicate Play"
                            >
                                <Copy size={12} /> Duplicate
                            </button>
                            <button
                                onClick={() => {
                                    const playName = plays.find(p => p.id === currentPlayId)?.name;
                                    if (window.confirm(`Are you sure you want to delete "${playName}"?`)) {
                                        onDeletePlay(currentPlayId);
                                    }
                                }}
                                className="flex-1 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 py-1.5 px-2 rounded text-xs font-medium border border-slate-700 hover:border-red-900/30 transition-all flex items-center justify-center gap-1"
                                title="Delete Play"
                            >
                                <Trash2 size={12} /> Delete
                            </button>
                        </div>
                    )}
                </div>

                {/* Play Name Editor */}
                {currentPlayId && (
                    <div className="mt-3">
                        <label className="text-[10px] text-slate-500 uppercase font-semibold">Play Name</label>
                        <input
                            type="text"
                            value={plays.find(p => p.id === currentPlayId)?.name || ''}
                            onChange={(e) => onUpdatePlayName(currentPlayId, e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Enter play name..."
                        />
                    </div>
                )}

                {/* Play Tags Editor */}
                {currentPlayId && (
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">Play Tags (Markers)</label>
                            <button
                                onClick={() => {
                                    const currentPlay = plays.find(p => p.id === currentPlayId);
                                    const currentTags = currentPlay?.tags || [];
                                    onUpdatePlayTags(currentPlayId, [
                                        ...currentTags,
                                        { id: crypto.randomUUID(), text: 'T', color: '#ec4899' }
                                    ]);
                                }}
                                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                            >
                                <Plus size={10} /> Add Tag
                            </button>
                        </div>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                            {(plays.find(p => p.id === currentPlayId)?.tags || []).map((tag, idx) => (
                                <div key={tag.id} className="flex gap-1.5 items-center">
                                    <input
                                        type="text"
                                        value={tag.text}
                                        maxLength={2}
                                        onChange={(e) => {
                                            const currentTags = [...(plays.find(p => p.id === currentPlayId)?.tags || [])];
                                            currentTags[idx] = { ...tag, text: e.target.value };
                                            onUpdatePlayTags(currentPlayId, currentTags);
                                        }}
                                        className="w-8 bg-slate-900 border border-slate-700 rounded px-1 py-1 text-center text-xs text-white font-bold"
                                    />
                                    <input
                                        type="color"
                                        value={tag.color}
                                        onChange={(e) => {
                                            const currentTags = [...(plays.find(p => p.id === currentPlayId)?.tags || [])];
                                            currentTags[idx] = { ...tag, color: e.target.value };
                                            onUpdatePlayTags(currentPlayId, currentTags);
                                        }}
                                        className="w-10 h-6 bg-slate-900 border border-slate-700 rounded cursor-pointer p-0.5"
                                    />
                                    <button
                                        onClick={() => {
                                            const currentTags = (plays.find(p => p.id === currentPlayId)?.tags || []).filter(t => t.id !== tag.id);
                                            onUpdatePlayTags(currentPlayId, currentTags);
                                        }}
                                        className="text-slate-500 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">

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

                        {/* Motion Controls */}
                        <div className="pt-2 border-t border-slate-700/50">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        if (selectedPlayer.motion) {
                                            onClearMotion();
                                        } else {
                                            // Initialize motion at current position + offset (e.g. 2 yards right)
                                            // Set default depth to 2 yards behind LOS
                                            // Move "inside" (towards center line at 312.5px) by 2 yards
                                            const defaultDepthPos = getPos(0, -2);
                                            const CENTER_X = 312.5;
                                            const xOffset = selectedPlayer.position.x < CENTER_X ? (2 * S) : -(2 * S);

                                            onUpdatePlayer(selectedPlayer.id, {
                                                motion: {
                                                    x: selectedPlayer.position.x + xOffset,
                                                    y: defaultDepthPos.y
                                                }
                                            });
                                        }
                                    }}
                                    className={cn(
                                        "flex-1 py-1.5 px-2 rounded text-[10px] font-medium border transition-all flex items-center justify-center gap-1",
                                        selectedPlayer.motion
                                            ? "bg-red-900/20 text-red-400 border-red-900/30 hover:bg-red-900/40"
                                            : "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700"
                                    )}
                                >
                                    {selectedPlayer.motion ? (
                                        <><Trash2 size={12} /> Clear Motion</>
                                    ) : (
                                        <><MoveRight size={12} /> Set Motion</>
                                    )}
                                </button>
                            </div>

                            {selectedPlayer.motion && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase font-semibold">Motion Align</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={(selectedPlayer.motion.x / 25 - 12.5).toFixed(1)}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                const newX = (12.5 + val) * 25;
                                                onUpdatePlayer(selectedPlayer.id, {
                                                    motion: { ...selectedPlayer.motion!, x: newX }
                                                });
                                            }}
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase font-semibold">Motion Depth</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={(selectedPlayer.motion.y / 25 - 20).toFixed(1)}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                const newY = (20 + val) * 25;
                                                onUpdatePlayer(selectedPlayer.id, {
                                                    motion: { ...selectedPlayer.motion!, y: newY }
                                                });
                                            }}
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            )}
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
                                    {ROUTE_PRESETS.map(preset => {
                                        const isActive = selectedPlayer.routes.find(r => r.type === activeRouteType)?.preset === preset.value;
                                        return (
                                            <button
                                                key={preset.value}
                                                onClick={() => onApplyRoute(preset.value)}
                                                className={cn(
                                                    "px-1 py-1.5 rounded text-[10px] border transition-all truncate",
                                                    isActive
                                                        ? "bg-blue-600 border-blue-400 text-white shadow-sm"
                                                        : "bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600"
                                                )}
                                                title={preset.label}
                                            >
                                                {preset.label.replace(' (5)', '')}
                                            </button>
                                        );
                                    })}
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

                {currentPlayId && (
                    <div className="p-4 border-t border-slate-700 space-y-2 bg-slate-950/30">
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
                    </div>
                )}
            </div>

            {/* Fixed Footer - Action Buttons */}
            <div className="p-4 border-t border-slate-700 space-y-2 bg-slate-950/30">
                <button
                    onClick={onNewPlay}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 px-4 rounded-md flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Plus size={18} /> New Play
                </button>

                <div className="pt-2 border-t border-slate-700/50">
                    <button
                        onClick={onExportPlaybook}
                        className="w-full bg-slate-800/50 hover:bg-slate-800 text-slate-400 py-2 px-4 rounded-md flex items-center justify-center gap-2 text-xs font-medium border border-slate-700/50 transition-all"
                        title="Export and Share Playbook"
                    >
                        Export & Share
                    </button>
                </div>
            </div>
        </div >
    );
};
