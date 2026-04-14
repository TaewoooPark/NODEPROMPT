import { useEffect, useCallback, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
import type { NodeType } from '../types';
import { migrateNodeData } from '../types';
import { useGraphStore } from '../store/useGraphStore';
import { PATTERN_CSS } from '../utils/nodePatterns';
import { useTypeLabels } from '../i18n/useLanguage';
import { useHistoryStore } from '../store/useHistoryStore';
import { getThreeRefs } from '../utils/threeRef';
import { cartesianToSpherical, radialToSpherical } from '../utils/coordinates';
import { useT } from '../i18n/useLanguage';

const NODE_TYPES: NodeType[] = ['ens', 'res', 'unum', 'aliquid', 'verum', 'bonum'];
const MAX_DEPTH = 4;

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  targetNodeId: string | null;
  targetEdgeId: string | null;
}

const INITIAL: MenuState = { visible: false, x: 0, y: 0, targetNodeId: null, targetEdgeId: null };

/** 화면 좌표 → Radial 모드 3D 좌표 (z=0 평면 교차) */
function screenToRadialPosition(clientX: number, clientY: number) {
  const { camera, gl } = getThreeRefs();
  if (!camera || !gl) return null;

  const rect = gl.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, hit);
  if (!hit) return null;

  const x = hit.x;
  const y = hit.y;
  const angle = Math.atan2(y, x);
  const depth = Math.sqrt(x * x + y * y);
  const sphereCoord = radialToSpherical(angle, depth, MAX_DEPTH);

  return { position: { x, y, z: 0 }, radialCoord: { angle, depth }, sphereCoord };
}

/** 화면 좌표 → Sphere 모드 3D 좌표 (구 표면 교차) */
function screenToSpherePosition(clientX: number, clientY: number) {
  const { camera, gl } = getThreeRefs();
  if (!camera || !gl) return null;
  const sphereRadius = useGraphStore.getState().sphereRadius;

  const rect = gl.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), sphereRadius);
  const hit = new THREE.Vector3();
  const intersects = raycaster.ray.intersectSphere(sphere, hit);
  if (!intersects) return null;

  const { theta, phi } = cartesianToSpherical(hit.x, hit.y, hit.z);
  const angle = phi;
  const depth = (theta / Math.PI) * MAX_DEPTH;

  return {
    position: { x: hit.x, y: hit.y, z: hit.z },
    sphereCoord: { theta, phi },
    radialCoord: { angle, depth },
  };
}

function createNodeAtPosition(
  coords: { position: { x: number; y: number; z: number }; sphereCoord: { theta: number; phi: number }; radialCoord: { angle: number; depth: number } },
) {
  const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const node = migrateNodeData({
    id,
    label: 'New Node',
    type: 'ens' as NodeType,
    weight: 0.5,
    description: '',
    depth: 2,
    isUserCreated: true,
    position: coords.position,
    sphereCoord: coords.sphereCoord,
    radialCoord: coords.radialCoord,
  });
  return node;
}

