import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Play, PlayFolder } from '@/types';

interface FolderTreeProps {
    plays: Play[];
    folders: PlayFolder[];
    currentPlayId: string | null;
    onSelectPlay: (id: string) => void;
    onToggleFolder: (id: string) => void;
    onReorderPlay: (draggedId: string, targetId: string) => void;
}

interface PlayRowProps {
    play: Play;
    isSelected: boolean;
    indent: number;
    onSelect: (id: string) => void;
    onDragStart: (id: string) => void;
    onDrop: (e: React.DragEvent, targetId: string) => void;
    isDragging: boolean;
}

const PlayRow: React.FC<PlayRowProps> = ({
    play, isSelected, indent, onSelect, onDragStart, onDrop, isDragging
}) => (
    <div
        draggable
        data-play-id={play.id}
        onDragStart={() => onDragStart(play.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop(e, play.id)}
        onClick={() => onSelect(play.id)}
        className={cn(
            'flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors select-none',
            isSelected ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800',
            isDragging && 'opacity-30'
        )}
        style={{ paddingLeft: `${indent}px` }}
    >
        <GripVertical size={10} className="text-slate-600 shrink-0" />
        <span className="flex-1 truncate">{play.name}</span>
        {(play.tags || []).length > 0 && (
            <div className="flex gap-0.5 shrink-0">
                {(play.tags || []).slice(0, 3).map(tag => (
                    <span
                        key={tag.id}
                        className="w-3 h-3 rounded-full border border-white/20"
                        style={{ backgroundColor: tag.color }}
                        title={tag.text}
                    />
                ))}
            </div>
        )}
    </div>
);

// Height of one folder header row in px — must match the rendered height of the header div.
const FOLDER_HEADER_H = 26;

export const FolderTree: React.FC<FolderTreeProps> = ({
    plays,
    folders,
    currentPlayId,
    onSelectPlay,
    onToggleFolder,
    onReorderPlay,
}) => {
    const [draggedPlayId, setDraggedPlayId] = useState<string | null>(null);

    // Scroll-based sticky tracking
    const scrollRef = useRef<HTMLDivElement>(null);
    const sentinelRefs = useRef<Record<string, HTMLDivElement | null>>({});
    // IDs of top-level folders whose headers have scrolled past the top, in scroll order
    const [stuckFolderIds, setStuckFolderIds] = useState<string[]>([]);

    // Scroll the selected play row into view when currentPlayId changes externally
    useEffect(() => {
        if (!currentPlayId || !scrollRef.current) return;
        const el = scrollRef.current.querySelector<HTMLElement>(`[data-play-id="${currentPlayId}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [currentPlayId]);

    const handleScroll = useCallback(() => {
        const container = scrollRef.current;
        if (!container) return;
        const containerTop = container.getBoundingClientRect().top;

        const stuck: Array<{ id: string; naturalTop: number }> = [];
        for (const [id, sentinel] of Object.entries(sentinelRefs.current)) {
            if (!sentinel) continue;
            const sentinelTop = sentinel.getBoundingClientRect().top;
            if (sentinelTop < containerTop) {
                // naturalTop: sentinel's position in scroll-space (stable for sorting)
                const naturalTop = sentinelTop - containerTop + container.scrollTop;
                stuck.push({ id, naturalTop });
            }
        }
        stuck.sort((a, b) => a.naturalTop - b.naturalTop);
        const newIds = stuck.map(s => s.id);
        setStuckFolderIds(prev =>
            prev.length === newIds.length && prev.every((id, i) => id === newIds[i]) ? prev : newIds
        );
    }, []);

    // Folders follow the routes, so plays can only be reordered, not moved between folders
    const handleDropOnPlay = (e: React.DragEvent, targetId: string) => {
        e.stopPropagation();
        if (!draggedPlayId || draggedPlayId === targetId) return;
        onReorderPlay(draggedPlayId, targetId);
        setDraggedPlayId(null);
    };

    const sortedFolders = [...folders].sort((a, b) => a.order - b.order);

    const playsInFolder = (folderId: string) =>
        plays.filter(p => p.folderId === folderId);

    // Stack index → pixel offset for a folder that has scrolled past the top
    const stickyTop = (folderId: string): number => {
        const idx = stuckFolderIds.indexOf(folderId);
        return idx === -1 ? 0 : idx * FOLDER_HEADER_H;
    };

    const renderFolderHeader = (folder: PlayFolder, topPx?: number) => (
        <div
            key={folder.id}
            className="flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-slate-800/50 sticky z-10 bg-slate-900 cursor-pointer select-none"
            style={{ top: topPx !== undefined ? `${topPx}px` : undefined }}
            onClick={() => onToggleFolder(folder.id)}
        >
            <span className="text-slate-500 shrink-0">
                {folder.isExpanded
                    ? <ChevronDown size={12} />
                    : <ChevronRight size={12} />
                }
            </span>
            <span className="flex-1 text-xs text-slate-300 font-medium truncate">
                {folder.name}
            </span>
            <span className="text-[10px] text-slate-600 shrink-0">
                {playsInFolder(folder.id).length}
            </span>
        </div>
    );

    return (
        <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="max-h-64 overflow-y-auto text-sm scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
        >
            {plays.length === 0 && (
                <div className="px-2 py-1 text-[10px] text-slate-600">No plays yet</div>
            )}

            {sortedFolders.map(folder => (
                <div key={folder.id}>
                    {/* Sentinel: zero-height marker at the folder's natural position.
                        Used by handleScroll to detect when this folder has scrolled past the top. */}
                    <div ref={el => { sentinelRefs.current[folder.id] = el; }} style={{ height: 0 }} />

                    {renderFolderHeader(folder, stickyTop(folder.id))}

                    {folder.isExpanded && playsInFolder(folder.id).map(play => (
                        <PlayRow
                            key={play.id}
                            play={play}
                            isSelected={currentPlayId === play.id}
                            indent={28}
                            onSelect={onSelectPlay}
                            onDragStart={setDraggedPlayId}
                            onDrop={handleDropOnPlay}
                            isDragging={draggedPlayId === play.id}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
};
