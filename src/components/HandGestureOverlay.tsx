import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { gestureState, start, stop, getVideoElement } from '../gesture/gestureEngine';
import { useT } from '../i18n/useLanguage';

// ── 스타일 ──
const wrapStyle: CSSProperties = {
  position: 'fixed',
  bottom: 14,
  left: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  alignItems: 'flex-start',
  zIndex: 100,
  fontFamily: '"DM Sans", "IBM Plex Sans", sans-serif',
  fontWeight: 300,
  fontSize: 10,
  color: '#1a1a1a',
  userSelect: 'none',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 8,
  padding: '4px 10px',
};

const btnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  lineHeight: 1,
  fontSize: 14,
};

const dotBase: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: '50%',
  flexShrink: 0,
};

const previewStyle: CSSProperties = {
  width: 64,
  height: 48,
  borderRadius: 6,
  overflow: 'hidden',
  opacity: 0.35,
  border: '1px solid rgba(0,0,0,0.1)',
};

// ── 컴포넌트 ──
interface DisplayState {
  handDetected: boolean;
  gestureName: string | null;
  isPinching: boolean;
  error: string | null;
}

export function HandGestureOverlay() {
  const gestureEnabled = useGraphStore((s) => s.gestureEnabled);
  const setGestureEnabled = useGraphStore((s) => s.setGestureEnabled);
  const [showPreview, setShowPreview] = useState(false);
  const [display, setDisplay] = useState<DisplayState>({
    handDetected: false,
    gestureName: null,
    isPinching: false,
    error: null,
  });
  const previewRef = useRef<HTMLDivElement>(null);
  const t = useT();

  // 토글 핸들러
  const toggle = useCallback(async () => {
    if (gestureEnabled) {
      stop();
      setGestureEnabled(false);
    } else {
      setGestureEnabled(true);
      await start();
      if (gestureState.error) {
        setGestureEnabled(false);
      }
    }
  }, [gestureEnabled, setGestureEnabled]);

  // 상태 폴링 (5Hz)
  useEffect(() => {
    if (!gestureEnabled) return;
    const id = setInterval(() => {
      setDisplay({
        handDetected: gestureState.handDetected,
        gestureName: gestureState.gestureName,
        isPinching: gestureState.isPinching,
        error: gestureState.error,
      });
    }, 200);
    return () => clearInterval(id);
  }, [gestureEnabled]);

  // 미니 웹캠 프리뷰 연결
  useEffect(() => {
    if (!showPreview || !gestureEnabled) return;
    const container = previewRef.current;
    const video = getVideoElement();
    if (!container || !video) return;

    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.transform = 'scaleX(-1)';
    container.appendChild(video);

    return () => {
      if (container.contains(video)) {
        container.removeChild(video);
      }
    };
  }, [showPreview, gestureEnabled]);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (gestureState.active) stop();
    };
  }, []);

  // 상태 점 색상
  const dotColor = !gestureEnabled
    ? '#999'
    : display.error
      ? '#e53935'
      : display.handDetected
        ? '#43a047'
        : '#fbc02d';

  // 제스처 라벨
  const gestureLabel = !gestureEnabled
    ? 'Off'
    : display.error
      ? 'Error'
      : !display.handDetected
        ? '...'
        : display.gestureName === 'Closed_Fist'
          ? 'Stop'
          : display.gestureName === 'Open_Palm'
            ? 'Touch'
            : display.gestureName ?? '...';

  return (
    <div style={wrapStyle}>
      {showPreview && gestureEnabled && (
        <div ref={previewRef} style={previewStyle} />
      )}
      <div style={rowStyle}>
        <button
          style={btnStyle}
          onClick={toggle}
          title={gestureEnabled ? t('gesture.disable') : t('gesture.enable')}
        >
          {gestureEnabled ? '🤚' : '✋'}
        </button>
        <div style={{ ...dotBase, background: dotColor }} />
        <span style={{ minWidth: 28 }}>{gestureLabel}</span>
        {gestureEnabled && (
          <button
            style={{ ...btnStyle, fontSize: 10, opacity: 0.5 }}
            onClick={() => setShowPreview((p) => !p)}
            title={t('gesture.previewToggle')}
          >
            {showPreview ? '◉' : '◎'}
          </button>
        )}
      </div>
    </div>
  );
}
