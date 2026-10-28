import React, { useState } from 'react';
import { Plus, MousePointer2 } from 'lucide-react';
import { ROUTE_PRESETS, type RoutePreset } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { Player, SavedRoute } from '@/types';

type RouteType = 'primary' | 'option' | 'check' | 'endzone';

interface RouteControlsProps {
    selectedPlayer: Player | null;
    activeRouteType: RouteType;
    onSetActiveRouteType: (type: RouteType) => void;
    onApplyRoute: (preset: RoutePreset) => void;
    onStartDrawing: (type: RouteType) => void;
    onFinishDrawing: () => void;
    onClearRoutes: () => void;
    isDrawing: boolean;
    savedRoutes: SavedRoute[];
    onSaveRoute: (name: string, routeType: RouteType) => void;
    onDeleteSavedRoute: (id: string) => void;
    onApplySavedRoute: (savedRouteId: string, routeType: RouteType) => void;
    className?: string;
    style?: React.CSSProperties;
}

/** Route layer, presets, saved routes and drawing for the selected player — shown below the field. */
export const RouteControls: React.FC<RouteControlsProps> = ({
    selectedPlayer,
    activeRouteType,
    onSetActiveRouteType,
    onApplyRoute,
    onStartDrawing,
    onFinishDrawing,
    onClearRoutes,
    isDrawing,
    savedRoutes,
    onSaveRoute,
    onDeleteSavedRoute,
    onApplySavedRoute,
    className,
    style
}) => {
    const [savingRouteName, setSavingRouteName] = useState('');
    const [isSavingRoute, setIsSavingRoute] = useState(false);

    const routeTypeButton = (type: RouteType, label: string, activeClass: string) => (
        <button
            onClick={() => onSetActiveRouteType(type)}
            className={cn(
                "flex-1 py-1 big:py-1.5 rounded text-[10px] big:text-sm font-medium transition-all",
                activeRouteType === type ? `${activeClass} text-white shadow-sm` : "text-slate-500 hover:text-slate-300"
            )}
        >
            {label}
        </button>
    );

    // Without a selected player the controls stay visible (disabled) with the same height, so the layout doesn't jump
    return (
        <div
            style={style}
            className={cn(
                "p-2 big:p-3 rounded-lg bg-slate-900 border border-slate-700 text-white flex flex-col gap-1.5 big:gap-2.5",
                !selectedPlayer && "opacity-40 pointer-events-none select-none",
                className
            )}
        >
            {/* Route layer + drawing */}
            <div className="flex gap-1.5 big:gap-2">
                <div className="flex-1 flex bg-slate-950/50 rounded p-0.5 border border-slate-700">
                    {routeTypeButton('primary', 'Primary (Solid)', 'bg-blue-600')}
                    {routeTypeButton('option', 'Option', 'bg-amber-600')}
                    {routeTypeButton('check', 'Check', 'bg-slate-700')}
                    {routeTypeButton('endzone', 'Endzone', 'bg-pink-600')}
                </div>
                {isDrawing ? (
                    <button
                        onClick={onFinishDrawing}
                        className="w-24 big:w-32 bg-emerald-900/30 hover:bg-emerald-900/50 px-2 py-1 big:py-1.5 rounded text-xs big:text-sm text-emerald-300 border border-emerald-800 transition-colors flex items-center justify-center gap-1 animate-pulse"
                    >
                        <MousePointer2 size={12} /> Finish
                    </button>
                ) : (
                    <button
                        onClick={() => onStartDrawing('primary')}
                        className="w-24 big:w-32 bg-blue-900/30 hover:bg-blue-900/50 px-2 py-1 big:py-1.5 rounded text-xs big:text-sm text-blue-300 border border-blue-800 transition-colors flex items-center justify-center gap-1"
                    >
                        <MousePointer2 size={12} /> Draw
                    </button>
                )}
                <button
                    onClick={onClearRoutes}
                    className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-2 big:px-3 py-1 big:py-1.5 rounded text-xs big:text-sm border border-red-900/30 transition-colors"
                >
                    Clear
                </button>
            </div>

            {/* Route Presets */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] big:grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1 big:gap-1.5">
                {ROUTE_PRESETS.map(preset => {
                    const isActive = selectedPlayer?.routes.find(r => r.type === activeRouteType)?.preset === preset.value;
                    return (
                        <button
                            key={preset.value}
                            onClick={() => onApplyRoute(preset.value)}
                            className={cn(
                                "px-0.5 py-1 big:py-2 rounded text-[10px] big:text-sm border transition-all truncate",
                                isActive
                                    ? "bg-blue-600 border-blue-400 text-white shadow-sm"
                                    : "bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600"
                            )}
                            title={preset.label}
                        >
                            {preset.label.replace(' (5)', '')}
                        </button>
                    );
                })}
            </div>

            {/* Saved Routes */}
            <div className="min-h-5 flex flex-wrap items-center gap-1">
                <span className="text-[10px] big:text-xs text-slate-500 uppercase font-semibold mr-1">Saved</span>
                {savedRoutes.length === 0 && !isSavingRoute && (
                    <span className="text-[10px] big:text-xs text-slate-600 italic">none yet</span>
                )}
                {savedRoutes.map(sr => (
                    <div key={sr.id} className="relative group">
                        <button
                            onClick={() => onApplySavedRoute(sr.id, activeRouteType)}
                            className="max-w-28 big:max-w-36 px-2 py-0.5 big:py-1 rounded text-[10px] big:text-sm border transition-all truncate bg-slate-700 hover:bg-purple-800/50 text-slate-200 border-slate-600 hover:border-purple-500"
                            title={sr.name}
                        >
                            {sr.name}
                        </button>
                        <button
                            onClick={() => onDeleteSavedRoute(sr.id)}
                            className="absolute -top-1 -right-1 hidden group-hover:flex w-4 h-4 bg-red-900 hover:bg-red-700 text-white rounded-full text-[9px] items-center justify-center"
                            title="Delete saved route"
                        >
                            ×
                        </button>
                    </div>
                ))}
                {isSavingRoute ? (
                    <div className="flex gap-1">
                        <input
                            autoFocus
                            type="text"
                            value={savingRouteName}
                            onChange={e => setSavingRouteName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && savingRouteName.trim()) {
                                    onSaveRoute(savingRouteName.trim(), activeRouteType);
                                    setIsSavingRoute(false);
                                }
                                if (e.key === 'Escape') setIsSavingRoute(false);
                            }}
                            placeholder="Route name…"
                            className="w-32 bg-slate-900 border border-slate-600 rounded px-2 py-0.5 text-[10px] text-white focus:outline-none focus:border-blue-500"
                        />
                        <button
                            onClick={() => {
                                if (savingRouteName.trim()) {
                                    onSaveRoute(savingRouteName.trim(), activeRouteType);
                                }
                                setIsSavingRoute(false);
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded text-[10px]"
                        >
                            Save
                        </button>
                    </div>
                ) : selectedPlayer?.routes.find(r => r.type === activeRouteType) && (
                    <button
                        onClick={() => { setIsSavingRoute(true); setSavingRouteName(''); }}
                        className="ml-auto text-[10px] big:text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                    >
                        <Plus size={10} /> Save current
                    </button>
                )}
            </div>
        </div>
    );
};
