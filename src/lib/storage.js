// Tiny key/value store on IndexedDB with a localStorage/in-memory fallback.
// Used for the wallet cache, portfolio history, token metadata and journal.

const DB_NAME = "levcal";
const STORE = "kv";
const memory = new Map();
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const lsKey = (k) => `levcal:idb:${k}`;

export async function idbGet(key, fallback = undefined) {
  const db = await openDb();
  try {
    if (db) {
      const v = await tx(db, "readonly", (s) => s.get(key));
      return v === undefined ? fallback : v;
    }
    if (memory.has(key)) return memory.get(key);
    const raw = localStorage.getItem(lsKey(key));
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return memory.has(key) ? memory.get(key) : fallback;
  }
}

export async function idbSet(key, value) {
  const db = await openDb();
  try {
    if (db) return await tx(db, "readwrite", (s) => s.put(value, key));
    memory.set(key, value);
    localStorage.setItem(lsKey(key), JSON.stringify(value));
  } catch {
    memory.set(key, value);
  }
}

export async function idbDel(key) {
  const db = await openDb();
  try {
    if (db) return await tx(db, "readwrite", (s) => s.delete(key));
    memory.delete(key);
    localStorage.removeItem(lsKey(key));
  } catch {
    memory.delete(key);
  }
}

export async function idbKeys() {
  const db = await openDb();
  try {
    if (db) return await tx(db, "readonly", (s) => s.getAllKeys());
  } catch {
    /* fall through */
  }
  return [...memory.keys()];
}

/* -------------------------------------------------- synchronous local state */

export function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: state stays in memory */
  }
}
