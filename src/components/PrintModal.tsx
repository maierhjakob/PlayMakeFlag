import React, { useState } from 'react';
import { X, Printer } from 'lucide-react';
import { CARD_HEIGHT_KEY, DEFAULT_CARD_HEIGHT, MAX_CARD_HEIGHT, MIN_CARD_HEIGHT, clampHeight, loadCardHeight } from '@/lib/printSettings';

interface PrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPrint: (settings: PrintSettings) => void;
}

export interface PrintSettings {
    playsPerPage: number;
    cardHeight: number; // cm
}

export const PrintModal: React.FC<PrintModalProps> = ({ isOpen, onClose, onPrint }) => {
    const [playsPerPage, setPlaysPerPage] = useState(4);
    const [cardHeight, setCardHeight] = useState(loadCardHeight);
    // Typed text, so the field can be cleared or half-typed without jumping
    const [heightInput, setHeightInput] = useState(() => String(loadCardHeight()));

    const applyHeight = (value: number) => {
        const height = clampHeight(value);
        setCardHeight(height);
        setHeightInput(String(height));
    };

    const handlePrint = () => {
        const height = clampHeight(parseFloat(heightInput.replace(',', '.')));
        applyHeight(height);
        try { localStorage.setItem(CARD_HEIGHT_KEY, String(height)); } catch { /* not remembered */ }
        onPrint({ playsPerPage, cardHeight: height });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[400px] overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Printer size={20} className="text-emerald-400" />
                        Print Settings
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-300">Playbooks per Page</label>
                        <select
                            value={playsPerPage}
                            onChange={(e) => setPlaysPerPage(Number(e.target.value))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                        >
                            <option value={1}>1 playbook per page</option>
                            <option value={2}>2 playbooks per page</option>
                            <option value={4}>4 playbooks per page</option>
                            <option value={6}>6 playbooks per page</option>
                        </select>
                        <p className="text-[10px] text-slate-500 italic">This determines how many playbooks are printed on one A4 side.</p>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-300">Playbook Height (cm)</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min={MIN_CARD_HEIGHT}
                                max={MAX_CARD_HEIGHT}
                                step={0.1}
                                value={cardHeight}
                                onChange={(e) => applyHeight(Number(e.target.value))}
                                className="flex-1 accent-emerald-500"
                            />
                            <input
                                type="text"
                                inputMode="decimal"
                                value={heightInput}
                                onChange={(e) => setHeightInput(e.target.value)}
                                onBlur={() => applyHeight(parseFloat(heightInput.replace(',', '.')))}
                                onKeyDown={(e) => e.key === 'Enter' && applyHeight(parseFloat(heightInput.replace(',', '.')))}
                                className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-center focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>{MIN_CARD_HEIGHT}–{MAX_CARD_HEIGHT} cm, width stays 11.5 cm</span>
                            {cardHeight !== DEFAULT_CARD_HEIGHT && (
                                <button onClick={() => applyHeight(DEFAULT_CARD_HEIGHT)} className="text-emerald-400 hover:text-emerald-300">
                                    Reset to {DEFAULT_CARD_HEIGHT} cm
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-xs text-slate-400 space-y-2">
                        <p className="font-semibold text-slate-300 uppercase text-[10px]">Important:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Each playbook is printed at <strong>11.5cm x {cardHeight}cm</strong>.</li>
                            <li>Play names are hidden to maximize space for play diagrams.</li>
                            <li>Make sure to enable <strong>"Background Graphics"</strong> in your browser's print dialog.</li>
                        </ul>
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
                        onClick={handlePrint}
                        className="flex-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"
                    >
                        <Printer size={18} />
                        Generate Print
                    </button>
                </div>
            </div>
        </div>
    );
};
