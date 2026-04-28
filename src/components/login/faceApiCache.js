const FACE_MODELS_URL = "/models";
const DB_NAME = "face-models-v1";
const STORE = "files";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = reject;
  });
}

function dbGet(db, key) {
  return new Promise((resolve) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = (e) => resolve(e.target.result ?? null);
    req.onerror = () => resolve(null);
  });
}

function dbPut(db, key, val) {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
}

let dbPromise = null;

function getDB() {
  if (!dbPromise) dbPromise = openDB().catch(() => null);
  return dbPromise;
}

async function cachedFetch(url, options) {
  try {
    const db = await getDB();
    if (db) {
      const cached = await dbGet(db, url);
      if (cached) return new Response(cached);
    }
    const res = await fetch(url, options);
    if (res.ok && db) {
      const buffer = await res.arrayBuffer();
      dbPut(db, url, buffer);
      return new Response(buffer);
    }
    return res;
  } catch {
    return fetch(url, options);
  }
}

let faceapi = null;
let modelsLoaded = false;
let loadingPromise = null;

export async function preloadFaceModels() {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    if (!faceapi) faceapi = await import("face-api.js");
    faceapi.env.monkeyPatch({ fetch: cachedFetch });
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODELS_URL),
    ]);
    modelsLoaded = true;
  })();

  return loadingPromise;
}

export function getFaceApi() {
  return faceapi;
}

export function areFaceModelsLoaded() {
  return modelsLoaded;
}
