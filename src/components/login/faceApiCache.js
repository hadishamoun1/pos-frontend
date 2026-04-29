const FACE_MODELS_URL = "/models";
const CACHE_NAME = "face-models-v1";

async function cachedFetch(url, options) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url);
    if (cached) return cached;
    const res = await fetch(url, options);
    if (res.ok) cache.put(url, res.clone());
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
