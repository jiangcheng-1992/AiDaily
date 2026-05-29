export type HandGestureSnapshot = {
  x: number;
  y: number;
  gesture: string;
  score: number;
};

export type HandGestureRecognizer = {
  recognizeForVideo: (
    video: HTMLVideoElement,
    timestampMs: number,
  ) => {
    gestures?: Array<Array<{ categoryName?: string; score?: number }>>;
    landmarks?: Array<Array<{ x: number; y: number; z?: number }>>;
  };
  close?: () => void;
};

type MediaPipeVisionModule = {
  FilesetResolver: {
    forVisionTasks: (wasmPath: string) => Promise<unknown>;
  };
  GestureRecognizer: {
    createFromOptions: (
      fileset: unknown,
      options: {
        baseOptions: {
          modelAssetPath: string;
          delegate: "GPU" | "CPU";
        };
        runningMode: "VIDEO";
        numHands: number;
      },
    ) => Promise<HandGestureRecognizer>;
  };
};

const visionCdn = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm";
const wasmCdn = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const gestureModelUrl =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

export async function createHandGestureRecognizer() {
  const vision = await importMediaPipeVision();
  const fileset = await vision.FilesetResolver.forVisionTasks(wasmCdn);

  return vision.GestureRecognizer.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: gestureModelUrl,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 1,
  });
}

export function readHandGesture(
  recognizer: HandGestureRecognizer,
  video: HTMLVideoElement,
): HandGestureSnapshot | null {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;

  const result = recognizer.recognizeForVideo(video, performance.now());
  const hand = result.landmarks?.[0];
  if (!hand?.length) return null;

  const palm = hand[9] ?? hand[0];
  const bestGesture = result.gestures?.[0]?.[0];
  const inferredGesture = inferOkGesture(hand) ?? bestGesture?.categoryName ?? "Unknown";

  return {
    x: clamp01(1 - palm.x),
    y: clamp01(palm.y),
    gesture: inferredGesture,
    score: bestGesture?.score ?? 0,
  };
}

export function isSelectGesture(gesture: string) {
  return ["Closed_Fist", "Ok_Sign", "Thumb_Up", "Victory", "ILoveYou"].includes(gesture);
}

export function isFocusGesture(gesture: string) {
  return gesture === "Open_Palm" || gesture === "Pointing_Up";
}

async function importMediaPipeVision() {
  const importer = new Function("url", "return import(url)") as (
    url: string,
  ) => Promise<MediaPipeVisionModule>;
  return importer(visionCdn);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function inferOkGesture(hand: Array<{ x: number; y: number; z?: number }>) {
  const thumbTip = hand[4];
  const indexTip = hand[8];
  const middleTip = hand[12];
  const wrist = hand[0];
  if (!thumbTip || !indexTip || !middleTip || !wrist) return null;

  const pinchDistance = getDistance(thumbTip, indexTip);
  const handScale = Math.max(0.08, getDistance(wrist, middleTip));
  return pinchDistance / handScale < 0.34 ? "Ok_Sign" : null;
}

function getDistance(
  a: { x: number; y: number; z?: number },
  b: { x: number; y: number; z?: number },
) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}
