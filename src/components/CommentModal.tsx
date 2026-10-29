import React, { useState } from 'react';
import { X, MessageSquare } from 'lucide-react';

interface CommentModalProps {
    playName: string;
    comment: string;
    onClose: () => void;
    onSave: (comment: string) => void;
}

// Mounted only while open, so the text starts from the play's saved comment each time
export const CommentModal: React.FC<CommentModalProps> = ({ playName, comment, onClose, onSave }) => {
    const [text, setText] = useState(comment);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[440px] max-w-full overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2 min-w-0">
                        <MessageSquare size={20} className="text-emerald-400 shrink-0" />
                        <span className="truncate">Comment: {playName}</span>
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-2">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        // Keep typing (Escape, Ctrl+Z, arrows) away from the app's keyboard shortcuts
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Escape') onClose();
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSave(text.trim());
                        }}
                        autoFocus
                        rows={6}
                        placeholder="E.g. QB reads the safety: if he stays deep, hit the slant."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                    />
                    <p className="text-[10px] text-slate-500 italic">Shown under the play in the PNG image. Not printed.</p>
                </div>

                <div className="p-4 bg-slate-800 border-t border-slate-700 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(text.trim())}
                        className="flex-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all"
                    >
                        Save Comment
                    </button>
                </div>
            </div>
        </div>
    );
};
