import React, { useState } from 'react';
import { Plus, Trash2, FolderOpen, Copy, MoveRight, ChevronUp, ChevronDown, FlipHorizontal2, WandSparkles, BringToFront, SendToBack, Search, X } from 'lucide-react';
import { getPos, S } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Play, Player, PlayTag, PlayFolder } from '@/types';
import { FolderTree } from '@/components/FolderTree';
import { ColorSwatches } from '@/components/ColorSwatches';
import { generatePlayName } from '@/lib/playNames';
import { FORMATIONS, FORMATION_NAMES, type Formation } from '@/lib/playFolders';

interface PlaybookSidebarProps {
    plays: Play[];
    currentPlayId: string | null;
    selectedPlayer: Player | null;
    onSelectPlay: (id: string) => void;
    onNewPlay: () => void;
    onDeletePlay: (id: string) => void;
    onUpdatePlayName: (id: string, name: string) => void;
    onUpdatePlayTags: (id: string, tags: PlayTag[]) => void;
    onUpdatePlayer: (id: string, updates: Partial<Player>) => void;
    onMovePlayerLayer: (id: string, to: 'front' | 'back') => void;
    onSetFormation: (formation: Formation, side: 'left' | 'right') => void;
    onSetPosition: (role: string) => void;
    onCopyPlay: (id: string) => void;
    onMirrorPlay: (id: string) => void;
    // Motion props
    isSettingMotion: boolean;
    onSetMotionMode: () => void;
    onClearMotion: () => void;
    // Folder props
    folders: PlayFolder[];
    onToggleFolder: (id: string) => void;
    onReorderPlay: (draggedId: string, targetId: string) => void;
    className?: string;
    style?: React.CSSProperties;
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
    onUpdatePlayer,
    onMovePlayerLayer,
    onSetFormation,
    onSetPosition,
    onCopyPlay,
    onMirrorPlay,
    onClearMotion,
    folders,
    onToggleFolder,
    onReorderPlay,
    className,
    style
}) => {

    const [formationSide, setFormationSide] = useState<'left' | 'right'>('right');

    // Search by play name or tag text; while searching only folders with matches are shown, expanded
    const [playSearch, setPlaySearch] = useState('');
    const searchTerm = playSearch.trim().toLowerCase();
    const visiblePlays = searchTerm
        ? plays.filter(p => p.name.toLowerCase().includes(searchTerm)
            || (p.tags || []).some(t => t.text.toLowerCase().includes(searchTerm)))
        : plays;
    const visibleFolders = searchTerm
        ? folders
            .filter(f => visiblePlays.some(p => p.folderId === f.id || p.folderId?.startsWith(`${f.id}/`)))
            .map(f => ({ ...f, isExpanded: true }))
        : folders;

    // Build ordered play list matching the folder tree's visual order
    const topFoldersSorted = [...folders]
        .filter(f => !f.parentId)
        .sort((a, b) => a.order - b.order);
    const orderedPlays: typeof plays = [];
    for (const folder of topFoldersSorted) {
        orderedPlays.push(...plays.filter(p => p.folderId === folder.id));
        const subs = [...folders]
            .filter(f => f.parentId === folder.id)
            .sort((a, b) => a.order - b.order);
        for (const sub of subs) {
            orderedPlays.push(...plays.filter(p => p.folderId === sub.id));
        }
    }
    orderedPlays.push(...plays.filter(p => !p.folderId));

    const currentIdx = orderedPlays.findIndex(p => p.id === currentPlayId);
    const prevPlay = currentIdx > 0 ? orderedPlays[currentIdx - 1] : null;
    const nextPlay = currentIdx !== -1 && currentIdx < orderedPlays.length - 1
        ? orderedPlays[currentIdx + 1]
        : null;

    return (
        <div style={style} className={cn("flex flex-col h-full bg-slate-900 text-white w-72 border-r border-slate-700 font-sans", className)}>
            {/* Fixed Header */}
            <div className="p-4 border-b border-slate-700 bg-slate-950/50">
                <h2 className="text-xl font-bold flex items-center gap-2 text-blue-400 mb-3">
                    <FolderOpen size={20} /> Plays
                </h2>

                {/* Play Folder Tree */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] text-slate-500 uppercase font-semibold">Plays</label>
                        <div className="flex gap-0.5">
                            <button
                                onClick={() => prevPlay && onSelectPlay(prevPlay.id)}
                                disabled={!prevPlay}
                                className="p-0.5 text-slate-500 hover:text-slate-200 disabled:opacity-25 disabled:cursor-default transition-colors"
                                title={prevPlay ? `Previous: ${prevPlay.name}` : 'No previous play'}
                            >
                                <ChevronUp size={14} />
                            </button>
                            <button
                                onClick={() => nextPlay && onSelectPlay(nextPlay.id)}
                                disabled={!nextPlay}
                                className="p-0.5 text-slate-500 hover:text-slate-200 disabled:opacity-25 disabled:cursor-default transition-colors"
                                title={nextPlay ? `Next: ${nextPlay.name}` : 'No next play'}
                            >
                                <ChevronDown size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                            type="text"
                            value={playSearch}
                            onChange={(e) => setPlaySearch(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Escape') setPlaySearch(''); }}
                            placeholder="Search plays…"
                            className="w-full bg-slate-900 border border-slate-700 rounded pl-7 pr-7 py-1 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                        />
                        {playSearch && (
                            <button
                                onClick={() => setPlaySearch('')}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                                title="Clear search"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                    <div className="border border-slate-700 bg-slate-900/50">
                        <FolderTree
                            plays={visiblePlays}
                            folders={visibleFolders}
                            emptyMessage={searchTerm ? 'No plays match your search' : undefined}
                            currentPlayId={currentPlayId}
                            onSelectPlay={onSelectPlay}
                            onToggleFolder={onToggleFolder}
                            onReorderPlay={onReorderPlay}
                        />
                    </div>

                    {/* Play Actions - Delete and Duplicate */}
                    {currentPlayId && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => onCopyPlay(currentPlayId)}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-blue-400 py-1.5 px-2 rounded text-xs font-medium border border-slate-700 transition-all flex items-center justify-center gap-1"
                                title="Duplicate Play"
                            >
                                <Copy size={12} /> Dupe
                            </button>
                            <button
                                onClick={() => onMirrorPlay(currentPlayId)}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-purple-400 py-1.5 px-2 rounded text-xs font-medium border border-slate-700 transition-all flex items-center justify-center gap-1"
                                title="Create mirrored copy of this play"
                            >
                                <FlipHorizontal2 size={12} /> Mirror
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
                                <Trash2 size={12} /> Del
                            </button>
                        </div>
                    )}
                </div>

                {/* Play Name Editor */}
                {currentPlayId && (
                    <div className="mt-3">
                        <label className="text-[10px] text-slate-500 uppercase font-semibold">Play Name</label>
                        <div className="flex gap-1.5">
                            <input
                                type="text"
                                value={plays.find(p => p.id === currentPlayId)?.name || ''}
                                onChange={(e) => onUpdatePlayName(currentPlayId, e.target.value)}
                                className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="Enter play name..."
                            />
                            <button
                                onClick={() => {
                                    const play = plays.find(p => p.id === currentPlayId);
                                    const name = play && generatePlayName(play);
                                    if (name) onUpdatePlayName(currentPlayId, name);
                                }}
                                className="shrink-0 px-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-blue-300 border border-slate-700 rounded transition-colors"
                                title="Generate name from the routes"
                            >
                                <WandSparkles size={13} />
                            </button>
                        </div>
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
                                    <ColorSwatches
                                        value={tag.color}
                                        onChange={(color) => {
                                            const currentTags = [...(plays.find(p => p.id === currentPlayId)?.tags || [])];
                                            currentTags[idx] = { ...tag, color };
                                            onUpdatePlayTags(currentPlayId, currentTags);
                                        }}
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
                        <ColorSwatches
                            value={selectedPlayer.color}
                            onChange={(color) => onUpdatePlayer(selectedPlayer.id, { color })}
                            className="justify-end"
                        />

                        {/* Layering: routes of players further back are drawn on top */}
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">Route Layer</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onMovePlayerLayer(selectedPlayer.id, 'front')}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 py-1.5 px-2 rounded text-[10px] text-slate-300 border border-slate-700 flex items-center justify-center gap-1"
                                    title="Draw this player's routes above the others"
                                >
                                    <BringToFront size={12} /> Bring to front
                                </button>
                                <button
                                    onClick={() => onMovePlayerLayer(selectedPlayer.id, 'back')}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 py-1.5 px-2 rounded text-[10px] text-slate-300 border border-slate-700 flex items-center justify-center gap-1"
                                    title="Draw this player's routes below the others"
                                >
                                    <SendToBack size={12} /> Send to back
                                </button>
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
                    </div>
                )}

                {currentPlayId && (
                    <div className="p-4 border-t border-slate-700 space-y-2 bg-slate-950/30">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">Formation</label>
                            {/* Strong side */}
                            <div className="flex bg-slate-900 rounded p-0.5 border border-slate-700">
                                {(['left', 'right'] as const).map(side => (
                                    <button
                                        key={side}
                                        onClick={() => setFormationSide(side)}
                                        className={cn(
                                            "px-2 py-0.5 rounded text-[10px] font-medium transition-all capitalize",
                                            formationSide === side ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"
                                        )}
                                    >
                                        {side}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {FORMATIONS.map(formation => (
                                <button
                                    key={formation}
                                    onClick={() => onSetFormation(formation, formationSide)}
                                    className="bg-slate-800 hover:bg-slate-700 py-1.5 px-2 rounded text-[10px] text-slate-300 border border-slate-700"
                                >
                                    {FORMATION_NAMES[formation]}
                                </button>
                            ))}
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
            </div>
        </div >
    );
};
