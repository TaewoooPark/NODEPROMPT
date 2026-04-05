import {
  GestureRecognizer,
  FilesetResolver,
  type GestureRecognizerResult,
} from '@mediapipe/tasks-vision';
import { OneEuroFilter } from '1eurofilter';
import { createDefaultGestureState, type GestureState } from './gestureTypes';

// ── 상수 ──
const INFERENCE_INTERVAL_MS = 67; // ~15fps
const VIDEO_WIDTH = 320;
const VIDEO_HEIGHT = 240;
const CALIBRATION_FRAMES = 30;

// 핀치 히스테리시스 (넓은 갭 + 디바운스)
const PINCH_START_DIST = 0.07;   // 자연스러운 핀치 거리
const PINCH_END_DIST = 0.13;    // 확실히 벌려야 해제
const PINCH_DEBOUNCE_FRAMES = 2; // 2 연속 프레임 확인 (15fps에서 ~130ms)

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task';
const WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

// 1-Euro Filter 파라미터
const FILTER_FREQ = 15;
const FILTER_MIN_CUTOFF = 1.0;
const FILTER_BETA = 0.007;
// 핀치 거리 필터: 적당한 스무딩 (너무 느리면 감지 지연)
const PINCH_FILTER_MIN_CUTOFF = 1.5;
const PINCH_FILTER_BETA = 0.01;

// ── 뮤터블 싱글톤 (useFrame에서 직접 읽기) ──
export const gestureState: GestureState = createDefaultGestureState();

// ── 내부 상태 ──
let recognizer: GestureRecognizer | null = null;
let videoEl: HTMLVideoElement | null = null;
let stream: MediaStream | null = null;
let rafId: number | null = null;
let timeoutId: ReturnType<typeof setTimeout> | null = null;

// 1-Euro 필터 인스턴스
let filterIndexX: OneEuroFilter | null = null;
let filterIndexY: OneEuroFilter | null = null;
let filterPalmSize: OneEuroFilter | null = null;
let filterPinchDist: OneEuroFilter | null = null;
// 핀치 중점 필터 (엄지+검지 중간점)
let filterPinchMidX: OneEuroFilter | null = null;
let filterPinchMidY: OneEuroFilter | null = null;

const calibrationSamples: number[] = [];

// 핀치 디바운스 카운터
let pinchOnCounter = 0;
let pinchOffCounter = 0;

