const FACE_MODELS_URL = "/models";

let faceapi = null;
let modelsLoaded = false;
let loadingPromise = null;

export async function preloadFaceModels() {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    if (!faceapi) faceapi = await import("face-api.js");
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
