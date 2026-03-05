import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronDown, GripVertical, FolderPlus, Pencil, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Play, PlayFolder } from '@/types';

interface FolderTreeProps {
    plays: Play[];
    folders: PlayFolder[];
    currentPlayId: string | null;
    onSelectPlay: (id: string) => void;
    onToggleFolder: (id: string) => void;
    onCreateFolder: (name: string, parentId?: string) => void;
    onDeleteFolder: (id: string) => void;
    onRenameFolder: (id: string, name: string) => void;
    onAssignPlayToFolder: (playId: string, folderId: string | undefined) => void;
    onReorderPlayInFolder: (draggedId: string, targetId: string, folderId: string | undefined) => void;
}

interface PlayRowProps {
    play: Play;
    isSelected: boolean;
    indent: number;
    folderId: string | undefined;
    onSelect: (id: string) => void;
    onDragStart: (id: string) => void;
    onDragOver: (e: React.DragEvent, targetId: string, folderId: string | undefined) => void;
    onDrop: (e: React.DragEvent, targetId: string, folderId: string | undefined) => void;
    isDragging: boolean;
}

const PlayRow: React.FC<PlayRowProps> = ({
    play, isSelected, indent, folderId, onSelect, onDragStart, onDragOver, onDrop, isDragging
}) => (
    <div
        draggable
        data-play-id={play.id}
        onDragStart={() => onDragStart(play.id)}
        onDragOver={(e) => { e.preventDefault(); onDragOver(e, play.id, folderId); }}
        onDrop={(e) => onDrop(e, play.id, folderId)}
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
    onCreateFolder,
    onDeleteFolder,
    onRenameFolder,
    onAssignPlayToFolder,
    onReorderPlayInFolder,
}) => {
    const [draggedPlayId, setDraggedPlayId] = useState<string | null>(null);
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [creatingIn, setCreatingIn] = useState<string | 'root' | null>(null);
    const [newFolderName, setNewFolderName] = useState('');
    const newFolderInputRef = useRef<HTMLInputElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

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

    const startEditing = (folder: PlayFolder) => {
        setEditingFolderId(folder.id);
        setEditingName(folder.name);
        setTimeout(() => editInputRef.current?.focus(), 0);
    };

    const commitEdit = () => {
        if (editingFolderId && editingName.trim()) {
            onRenameFolder(editingFolderId, editingName.trim());
        }
        setEditingFolderId(null);
        setEditingName('');
    };

    const startCreating = (parentId: string | 'root') => {
        setCreatingIn(parentId);
        setNewFolderName('');
        setTimeout(() => newFolderInputRef.current?.focus(), 0);
    };

    const commitCreate = () => {
        const name = newFolderName.trim();
        if (name && creatingIn !== null) {
            onCreateFolder(name, creatingIn === 'root' ? undefined : creatingIn);
        }
        setCreatingIn(null);
        setNewFolderName('');
    };

    const handleDragOver = (e: React.DragEvent, _targetId: string, _folderId: string | undefined) => {
        e.preventDefault();
    };

    const handleDropOnPlay = (e: React.DragEvent, targetId: string, folderId: string | undefined) => {
        e.stopPropagation();
        if (!draggedPlayId || draggedPlayId === targetId) return;
        onReorderPlayInFolder(draggedPlayId, targetId, folderId);
        setDraggedPlayId(null);
    };

    const handleDropOnFolder = (e: React.DragEvent, folderId: string) => {
        e.stopPropagation();
        if (!draggedPlayId) return;
        onAssignPlayToFolder(draggedPlayId, folderId);
        setDraggedPlayId(null);
    };

    const handleDropOnUncategorized = (e: React.DragEvent) => {
        e.stopPropagation();
        if (!draggedPlayId) return;
        onAssignPlayToFolder(draggedPlayId, undefined);
        setDraggedPlayId(null);
    };

    const topFolders = [...folders]
        .filter(f => !f.parentId)
        .sort((a, b) => a.order - b.order);

    const subFolders = (parentId: string) =>
        [...folders]
            .filter(f => f.parentId === parentId)
            .sort((a, b) => a.order - b.order);

    const playsInFolder = (folderId: string) =>
        plays.filter(p => p.folderId === folderId);

    const uncategorizedPlays = plays.filter(p => !p.folderId);

    // Stack index → pixel offset for a folder that has scrolled past the top
    const stickyTop = (folderId: string): number => {
        const idx = stuckFolderIds.indexOf(folderId);
        return idx === -1 ? 0 : idx * FOLDER_HEADER_H;
    };

    const renderFolderHeader = (folder: PlayFolder, isSubFolder: boolean, topPx?: number) => (
        <div
            key={folder.id}
            className={cn(
                "flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-slate-800/50 group sticky z-10 bg-slate-900",
                isSubFolder && "bg-slate-900/90"
            )}
            style={{
                paddingLeft: isSubFolder ? '20px' : '8px',
                top: topPx !== undefined ? `${topPx}px` : undefined,
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDropOnFolder(e, folder.id)}
        >
            <button
                onClick={() => onToggleFolder(folder.id)}
                className="text-slate-500 hover:text-slate-300 shrink-0"
            >
                {folder.isExpanded
                    ? <ChevronDown size={12} />
                    : <ChevronRight size={12} />
                }
            </button>

            {editingFolderId === folder.id ? (
                <input
                    ref={editInputRef}
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') { setEditingFolderId(null); }
                    }}
                    className="flex-1 bg-slate-700 border border-blue-500 rounded px-1 py-0.5 text-xs text-white focus:outline-none"
                />
            ) : (
                <span
                    className="flex-1 text-xs text-slate-300 font-medium truncate"
                    onDoubleClick={() => startEditing(folder)}
                >
                    {folder.name}
                </span>
            )}

            <span className="text-[10px] text-slate-600 shrink-0">
                {playsInFolder(folder.id).length + subFolders(folder.id).reduce((sum, sf) => sum + playsInFolder(sf.id).length, 0)}
            </span>

            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                {!isSubFolder && (
                    <button
                        onClick={() => startCreating(folder.id)}
                        className="text-slate-600 hover:text-slate-300 p-0.5 rounded"
                        title="Add sub-folder"
                    >
                        <FolderPlus size={11} />
                    </button>
                )}
                <button
                    onClick={() => startEditing(folder)}
                    className="text-slate-600 hover:text-slate-300 p-0.5 rounded"
                    title="Rename"
                >
                    <Pencil size={11} />
                </button>
                <button
                    onClick={() => {
                        if (window.confirm(`Delete folder "${folder.name}"?`)) {
                            onDeleteFolder(folder.id);
                        }
                    }}
                    className="text-slate-600 hover:text-red-400 p-0.5 rounded"
                    title="Delete folder"
                >
                    <Trash2 size={11} />
                </button>
            </div>
        </div>
    );

    return (
        <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="max-h-64 overflow-y-auto text-sm scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
        >
            {/* Top bar */}
            <div className="flex items-center gap-1 px-2 pb-2 border-b border-slate-700/50 mb-1">
                <button
                    onClick={() => startCreating('root')}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 py-1 px-1.5 rounded border border-slate-700 transition-colors flex items-center gap-0.5"
                    title="New folder"
                >
                    <Plus size={11} /> New Folder
                </button>
            </div>

            {/* New root folder input */}
            {creatingIn === 'root' && (
                <div className="px-2 pb-1">
                    <input
                        ref={newFolderInputRef}
                        value={newFolderName}
                        placeholder="Folder name…"
                        onChange={e => setNewFolderName(e.target.value)}
                        onBlur={commitCreate}
                        onKeyDown={e => {
                            if (e.key === 'Enter') commitCreate();
                            if (e.key === 'Escape') { setCreatingIn(null); }
                        }}
                        className="w-full bg-slate-700 border border-blue-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                    />
                </div>
            )}

            {/* Folders */}
            {topFolders.map(folder => (
                <div key={folder.id}>
                    {/* Sentinel: zero-height marker at the folder's natural position.
                        Used by handleScroll to detect when this folder has scrolled past the top. */}
                    <div ref={el => { sentinelRefs.current[folder.id] = el; }} style={{ height: 0 }} />

                    {renderFolderHeader(folder, false, stickyTop(folder.id))}

                    {folder.isExpanded && (
                        <div>
                            {playsInFolder(folder.id).map(play => (
                                <PlayRow
                                    key={play.id}
                                    play={play}
                                    isSelected={currentPlayId === play.id}
                                    indent={28}
                                    folderId={folder.id}
                                    onSelect={onSelectPlay}
                                    onDragStart={setDraggedPlayId}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDropOnPlay}
                                    isDragging={draggedPlayId === play.id}
                                />
                            ))}

                            {subFolders(folder.id).map(sub => (
                                <div key={sub.id}>
                                    {renderFolderHeader(sub, true)}
                                    {sub.isExpanded && playsInFolder(sub.id).map(play => (
                                        <PlayRow
                                            key={play.id}
                                            play={play}
                                            isSelected={currentPlayId === play.id}
                                            indent={52}
                                            folderId={sub.id}
                                            onSelect={onSelectPlay}
                                            onDragStart={setDraggedPlayId}
                                            onDragOver={handleDragOver}
                                            onDrop={handleDropOnPlay}
                                            isDragging={draggedPlayId === play.id}
                                        />
                                    ))}
                                </div>
                            ))}

                            {creatingIn === folder.id && (
                                <div className="px-2 py-1" style={{ paddingLeft: '24px' }}>
                                    <input
                                        ref={newFolderInputRef}
                                        value={newFolderName}
                                        placeholder="Sub-folder name…"
                                        onChange={e => setNewFolderName(e.target.value)}
                                        onBlur={commitCreate}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') commitCreate();
                                            if (e.key === 'Escape') { setCreatingIn(null); }
                                        }}
                                        className="w-full bg-slate-700 border border-blue-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}

            {/* Uncategorized section */}
            <div
                className="mt-1"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropOnUncategorized}
            >
                {(uncategorizedPlays.length > 0 || plays.length === 0) && (
                    <div className="px-2 py-1 text-[10px] text-slate-600 uppercase font-semibold tracking-wider">
                        Uncategorized ({uncategorizedPlays.length})
                    </div>
                )}
                {uncategorizedPlays.map(play => (
                    <PlayRow
                        key={play.id}
                        play={play}
                        isSelected={currentPlayId === play.id}
                        indent={12}
                        folderId={undefined}
                        onSelect={onSelectPlay}
                        onDragStart={setDraggedPlayId}
                        onDragOver={handleDragOver}
                        onDrop={handleDropOnPlay}
                        isDragging={draggedPlayId === play.id}
                    />
                ))}
            </div>
        </div>
    );
};
