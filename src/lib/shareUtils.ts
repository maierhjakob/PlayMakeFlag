import type { Playbook, Play, Player, RouteSegment, Point, PlayTag } from '../types';
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
export const minifyPlaybook = (pb: Playbook): any => {
    return [
        3, // Version
        pb.id,
        pb.name,
        pb.gridConfig.columnNames,
        pb.plays.map(minifyPlay)
    ];
};

const minifyPlay = (p: Play): any => {
    return [
        p.id,
        p.name,
        p.players.map(minifyPlayer),
        p.tags?.map(minifyTag) || [],
        p.gridPosition ? [p.gridPosition.row, p.gridPosition.column] : null,
        p.ballPosition ? minifyPoint(p.ballPosition) : null
    ];
};

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
export const unminifyPlaybook = (data: any): Playbook => {
    if (!Array.isArray(data)) return data as Playbook;
    if (data[0] !== 3) return data as unknown as Playbook;

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

export const isMinified = (data: any): boolean => {
    return Array.isArray(data) && data[0] === 3;
};

// HTML Redirector Generator (Handshake Version)
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
