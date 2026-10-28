import React from 'react';
import { COLOR_PRESETS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface ColorSwatchesProps {
    value: string;
    onChange: (color: string) => void;
    className?: string;
}

export const ColorSwatches: React.FC<ColorSwatchesProps> = ({ value, onChange, className }) => (
    <div className={cn("flex items-center gap-1", className)}>
        {COLOR_PRESETS.map(preset => {
            const isSelected = value.toLowerCase() === preset.value;
            return (
                <button
                    key={preset.value}
                    type="button"
                    title={preset.name}
                    onClick={() => onChange(preset.value)}
                    className={cn(
                        "w-3.5 h-3.5 rounded-full shrink-0 border border-slate-600 transition-transform hover:scale-110",
                        isSelected && "ring-2 ring-white ring-offset-1 ring-offset-slate-900"
                    )}
                    style={{ backgroundColor: preset.value }}
                />
            );
        })}
    </div>
);
