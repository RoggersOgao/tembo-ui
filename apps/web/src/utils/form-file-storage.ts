/**
 * lib/form-file-storage.ts
 *
 * IndexedDB utility for persisting File objects across page refreshes.
 * Used by the multi-step property form to store:
 *   - The selected folder file  (key: `{propertyId}-folder`)
 *   - Photo files               (key: `{propertyId}-photos`)
 *
 * Photo shape matches ProductImageProps exactly. The `url` (blob URL) is
 * intentionally NOT stored — blob URLs die on refresh. We store the raw File
 * blob and regenerate `url` via URL.createObjectURL on load.
 */

import { ProductImageProps } from "@/types/general/general";



const DB_NAME = 'property-form-files';
const DB_VERSION = 1;
const STORE_FILES = 'files';   // single File objects (folder)
const STORE_PHOTOS = 'photos';  // ProductImageProps[] with File blobs

// ─── DB singleton ─────────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES);
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) db.createObjectStore(STORE_PHOTOS);
    };

    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

// ─── Generic helpers ──────────────────────────────────────────────────────────

async function idbSet(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(store: string, key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(store: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Folder file API ─────────────────────────────────────────────────────────

export async function saveFolderFile(propertyId: string, file: File): Promise<void> {
  await idbSet(STORE_FILES, `${propertyId}-folder`, file);
}

export async function loadFolderFile(propertyId: string): Promise<File | null> {
  return idbGet<File>(STORE_FILES, `${propertyId}-folder`);
}

export async function deleteFolderFile(propertyId: string): Promise<void> {
  await idbDelete(STORE_FILES, `${propertyId}-folder`);
}

// ─── Photo files API ──────────────────────────────────────────────────────────
//
// Matches ProductImageProps exactly. `url` (a blob URL) is stripped before
// saving — blob URLs are session-only and die on refresh. On load we
// regenerate `url` from the stored File blob via URL.createObjectURL.
//
// Stored shape per photo: { id, file, name, size, type, width, height }
// Loaded shape per photo: { id, file, name, size, type, width, height, url }  ← full ProductImageProps



type StoredPhoto = Omit<ProductImageProps, 'url'>;

export async function savePhotoFiles(
  propertyId: string,
  photos: ProductImageProps[],
): Promise<void> {
  // Strip url — it's a blob URL that won't survive a page refresh.
  const stripped: StoredPhoto[] = photos.map(({ url: _url, ...rest }) => rest);
  await idbSet(STORE_PHOTOS, `${propertyId}-photos`, stripped);
}
export async function loadPhotoFiles(propertyId: string): Promise<ProductImageProps[]> {
  const stored = await idbGet<StoredPhoto[]>(STORE_PHOTOS, `${propertyId}-photos`);
  if (!stored || !Array.isArray(stored)) return [];

  // Regenerate fresh blob URLs from the restored File blobs.
  // These are valid for the lifetime of this page session.
  // Filter out any entries whose file blob was not restored (null) to avoid
  // passing null to URL.createObjectURL.
  return stored
    .filter((photo): photo is StoredPhoto & { file: File } => photo?.file != null)
    .map(photo => ({
      ...photo,
      url: URL.createObjectURL(photo.file),
    }));
}

export async function deletePhotoFiles(propertyId: string): Promise<void> {
  await idbDelete(STORE_PHOTOS, `${propertyId}-photos`);
}

// ─── Cleanup helper ───────────────────────────────────────────────────────────
// Call this on successful submit or form reset to clear everything.

export async function clearFormFiles(propertyId: string): Promise<void> {
  await Promise.allSettled([
    deleteFolderFile(propertyId),
    deletePhotoFiles(propertyId),
  ]);
}