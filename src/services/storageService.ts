
import { openDB, IDBPDatabase } from 'idb';
import { ImageItem } from '../types';
import { fileToBase64 } from './imageUtils';

const DB_NAME = 'banana_ai_db';
const STORE_NAME = 'images';
const DB_VERSION = 1;

interface StoredImage {
  id: string;
  fileData: string; // base64
  fileType: string;
  fileName: string;
  previewData?: string;
  processedData?: string;
  item: Omit<ImageItem, 'file'>;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

// Helper to reconstruct File object from base64
const base64ToFile = (base64: string, name: string, type: string): File => {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new File([ab], name, { type });
};

export const saveSessionImages = async (images: ImageItem[]) => {
  // CRITICAL FIX: Prepare all data BEFORE opening the transaction.
  // Async operations like fileToBase64 (FileReader) cause IDB transactions to auto-commit/close if awaited inside the loop.
  const preparedImages: StoredImage[] = await Promise.all(images.map(async (img) => {
    const fileBase64 = await fileToBase64(img.file);
    return {
      id: img.id,
      fileData: fileBase64,
      fileType: img.file.type,
      fileName: img.originalMeta.name,
      item: {
          ...img,
          previewUrl: '', // URLs are ephemeral, cannot store
          processedUrl: '' // URLs are ephemeral
      },
    };
  }));

  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  // Clear existing to avoid stale state
  await store.clear();

  for (const stored of preparedImages) {
    await store.put(stored);
  }
  
  await tx.done;
};

export const loadSessionImages = async (): Promise<ImageItem[]> => {
  const db = await getDB();
  const stored: StoredImage[] = await db.getAll(STORE_NAME);
  
  if (!stored || stored.length === 0) return [];

  return stored.map(s => {
      const file = base64ToFile(s.fileData, s.fileName, s.fileType);
      return {
          ...s.item,
          file: file,
          previewUrl: URL.createObjectURL(file), // Re-create URL
          processedUrl: undefined, // User will need to re-download or we need deeper storage logic
          status: s.item.status === 'PROCESSING' ? 'IDLE' : s.item.status // Reset stuck processing
      } as ImageItem;
  });
};
