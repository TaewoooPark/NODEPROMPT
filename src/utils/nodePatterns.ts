import * as THREE from 'three';
import type { CSSProperties } from 'react';
import type { NodeType } from '../types';

export const ALL_NODE_TYPES: NodeType[] = ['concept', 'nuance', 'mood', 'philosophy', 'abstraction', 'context'];

const SIZE = 128;
const textureCache = new Map<NodeType, THREE.CanvasTexture>();

function drawPattern(ctx: CanvasRenderingContext2D, type: NodeType) {
  const S = SIZE;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#1a1a1a';
  ctx.strokeStyle = '#1a1a1a';

  switch (type) {
    case 'concept':
      // Solid black — darkest
      ctx.fillRect(0, 0, S, S);
      break;

    case 'nuance': {
      // Horizontal stripes — medium
      ctx.lineWidth = 4;
      for (let y = 0; y < S; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(S, y);
        ctx.stroke();
      }
      break;
    }

    case 'mood':
      // Dots — lightest
      for (let y = 11; y < S; y += 22) {
        for (let x = 11; x < S; x += 22) {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;

    case 'philosophy': {
      // Diagonal stripes (45deg) — medium-dark
      ctx.lineWidth = 5;
      for (let i = -S; i < S * 2; i += 16) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + S, S);
        ctx.stroke();
      }
      break;
    }

    case 'abstraction': {
      // Crosshatch — dark
      ctx.lineWidth = 3.5;
      for (let i = -S; i < S * 2; i += 16) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + S, S);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i + S, 0);
        ctx.lineTo(i, S);
        ctx.stroke();
      }
      break;
    }

    case 'context': {
      // Vertical stripes — medium-light
      ctx.lineWidth = 3;
      for (let x = 0; x < S; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, S);
        ctx.stroke();
      }
      break;
    }
  }
}

/** Canvas texture for 3D sphere materials */
export function getPatternTexture(type: NodeType): THREE.CanvasTexture {
  if (textureCache.has(type)) return textureCache.get(type)!;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  drawPattern(canvas.getContext('2d')!, type);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  textureCache.set(type, texture);
  return texture;
}

/** CSS inline styles for 2D HTML swatches (legend, context menu) */
export const PATTERN_CSS: Record<NodeType, CSSProperties> = {
  concept: { background: '#1a1a1a' },
  nuance: {
    background: 'repeating-linear-gradient(0deg, #1a1a1a 0px, #1a1a1a 2px, #fff 2px, #fff 6px)',
  },
  mood: {
    backgroundImage: 'radial-gradient(#1a1a1a 1.5px, transparent 1.5px)',
    backgroundSize: '5px 5px',
    backgroundColor: '#fff',
  },
  philosophy: {
    background: 'repeating-linear-gradient(45deg, #1a1a1a 0px, #1a1a1a 2px, #fff 2px, #fff 6px)',
  },
  abstraction: {
    background: `repeating-linear-gradient(45deg, #1a1a1a 0px, #1a1a1a 1px, transparent 1px, transparent 5px),
                 repeating-linear-gradient(-45deg, #1a1a1a 0px, #1a1a1a 1px, transparent 1px, transparent 5px)`,
    backgroundColor: '#fff',
  },
  context: {
    background: 'repeating-linear-gradient(90deg, #1a1a1a 0px, #1a1a1a 2px, #fff 2px, #fff 6px)',
  },
};

export const TYPE_LABELS_KO: Record<NodeType, string> = {
  concept: '개념',
  nuance: '뉘앙스',
  mood: '분위기',
  philosophy: '철학',
  abstraction: '추상',
  context: '맥락',
};
