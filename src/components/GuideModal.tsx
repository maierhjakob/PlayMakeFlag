import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuideModalProps {
    onClose: () => void;
}

interface GuideStep {
    title: string;
    image: string;
    points: React.ReactNode[];
}

const img = (name: string) => `${import.meta.env.BASE_URL}guide/${name}.webp`;

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className="px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 text-[11px] font-mono text-slate-200">{children}</kbd>
);

const STEPS: GuideStep[] = [
    {
        title: 'Create a play',
        image: img('plays'),
        points: [
            <>Click <strong>New Play</strong> at the bottom of the plays list. It starts with a 5-player formation.</>,
            <>Give it a name and add <strong>tags</strong> (short markers like a letter or number). They show above the field and in the printed playbook.</>,
            <>Your plays stay on this device; you don't need an account.</>,
        ],
    },
    {
        title: 'Set up your players',
        image: img('players'),
        points: [
            <><strong>Drag</strong> a player to move them on the field.</>,
            <><strong>Click</strong> a player to select them. On the left you can change their label, color, position and add a <strong>motion</strong>.</>,
        ],
    },
    {
        title: 'Draw routes',
        image: img('routes'),
        points: [
            <>With a player selected, pick the route type: <strong>Primary</strong>, <strong>Option</strong>, <strong>Check</strong> or <strong>Endzone</strong>.</>,
            <>Click a preset like <strong>Slant</strong> or <strong>Post</strong>, or click <strong>Draw</strong> and click the points on the field.</>,
            <>Press <Key>Enter</Key> or <strong>Finish</strong> when the route is done, <Key>Esc</Key> to cancel. Drag the points to adjust it later.</>,
        ],
    },
    {
        title: 'Build your playbook',
        image: img('playbook'),
        points: [
            <>On the right (the <strong>Grid</strong> tab on phones), choose a playbook or create a new one with <strong>+</strong>.</>,
            <>Click an empty cell to put the current play there. Hover a column name and click the pencil to rename it.</>,
            <>One play can be used in several playbooks; changes show up everywhere.</>,
        ],
    },
    {
        title: 'Share, print and back up',
        image: img('share'),
        points: [
            <><strong>Export & Share</strong> creates a file you can send to your team; opening it imports the playbooks.</>,
            <><strong>Print</strong> prints the playbook for a wristband. <strong>PNG</strong> next to the field saves a single play as an image, with its <strong>NOTE</strong>.</>,
            <><strong>Back up all playbooks</strong> now and then, so nothing is lost if the browser data is cleared.</>,
        ],
    },
];

export const GuideModal: React.FC<GuideModalProps> = ({ onClose }) => {
    const [stepIdx, setStepIdx] = useState(0);
    const step = STEPS[stepIdx];
    const isLast = stepIdx === STEPS.length - 1;

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            // Keep the arrow keys and Escape from reaching the designer behind the guide
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight') setStepIdx(i => Math.min(STEPS.length - 1, i + 1));
            else if (e.key === 'ArrowLeft') setStepIdx(i => Math.max(0, i - 1));
            else return;
            e.preventDefault();
            e.stopImmediatePropagation();
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[720px] max-w-full max-h-full flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <CircleHelp size={20} className="text-emerald-400" />
                        {step.title}
                    </h2>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{stepIdx + 1} / {STEPS.length}</span>
                        <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg text-slate-400" title="Close guide">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto">
                    <div className="bg-slate-950 flex items-center justify-center p-3 border-b border-slate-800">
                        <img
                            src={step.image}
                            alt={step.title}
                            className="max-w-full max-h-[380px] rounded-lg border border-slate-700 object-contain"
                        />
                    </div>
                    <ul className="p-5 space-y-2.5 text-sm text-slate-300 list-disc pl-9">
                        {step.points.map((point, i) => <li key={i}>{point}</li>)}
                    </ul>
                </div>

                <div className="p-4 bg-slate-800 border-t border-slate-700 flex items-center gap-3">
                    <button
                        onClick={() => setStepIdx(i => i - 1)}
                        disabled={stepIdx === 0}
                        className="px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                        <ChevronLeft size={16} /> Back
                    </button>
                    <div className="flex-1 flex justify-center gap-1.5">
                        {STEPS.map((s, i) => (
                            <button
                                key={s.title}
                                onClick={() => setStepIdx(i)}
                                className={cn("w-2 h-2 rounded-full transition-colors", i === stepIdx ? "bg-emerald-400" : "bg-slate-600 hover:bg-slate-500")}
                                title={s.title}
                            />
                        ))}
                    </div>
                    <button
                        onClick={() => isLast ? onClose() : setStepIdx(i => i + 1)}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-1"
                    >
                        {isLast ? "Let's go" : <>Next <ChevronRight size={16} /></>}
                    </button>
                </div>
            </div>
        </div>
    );
};
