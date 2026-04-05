# NodePrompt

**인터랙티브 개념 그래프를 통한 공간적 프롬프트 엔지니어링**

프롬프트를 입력하면 AI가 다차원 개념 그래프로 분해하여 3D 구 표면에 배치하고, 사용자가 공간적으로 재구성한 뒤 구조화된 프롬프트로 재합성하여 더 높은 품질의 AI 응답을 생성합니다.

> *"사고는 비선형이다. 언어는 선형이다. 구의 표면이 그 간극을 메운다."*

[English README](./README.md)

---

## NodePrompt가 필요한 이유

기존 프롬프트 엔지니어링은 블랙박스입니다. 텍스트를 입력하고, 응답을 받고, 맹목적으로 반복합니다. NodePrompt는 프롬프트의 *구조*를 시각화하고 편집 가능하게 만듭니다.

| 기존 프롬프팅 | NodePrompt |
|---|---|
| 선형 텍스트 입출력 | 프롬프트를 개념 그래프로 분해 |
| 불투명한 추론 과정 | 노드 가중치, 타입, 관계가 시각적으로 표현 |
| 수동 반복 수정 | 공간 편집: 드래그, 가중치 조절, 관계 재연결 |
| 단일 관점 | 6가지 인지 차원 동시 추출 |

핵심 혁신은 **인간-AI 공동 분해(Co-Decomposition)**: AI가 개념 구조를 제안하고, 인간이 공간적으로 재구성한 뒤, AI가 재합성합니다 — 지식구조 이론에 기반한 순환적 협업 루프입니다.

---

## 이론적 기반

NodePrompt의 설계는 인지과학, 지식 표현, 정보 시각화 분야의 검증된 연구에 기반합니다.

### 인지 구조

- **Rosch의 기본 수준 범주화** (1976) — 추출 시스템은 가장 밀도 높은 노드 레이어를 깊이 2(기본 수준)에 배치합니다. 인간 인지가 가장 효율적으로 작동하는 수준입니다. 상위 주제는 위에, 하위 세부사항은 아래에 위치합니다.
- **Miller의 법칙 (7 +/- 2)** (1956) — 각 부모 노드의 자식 수를 ~7개로 제한하여 작업 기억 용량을 존중합니다. 분기 계수는 `min(7, ceil(N^(1/D)))`로 계산됩니다.
- **Hayakawa의 추상 사다리** (1939) — 깊은 계층일수록 추상도가 낮아집니다. 루트 테마가 가장 추상적이고, 리프 노드가 가장 구체적인 사례입니다.

### 지식 표현

- **Ranganathan의 패싯 분류법** (1933) — 노드는 단일 분류 체계가 아닌 독립적 패싯(인지 유형, 인식론적 입장, 수사학적 역할)을 가집니다. "분위기" 노드가 어떤 깊이에든 나타날 수 있습니다.
- **Novak의 개념 매핑** (1972) — 트리 엣지뿐 아니라 가지 간 교차 엣지에서 진정한 통찰이 생깁니다. 6가지 관계 유형을 지원합니다: `인과`, `대비`, `증폭`, `억제`, `병렬`, `의존`.
- **TopicGPT 다단계 추출** (2024) — 다단계 추출이 단일 추출보다 더 정확한 개념 그래프를 생성합니다. NodePrompt는 3단계 파이프라인을 사용합니다: 골격 → 채우기 → 검증.

### 시각화 이론

- **Munzner의 H3 쌍곡 레이아웃** (1997) — Interior 모드는 Poincare 볼 근사를 사용하여 중심 노드는 크게, 주변 노드는 압축 표시하여 초점+맥락 탐색이 가능합니다.
- **Lombardi 네트워크 미학** — 모든 엣지는 교대 방향의 Bezier 곡선으로 렌더링됩니다. Mark Lombardi의 네트워크 다이어그램 스타일: 흰 배경에 검은 선, 무색, 무그림자, 기하학적 정밀함.

