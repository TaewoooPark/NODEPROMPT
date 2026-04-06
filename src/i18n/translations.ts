export type Lang = 'ko' | 'en';

const translations = {
  // ── HelpOverlay ──
  'help.title': { ko: 'Keyboard Shortcuts', en: 'Keyboard Shortcuts' },
  'help.nav': { ko: 'Navigation', en: 'Navigation' },
  'help.switchMode': { ko: 'Sphere / Radial 전환', en: 'Switch Sphere / Radial' },
  'help.switchModeDbl': { ko: '더블클릭으로도 전환', en: 'Double-click to switch' },
  'help.cameraHome': { ko: '카메라 홈', en: 'Camera Home' },
  'help.zoom': { ko: '줌', en: 'Zoom' },
  'help.rotate': { ko: '회전 (Sphere)', en: 'Rotate (Sphere)' },
  'help.node': { ko: 'Node', en: 'Node' },
  'help.selectFocus': { ko: '노드 선택 / 포커싱', en: 'Select / Focus node' },
  'help.unfocus': { ko: '재클릭으로 포커싱 해제', en: 'Click again to unfocus' },
  'help.deselect': { ko: '선택 해제', en: 'Deselect' },
  'help.dragNode': { ko: '노드 드래그 (Radial)', en: 'Drag node (Radial)' },
  'help.weightUp': { ko: '가중치 증가', en: 'Increase weight' },
  'help.weightDown': { ko: '가중치 감소', en: 'Decrease weight' },
  'help.weightWheel': { ko: '가중치 휠 조절 (Radial)', en: 'Adjust weight by wheel (Radial)' },
  'help.deleteNode': { ko: '노드 삭제 (Radial)', en: 'Delete node (Radial)' },
  'help.edge': { ko: 'Edge', en: 'Edge' },
  'help.edgeStart': { ko: '엣지 생성 시작/완성', en: 'Start / Complete edge' },
  'help.edgeCancel': { ko: '엣지 생성 취소', en: 'Cancel edge creation' },
  'help.display': { ko: 'Display', en: 'Display' },
  'help.toggleLabels': { ko: '라벨 토글', en: 'Toggle labels' },
  'help.thisHelp': { ko: '이 도움말', en: 'This help' },
  'help.gesture': { ko: 'Hand Gesture (Sphere)', en: 'Hand Gesture (Sphere)' },
  'help.gestureToggle': { ko: '제스처 ON/OFF', en: 'Gesture ON/OFF' },
  'help.gestureToggleShortcut': { ko: '하단 좌측 토글 버튼', en: 'Bottom-left toggle' },
  'help.rotateSphere': { ko: '구 회전', en: 'Rotate sphere' },
  'help.rotateSphereShortcut': { ko: '손바닥 펴고 드래그', en: 'Open palm & drag' },
  'help.stopRotation': { ko: '회전 정지', en: 'Stop rotation' },
  'help.stopRotationShortcut': { ko: '주먹 쥐기', en: 'Make a fist' },
  'help.zoomInOut': { ko: '줌 인/아웃', en: 'Zoom in/out' },
  'help.zoomInOutShortcut': { ko: '손 크기 변화', en: 'Hand size change' },
  'help.tip': { ko: 'Tip', en: 'Tip' },
  'help.tipText': {
    ko: '노드를 클릭하면 연결된 노드만 강조됩니다. 다시 클릭하면 포커싱이 풀립니다. 우클릭으로 컨텍스트 메뉴를 열 수 있습니다. 하단 좌측 버튼으로 웹캠 제스처 컨트롤을 활성화할 수 있습니다.',
    en: 'Click a node to highlight its connections. Click again to unfocus. Right-click to open the context menu. Use the bottom-left button to enable webcam gesture control.',
  },
  'help.close': { ko: 'Close', en: 'Close' },

  // ── Toolbar ──
  'toolbar.apiKeySettings': { ko: 'API Key 설정', en: 'API Key Settings' },
  'toolbar.keyStorageNote': { ko: '키는 브라우저에만 저장됩니다 (localStorage)', en: 'Key is stored in browser only (localStorage)' },
  'toolbar.demoPrompt': { ko: 'AI가 인간 사회에 미치는 다층적 영향', en: 'Multifaceted impact of AI on human society' },

  // ── PromptInput ──
  'prompt.placeholder': { ko: '프롬프트를 입력하세요...', en: 'Enter your prompt...' },
  'prompt.depth': { ko: '깊이', en: 'Depth' },
  'prompt.nodes': { ko: '노드', en: 'Nodes' },
  'prompt.branch': { ko: '분기', en: 'Branch' },
  'prompt.cancel': { ko: '취소', en: 'Cancel' },
  'prompt.analyze': { ko: '분석 (Ctrl+Enter)', en: 'Analyze (Ctrl+Enter)' },
  'prompt.phase1': { ko: '구조 설계', en: 'Structuring' },
  'prompt.phase2': { ko: '내용 채움', en: 'Filling content' },
  'prompt.phase3': { ko: '검증 및 패치', en: 'Validation & Patch' },
  'prompt.cancelled': { ko: '요청이 취소되었습니다.', en: 'Request was cancelled.' },

  // ── NodeEditPanel ──
  'edit.dblClickLabel': { ko: '더블클릭하여 이름 수정', en: 'Double-click to edit name' },
  'edit.descPlaceholder': { ko: '설명을 입력하거나 Auto로 생성', en: 'Enter description or use Auto' },
  'edit.restore': { ko: '복원', en: 'Restore' },
  'edit.delete': { ko: '삭제', en: 'Delete' },
  'edit.connectEdge': { ko: '엣지 연결', en: 'Connect Edge' },

  // ── ContextMenu ──
  'ctx.restore': { ko: '복원', en: 'Restore' },
  'ctx.delete': { ko: '삭제', en: 'Delete' },
  'ctx.changeType': { ko: '타입 변경', en: 'Change Type' },
  'ctx.startEdge': { ko: '엣지 연결 시작', en: 'Start Edge Connection' },
  'ctx.addNode': { ko: '노드 추가', en: 'Add Node' },
  'ctx.deselect': { ko: '선택 해제', en: 'Deselect' },

  // ── ResponsePanel ──
  'resp.viewResponse': { ko: '응답 보기', en: 'View Response' },
  'resp.viewSynthesized': { ko: '합성 프롬프트 보기', en: 'View Synthesized Prompt' },
  'resp.placeholder': { ko: '답변을 생성하면 여기에 표시됩니다.', en: 'Responses will appear here.' },
  'resp.cancel': { ko: '취소', en: 'Cancel' },
  'resp.generate': { ko: '답변 생성', en: 'Generate' },
  'resp.generating': { ko: '답변 생성 중...', en: 'Generating...' },
  'resp.error': { ko: '오류', en: 'Error' },

  // ── HandGestureOverlay ──
  'gesture.disable': { ko: '제스처 제어 끄기', en: 'Disable gesture control' },
  'gesture.enable': { ko: '제스처 제어 켜기', en: 'Enable gesture control' },
  'gesture.previewToggle': { ko: '웹캠 미리보기 토글', en: 'Toggle webcam preview' },

  // ── Node Type Labels ──
  'type.concept': { ko: '개념', en: 'Concept' },
  'type.nuance': { ko: '뉘앙스', en: 'Nuance' },
  'type.mood': { ko: '분위기', en: 'Mood' },
  'type.philosophy': { ko: '철학', en: 'Philosophy' },
  'type.abstraction': { ko: '추상', en: 'Abstraction' },
  'type.context': { ko: '맥락', en: 'Context' },
} as const;

export type TranslationKey = keyof typeof translations;

export function getTranslation(key: TranslationKey, lang: Lang): string {
  return translations[key][lang];
}

export default translations;
