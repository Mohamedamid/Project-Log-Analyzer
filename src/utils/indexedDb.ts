const DB_NAME = "log-analyzer-db";
const DB_VERSION = 1;
const STORE_NAME = "state";
const CURRENT_ANALYSIS_KEY = "current-analysis-v2";

function openStateDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
  });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openStateDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = action(store);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function loadCurrentAnalysis<T>(): Promise<T | null> {
  try {
    return (await withStore<T | undefined>("readonly", (store) => store.get(CURRENT_ANALYSIS_KEY))) || null;
  } catch {
    return null;
  }
}

export async function saveCurrentAnalysis<T>(value: T): Promise<void> {
  try {
    await withStore<IDBValidKey>("readwrite", (store) => store.put(value, CURRENT_ANALYSIS_KEY));
  } catch {
    // The app remains usable in memory even when browser storage is unavailable.
  }
}

export async function clearCurrentAnalysis(): Promise<void> {
  try {
    await withStore<undefined>("readwrite", (store) => store.delete(CURRENT_ANALYSIS_KEY));
  } catch {
    // Ignore storage errors for the same reason as saveCurrentAnalysis.
  }
}
