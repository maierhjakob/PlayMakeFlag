import React, { useState, useRef, useEffect } from 'react';
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
    /** Shown instead of the folders when there are no plays */
    emptyMessage?: string;
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
// While scrolling, the formation header sticks at the top and the depth header right below it.
const FOLDER_HEADER_H = 26;

export const FolderTree: React.FC<FolderTreeProps> = ({
    plays,
    folders,
    currentPlayId,
    onSelectPlay,
    onToggleFolder,
    onReorderPlay,
    emptyMessage = 'No plays yet',
}) => {
    const [draggedPlayId, setDraggedPlayId] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

    // Scroll the selected play row into view when currentPlayId changes externally
    useEffect(() => {
        if (!currentPlayId || !scrollRef.current) return;
        const el = scrollRef.current.querySelector<HTMLElement>(`[data-play-id="${currentPlayId}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [currentPlayId]);

    // Folders follow the routes, so plays can only be reordered, not moved between folders
    const handleDropOnPlay = (e: React.DragEvent, targetId: string) => {
        e.stopPropagation();
        if (!draggedPlayId || draggedPlayId === targetId) return;
        onReorderPlay(draggedPlayId, targetId);
        setDraggedPlayId(null);
    };

    // Formation folders on top, depth sub-folders inside; plays live in the sub-folders
    const topFolders = folders.filter(f => !f.parentId).sort((a, b) => a.order - b.order);

    const subFolders = (parentId: string) =>
        folders.filter(f => f.parentId === parentId).sort((a, b) => a.order - b.order);

    const playsInFolder = (folderId: string) =>
        plays.filter(p => p.folderId === folderId);

    const playCount = (folder: PlayFolder) =>
        playsInFolder(folder.id).length + subFolders(folder.id).reduce((sum, sub) => sum + playsInFolder(sub.id).length, 0);

    const renderFolderHeader = (folder: PlayFolder, isSubFolder: boolean) => (
        <div
            key={folder.id}
            className={cn(
                "flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-slate-800 cursor-pointer select-none sticky bg-slate-900",
                isSubFolder ? "z-10" : "z-20"
            )}
            style={{
                height: FOLDER_HEADER_H,
                paddingLeft: isSubFolder ? '20px' : '8px',
                top: isSubFolder ? FOLDER_HEADER_H : 0,
            }}
            onClick={() => onToggleFolder(folder.id)}
        >
            <span className="text-slate-500 shrink-0">
                {folder.isExpanded
                    ? <ChevronDown size={12} />
                    : <ChevronRight size={12} />
                }
            </span>
            <span className={cn("flex-1 text-xs truncate", isSubFolder ? "text-slate-400" : "text-slate-300 font-medium")}>
                {folder.name}
            </span>
            <span className="text-[10px] text-slate-600 shrink-0">
                {playCount(folder)}
            </span>
        </div>
    );

    return (
        <div
            ref={scrollRef}
            className="max-h-64 overflow-y-auto text-sm scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
        >
            {plays.length === 0 && (
                <div className="px-2 py-1 text-[10px] text-slate-600">{emptyMessage}</div>
            )}

            {topFolders.map(folder => (
                <div key={folder.id}>
                    {renderFolderHeader(folder, false)}

                    {folder.isExpanded && subFolders(folder.id).map(sub => (
                        <div key={sub.id}>
                            {renderFolderHeader(sub, true)}
                            {sub.isExpanded && playsInFolder(sub.id).map(play => (
                                <PlayRow
                                    key={play.id}
                                    play={play}
                                    isSelected={currentPlayId === play.id}
                                    indent={36}
                                    onSelect={onSelectPlay}
                                    onDragStart={setDraggedPlayId}
                                    onDrop={handleDropOnPlay}
                                    isDragging={draggedPlayId === play.id}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};