### 프롬프트 엔지니어링 연구

- **Chain-of-Symbol (CoS) 프롬프팅** — 구조화된 기호 표현(노드 타입, 가중치, 관계)이 재합성 시 LLM의 공간적 추론을 개선합니다.
- **시각적 프롬프트 엔지니어링** — 텍스트는 변환과 목표 설명에 강하고, 공간 레이아웃은 관계와 상대적 중요도 전달에 강합니다. NodePrompt는 두 양식을 결합합니다.

---

## 기능

### 세 가지 인터랙션 모드

```
            [Sphere 모드]
          구 표면 위 3D 조감
         /        |         \
     Space    더블클릭     스크롤 줌
        \        |          /
       [Radial 모드]   [Interior 모드]
      동심원 링 위      구 내부
      2D 편집          어안 렌즈 탐색
```

**Sphere 모드** — 피보나치 격자로 구 표면에 노드 분포. 궤도 회전, 줌, 클릭으로 전체 개념 그래프를 한눈에 탐색합니다.

**Radial 모드** — 2D 편집 작업 공간. 계층 깊이별 동심원 링에 노드 배치 (최대 5개 링). 드래그, 가중치 조절, 엣지 생성이 가능합니다.

**Interior 모드** — 구 내부에서의 몰입형 어안 뷰. 쌍곡 스케일링(Poincare 볼 모델)으로 가까운 노드는 크게, 먼 노드는 작게 표시됩니다.

모드 전환은 `Space` 또는 더블클릭. 모든 전환은 노드 아이덴티티를 보존하는 부드러운 GSAP 모프입니다.

### 6가지 인지 차원

모든 프롬프트는 의미의 서로 다른 측면을 나타내는 6가지 차원으로 분해됩니다:

| 타입 | 포착하는 것 | 예시 |
|---|---|---|
| **Concept** | 핵심 주제, 키워드, 대상 | "기계학습", "신경망" |
| **Nuance** | 함축된 의미, 행간, 말하지 않은 것 | "확장성에 대한 암묵적 가정" |
| **Mood** | 감정적 톤, 분위기 | "조심스러운 낙관", "긴급함" |
| **Philosophy** | 기저 세계관, 가치, 신념 | "기술 결정론" |
| **Abstraction** | 메타포, 상위 패턴 | "피드백 루프", "창발" |
| **Context** | 상황, 청중, 제약 조건 | "학술 논문", "비전문가 대상" |

각 타입은 고유한 패턴 텍스처로 구별됩니다 (Lombardi 스타일: 무색, 패턴 기반 구분).

### 인터랙티브 그래프 편집

- **클릭** — 노드 포커싱. 연결된 노드가 강조되고 나머지는 부드럽게 페이드
- **재클릭** — 포커싱 해제 (그라데이션 전환)
- **드래그** — Radial 모드에서 노드 위치 재배치
- **스크롤 휠** — 노드 위에서 가중치(중요도) 조절
- **Shift+클릭** — 두 노드 순서대로 클릭하여 엣지 생성
- **우클릭** — 컨텍스트 메뉴 (타입 변경, 삭제, 엣지 연결)
- **편집 패널** (우측) — 가중치 슬라이더, 타입 선택기, 삭제/엣지 액션
- **정보 패널** (좌측) — 설명, 연결 노드 목록, 가중치 바, 클릭 내비게이션

### 합성 프롬프트 파이프라인

```
  사용자 프롬프트
       |
       v
  [3단계 AI 추출]
  골격 -> 채우기 -> 검증
       |
       v
  개념 그래프 (편집 가능)
  - 깊이별 계층 구조
  - 가중치 부여된 노드 (0-1)
  - 유형화된 관계
       |
       v
  [프롬프트 합성기]
  그래프 → 구조화된 프롬프트:
    - 노드 계층 & 가중치 반영
    - 엣지 관계 반영
    - 삭제된 관점 (제외로 명시)
    - 가지 간 교차 연결
       |
       v
  [AI 응답 생성]
  더 높은 품질, 더 섬세한 출력
```

