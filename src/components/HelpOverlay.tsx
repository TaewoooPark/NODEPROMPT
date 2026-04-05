import { useState, useCallback, useEffect, type CSSProperties } from 'react';

const btnStyle: CSSProperties = {
  position: 'fixed',
  left: 16,
  top: 16,
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: '1px solid rgba(0,0,0,0.15)',
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(10px)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  fontWeight: 300,
  color: '#555',
  fontFamily: '"DM Sans", "IBM Plex Sans", sans-serif',
  zIndex: 110,
  transition: 'background 0.15s ease',
};

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  backdropFilter: 'blur(4px)',
  zIndex: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const cardStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 12,
  padding: '24px 32px',
  maxWidth: 420,
  width: '90vw',
  fontFamily: '"DM Sans", "IBM Plex Sans", sans-serif',
  color: '#1a1a1a',
};

const sectionTitle: CSSProperties = {
  fontSize: 10,
  fontWeight: 400,
  color: '#999',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginTop: 16,
  marginBottom: 6,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '3px 0',
  fontSize: 12,
  fontWeight: 300,
};

const kbdStyle: CSSProperties = {
  background: 'rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 3,
  padding: '1px 6px',
  fontSize: 11,
  fontFamily: 'inherit',
  fontWeight: 400,
  color: '#333',
};

function Row({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <div style={rowStyle}>
      <span>{label}</span>
      <kbd style={kbdStyle}>{shortcut}</kbd>
    </div>
  );
}

export function HelpOverlay() {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  // ? 키로 열기/닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <>
      <button style={btnStyle} onClick={toggle} title="Help (?)">
        ?
      </button>

      {open && (
        <div style={overlayStyle} onClick={toggle}>
          <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 400, marginBottom: 4 }}>
              Keyboard Shortcuts
            </div>

            <div style={sectionTitle}>Navigation</div>
            <Row label="Sphere / Radial 전환" shortcut="Space" />
            <Row label="더블클릭으로도 전환" shortcut="Double-click" />
            <Row label="카메라 홈" shortcut="H" />
            <Row label="줌" shortcut="Scroll" />
            <Row label="회전 (Sphere)" shortcut="Drag" />

            <div style={sectionTitle}>Node</div>
            <Row label="노드 선택 / 포커싱" shortcut="Click" />
            <Row label="재클릭으로 포커싱 해제" shortcut="Click again" />
            <Row label="선택 해제" shortcut="Esc" />
            <Row label="노드 드래그 (Radial)" shortcut="Drag" />
            <Row label="가중치 증가" shortcut="] / +" />
            <Row label="가중치 감소" shortcut="[ / -" />
            <Row label="가중치 휠 조절 (Radial)" shortcut="Wheel on node" />
            <Row label="노드 삭제 (Radial)" shortcut="Backspace" />

            <div style={sectionTitle}>Edge</div>
            <Row label="엣지 생성 시작/완성" shortcut="Shift + Click" />
            <Row label="엣지 생성 취소" shortcut="Esc" />

            <div style={sectionTitle}>Display</div>
            <Row label="라벨 토글" shortcut="L" />
            <Row label="Undo" shortcut="Ctrl + Z" />
            <Row label="Redo" shortcut="Ctrl + Shift + Z" />
            <Row label="이 도움말" shortcut="?" />

            <div style={{ ...sectionTitle, marginTop: 20 }}>Tip</div>
            <div style={{ fontSize: 11, fontWeight: 300, color: '#666', lineHeight: 1.6 }}>
              노드를 클릭하면 연결된 노드만 강조됩니다.
              다시 클릭하면 포커싱이 풀립니다.
              우클릭으로 컨텍스트 메뉴를 열 수 있습니다.
            </div>

            <button
              onClick={toggle}
              style={{
                marginTop: 16,
                width: '100%',
                padding: '6px 0',
                background: '#1a1a1a',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontFamily: 'inherit',
                fontWeight: 300,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
