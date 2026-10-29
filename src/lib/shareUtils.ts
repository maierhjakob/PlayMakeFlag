import type { Playbook, Play, Player, RouteSegment, Point, PlayTag, PlayDefense } from '../types';

// Old-format playbook shape used for import/export compatibility
type SerializedPlaybook = Omit<Playbook, 'entries'> & { plays: Play[] };
import { S } from './constants';

const ROUTE_TYPE_MAP: Record<string, number> = {
    'primary': 0,
    'option': 1,
    'check': 2,
    'endzone': 3
};

const INV_ROUTE_TYPE_MAP: Record<number, string> = Object.fromEntries(
    Object.entries(ROUTE_TYPE_MAP).map(([k, v]) => [v, k])
);

// Yard conversion: pixels to 0.5 yard increments (integers)
const toYards = (val: number) => Math.round((val / S) * 2);
const fromYards = (val: number) => (val / 2) * S;

// Base64-URL helpers
export const toBase64URL = (binary: string): string => {
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

export const fromBase64URL = (base64url: string): string => {
    let base64 = base64url
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
        base64 += '=';
    }
    return atob(base64);
};

// VERSION 3: POSITIONAL ARRAYS (EXTREME)
// `plays` should be the current playbook's plays with gridPosition merged in from entries.
export const minifyPlaybook = (pb: Playbook, plays: Play[]): any => {
    return [
        3, // Version
        pb.id,
        pb.name,
        pb.gridConfig.columnNames,
        plays.map(minifyPlay)
    ];
};

const minifyPlay = (p: Play): any => {
    return [
        p.id,
        p.name,
        p.players.map(minifyPlayer),
        p.tags?.map(minifyTag) || [],
        p.gridPosition ? [p.gridPosition.row, p.gridPosition.column] : null,
        p.ballPosition ? minifyPoint(p.ballPosition) : null,
        // Added later as optional last elements, so older versions simply ignore them
        p.defense ? minifyDefense(p.defense) : null,
        p.comment || null,
        p.updatedAt || null
    ];
};

const minifyDefense = (d: PlayDefense): any => [
    d.coverage || null,
    d.defenders.map(def => [
        def.id,
        minifyPoint(def.position),
        def.zone ? [def.zone.dx, def.zone.dy, def.zone.rx, def.zone.ry].map(toYards) : null,
        def.manTargetId || null,
        def.rush ? 1 : 0,
        def.color || null,
        def.path?.length ? def.path.map(minifyPoint) : null,
    ]),
];

const unminifyDefense = (data: any): PlayDefense => ({
    coverage: data[0] || null,
    defenders: data[1].map((def: any) => ({
        id: def[0],
        position: unminifyPoint(def[1]),
        zone: def[2] ? { dx: fromYards(def[2][0]), dy: fromYards(def[2][1]), rx: fromYards(def[2][2]), ry: fromYards(def[2][3]) } : null,
        manTargetId: def[3] || null,
        rush: def[4] === 1,
        color: def[5] || undefined,
        path: def[6] ? def[6].map(unminifyPoint) : undefined,
    })),
});

const minifyPlayer = (p: Player): any => {
    return [
        p.id,
        p.role,
        p.label,
        p.color,
        minifyPoint(p.position),
        p.motion ? minifyPoint(p.motion) : null,
        p.routes.map(minifyRoute)
    ];
};

const minifyRoute = (r: RouteSegment): any => {
    return [
        r.id,
        ROUTE_TYPE_MAP[r.type],
        r.points.map(minifyPoint),
        r.preset || null
    ];
};

const minifyTag = (t: PlayTag): any => {
    return [t.id, t.text, t.color];
};

const minifyPoint = (p: Point): [number, number] => [toYards(p.x), toYards(p.y)];
const unminifyPoint = (p: [number, number]): Point => ({ x: fromYards(p[0]), y: fromYards(p[1]) });