// ── 유틸 ──
function euclidean2D(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** MediaPipe 정규화(0-1) → Three.js NDC(-1~1), 웹캠 미러링 보정 */
function toNdc(mpX: number, mpY: number): [number, number] {
  return [
    -(mpX * 2 - 1), // 미러링: X 반전
    -(mpY * 2 - 1), // Y-down → Y-up
  ];
}

// ── 추론 루프 ──
function inferenceLoop() {
  if (!recognizer || !videoEl || videoEl.readyState < 2) {
    scheduleNext();
    return;
  }

  let result: GestureRecognizerResult;
  try {
    result = recognizer.recognizeForVideo(videoEl, performance.now());
  } catch {
    scheduleNext();
    return;
  }

  const now = performance.now();
  const ts = now / 1000; // 1-Euro 필터는 초 단위

  const hasHand = result.landmarks.length > 0;
  gestureState.handDetected = hasHand;

  if (!hasHand) {
    gestureState.gestureName = null;
    gestureState.gestureConfidence = 0;
    gestureState.isPinching = false;
    gestureState.pinchStrength = 0;
    pinchOnCounter = 0;
    pinchOffCounter = 0;
    scheduleNext();
    return;
  }

  // 제스처 분류
  const gesture = result.gestures[0]?.[0];
  gestureState.gestureName = gesture?.categoryName ?? null;
  gestureState.gestureConfidence = gesture?.score ?? 0;

  // 랜드마크
  const lm = result.landmarks[0];
  const wrist = lm[0];     // landmark 0: 손목
  const thumbTip = lm[4];  // landmark 4: 엄지 끝
  const indexTip = lm[8];  // landmark 8: 검지 끝
  const midMcp = lm[9];    // landmark 9: 중지 MCP

  // ── 핀치 감지: 필터링 + 히스테리시스 + 디바운스 ──
  const rawPinchDist = euclidean2D(thumbTip.x, thumbTip.y, indexTip.x, indexTip.y);
  const smoothedPinchDist = filterPinchDist!.filter(rawPinchDist, ts);
  gestureState.pinchStrength = 1 - Math.min(smoothedPinchDist / 0.12, 1);

  // 디바운스: N 연속 프레임 확인 후 상태 전환
  if (gestureState.isPinching) {
    // 현재 핀치 중 → 해제 조건 확인
    if (smoothedPinchDist > PINCH_END_DIST) {
      pinchOffCounter++;
      pinchOnCounter = 0;
      if (pinchOffCounter >= PINCH_DEBOUNCE_FRAMES) {
        gestureState.isPinching = false;
        pinchOffCounter = 0;
      }
    } else {
      pinchOffCounter = 0;
    }
  } else {
    // 현재 미핀치 → 시작 조건 확인
    if (smoothedPinchDist < PINCH_START_DIST) {
      pinchOnCounter++;
      pinchOffCounter = 0;
      if (pinchOnCounter >= PINCH_DEBOUNCE_FRAMES) {
        gestureState.isPinching = true;
        pinchOnCounter = 0;
      }
    } else {
      pinchOnCounter = 0;
    }
  }

  // ── 포인터 좌표: 손바닥 중심 (손목↔중지MCP 중점 = 안정적) ──
  const palmCenterMpX = (wrist.x + midMcp.x) / 2;
  const palmCenterMpY = (wrist.y + midMcp.y) / 2;
  const [rawNdcX, rawNdcY] = toNdc(palmCenterMpX, palmCenterMpY);

  // 이전 값 저장 (프레임 보간용)
  gestureState.prevIndexTipNdcX = gestureState.indexTipNdcX;
  gestureState.prevIndexTipNdcY = gestureState.indexTipNdcY;
  gestureState.prevPalmSizeSmoothed = gestureState.palmSizeSmoothed;

  gestureState.indexTipNdcX = filterPinchMidX!.filter(rawNdcX, ts);
  gestureState.indexTipNdcY = filterPinchMidY!.filter(rawNdcY, ts);

  // ── 손바닥 크기 (줌용, 1-Euro 필터) ──
  const rawPalmSize = euclidean2D(wrist.x, wrist.y, midMcp.x, midMcp.y);
  gestureState.palmSize = rawPalmSize;
  gestureState.palmSizeSmoothed = filterPalmSize!.filter(rawPalmSize, ts);

  // 캘리브레이션 (첫 CALIBRATION_FRAMES 프레임)
  if (calibrationSamples.length < CALIBRATION_FRAMES) {
    calibrationSamples.push(rawPalmSize);
    if (calibrationSamples.length === CALIBRATION_FRAMES) {
      gestureState.palmSizeBaseline = median(calibrationSamples);
    }
  }

  gestureState.lastUpdateMs = now;
  scheduleNext();
}

function scheduleNext() {
  if (!gestureState.active) return;
  timeoutId = setTimeout(() => {
    rafId = requestAnimationFrame(inferenceLoop);
  }, INFERENCE_INTERVAL_MS);
}

// ── Public API ──

export async function start(): Promise<void> {
  if (gestureState.active) return;

  try {
    // 웹캠
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
    });

    videoEl = document.createElement('video');
    videoEl.srcObject = stream;
    videoEl.setAttribute('playsinline', '');
    videoEl.muted = true;
    await videoEl.play();

    // MediaPipe WASM + 모델
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
    recognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
    });

    // 1-Euro 필터 초기화
    filterIndexX = new OneEuroFilter(FILTER_FREQ, FILTER_MIN_CUTOFF, FILTER_BETA);
    filterIndexY = new OneEuroFilter(FILTER_FREQ, FILTER_MIN_CUTOFF, FILTER_BETA);
    filterPalmSize = new OneEuroFilter(FILTER_FREQ, FILTER_MIN_CUTOFF, FILTER_BETA);
    filterPinchDist = new OneEuroFilter(FILTER_FREQ, PINCH_FILTER_MIN_CUTOFF, PINCH_FILTER_BETA);
    // 핀치 중점 필터: 안정성 우선 (더 낮은 cutoff)
    filterPinchMidX = new OneEuroFilter(FILTER_FREQ, 0.6, 0.005);
    filterPinchMidY = new OneEuroFilter(FILTER_FREQ, 0.6, 0.005);

    // 상태 초기화
    Object.assign(gestureState, createDefaultGestureState());
    gestureState.active = true;
    gestureState.error = null;
    calibrationSamples.length = 0;
    pinchOnCounter = 0;
    pinchOffCounter = 0;

    // 추론 루프 시작
    scheduleNext();
  } catch (err) {
    gestureState.error =
      err instanceof DOMException && err.name === 'NotAllowedError'
        ? '카메라 권한이 거부되었습니다'
        : `초기화 실패: ${(err as Error).message}`;
    gestureState.active = false;
  }
}

export function stop(): void {
  gestureState.active = false;

  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
    videoEl = null;
  }
  if (recognizer) {
    recognizer.close();
    recognizer = null;
  }

  filterIndexX = null;
  filterIndexY = null;
  filterPalmSize = null;
  filterPinchDist = null;
  filterPinchMidX = null;
  filterPinchMidY = null;

  Object.assign(gestureState, createDefaultGestureState());
  calibrationSamples.length = 0;
  pinchOnCounter = 0;
  pinchOffCounter = 0;
}

export function getVideoElement(): HTMLVideoElement | null {
  return videoEl;
}
