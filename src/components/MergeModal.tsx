import React, { useState } from 'react';
import { GitMerge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSavedAt } from '@/lib/shareUtils';
import type { Play } from '@/types';
import type { ConflictChoice, PlayConflict } from '@/hooks/usePlaybook';
import { MiniPlayPreview } from './MiniPlayPreview';

interface MergeModalProps {
    conflicts: PlayConflict[];
    onResolve: (choices: Record<string, ConflictChoice>) => void;
}

const CHOICES: { value: ConflictChoice; label: string }[] = [
    { value: 'mine', label: 'Keep yours' },
    { value: 'theirs', label: 'Use imported' },
    { value: 'both', label: 'Save both' },
];

const changedAt =(play: Play) => play.updatedAt ? formatSavedAt(play.updatedAt) : 'unknown';

// Mounted only while there are conflicts, so the choices start from the newer version each time
export const MergeModal: React.FC<MergeModalProps> = ({ conflicts, onResolve }) => {
    const [choices, setChoices] = useState<Record<string, ConflictChoice>>(() => Object.fromEntries(
        conflicts.map(c => [c.mine.id, (c.theirs.updatedAt || 0) > (c.mine.updatedAt || 0) ? 'theirs' : 'mine'])
    ));

    const choose = (id: string, choice: ConflictChoice) => setChoices(prev => ({ ...prev, [id]: choice }));

    const versionCard = (conflict: PlayConflict, side: 'mine' | 'theirs') => {
        const play = conflict[side];
        const other = conflict[side === 'mine' ? 'theirs' : 'mine'];
        const isNewer = (play.updatedAt || 0) > (other.updatedAt || 0);
        const selected = choices[conflict.mine.id] === side || choices[conflict.mine.id] === 'both';
        return (
            <button
                onClick={() => choose(conflict.mine.id, side)}
                className={cn(
                    "flex-1 min-w-0 flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors",
                    selected ? "border-emerald-500 bg-emerald-950/40" : "border-slate-700 bg-slate-800/50 hover:border-slate-500"
                )}
            >
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    {side === 'mine' ? 'Yours' : 'Imported'}
                    {isNewer && <span className="px-1.5 rounded-full bg-emerald-600 text-[10px]">newer</span>}
                </div>
                <div className="bg-white rounded">
                    <MiniPlayPreview play={play} width={120} height={120} strokeWidth={1.6} />
                </div>
                <div className="text-xs text-white truncate max-w-full">{play.name}</div>
                {play.comment && <div className="text-[10px] italic text-slate-400 truncate max-w-full">{play.comment}</div>}
                <div className="text-[10px] text-slate-500">Changed {changedAt(play)}</div>
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[520px] max-w-full max-h-full flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-700 bg-slate-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <GitMerge size={20} className="text-emerald-400" />
                        {conflicts.length === 1 ? '1 play was changed' : `${conflicts.length} plays were changed`}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        The import has a different version of plays you already have. Choose which version to keep.
                    </p>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto">
                    {conflicts.map(conflict => (
                        <div key={conflict.mine.id} className="space-y-2">
                            <div className="flex gap-2">
                                {versionCard(conflict, 'mine')}
                                {versionCard(conflict, 'theirs')}
                            </div>
                            <div className="flex gap-1 p-1 rounded-lg bg-slate-800 border border-slate-700">
                                {CHOICES.map(({ value, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => choose(conflict.mine.id, value)}
                                        className={cn(
                                            "flex-1 py-1.5 rounded text-xs font-semibold transition-colors",
                                            choices[conflict.mine.id] === value ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {choices[conflict.mine.id] === 'both' && (
                                <p className="text-[10px] text-slate-500">
                                    Yours stays as it is; the imported one is saved as a copy: "{conflict.theirs.name} (imported)".
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-slate-800 border-t border-slate-700 flex">
                    <button
                        onClick={() => onResolve(choices)}
                        className="flex-1 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
};