---

## 시작하기

### 사전 요구사항

- Node.js 18+
- Claude API 키 ([Anthropic Console](https://console.anthropic.com/))

### 설치

```bash
git clone https://github.com/your-username/nodeprompt.git
cd nodeprompt
npm install
npm run dev
```

### API 키 설정

**방법 A — 브라우저 (배포 시 권장)**
1. `npm run dev` 실행 후 터미널에 표시되는 로컬 URL 접속
2. 상단 툴바의 **API** 버튼 클릭
3. Claude API 키 붙여넣기 (`****`로 마스킹 표시, `localStorage`에만 저장)
4. 연결 성공 시 표시가 `API`로 변경

**방법 B — 환경 변수**
```bash
echo "VITE_ANTHROPIC_API_KEY=sk-ant-..." > .env
```

브라우저 입력 키가 `.env`보다 우선합니다. 키는 Reset이나 페이지 새로고침 후에도 유지됩니다.

### 빠른 시작

1. 하단 입력창에 프롬프트 입력 (예: *"인공지능이 창작 산업에 미치는 영향"*)
2. **N** (노드 수, 5–50)과 **D** (깊이, 1–5) 슬라이더 조절
3. **Extract** 클릭 — AI가 프롬프트를 구 표면의 개념 그래프로 분해
4. `Space`를 눌러 Radial 모드 진입
5. 노드 드래그, 가중치 조절, 불필요한 개념 삭제, 새 엣지 생성
6. **Synthesize** 클릭 — 편집된 그래프에서 구조화된 프롬프트 생성
7. **Generate** 클릭 — 공간 편집이 반영된 AI 응답 수신
8. 또는 **Demo** 클릭으로 미리 구축된 50노드 그래프 탐색

---

## 조작법

| 동작 | 입력 |
|---|---|
| Sphere / Radial 전환 | `Space` 또는 더블클릭 |
| 노드 선택 / 포커싱 | 클릭 |
| 포커싱 해제 | 같은 노드 재클릭 또는 `Esc` |
| 노드 드래그 (Radial) | 드래그 |
| 가중치 증가 | `]` `+` |
| 가중치 감소 | `[` `-` |
| 가중치 조절 (Radial) | 노드 위 스크롤 휠 |
| 엣지 생성 | `Shift+클릭` 소스 → 타겟 |
| 엣지 생성 취소 | `Esc` |
| 노드 삭제 (Radial) | `Backspace` |
| 라벨 토글 | `L` |
| 카메라 홈 | `H` |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Shift+Z` |
| 도움말 오버레이 | `?` |

---

## 아키텍처

### 기술 스택

| 레이어 | 기술 |
|---|---|
| 렌더링 | React Three Fiber + Three.js (InstancedMesh) |
| 애니메이션 | GSAP (100+ 노드 단일 트윈 모프) |
| 상태 관리 | Zustand (Map + Array 이중 구조) |
| 레이아웃 | D3-hierarchy (방사형 링), Fibonacci 격자 (구면) |
| API | Claude API (Vite 프록시 경유) |
| 검증 | Zod 스키마 검증 + 재시도 |
| 스타일 | Lombardi 미학 (DM Sans, IBM Plex Sans) |
| 빌드 | Vite + TypeScript |

### 성능

- **InstancedMesh** — 타입별 단일 드로우 콜. 100+ 노드에서 부드러움, 10,000+까지 가능.
- **애니메이션 중 React re-render 0회** — 모든 위치 업데이트는 `useFrame`에서 Zustand 스토어 직접 읽기.
- **배치 엣지 렌더링** — 단일 `LineSegments` + `BufferGeometry` + `Float32Array`로 모든 엣지 처리.
- **캐시된 하이라이트 상태** — 연결 노드 셋을 포커스 변경당 1회 계산, 프레임당 컴포넌트 간 재사용.

### 데이터 모델

```typescript
interface NodeData {
  id: string;
  label: string;
  type: 'concept' | 'nuance' | 'mood' | 'philosophy' | 'abstraction' | 'context';
  weight: number;              // 0–1 중요도 점수
  description: string;
  depth: number;               // 0=루트, 1=테마, 2=기본, 3+=세부
  abstractionLevel: 'superordinate' | 'basic' | 'subordinate' | 'instance';
  parentId: string | null;
  children: string[];
  position: { x, y, z };
  sphereCoord: { theta, phi };
  radialCoord: { angle, depth };
}

interface EdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  relation: 'causal' | 'contrast' | 'amplify' | 'suppress' | 'parallel' | 'dependency';
  strength: number;            // 0–1
  isHierarchical: boolean;
}
```

### 프로젝트 구조

```
src/
├── components/           # 3D 씬 + UI 컴포넌트
│   ├── Scene.tsx             캔버스, 조명, 후처리
│   ├── SceneInner.tsx        모드 라우팅, 모프 전환
│   ├── SphereInstancedView   InstancedMesh + LOD 라벨 (Sphere/전환 중)
│   ├── InteriorView.tsx      쌍곡 어안 InstancedMesh
│   ├── DraggableNode.tsx     Radial 드래그/가중치/엣지 인터랙션
│   ├── EdgeRenderer.tsx      통합 Bezier 엣지 렌더러 (useFrame, re-render 0회)
│   ├── NodeInfoPanel.tsx     좌측 패널: 설명 + 연결 노드
│   ├── NodeEditPanel.tsx     우측 패널: 가중치 슬라이더 + 타입 + 액션
│   ├── HelpOverlay.tsx       ? 버튼 + 키보드 단축키 레퍼런스
│   ├── PromptInput.tsx       프롬프트 입력 + N/D 슬라이더
│   ├── ResponsePanel.tsx     스트리밍 응답 + 개념 하이라이트
│   ├── Toolbar.tsx           모드/통계/API 키/라벨/리셋
│   └── ContextMenu.tsx       우클릭 메뉴 (뷰포트 클램핑)
├── hooks/
│   ├── useMorphTransition    GSAP Sphere ↔ Radial 모프
│   ├── useRadialPhysics      Radial 드래그 스프링 물리
│   ├── useNodeSpawnAnimation 노드 생성 elastic 스태거
│   └── useKeyboardShortcuts  글로벌 키보드 핸들러
├── services/
│   ├── claude.ts             3단계 추출 + 스트리밍 + API 키 관리
│   ├── synthesizer.ts        그래프 → 구조화 프롬프트 합성
│   └── mapNodesToSphere.ts   Fibonacci 격자 + Tammes 반발력
├── store/
│   ├── useGraphStore.ts      노드/엣지/모드/CRUD/엣지 생성 상태
│   └── useHistoryStore.ts    Undo/Redo 액션 스택
├── types/
│   ├── node.ts               NodeData, NodeType, 패싯
│   ├── edge.ts               EdgeData, RelationType
│   └── extraction.ts         예산 배분 (Rosch/Miller 제약)
├── utils/
│   ├── radialLayout.ts       용량 제한이 있는 동심원 링 레이아웃
│   ├── coordinates.ts        구면 ↔ 직교 ↔ 방사형 변환
│   ├── highlightState.ts     캐시된 포커스/연결 계산 + 페이드
│   └── nodePatterns.ts       Lombardi 패턴 텍스처 (6종)
└── App.tsx
```

---

## 설계 원칙

1. **흰 캔버스, 검은 잉크** — Lombardi 미학. 색상 없음, 그림자 없음, 그라데이션 없음. 패턴 텍스처로 노드 타입을 구분.
2. **모드 간 연속성** — 노드 아이덴티티(패턴, 크기, 라벨)가 모든 전환에서 보존. 불연속 없음.
3. **즉각적 피드백** — 모든 인터랙션이 부드러운 전환과 함께 즉각적 시각 반응 생성.
4. **줌에 따른 정보 밀도** — 축소 시 라벨 숨김, 확대 시 전체 디테일 표시.
5. **사용자 권한 절대** — AI가 계층을 제안하지만 사용자가 모든 것을 재정의 가능. 그래프는 제안이지 제약이 아님.

---

## 작동 원리: 공동 분해 루프

NodePrompt는 기존 도구 범주 사이의 공백을 채웁니다:

| 도구 범주 | 한계 | NodePrompt의 답 |
|---|---|---|
| 마인드맵 도구 | 수동 입력, 2D, 트리 구조 | AI 보조 추출, 3D+2D, 교차 링크 그래프 |
| AI 챗봇 | 선형 텍스트, 불투명 추론 | 가시적 개념 그래프, 공간 편집 |
| 지식 그래프 | 정적, 읽기 전용 | 완전 편집 가능, 생성에 피드백 |
| 3D 시각화 | 표시만, 편집 불가 | 3개 모드에서 인터랙티브 편집 |

시각적 프롬프트 엔지니어링 연구의 핵심 통찰: 텍스트 프롬프트는 *원하는 것*을 설명하는 데 강하고, 공간 레이아웃은 *아이디어 간 관계*를 전달하는 데 강합니다. 두 양식을 결합함으로써 — 의도를 위한 텍스트 입력, 구조를 위한 공간 편집 — NodePrompt는 어느 한쪽만으로는 달성할 수 없는 풍부한 프롬프트를 생성합니다.

---

## 추출 파이프라인

3단계 추출 파이프라인은 인지과학 제약 조건을 중심으로 설계되었습니다:

### 1단계: 골격 (Scaffold)
최상위 테마 추출 (깊이 0–1). 예산: N 노드의 ~22%. 상위 범주 형성 (Rosch).

### 2단계: 채우기 (Fill)
각 테마를 기본 수준 개념으로 확장 (깊이 2). 예산: N의 ~40%. 가장 밀도 높은 레이어 — 인간 인지가 가장 효율적으로 작동하는 수준.

### 3단계: 검증 (Validate)
하위 세부사항 추가 (깊이 3+) 및 가지 간 교차 엣지 발견. 예산: 나머지 ~38%. 여기서의 엣지 발견이 가장 가치 있는 통찰 생성 (Novak).

**예산 배분**은 `allocateLevelBudget(N, D)`가 다음을 강제합니다:
- 분기 계수 ≤ 7 (Miller 법칙)
- 깊이 2가 항상 가장 많은 노드 수신 (Rosch의 기본 수준)
- 각 레벨은 추상도가 하강 (Hayakawa의 사다리)

---

## 참고 문헌

### 인지과학
- Rosch, E. (1976). *Basic objects in natural categories*. Cognitive Psychology, 8(3), 382–439.
- Miller, G. A. (1956). *The magical number seven, plus or minus two*. Psychological Review, 63(2), 81–97.
- Hayakawa, S. I. (1939). *Language in Action*. Harcourt, Brace.

### 지식 표현
- Ranganathan, S. R. (1933). *Colon Classification*. Madras Library Association.
- Novak, J. D., & Gowin, D. B. (1984). *Learning How to Learn*. Cambridge University Press.

### 정보 시각화
- Munzner, T. (1997). *H3: Laying out large directed graphs in 3D hyperbolic space*. IEEE InfoVis.
- Lombardi, M. (2000). *Mark Lombardi: Global Networks*. Independent Curators International.

### AI & 프롬프트 엔지니어링
- Cheng, X. et al. (2024). *TopicGPT: A prompt-based topic modeling framework*. NAACL.
- Zhu, W. et al. (2024). *Chain-of-Symbol prompting for spatial reasoning in LLMs*. arXiv:2305.10276.

---

## 라이선스

MIT

---

<p align="center">
React Three Fiber, Three.js, Zustand, GSAP, D3, Claude API로 제작되었습니다.
</p>
