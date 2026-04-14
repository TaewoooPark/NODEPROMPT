import type { CSSProperties } from 'react';
import type { ProviderId } from './types';

// 모노톤 프로바이더 로고. currentColor만 사용해 Lombardi 스타일에 흡수되도록.
// 원본 브랜드 로고를 극도로 단순화한 추상 기호(그래픽 트레이드마크 회피 목적).

interface LogoProps {
  size?: number;
  style?: CSSProperties;
}

// Anthropic: 8-point burst (별)
function AnthropicLogo({ size = 12, style }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={style} aria-hidden>
      <g stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none">
        <line x1="6" y1="0.8" x2="6" y2="11.2" />
        <line x1="0.8" y1="6" x2="11.2" y2="6" />
        <line x1="2.3" y1="2.3" x2="9.7" y2="9.7" />
        <line x1="9.7" y1="2.3" x2="2.3" y2="9.7" />
      </g>
    </svg>
  );
}

// OpenAI: 육각형 노드 마크
function OpenAILogo({ size = 12, style }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={style} aria-hidden>
      <polygon
        points="6,0.8 10.5,3.4 10.5,8.6 6,11.2 1.5,8.6 1.5,3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="6" r="1.2" fill="currentColor" />
    </svg>
  );
}

// Gemini: 4-point star (diamond with pinched sides)
function GeminiLogo({ size = 12, style }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={style} aria-hidden>
      <path
        d="M6 0.5 C6.4 4 8 5.6 11.5 6 C8 6.4 6.4 8 6 11.5 C5.6 8 4 6.4 0.5 6 C4 5.6 5.6 4 6 0.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Grok (xAI): 단순화된 X
function GrokLogo({ size = 12, style }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={style} aria-hidden>
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <line x1="1.5" y1="1.5" x2="10.5" y2="10.5" />
        <line x1="10.5" y1="1.5" x2="1.5" y2="10.5" />
      </g>
    </svg>
  );
}

// DeepSeek: 단순화된 파도/고래 등선
function DeepSeekLogo({ size = 12, style }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={style} aria-hidden>
      <path
        d="M1 7.5 Q3 3.5 6 5.5 Q9 7.5 11 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="8.8" cy="5" r="0.9" fill="currentColor" />
    </svg>
  );
}

// Qwen: 원 + 아래꼬리 (Q)
function QwenLogo({ size = 12, style }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={style} aria-hidden>
      <circle cx="5.4" cy="5.4" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <line
        x1="7.8"
        y1="7.8"
        x2="11"
        y2="11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ProviderLogo({ provider, size, style }: { provider: ProviderId } & LogoProps) {
  switch (provider) {
    case 'anthropic': return <AnthropicLogo size={size} style={style} />;
    case 'openai': return <OpenAILogo size={size} style={style} />;
    case 'gemini': return <GeminiLogo size={size} style={style} />;
    case 'grok': return <GrokLogo size={size} style={style} />;
    case 'deepseek': return <DeepSeekLogo size={size} style={style} />;
    case 'qwen': return <QwenLogo size={size} style={style} />;
  }
}
