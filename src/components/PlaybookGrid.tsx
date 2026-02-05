import React, { useState } from 'react';
import { Grid3x3, Edit2, X, Plus, Trash2, BookOpen, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Play, Playbook } from '@/types';
import { MiniPlayPreview } from './MiniPlayPreview';

interface PlaybookGridProps {
    // Playbook management
    playbooks: Playbook[];
    currentPlaybookId: string;
    onSelectPlaybook: (id: string) => void;
    onNewPlaybook: () => void;
    onRenamePlaybook: (id: string, name: string) => void;
    onDeletePlaybook: (id: string) => void;
    onOpenPrintSettings: () => void;

    // Grid management
    plays: Play[];
    currentPlayId: string | null;
    columnNames: string[];
    onUpdateColumnName: (index: number, name: string) => void;
    onAssignPlayToCell: (playId: string, row: number, col: number) => void;
    onRemovePlayFromCell: (row: number, col: number) => void;
    onSelectPlay: (id: string) => void;
    className?: string;
}

export const PlaybookGrid: React.FC<PlaybookGridProps> = ({
    playbooks,
    currentPlaybookId,
    onSelectPlaybook,
    onNewPlaybook,
    onRenamePlaybook,
    onDeletePlaybook,
    plays,
    currentPlayId,
    columnNames,
    onUpdateColumnName,
    onAssignPlayToCell,
    onRemovePlayFromCell,
    onSelectPlay,
    onOpenPrintSettings,
    className
}) => {
    const [editingColumn, setEditingColumn] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editingPlaybookId, setEditingPlaybookId] = useState<string | null>(null);
    const [playbookNameEdit, setPlaybookNameEdit] = useState('');

    const ROWS = 4;
    const COLS = 5;

    const currentPlaybook = playbooks.find(pb => pb.id === currentPlaybookId);

    const getPlayAtCell = (row: number, col: number): Play | null => {
        return plays.find(p => p.gridPosition?.row === row && p.gridPosition?.column === col) || null;
    };

    const handleCellClick = (row: number, col: number) => {
        const existingPlay = getPlayAtCell(row, col);

        if (existingPlay) {
            // Cell occupied - select the play
            onSelectPlay(existingPlay.id);
        } else if (currentPlayId) {
            // Assign current play to this cell
            onAssignPlayToCell(currentPlayId, row, col);
        }
    };

    const startEditingColumn = (index: number) => {
        setEditingColumn(index);
        setEditValue(columnNames[index]);
    };

    const finishEditingColumn = () => {
        if (editingColumn !== null && editValue.trim()) {
            onUpdateColumnName(editingColumn, editValue.trim());
        }
        setEditingColumn(null);
        setEditValue('');
    };

    return (
        <div className={cn("flex flex-col h-full bg-slate-900 text-white w-[400px] border-l border-slate-700 font-sans", className)}>
            {/* Header */}
            <div className="p-4 border-b border-slate-700 bg-slate-950/50 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-emerald-400">
                        <BookOpen size={20} /> Playbooks
                    </h2>
                    <button
                        onClick={onOpenPrintSettings}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2 text-sm font-bold"
                        title="Print Playbook"
                    >
                        <Printer size={16} /> Print
                    </button>
                </div>

                {/* Playbook Selector */}
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 uppercase font-semibold">Current Playbook</label>
                    <div className="flex gap-2">
                        <select
                            value={currentPlaybookId}
                            onChange={(e) => onSelectPlaybook(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                        >
                            {playbooks.map((pb) => (
                                <option key={pb.id} value={pb.id}>
                                    {pb.name}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => onNewPlaybook()}
                            className="bg-slate-800 hover:bg-slate-700 text-emerald-400 p-2 rounded border border-slate-700 transition-all"
                            title="New Playbook"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    {/* Playbook Actions */}
                    {currentPlaybook && (
                        <div className="flex gap-2">
                            {editingPlaybookId === currentPlaybookId ? (
                                <input
                                    type="text"
                                    value={playbookNameEdit}
                                    onChange={(e) => setPlaybookNameEdit(e.target.value)}
                                    onBlur={() => {
                                        if (playbookNameEdit.trim()) {
                                            onRenamePlaybook(currentPlaybookId, playbookNameEdit.trim());
                                        }
                                        setEditingPlaybookId(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            if (playbookNameEdit.trim()) {
                                                onRenamePlaybook(currentPlaybookId, playbookNameEdit.trim());
                                            }
                                            setEditingPlaybookId(null);
                                        }
                                        if (e.key === 'Escape') {
                                            setEditingPlaybookId(null);
                                        }
                                    }}
                                    autoFocus
                                    className="flex-1 bg-slate-900 border-2 border-emerald-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                />
                            ) : (
                                <button
                                    onClick={() => {
                                        setEditingPlaybookId(currentPlaybookId);
                                        setPlaybookNameEdit(currentPlaybook.name);
                                    }}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 py-1.5 px-2 rounded text-xs font-medium border border-slate-700 transition-all flex items-center justify-center gap-1"
                                    title="Rename Playbook"
                                >
                                    <Edit2 size={12} /> Rename
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (window.confirm(`Delete playbook "${currentPlaybook.name}"? This cannot be undone.`)) {
                                        onDeletePlaybook(currentPlaybookId);
                                    }
                                }}
                                className="flex-1 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 py-1.5 px-2 rounded text-xs font-medium border border-slate-700 hover:border-red-900/30 transition-all flex items-center justify-center gap-1"
                                title="Delete Playbook"
                                disabled={playbooks.length <= 1}
                            >
                                <Trash2 size={12} /> Delete
                            </button>
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-700/50 pt-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-300 mb-2">
                        <Grid3x3 size={16} /> Play Grid
                    </h3>
                    <p className="text-xs text-slate-500">
                        Click a cell to assign the current play
                    </p>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto p-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
                <div className="inline-block min-w-full">
                    {/* Column Headers */}
                    <div className="grid grid-cols-[40px_repeat(5,1fr)] gap-1 mb-1">
                        <div className="h-10"></div>
                        {columnNames.map((name, colIndex) => (
                            <div
                                key={colIndex}
                                className="h-10 bg-slate-800 rounded flex items-center justify-center font-bold text-sm border border-slate-700 group relative"
                            >
                                {editingColumn === colIndex ? (
                                    <input
                                        type="text"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onBlur={finishEditingColumn}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') finishEditingColumn();
                                            if (e.key === 'Escape') {
                                                setEditingColumn(null);
                                                setEditValue('');
                                            }
                                        }}
                                        autoFocus
                                        className="w-full h-full bg-slate-900 text-center text-white outline-none border-2 border-blue-500 rounded px-1"
                                        maxLength={3}
                                    />
                                ) : (
                                    <>
                                        <span className="text-emerald-400">{name}</span>
                                        <button
                                            onClick={() => startEditingColumn(colIndex)}
                                            className="absolute right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-slate-700 rounded"
                                            title="Edit column name"
                                        >
                                            <Edit2 size={10} className="text-slate-400" />
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Grid Rows */}
                    {Array.from({ length: ROWS }).map((_, rowIndex) => (
                        <div key={rowIndex} className="grid grid-cols-[40px_repeat(5,1fr)] gap-1 mb-1">
                            {/* Row Number */}
                            <div className="h-20 bg-slate-800 rounded flex items-center justify-center font-bold text-sm border border-slate-700">
                                <span className="text-emerald-400">{rowIndex + 1}</span>
                            </div>

                            {/* Grid Cells */}
                            {Array.from({ length: COLS }).map((_, colIndex) => {
                                const play = getPlayAtCell(rowIndex, colIndex);
                                const isCurrentPlayCell = play?.id === currentPlayId;

                                return (
                                    <button
                                        key={colIndex}
                                        onClick={() => handleCellClick(rowIndex, colIndex)}
                                        className={cn(
                                            "h-20 rounded border-2 transition-all text-xs font-medium flex flex-col items-center justify-center gap-0.5 relative group p-1",
                                            play
                                                ? isCurrentPlayCell
                                                    ? "bg-blue-600/20 border-blue-500 text-blue-300"
                                                    : "bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500"
                                                : currentPlayId
                                                    ? "bg-slate-800/50 border-dashed border-slate-600 hover:border-emerald-500 hover:bg-emerald-900/20 text-slate-500"
                                                    : "bg-slate-800/30 border-slate-700 text-slate-600 cursor-not-allowed"
                                        )}
                                        disabled={!currentPlayId && !play}
                                        title={play ? `${play.name} (click to remove)` : currentPlayId ? 'Click to assign current play' : 'Select a play first'}
                                    >
                                        {play ? (
                                            <>
                                                <MiniPlayPreview
                                                    play={play}
                                                    width={50}
                                                    height={56}
                                                    className="rounded"
                                                />
                                                <span className="text-[9px] truncate w-full px-0.5 text-center leading-tight">
                                                    {play.name}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onRemovePlayFromCell(rowIndex, colIndex);
                                                    }}
                                                    className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 bg-slate-900/80 rounded-full p-0.5 hover:bg-red-900/20"
                                                    title="Remove from grid"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </>
                                        ) : currentPlayId ? (
                                            <span className="text-[10px] opacity-50">Click to assign</span>
                                        ) : (
                                            <span className="text-[10px] opacity-30">Empty</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer Info */}
            <div className="p-3 border-t border-slate-700 bg-slate-950/30 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-600/20 border-2 border-blue-500 rounded"></div>
                    <span>Current play</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <div className="w-3 h-3 bg-slate-800 border-2 border-slate-600 rounded"></div>
                    <span>Assigned play</span>
                </div>
            </div>
        </div>
    );
};