// UNMINIFICATION (V3)
// Returns old-format shape (plays: Play[]) so handleImportData can migrate it.
export const unminifyPlaybook = (data: any): SerializedPlaybook => {
    if (!Array.isArray(data) || data[0] !== 3) return data as SerializedPlaybook;

    return {
        id: data[1],
        name: data[2],
        gridConfig: { columnNames: data[3] },
        plays: data[4].map(unminifyPlay),
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
};

const unminifyPlay = (data: any): Play => {
    return {
        id: data[0],
        name: data[1],
        players: data[2].map(unminifyPlayer),
        tags: data[3].map(unminifyTag),
        gridPosition: data[4] ? { row: data[4][0], column: data[4][1] } : undefined,
        ballPosition: data[5] ? unminifyPoint(data[5]) : undefined,
        defense: data[6] ? unminifyDefense(data[6]) : undefined,
        comment: data[7] || undefined,
        updatedAt: data[8] || undefined,
    };
};

const unminifyPlayer = (data: any): Player => {
    return {
        id: data[0],
        role: data[1],
        label: data[2],
        color: data[3],
        position: unminifyPoint(data[4]),
        motion: data[5] ? unminifyPoint(data[5]) : null,
        routes: data[6].map(unminifyRoute),
    };
};

const unminifyRoute = (data: any): RouteSegment => {
    return {
        id: data[0],
        type: (INV_ROUTE_TYPE_MAP[data[1]] || 'primary') as any,
        points: data[2].map(unminifyPoint),
        preset: data[3] || undefined,
    };
};

const unminifyTag = (data: any): PlayTag => {
    return {
        id: data[0],
        text: data[1],
        color: data[2],
    };
};

/** The play's content as it would be shared, without grid position and change time: equal for the same play. */
export const playFingerprint = (p: Play): string =>
    JSON.stringify(minifyPlay({ ...p, gridPosition: undefined, updatedAt: undefined }));

export const isMinified = (data: any): boolean => {
    return Array.isArray(data) && data[0] === 3;
};

// BACKUP (V4): every playbook in one file, with the time it was saved.
// The plays are stored once; each playbook keeps its own grid positions.
export const minifyBackup = (playbooks: Playbook[], plays: Play[], savedAt: number): any => [
    4, // Version
    savedAt,
    plays.map(p => minifyPlay({ ...p, gridPosition: undefined })),
    playbooks.map(pb => [
        pb.id,
        pb.name,
        pb.gridConfig.columnNames,
        pb.entries.map(e => [e.playId, e.gridPosition ? [e.gridPosition.row, e.gridPosition.column] : null]),
    ]),
];

/** A backup's save time for people to read, e.g. "29 Oct 2026, 14:05". */
export const formatSavedAt = (savedAt: number): string =>
    new Date(savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** A backup's save time for its file name, in local time: 2026-10-29_14-05 */
export const fileStampSavedAt = (savedAt: number): string => {
    const d = new Date(savedAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
};

export const isBackup = (data: any): boolean => Array.isArray(data) && data[0] === 4;

// Returns playbooks in the import shape: every play (handleImportData adds them to the global plays) plus the
// playbook's own entries, so membership and grid positions come back exactly as saved
export const unminifyBackup = (data: any): { savedAt: number; playbooks: (SerializedPlaybook & Pick<Playbook, 'entries'>)[] } => {
    const plays: Play[] = data[2].map(unminifyPlay);
    return {
        savedAt: data[1],
        playbooks: data[3].map((pb: any) => ({
            id: pb[0],
            name: pb[1],
            gridConfig: { columnNames: pb[2] },
            entries: pb[3].map((e: any) => ({
                playId: e[0],
                ...(e[1] ? { gridPosition: { row: e[1][0], column: e[1][1] } } : {}),
            })),
            plays,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        })),
    };
};

/** Deflate-compress and Base64URL-encode minified data for embedding in a playbook file or share link. */
export const encodeShareData = async (minified: any): Promise<string> => {
    const stream = new Blob([JSON.stringify(minified)]).stream().pipeThrough(new CompressionStream('deflate'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return toBase64URL(binary);
};

// HTML Redirector Generator (Handshake Version)
/** The share data embedded in an exported playbook file (see generateRedirectHtml), or null if it isn't one. */
export const extractShareData = (html: string): string | null =>
    html.match(/const PLAYBOOK_DATA = "([^"]+)"/)?.[1] ?? null;

export const generateRedirectHtml = (playbookName: string, shareData: string): string => {
    const appUrl = `https://maierhjakob.github.io/PlayMakeFlag/`;

    return `<!DOCTYPE html>
<html>
<head>
    <title>Playbook: ${playbookName}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: white; text-align: center; padding: 20px; box-sizing: border-box; }
        .card { background: #1e293b; padding: 2rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; max-width: 400px; width: 100%; }
        .loader { border: 4px solid #334155; border-top: 4px solid #3b82f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px; display: none; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        h2 { margin: 0 0 10px; color: #3b82f6; }
        p { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; }
        .btn { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; cursor: pointer; border: none; transition: background 0.2s; font-size: 1rem; }
        .btn:hover { background: #2563eb; }
        .status { margin-top: 15px; font-size: 0.8rem; color: #64748b; font-style: italic; }
    </style>
</head>
<body>
    <div class="card">
        <div id="loader" class="loader"></div>
        <h2>"${playbookName}"</h2>
        <p>This file contains your playbook data. Click the button below to open it in the Play Designer.</p>
        
        <button id="openBtn" class="btn" onclick="openAndShare()">Open Playbook</button>
        
        <div id="statusMsg" class="status">Click to load the app...</div>
    </div>

    <script>
        const PLAYBOOK_DATA = "${shareData}";
        let appWindow = null;

        function openAndShare() {
            const btn = document.getElementById('openBtn');
            const status = document.getElementById('statusMsg');
            const loader = document.getElementById('loader');

            status.textContent = "Opening Play Designer...";
            btn.style.display = "none";
            loader.style.display = "block";

            // Open the app
            appWindow = window.open("${appUrl}", "_blank");

            // Handshake logic
            window.addEventListener("message", (event) => {
                // Security check: Only allow messages from your domain
                if (!event.origin.includes("github.io") && !event.origin.includes("localhost")) return;

                if (event.data === "HANDSHAKE_READY") {
                    status.textContent = "Data transfer in progress...";
                    // Send the data
                    appWindow.postMessage({
                        type: "IMPORT_PLAYBOOK",
                        data: PLAYBOOK_DATA
                    }, "*");
                    
                    status.textContent = "Success! You can close this tab now.";
                    loader.style.display = "none";
                }
            });
        }
    </script>
</body>
</html>`;
};
