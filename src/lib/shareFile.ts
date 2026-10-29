import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

interface ShareFileOptions {
    title: string;
    /** Sent along with the file; share targets like Copy treat it as a second item */
    text?: string;
}

const toBase64 = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
};

/**
 * Hand a file to the system share sheet: the native one in the app, the Web Share API in phone browsers
 * that support sharing files, otherwise download it. Desktop browsers download: Chrome's share menu on macOS
 * saved the file twice. Returns 'downloaded' when it fell back to a download.
 */
export const shareFile = async (file: File, { title, text }: ShareFileOptions): Promise<'shared' | 'downloaded'> => {
    if (Capacitor.isNativePlatform()) {
        const { uri } = await Filesystem.writeFile({
            path: file.name.replace(/[^\w.-]/g, '_'),
            data: await toBase64(file),
            directory: Directory.Cache,
        });
        try {
            await Share.share({ title, text, files: [uri], dialogTitle: title });
        } catch {
            // Share sheet dismissed
        }
        return 'shared';
    }

    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    if (isTouchDevice && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title, text });
            return 'shared';
        } catch (e) {
            // Dismissed by the user: done. Anything else: fall back to a download
            if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
        }
    }

    downloadFile(file);
    return 'downloaded';
};

const downloadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
};

/**
 * Save a file on the device without the share sheet: into Documents in the app, a download in browsers.
 * Returns where it ended up, for telling the user.
 */
export const saveFile = async (file: File): Promise<string> => {
    if (Capacitor.isNativePlatform()) {
        const path = file.name.replace(/[^\w.-]/g, '_');
        await Filesystem.writeFile({
            path,
            data: await toBase64(file),
            directory: Directory.Documents,
        });
        return `Documents/${path}`;
    }

    downloadFile(file);
    return 'your downloads';
};