export function ContextMenu() {
  const [menu, setMenu] = useState<MenuState>(INITIAL);
  const mode = useGraphStore((s) => s.mode);
  const nodes = useGraphStore((s) => s.nodes);
  const addNode = useGraphStore((s) => s.addNode);
  const softDeleteNode = useGraphStore((s) => s.softDeleteNode);
  const restoreNode = useGraphStore((s) => s.restoreNode);
  const updateNode = useGraphStore((s) => s.updateNode);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId);
  const startEdgeCreation = useGraphStore((s) => s.startEdgeCreation);
  const pushAction = useHistoryStore((s) => s.pushAction);
  const t = useT();
  const typeLabels = useTypeLabels();

  // 우클릭 감지 — radial + sphere 모두
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mode !== 'radial' && mode !== 'sphere') return;
      e.preventDefault();

      if (selectedNodeId) {
        setMenu({ visible: true, x: e.clientX, y: e.clientY, targetNodeId: selectedNodeId, targetEdgeId: null });
        return;
      }

      setMenu({ visible: true, x: e.clientX, y: e.clientY, targetNodeId: null, targetEdgeId: null });
    };
    window.addEventListener('contextmenu', handler);
    return () => window.removeEventListener('contextmenu', handler);
  }, [mode, selectedNodeId]);

  // 클릭으로 메뉴 닫기
  useEffect(() => {
    if (!menu.visible) return;
    const handler = () => setMenu(INITIAL);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [menu.visible]);

  const close = useCallback(() => setMenu(INITIAL), []);

  if (!menu.visible || (mode !== 'radial' && mode !== 'sphere')) return null;

  const targetNode = menu.targetNodeId ? nodes.get(menu.targetNodeId) : null;

  // 뷰포트 안으로 clamping
  const menuWidth = 200;
  const menuHeight = targetNode ? 320 : 90;
  const clampedX = Math.min(menu.x, window.innerWidth - menuWidth - 12);
  const clampedY = Math.min(menu.y, window.innerHeight - menuHeight - 12);

  const menuStyle: CSSProperties = {
    position: 'fixed',
    left: Math.max(8, clampedX),
    top: Math.max(8, clampedY),
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 8,
    padding: '4px 0',
    minWidth: 180,
    zIndex: 1000,
    fontSize: 13,
    color: '#1a1a1a',
    fontFamily: '"DM Sans", "IBM Plex Sans", sans-serif',
    fontWeight: 300,
  };

  const itemStyle: CSSProperties = {
    padding: '6px 14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const hoverHandlers = {
    onMouseOver: (e: React.MouseEvent) => ((e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)'),
    onMouseOut: (e: React.MouseEvent) => ((e.currentTarget as HTMLElement).style.background = 'transparent'),
  };

  // --- 노드 메뉴 ---
  if (targetNode) {
    return (
      <div style={menuStyle}>
        {/* 삭제 / 복원 */}
        {targetNode.isDeleted ? (
          <div
            style={itemStyle}
            {...hoverHandlers}
            onClick={() => {
              restoreNode(targetNode.id);
              pushAction({
                type: 'restoreNode',
                targetId: targetNode.id,
                before: { isDeleted: true },
                after: { isDeleted: false },
              });
              close();
            }}
          >
            {t('ctx.restore')}
          </div>
        ) : (
          <div
            style={itemStyle}
            {...hoverHandlers}
            onClick={() => {
              softDeleteNode(targetNode.id);
              pushAction({
                type: 'softDeleteNode',
                targetId: targetNode.id,
                before: { isDeleted: false },
                after: { isDeleted: true },
              });
              close();
            }}
          >
            {t('ctx.delete')}
          </div>
        )}

        {/* 타입 변경 */}
        <div style={{ padding: '4px 14px', fontSize: 11, color: '#888', borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: 2 }}>
          {t('ctx.changeType')}
        </div>
        {NODE_TYPES.map((tp) => (
          <div
            key={tp}
            style={{ ...itemStyle, fontWeight: targetNode.type === tp ? 700 : 400 }}
            {...hoverHandlers}
            onClick={() => {
              if (targetNode.type === tp) { close(); return; }
              pushAction({
                type: 'updateNode',
                targetId: targetNode.id,
                before: { type: targetNode.type },
                after: { type: tp },
              });
              updateNode(targetNode.id, { type: tp });
              close();
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.2)', flexShrink: 0, ...PATTERN_CSS[tp] }} />
            {typeLabels[tp]}
          </div>
        ))}

        {/* 엣지 연결 시작 */}
        {!targetNode.isDeleted && (
          <>
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', margin: '2px 0' }} />
            <div
              style={itemStyle}
              {...hoverHandlers}
              onClick={() => { startEdgeCreation(targetNode.id); close(); }}
            >
              {t('ctx.startEdge')}
            </div>
          </>
        )}
      </div>
    );
  }

  // --- 빈 공간 메뉴 ---
  const handleAddNode = () => {
    const coords = mode === 'radial'
      ? screenToRadialPosition(menu.x, menu.y)
      : screenToSpherePosition(menu.x, menu.y);

    if (!coords) { close(); return; }

    const node = createNodeAtPosition(coords);
    addNode(node);
    pushAction({
      type: 'addNode',
      targetId: node.id,
      before: null,
      after: node,
    });
    setSelectedNodeId(node.id);
    close();
  };

  return (
    <div style={menuStyle}>
      <div style={itemStyle} {...hoverHandlers} onClick={handleAddNode}>
        {t('ctx.addNode')}
      </div>
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', margin: '2px 0' }} />
      <div
        style={itemStyle}
        {...hoverHandlers}
        onClick={() => {
          setSelectedNodeId(null);
          close();
        }}
      >
        {t('ctx.deselect')}
      </div>
    </div>
  );
}
