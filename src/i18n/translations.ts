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

  // ── HelpOverlay — 6 Transcendentia (Aquinas, De Veritate q.1 a.1) ──
  'help.transcendentals': { ko: '여섯 초월자 (Transcendentia)', en: 'The Six Transcendentia' },
  'help.transcendentalsIntro': {
    ko: '노드 타입은 아퀴나스의 여섯 초월자입니다 (De Veritate q.1 a.1). 범주를 초월한 여섯 가지 형이상학적 물음 — 같은 지시체에 대해 서로 다른 조명 면을 묻습니다. 한 노드가 여러 면에 해당할 수 있을 때는, 프롬프트가 *어느 물음으로* 그것을 붙잡고 있는지를 기준으로 선택합니다.',
    en: 'Node types are Aquinas\'s six transcendentia (De Veritate q.1 a.1). They are six metaphysical questions that transcend the categories — each asks a different aspect of the same referent. When a node fits more than one, choose the register the prompt *leans into*.',
  },
  'help.tcHeaderLatin': { ko: '초월자', en: 'Transcendental' },
  'help.tcHeaderMean': { ko: '의미', en: 'Meaning' },
  'help.tcHeaderAsk': { ko: '무엇을 묻는가', en: 'The question it asks' },
  'help.tcHeaderDraft': { ko: '1차안', en: 'First draft' },

  'help.ensMean': { ko: '존재 — id quod est', en: 'Being — id quod est' },
  'help.ensAsk': { ko: '이 프롬프트는 무엇을 "있다"고 정립하는가?', en: 'What does the prompt posit as existing?' },
  'help.ensDraft': { ko: 'concept (핵심 개념)', en: 'concept' },

  'help.resMean': { ko: '본질 — quod habet quidditatem', en: 'Essence — quod habet quidditatem' },
  'help.resAsk': { ko: '이것의 "무엇임(quidditas)"은 무엇인가?', en: 'What IS it, in its nature?' },
  'help.resDraft': { ko: 'abstraction (추상·형식)', en: 'abstraction' },

  'help.unumMean': { ko: '통일 — ens indivisum', en: 'Unity — ens indivisum' },
  'help.unumAsk': { ko: '어떤 지평 안에서 하나로 묶이는가?', en: 'Under what horizon is it held as one?' },
  'help.unumDraft': { ko: 'context (상황·맥락)', en: 'context' },

  'help.aliquidMean': { ko: '차이 — aliud-quid', en: 'Difference — aliud-quid' },
  'help.aliquidAsk': { ko: '이것을 인접한 것과 구별짓는 것은?', en: 'What marks it as other than its neighbor?' },
  'help.aliquidDraft': { ko: 'nuance (뉘앙스)', en: 'nuance' },

  'help.verumMean': { ko: '진리 — ens ut cognoscibile', en: 'Truth — ens ut cognoscibile' },
  'help.verumAsk': { ko: '어떤 진리 프레임 안에서 성립하는가?', en: 'Under which truth-frame does it hold?' },
  'help.verumDraft': { ko: 'philosophy (세계관)', en: 'philosophy' },

  'help.bonumMean': { ko: '가치 — ens ut appetibile', en: 'Value — ens ut appetibile' },
  'help.bonumAsk': { ko: '무엇을 향해 기울어 있는가 — 원하는가 두려워하는가?', en: 'Toward what is it oriented — desired or feared?' },
  'help.bonumDraft': { ko: 'mood (정서)', en: 'mood' },

  'help.transcendentalsFoot': {
    ko: '현재 UI 라벨(존재/본질/통일/차이/진리/가치)은 각각 하나의 초월자를 가리키도록 고정되어 있습니다. 기존 6가지 유형(concept/nuance/mood/philosophy/abstraction/context)은 이 방향의 1차 초안이었고, 이번 개정은 그 초안을 초월자 층위로 끌어올린 것입니다.',
    en: 'The current UI labels (Being/Essence/Unity/Difference/Truth/Value) each point to exactly one transcendental. The earlier six types (concept/nuance/mood/philosophy/abstraction/context) were a first draft in this direction; this revision raises that draft to the transcendental register.',
  },

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
  'prompt.attach.drop': { ko: '이미지·PDF를 여기로 드래그하거나 클릭해 선택', en: 'Drop image/PDF here or click to select' },
  'prompt.attach.remove': { ko: '제거', en: 'Remove' },
  'prompt.attach.tooLarge': { ko: '파일이 너무 큽니다 (최대 {max}MB)', en: 'File too large (max {max}MB)' },
  'prompt.attach.unsupportedType': { ko: '지원하지 않는 파일 형식입니다', en: 'Unsupported file type' },
  'prompt.attach.providerNoImage': { ko: '{provider}는 이미지 입력을 지원하지 않습니다. 다른 프로바이더를 선택하거나 이미지를 제거하세요.', en: '{provider} does not support image input. Choose another provider or remove images.' },
  'prompt.attach.providerNoPdf': { ko: '{provider}는 PDF 입력을 지원하지 않습니다. Anthropic 또는 Gemini를 사용하세요.', en: '{provider} does not support PDF input. Use Anthropic or Gemini.' },

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

  // ── Node Type Labels — 6 Transcendentia (Aquinas, De Veritate q.1 a.1) ──
  'type.ens':     { ko: '존재', en: 'Being' },
  'type.res':     { ko: '본질', en: 'Essence' },
  'type.unum':    { ko: '통일', en: 'Unity' },
  'type.aliquid': { ko: '차이', en: 'Difference' },
  'type.verum':   { ko: '진리', en: 'Truth' },
  'type.bonum':   { ko: '가치', en: 'Value' },
} as const;

export type TranslationKey = keyof typeof translations;

export function getTranslation(key: TranslationKey, lang: Lang): string {
  return translations[key][lang];
}

export default translations;
