import { createElement } from 'react';
import { MiniPlayPreview } from '@/components/MiniPlayPreview';
import type { Play } from '@/types';

// The play is drawn like the playbook previews at this size, then rasterized PIXEL_RATIO times larger
const FIELD_SIZE = 240;
const STROKE_WIDTH = 2.4;
const PIXEL_RATIO = 5;

const PADDING = 48;
const TITLE_FONT_SIZE = 56;
const TAG_FONT_SIZE = 30;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
});

/**
 * The play drawn as a PNG: name and tags on top, the field (25 × 25 yd, as in the previews) below.
 * With showDefense the play's defense is drawn too.
 */
export const renderPlayImage = async (play: Play, { showDefense = false } = {}): Promise<File> => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const svg = renderToStaticMarkup(
        createElement(MiniPlayPreview, { play, width: FIELD_SIZE, height: FIELD_SIZE, strokeWidth: STROKE_WIDTH, showDefense })
    ).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const field = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

    const fieldPx = FIELD_SIZE * PIXEL_RATIO;
    const tags = play.tags || [];
    const tagRowHeight = tags.length > 0 ? TAG_FONT_SIZE + 32 : 0;
    const headerHeight = TITLE_FONT_SIZE + 24 + tagRowHeight;

    const canvas = document.createElement('canvas');
    canvas.width = fieldPx + 2 * PADDING;
    canvas.height = PADDING + headerHeight + fieldPx + PADDING;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Play name
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${TITLE_FONT_SIZE}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(play.name, canvas.width / 2, PADDING, canvas.width - 2 * PADDING);

    // Tags as colored pills, centered under the name
    if (tags.length > 0) {
        ctx.font = `bold ${TAG_FONT_SIZE}px ${FONT}`;
        const pillPadding = 18;
        const gap = 12;
        const widths = tags.map(t => ctx.measureText(t.text).width + 2 * pillPadding);
        let x = (canvas.width - (widths.reduce((a, b) => a + b, 0) + gap * (tags.length - 1))) / 2;
        const y = PADDING + TITLE_FONT_SIZE + 24;
        const h = TAG_FONT_SIZE + 16;
        tags.forEach((tag, i) => {
            ctx.fillStyle = tag.color;
            ctx.beginPath();
            ctx.roundRect(x, y, widths[i], h, h / 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tag.text, x + widths[i] / 2, y + h / 2 + 1);
            x += widths[i] + gap;
        });
    }

    // Field with a thin frame
    const fieldY = PADDING + headerHeight;
    ctx.drawImage(field, PADDING, fieldY, fieldPx, fieldPx);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.strokeRect(PADDING, fieldY, fieldPx, fieldPx);

    const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png')
    );
    const fileName = `${play.name.trim().replace(/[^\w-]+/g, '_') || 'play'}.png`;
    return new File([blob], fileName, { type: 'image/png' });
};
