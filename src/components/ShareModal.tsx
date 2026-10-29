import React, { useState } from 'react';
import { X, Share2 } from 'lucide-react';
import type { Playbook } from '@/types';

interface ShareModalProps {
    playbooks: Playbook[];
    currentPlaybookId: string;
    onClose: () => void;
    onShare: (playbookIds: string[]) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ playbooks, currentPlaybookId, onClose, onShare }) => {
    // Mounted only while open, so each time it starts from the current playbook
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set([currentPlaybookId]));

    const allSelected = selectedIds.size === playbooks.length;

    const toggle = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[400px] max-w-full max-h-full flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Share2 size={20} className="text-emerald-400" />
                        Export & Share
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-3 overflow-y-auto">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-300">Playbooks to share</label>
                        <button
                            onClick={() => setSelectedIds(allSelected ? new Set() : new Set(playbooks.map(pb => pb.id)))}
                            className="text-xs text-emerald-400 hover:text-emerald-300"
                        >
                            {allSelected ? 'Select none' : 'Select all'}
                        </button>
                    </div>
                    <div className="space-y-1">
                        {playbooks.map(pb => (
                            <label
                                key={pb.id}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 cursor-pointer text-sm text-white"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(pb.id)}
                                    onChange={() => toggle(pb.id)}
                                    className="accent-emerald-500 w-4 h-4"
                                />
                                {pb.name}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-slate-800 border-t border-slate-700 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onShare(playbooks.filter(pb => selectedIds.has(pb.id)).map(pb => pb.id))}
                        disabled={selectedIds.size === 0}
                        className="flex-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"
                    >
                        <Share2 size={18} />
                        Share {selectedIds.size === 1 ? '1 playbook' : `${selectedIds.size} playbooks`}
                    </button>
                </div>
            </div>
        </div>
    );
};
