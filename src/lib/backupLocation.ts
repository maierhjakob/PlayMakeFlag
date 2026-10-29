// The backup file the user picked, remembered between visits so each backup overwrites it.
// Uses the File System Access API (Chrome / Edge on desktop); elsewhere backups are downloaded instead.

// Not in TypeScript's DOM types yet
interface PermissionedFileHandle extends FileSystemFileHandle {
    queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
    requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
}
type SaveFilePicker = (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<PermissionedFileHandle>;

const showSaveFilePicker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;

export const canPickBackupLocation = !!showSaveFilePicker;

// File handles can't go into localStorage, but IndexedDB stores them as they are
const DB_NAME = 'playmakerflag';
const STORE = 'handles';
const KEY = 'backupFile';

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

const dbRequest = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) => {
    const db = await openDb();
    return new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const loadHandle = () => dbRequest<PermissionedFileHandle | undefined>('readonly', store => store.get(KEY));
const storeHandle = (handle: PermissionedFileHandle) => dbRequest('readwrite', store => store.put(handle, KEY));

/** Ask where to save backups from now on. Returns null when the user cancels. */
export const pickBackupLocation = async (): Promise<PermissionedFileHandle | null> => {
    try {
        const handle = await showSaveFilePicker!({
            suggestedName: 'PlayMakerFlag_Backup.html',
            types: [{ description: 'Playbook backup', accept: { 'text/html': ['.html'] } }],
        });
        await storeHandle(handle);
        return handle;
    } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return null;
        throw e;
    }
};

/**
 * The remembered backup file, with permission to write it (the browser may ask once per visit),
 * or a newly picked one when there is none yet or access was refused. Null when the user cancels.
 * Call it first thing in a click handler: the picker and the permission prompt need the click.
 */
export const getBackupLocation = async (): Promise<PermissionedFileHandle | null> => {
    const handle = await loadHandle().catch(() => undefined);
    if (handle) {
        const permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission === 'granted' || await handle.requestPermission({ mode: 'readwrite' }) === 'granted') {
            return handle;
        }
    }
    return pickBackupLocation();
};

/** Overwrite the backup file with new content. */
export const writeBackup = async (handle: FileSystemFileHandle, content: Blob) => {
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
};
