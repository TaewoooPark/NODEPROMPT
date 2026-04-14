import { useState, useCallback, useEffect, type CSSProperties } from 'react';
import { useLanguageStore } from '../i18n/useLanguage';
import { useT, useTypeLabels } from '../i18n/useLanguage';
import { PATTERN_CSS } from '../utils/nodePatterns';
import type { NodeType } from '../types';

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

const langBtnStyle: CSSProperties = {
  position: 'fixed',
  left: 50,
  top: 16,
  height: 28,
  borderRadius: 14,
  border: '1px solid rgba(0,0,0,0.15)',
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(10px)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 400,
  color: '#555',
  fontFamily: '"DM Sans", "IBM Plex Sans", sans-serif',
  zIndex: 110,
  transition: 'background 0.15s ease',
  padding: '0 10px',
  letterSpacing: '0.02em',
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
  maxWidth: 860,
  width: '92vw',
  maxHeight: '90vh',
  overflowY: 'auto',
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

const TRANSCENDENTALS: { type: NodeType; meanKey: string; askKey: string; draftKey: string }[] = [
  { type: 'ens',     meanKey: 'help.ensMean',     askKey: 'help.ensAsk',     draftKey: 'help.ensDraft' },
  { type: 'res',     meanKey: 'help.resMean',     askKey: 'help.resAsk',     draftKey: 'help.resDraft' },
  { type: 'unum',    meanKey: 'help.unumMean',    askKey: 'help.unumAsk',    draftKey: 'help.unumDraft' },
  { type: 'aliquid', meanKey: 'help.aliquidMean', askKey: 'help.aliquidAsk', draftKey: 'help.aliquidDraft' },
  { type: 'verum',   meanKey: 'help.verumMean',   askKey: 'help.verumAsk',   draftKey: 'help.verumDraft' },
  { type: 'bonum',   meanKey: 'help.bonumMean',   askKey: 'help.bonumAsk',   draftKey: 'help.bonumDraft' },
];

export function HelpOverlay() {
  const [open, setOpen] = useState(false);
  const t = useT();
  const typeLabels = useTypeLabels();
  const lang = useLanguageStore((s) => s.lang);
  const toggleLang = useLanguageStore((s) => s.toggleLang);

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

      <button
        style={langBtnStyle}
        onClick={toggleLang}
        title={lang === 'ko' ? 'Switch to English' : '한국어로 전환'}
      >
        {lang === 'ko' ? 'EN' : '한'}
      </button>

      {open && (
        <div style={overlayStyle} onClick={toggle}>
          <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 400, marginBottom: 12 }}>
              {t('help.title')}
            </div>

            <div style={{ display: 'flex', gap: 32 }}>
              {/* ── Left column ── */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={sectionTitle}>{t('help.nav')}</div>
                <Row label={t('help.switchMode')} shortcut="Space" />
                <Row label={t('help.switchModeDbl')} shortcut="Double-click" />
                <Row label={t('help.cameraHome')} shortcut="H" />
                <Row label={t('help.zoom')} shortcut="Scroll" />
                <Row label={t('help.rotate')} shortcut="Drag" />

                <div style={sectionTitle}>{t('help.node')}</div>
                <Row label={t('help.selectFocus')} shortcut="Click" />
                <Row label={t('help.unfocus')} shortcut="Click again" />
                <Row label={t('help.deselect')} shortcut="Esc" />
                <Row label={t('help.dragNode')} shortcut="Drag" />
                <Row label={t('help.weightUp')} shortcut="] / +" />
                <Row label={t('help.weightDown')} shortcut="[ / -" />
                <Row label={t('help.weightWheel')} shortcut="Wheel on node" />
                <Row label={t('help.deleteNode')} shortcut="Backspace" />
              </div>

              {/* ── Right column ── */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={sectionTitle}>{t('help.edge')}</div>
                <Row label={t('help.edgeStart')} shortcut="Shift + Click" />
                <Row label={t('help.edgeCancel')} shortcut="Esc" />

                <div style={sectionTitle}>{t('help.display')}</div>
                <Row label={t('help.toggleLabels')} shortcut="L" />
                <Row label="Undo" shortcut="Ctrl + Z" />
                <Row label="Redo" shortcut="Ctrl + Shift + Z" />
                <Row label={t('help.thisHelp')} shortcut="?" />

                <div style={sectionTitle}>{t('help.gesture')}</div>
                <Row label={t('help.gestureToggle')} shortcut={t('help.gestureToggleShortcut')} />
                <Row label={t('help.rotateSphere')} shortcut={t('help.rotateSphereShortcut')} />
                <Row label={t('help.stopRotation')} shortcut={t('help.stopRotationShortcut')} />
                <Row label={t('help.zoomInOut')} shortcut={t('help.zoomInOutShortcut')} />

                <div style={{ ...sectionTitle, marginTop: 20 }}>{t('help.tip')}</div>
                <div style={{ fontSize: 11, fontWeight: 300, color: '#666', lineHeight: 1.6 }}>
                  {t('help.tipText')}
                </div>
              </div>
            </div>

            {/* ── Transcendentia section ── */}
            <div style={{ ...sectionTitle, marginTop: 24 }}>{t('help.transcendentals')}</div>
            <div style={{ fontSize: 11, fontWeight: 300, color: '#555', lineHeight: 1.6, marginBottom: 10 }}>
              {t('help.transcendentalsIntro')}
            </div>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 11,
              fontWeight: 300,
              color: '#1a1a1a',
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.12)' }}>
                  <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 400, color: '#888', fontSize: 10, letterSpacing: '0.04em' }}>
                    {t('help.tcHeaderLatin')}
                  </th>
                  <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 400, color: '#888', fontSize: 10, letterSpacing: '0.04em' }}>
                    {t('help.tcHeaderMean')}
                  </th>
                  <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 400, color: '#888', fontSize: 10, letterSpacing: '0.04em' }}>
                    {t('help.tcHeaderAsk')}
                  </th>
                  <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 400, color: '#888', fontSize: 10, letterSpacing: '0.04em' }}>
                    {t('help.tcHeaderDraft')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {TRANSCENDENTALS.map((row) => (
                  <tr key={row.type} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <td style={{ padding: '6px 6px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 10, height: 10, borderRadius: '50%',
                          border: '0.5px solid rgba(0,0,0,0.2)',
                          ...PATTERN_CSS[row.type],
                        }} />
                        <span style={{ fontStyle: 'italic', fontWeight: 400 }}>{row.type}</span>
                        <span style={{ color: '#999' }}>·</span>
                        <span>{typeLabels[row.type]}</span>
                      </span>
                    </td>
                    <td style={{ padding: '6px 6px', color: '#444', verticalAlign: 'top' }}>
                      {t(row.meanKey as never)}
                    </td>
                    <td style={{ padding: '6px 6px', color: '#1a1a1a', verticalAlign: 'top' }}>
                      {t(row.askKey as never)}
                    </td>
                    <td style={{ padding: '6px 6px', color: '#888', fontSize: 10, verticalAlign: 'top' }}>
                      {t(row.draftKey as never)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 10, fontWeight: 300, color: '#888', lineHeight: 1.6, marginTop: 10, fontStyle: 'italic' }}>
              {t('help.transcendentalsFoot')}
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
              {t('help.close')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
