export interface GestureState {
  /** 엔진이 활성 상태인지 */
  active: boolean;
  /** 손이 현재 감지되는지 */
  handDetected: boolean;
  /** MediaPipe 인식 제스처명 */
  gestureName: string | null;
  /** 제스처 신뢰도 0-1 */
  gestureConfidence: number;

  // ── 핀치 ──
  /** 엄지↔검지 핀치 상태 (히스테리시스 적용) */
  isPinching: boolean;
  /** 핀치 강도 0-1 (0=완전 벌림, 1=완전 접힘) */
  pinchStrength: number;

  // ── 검지 끝 (NDC -1~1, 웹캠 미러링 보정됨) ──
  indexTipNdcX: number;
  indexTipNdcY: number;

  // ── 손바닥 크기 (줌용) ──
  palmSize: number;
  palmSizeSmoothed: number;
  palmSizeBaseline: number;

  // ── 프레임 보간용 이전 값 ──
  prevIndexTipNdcX: number;
  prevIndexTipNdcY: number;
  prevPalmSizeSmoothed: number;

  /** 마지막 추론 타임스탬프 (ms) */
  lastUpdateMs: number;
  /** 에러 메시지 */
  error: string | null;
}

export function createDefaultGestureState(): GestureState {
  return {
    active: false,
    handDetected: false,
    gestureName: null,
    gestureConfidence: 0,
    isPinching: false,
    pinchStrength: 0,
    indexTipNdcX: 0,
    indexTipNdcY: 0,
    palmSize: 0,
    palmSizeSmoothed: 0,
    palmSizeBaseline: 0,
    prevIndexTipNdcX: 0,
    prevIndexTipNdcY: 0,
    prevPalmSizeSmoothed: 0,
    lastUpdateMs: 0,
    error: null,
  };
}
