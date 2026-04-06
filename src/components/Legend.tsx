import { ALL_NODE_TYPES, PATTERN_CSS } from '../utils/nodePatterns';
import { useTypeLabels } from '../i18n/useLanguage';

export function Legend() {
  const typeLabels = useTypeLabels();

  return (
    <div style={{
      position: 'fixed',
      top: 14,
      right: 14,
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: 6,
      padding: '8px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
      fontFamily: '"DM Sans", "IBM Plex Sans", "Helvetica Neue", sans-serif',
      fontSize: 10,
      fontWeight: 300,
      letterSpacing: '0.02em',
      color: '#1a1a1a',
      zIndex: 100,
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      {ALL_NODE_TYPES.map((type) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            border: '0.5px solid rgba(0,0,0,0.15)',
            flexShrink: 0,
            ...PATTERN_CSS[type],
          }} />
          <span>{typeLabels[type]}</span>
        </div>
      ))}
    </div>
  );
}
