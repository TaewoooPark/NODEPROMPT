# NodePrompt

**Spatial Prompt Engineering through Interactive Concept Graphs**

<p align="center">
  <img src="https://img.shields.io/github/license/TaewoooPark/NODEPROMPT?style=flat-square&labelColor=000000&color=333333" alt="License">
  <img src="https://img.shields.io/github/stars/TaewoooPark/NODEPROMPT?style=flat-square&logo=github&logoColor=white&labelColor=000000&color=333333" alt="GitHub stars">
  <img src="https://img.shields.io/github/last-commit/TaewoooPark/NODEPROMPT?style=flat-square&labelColor=000000&color=333333" alt="Last commit">
  <img src="https://img.shields.io/github/languages/top/TaewoooPark/NODEPROMPT?style=flat-square&labelColor=000000&color=333333" alt="Top language">
  &nbsp;
  <img src="https://img.shields.io/badge/TypeScript-000000?style=flat-square&logo=typescript&logoColor=white&labelColor=000000" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-000000?style=flat-square&logo=react&logoColor=white&labelColor=000000" alt="React">
  <img src="https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=threedotjs&logoColor=white&labelColor=000000" alt="Three.js">
  <img src="https://img.shields.io/badge/Vite-000000?style=flat-square&logo=vite&logoColor=white&labelColor=000000" alt="Vite">
  &nbsp;
  <img src="https://img.shields.io/badge/Claude-000000?style=flat-square&logo=anthropic&logoColor=white&labelColor=000000" alt="Anthropic Claude">
  <img src="https://img.shields.io/badge/GPT-000000?style=flat-square&logo=openai&logoColor=white&labelColor=000000" alt="OpenAI GPT">
  <img src="https://img.shields.io/badge/Gemini-000000?style=flat-square&logo=googlegemini&logoColor=white&labelColor=000000" alt="Google Gemini">
  <img src="https://img.shields.io/badge/Grok-000000?style=flat-square&logo=x&logoColor=white&labelColor=000000" alt="xAI Grok">
  <img src="https://img.shields.io/badge/DeepSeek-000000?style=flat-square&labelColor=000000&color=000000" alt="DeepSeek">
  <img src="https://img.shields.io/badge/Qwen-000000?style=flat-square&labelColor=000000&color=000000" alt="Alibaba Qwen">
</p>

NodePrompt decomposes natural language prompts into multi-dimensional concept graphs, renders them on a 3D sphere, and lets users spatially reorganize ideas before resynthesizing them into structured prompts for higher-quality AI responses.

> *"Thinking is non-linear. Language is linear. The sphere bridges that gap."*

<p align="center">
  <video src="https://github.com/user-attachments/assets/388508da-4304-456e-a41e-19b30b890bff" width="100%" autoplay loop muted playsinline></video>
</p>

<p align="center">
  <img src="./public/screenshots/sphere.png" alt="NodePrompt Sphere Mode — 50+ labeled concept nodes distributed on a 3D sphere via Fibonacci lattice, connected by Bezier edges in Mark Lombardi black-and-white network aesthetic. A natural language prompt on the left is decomposed into a navigable spatial concept graph." width="100%">
</p>

[한국어 README](./README_KR.md)

---

## Why NodePrompt?

Traditional prompt engineering is a black box: you type text, get a response, and iterate blindly. NodePrompt makes the *structure* of your prompt visible and editable.

| Traditional Prompting | NodePrompt |
|---|---|
| Linear text in, linear text out | Prompt decomposed into a concept graph |
| Opaque reasoning | Visible node weights, types, and relationships |
| Manual iteration | Spatial editing: drag, reweight, reconnect |
| Single perspective | 6 conceptual dimensions extracted simultaneously |

The core innovation is **Human-AI Co-Decomposition**: AI proposes a conceptual structure, humans reshape it spatially, then AI resynthesizes — a cyclic collaboration loop grounded in knowledge structure theory.

---

## Theoretical Foundations

NodePrompt's design draws from established research in cognitive science, knowledge representation, and information visualization.

### Cognitive Architecture

- **Rosch's Basic-Level Categorization** (1976) — The extraction system places the densest layer of nodes at depth 2 (basic level), where human cognition operates most efficiently. Superordinate themes sit above; subordinate details below.
- **Miller's Law (7 +/- 2)** (1956) — Each parent node is limited to ~7 children, respecting working memory capacity. The branching factor is computed as `min(7, ceil(N^(1/D)))`.
- **Hayakawa's Abstraction Ladder** (1939) — Deeper hierarchy levels descend in abstraction: root themes are the most abstract, leaf nodes are concrete instances.

### Knowledge Representation

- **Ranganathan's Faceted Classification** (1933) — Nodes carry independent facets (cognitive type, epistemological stance, rhetorical role) rather than a single rigid taxonomy. A "mood" node can appear at any depth.
- **Novak's Concept Mapping** (1972) — Cross-branch edges (not just tree edges) are where genuine insight emerges. The system supports 6 relation types: `causal`, `contrast`, `amplify`, `suppress`, `parallel`, `dependency`.
- **TopicGPT Multi-Pass Extraction** (2024) — Multi-pass extraction produces more accurate concept graphs than single-pass approaches. NodePrompt uses a 3-phase pipeline: Scaffold, Fill, Validate.

### Visualization Theory

- **Munzner's H3 Hyperbolic Layout** (1997) — Interior mode uses a Poincare ball approximation where central nodes appear larger and peripheral nodes compress, enabling focus+context navigation.
- **Lombardi Network Aesthetics** — All edges are Bezier curves with alternating sweep directions, following Mark Lombardi's network diagram style: black on white, no colors, no shadows, geometric precision.

### Prompt Engineering Research

- **Chain-of-Symbol (CoS) Prompting** — Structured symbolic representations (node types, weights, relations) improve LLM spatial reasoning when resynthesized into prompts.
- **Visual Prompt Engineering** — Research shows text excels at describing transformations and goals, while spatial layouts better communicate relationships and relative importance. NodePrompt combines both modalities.

---

## Features

### Three Interaction Modes

```
            [Sphere Mode]
          3D overview on sphere
         /        |         \
     Space    Double-click   Scroll-zoom
        \        |          /
         [Radial Mode]   [Interior Mode]
       2D concentric     Fisheye from
       ring editing      inside sphere
```

**Sphere Mode** — Nodes distributed on a sphere surface via Fibonacci lattice. Orbit, zoom, and click to explore the full concept graph at a glance.

**Radial Mode** — 2D editing workspace. Nodes arranged in concentric rings by hierarchy depth (max 5 rings). Drag to reposition, scroll to adjust weight, shift-click to create edges.

<p align="center">
  <img src="./public/screenshots/radial.png" alt="NodePrompt Radial Mode — concept nodes laid out in concentric hierarchical rings around a central theme, with Bezier edges rendered in Lombardi aesthetic. Layout supports drag-to-reposition, scroll-to-weight, and shift-click-to-connect for spatial prompt editing." width="100%">
</p>

**Interior Mode** — Immersive fisheye view from inside the sphere. Hyperbolic scaling (Poincare ball model) magnifies nearby nodes while compressing distant ones.

All transitions are smooth GSAP morphs preserving node identity.

### Six Transcendental Dimensions

NodePrompt's six node types are Aquinas's six *transcendentia* from *De Veritate* q.1 a.1 — the metaphysical modes by which any being (*ens*) can be considered. Every prompt is read through these six registers, each asking a different question of the same text:

| Latin — UI | Meaning | The question it asks | First-draft mapping |
|---|---|---|---|
| **ens** — Being | *id quod est* — what is posited as being | What does this prompt posit as existing? | Core subjects, topics, referents |
| **res** — Essence | *quod habet quidditatem* — what has a whatness | What is it, as a formal structure? | Definitions, mechanisms, higher-order patterns |
| **unum** — Unity | *ens indivisum* — being as undivided in itself | What holds it together as one? | Situation, audience, unifying frame, context |
| **aliquid** — Difference | *aliud-quid* — other-than-other | What distinguishes it from what it is not? | Subtext, contrast, implied tensions, nuance |
| **verum** — Truth | *ens ut cognoscibile* — being as knowable to intellect | How is it true to a knower? | Worldviews, ethical/epistemic commitments, philosophy |
| **bonum** — Value | *ens ut appetibile* — being as desirable to will | How is it desirable to a will? | Tone, mood, affective charge, values |

The six are not six *kinds* of being but six *aspects* of the same being — "convertibilia cum ente" (convertible with being itself). A single concept can be read through any register; the register chosen is the lens, not the content. Each type is distinguished by a unique pattern texture (Lombardi-style: no colors, pattern-only differentiation), and the Help overlay (`?` button) contains the full mapping with example questions.

### Interactive Graph Editing

- **Click** a node to focus — connected nodes highlight, others fade with smooth transition
- **Click again** to unfocus
- **Drag** nodes in Radial mode to spatially reorganize
- **Scroll wheel** on a node to adjust its weight (importance)
- **Shift+click** two nodes to create an edge between them
- **Right-click** empty space to **add a new node** (works in both Sphere and Radial modes)
- **Right-click** a selected node for context menu (type change, delete, edge creation)
- **Double-click** a node label (in either panel) to **rename** it inline
- **Edit panel** (right side) — label editing, description with **Auto** AI-generate button, weight slider, type selector, delete, edge actions
- **Info panel** (left side) — label editing, description, connected nodes list, weight bar with click-to-navigate

<p align="center">
  <img src="./public/screenshots/radial-inspector.png" alt="NodePrompt editing workflow in Radial mode — left info panel shows the selected node's description, hierarchy, and connected nodes; right edit panel exposes label editing, weight slider, node-type selector (ens, res, unum, aliquid, verum, bonum — Aquinas's six transcendentals), AI auto-generate button for descriptions, and edge creation actions." width="100%">
</p>

### Hand Gesture Control

NodePrompt supports hands-free interaction via webcam using [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer) hand tracking. Toggle the gesture button (bottom-left) to activate.

| Gesture | Action |
|---|---|
| **Open palm + drag** | Rotate the 3D sphere by moving your hand |
| **Closed fist** | Stop rotation immediately |
| **Hand removed** | Sphere coasts with momentum decay |
| **Hand size change** | Zoom in (closer to camera) / zoom out (further away) |

The system runs at ~15 fps inference with 1-Euro filters for smooth, jitter-free tracking. A ring cursor on the sphere surface provides real-time visual feedback. An optional mini webcam preview can be toggled from the overlay.

### Synthesized Prompt Pipeline

```
  User's prompt
       |
       v
  [3-Phase AI Extraction]
  Scaffold -> Fill -> Validate
       |
       v
  Concept Graph (editable)
  - Hierarchy with depths
  - Weighted nodes (0-1)
  - Typed relationships
       |
       v
  [Prompt Synthesizer]
  Graph -> structured prompt preserving:
    - Node hierarchy & weights
    - Edge relationships
    - Deleted perspectives (noted as excluded)
    - Cross-branch connections
       |
       v
  [AI Response Generation]
  Higher quality, more nuanced output
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- An API key for at least one of the six supported providers:
  - [Anthropic Claude](https://console.anthropic.com/) · [OpenAI GPT](https://platform.openai.com/) · [Google Gemini](https://aistudio.google.com/)
  - [xAI Grok](https://console.x.ai/) · [DeepSeek](https://platform.deepseek.com/) · [Alibaba Qwen (DashScope)](https://dashscope.console.aliyun.com/)

### Installation

```bash
git clone https://github.com/TaewoooPark/NODEPROMPT.git
cd NODEPROMPT
npm install
npm run dev
```

### Provider & API Key Setup

NodePrompt speaks to **six LLM providers** through a unified interface. Pick whichever you have a key for — structured extraction, streaming, and descriptions all work identically across providers.

| Provider | Fast (extraction) | Flagship (generation) |
|---|---|---|
| **Anthropic** | Claude Haiku 4.5 | Claude Sonnet 4.6 |
| **OpenAI** | GPT-5.4 Mini | GPT-5.4 |
| **Google** | Gemini 2.5 Flash | Gemini 3.1 Pro |
| **xAI** | Grok 4.1 Fast | Grok 4.1 Fast Reasoning |
| **DeepSeek** | DeepSeek V3.2 Chat | DeepSeek Reasoner |
| **Alibaba** | Qwen3.5 Flash | Qwen3 Max |

**Option A — Browser (recommended)**
1. Run `npm run dev` and open the local URL
2. Click the provider dropdown in the top toolbar (it shows a monotone logo + the active provider's short name)
3. Pick a provider — a small bilingual (EN/KO) note pops up next to the dropdown if the flagship model requires extra activation on that provider's dashboard (OpenAI Verified Org, Gemini billing, Qwen per-model activation)
4. Click **API** to enter the key for the picked provider (displayed as `****`, stored in `localStorage` only). Each provider has its own slot, so you can keep several keys at once.

**Option B — Environment variables**
```bash
cp .env.example .env
# Fill in any providers you use (others can be left blank):
# VITE_ANTHROPIC_API_KEY=sk-ant-...
# VITE_OPENAI_API_KEY=sk-...
# VITE_GEMINI_API_KEY=AIza...
# VITE_XAI_API_KEY=xai-...
# VITE_DEEPSEEK_API_KEY=sk-...
# VITE_QWEN_API_KEY=sk-...
```

Browser-entered keys take priority over `.env`. Legacy single-key installs (`nodeprompt_api_key`) are auto-migrated into the Anthropic slot on first load.

> **Note:** All six providers are reached through Vite's dev proxy to bypass CORS. This setup is intended for local development (`npm run dev`). For production deployment, a separate backend proxy is required.

### Quick Start

1. Type a prompt (e.g., *"The impact of artificial intelligence on creative industries"*)
2. Adjust **N** (node count, 5–50) and **D** (depth, 1–5) sliders
3. Click **Extract** — AI decomposes your prompt into a concept graph on the sphere
4. Press `Space` to enter Radial mode
5. Drag nodes, adjust weights, delete irrelevant concepts, create new edges
6. Click **Synthesize** to build a structured prompt from your edited graph
7. Click **Generate** for an AI response informed by your spatial edits
8. Or click **Demo** to explore a pre-built 50-node graph

---

## Controls

| Action | Input |
|---|---|
| Switch Sphere / Radial | `Space` or Double-click |
| Select / Focus node | Click |
| Unfocus | Click same node again, or `Esc` |
| Drag node (Radial) | Drag |
| Adjust weight | `]` `+` increase / `[` `-` decrease |
| Adjust weight (Radial) | Scroll wheel on node |
| Add node | Right-click empty space (Sphere / Radial) |
| Rename node | Double-click label in panel |
| Auto-generate description | Click **Auto** in edit panel |
| Create edge | `Shift+Click` source, then target |
| Cancel edge creation | `Esc` |
| Delete node (Radial) | `Backspace` |
| Toggle labels | `L` |
| Camera home | `H` |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Shift+Z` (Mac: `Cmd+Z` / `Cmd+Shift+Z`) |
| Help overlay | `?` |
| **Hand Gesture** | |
| Toggle gesture control | Bottom-left toggle button |
| Rotate sphere | Open palm + drag |
| Stop rotation | Closed fist |
| Zoom in / out | Move hand closer / further from camera |

---

## Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Rendering | React Three Fiber + Three.js (InstancedMesh) |
| Animation | GSAP (single-tween morph for 100+ nodes) |
| State | Zustand (Map + Array dual structure) |
| Layout | D3-hierarchy (radial rings), Fibonacci lattice (sphere) |
| LLM API | Anthropic / OpenAI / Gemini / xAI / DeepSeek / Qwen via unified provider layer + Vite proxy |
| Gesture | MediaPipe Hand + 1-Euro filter |
| Validation | Zod schema validation with retry |
| Style | Lombardi aesthetic (DM Sans, IBM Plex Sans) |
| Build | Vite + TypeScript |

### Performance

- **InstancedMesh** — Single draw call for all nodes per type. Smooth at 100+ nodes, capable of 10,000+.
- **Zero React re-renders** during animation — All position updates via `useFrame` reading Zustand store directly.
- **Batched edge rendering** — Single `LineSegments` with `BufferGeometry` and `Float32Array` for all edges.
- **Cached highlight state** — Connected-node set computed once per focus change, reused across components per frame.

### Data Model

```typescript
interface NodeData {
  id: string;
  label: string;
  type: 'ens' | 'res' | 'unum' | 'aliquid' | 'verum' | 'bonum';  // Aquinas, De Veritate q.1 a.1
  weight: number;              // 0–1 importance score
  description: string;
  depth: number;               // 0=root, 1=theme, 2=basic, 3+=detail
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

### Project Structure

```
src/
├── components/           # 3D scene + UI components
│   ├── Scene.tsx             Canvas, lighting, post-processing
│   ├── SceneInner.tsx        Mode routing, morph transitions
│   ├── SphereInstancedView   InstancedMesh + LOD labels (Sphere/transition)
│   ├── InteriorView.tsx      Hyperbolic fisheye InstancedMesh
│   ├── DraggableNode.tsx     Radial drag/weight/edge interaction
│   ├── EdgeRenderer.tsx      Unified Bezier edge renderer (useFrame, 0 re-renders)
│   ├── NodeInfoPanel.tsx     Left panel: description + connections
│   ├── NodeEditPanel.tsx     Right panel: weight slider + type + actions
│   ├── HandGestureOverlay.tsx Toggle + status for webcam gesture control
│   ├── HandCursor.tsx        3D ring cursor following hand on sphere
│   ├── HelpOverlay.tsx       ? button + keyboard shortcut reference
│   ├── PromptInput.tsx       Prompt input with N/D sliders
│   ├── ResponsePanel.tsx     Streaming response + concept highlight
│   ├── Toolbar.tsx           Mode/stats/API key/labels/reset
│   └── ContextMenu.tsx       Right-click menu (viewport-clamped)
├── hooks/
│   ├── useMorphTransition    GSAP Sphere ↔ Radial morph
│   ├── useRadialPhysics      Spring physics for radial drag
│   ├── useGestureControl     Webcam hand → sphere rotation/zoom
│   ├── useNodeSpawnAnimation Elastic stagger on node creation
│   └── useKeyboardShortcuts  Global keyboard handlers
├── services/
│   ├── claude.ts             3-phase extraction + streaming orchestration (provider-agnostic)
│   ├── synthesizer.ts        Graph → structured prompt composition
│   ├── mapNodesToSphere.ts   Fibonacci lattice + Tammes repulsion
│   └── llm/                  Unified multi-provider LLM layer
│       ├── types.ts              LLMProvider interface (structured / simple / stream)
│       ├── catalog.ts            Per-provider metadata + default fast/flagship models
│       ├── registry.ts           Key storage, legacy migration, provider factory + cache
│       ├── logos.tsx             Monotone inline SVG logos (currentColor)
│       └── providers/
│           ├── anthropic.ts          Messages API + tool_choice structured output
│           ├── openaiCompat.ts       OpenAI / Grok / DeepSeek / Qwen (json_schema)
│           └── gemini.ts             Gemini REST (responseSchema, nullable)
├── store/
│   ├── useGraphStore.ts      Nodes/edges/mode/CRUD/edge-creation state
│   └── useHistoryStore.ts    Undo/Redo action stack
├── types/
│   ├── node.ts               NodeData, NodeType, facets
│   ├── edge.ts               EdgeData, RelationType
│   └── extraction.ts         Budget allocation (Rosch/Miller constraints)
├── gesture/
│   ├── gestureEngine.ts      MediaPipe inference + 1-Euro filtering
│   └── gestureTypes.ts       GestureState interface
├── utils/
│   ├── radialLayout.ts       Concentric ring layout with capacity limits
│   ├── coordinates.ts        Spherical ↔ Cartesian ↔ Radial transforms
│   ├── highlightState.ts     Cached focus/connected computation with fade
│   └── nodePatterns.ts       Lombardi pattern textures (6 types)
└── App.tsx
```

---

## Design Principles

<p align="center">
  <img src="./public/favicon.svg" alt="NodePrompt — Fibonacci sphere logo" width="240">
</p>

1. **White canvas, black ink** — Lombardi aesthetic. No colors, no shadows, no gradients. Pattern textures distinguish node types.
2. **Continuity across modes** — Node identity (pattern, size, label) is preserved through all transitions.
3. **Immediate feedback** — Every interaction produces instant visual response with smooth transitions.
4. **Information density by zoom** — Labels hide when zoomed out, full detail when zoomed in.
5. **User authority is absolute** — AI proposes hierarchy, users can override everything. The graph is a suggestion, not a constraint.

---

## How It Works: The Co-Decomposition Loop

NodePrompt fills a gap between existing tools:

| Tool Category | Limitation | NodePrompt's Answer |
|---|---|---|
| Mind mapping tools | Manual input, 2D only, tree structures | AI-assisted extraction, 3D + 2D, graph with cross-links |
| AI chatbots | Linear text, opaque reasoning | Visible concept graph, spatial editing |
| Knowledge graphs | Static, read-only | Fully editable, feeds back into generation |
| 3D visualizations | Display only, no editing | Interactive editing across 3 modes |

The key insight from Visual Prompt Engineering research: text prompts excel at describing *what* you want, while spatial layouts better communicate *how ideas relate*. By combining both — text input for intent, spatial editing for structure — NodePrompt produces prompts that are richer than either modality alone.

---

## Extraction Pipeline

The 3-phase extraction pipeline is designed around cognitive science constraints:

### Phase 1: Scaffold
Extract top-level themes (depth 0–1). Budget: ~22% of N nodes. These form the superordinate categories (Rosch).

### Phase 2: Fill
Expand each theme with basic-level concepts (depth 2). Budget: ~40% of N. This is the densest layer — where human cognition operates most efficiently.

### Phase 3: Validate
Add subordinate details (depth 3+) and cross-branch edges. Budget: remaining ~38%. Edge discovery here produces the most valuable insights (Novak).

**Budget allocation** follows `allocateLevelBudget(N, D)` which enforces:
- Branching factor ≤ 7 (Miller's Law)
- Depth 2 always receives the most nodes (Rosch's basic level)
- Each level descends in abstraction (Hayakawa's ladder)

---

## References

### Cognitive Science
- Rosch, E. (1976). *Basic objects in natural categories*. Cognitive Psychology, 8(3), 382–439.
- Miller, G. A. (1956). *The magical number seven, plus or minus two*. Psychological Review, 63(2), 81–97.
- Hayakawa, S. I. (1939). *Language in Action*. Harcourt, Brace.

### Knowledge Representation
- Ranganathan, S. R. (1933). *Colon Classification*. Madras Library Association.
- Novak, J. D., & Gowin, D. B. (1984). *Learning How to Learn*. Cambridge University Press.

### Information Visualization
- Munzner, T. (1997). *H3: Laying out large directed graphs in 3D hyperbolic space*. IEEE InfoVis.
- Lombardi, M. (2000). *Mark Lombardi: Global Networks*. Independent Curators International.

### AI & Prompt Engineering
- Cheng, X. et al. (2024). *TopicGPT: A prompt-based topic modeling framework*. NAACL.
- Zhu, W. et al. (2024). *Chain-of-Symbol prompting for spatial reasoning in LLMs*. arXiv:2305.10276.

---

## Connect

<p align="center">
  <a href="https://github.com/TaewoooPark"><img src="https://img.shields.io/badge/-GitHub-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub"></a>
  <a href="https://x.com/theoverstrcture"><img src="https://img.shields.io/badge/-X-000000?style=for-the-badge&logo=x&logoColor=white" alt="X (Twitter)"></a>
  <a href="https://www.linkedin.com/in/taewoo-park-427a05352"><img src="https://img.shields.io/badge/-LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
  <a href="https://www.instagram.com/t.wo0_x/"><img src="https://img.shields.io/badge/-Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram"></a>
  <a href="mailto:ptw151125@kaist.ac.kr"><img src="https://img.shields.io/badge/-Email-D14836?style=for-the-badge&logo=gmail&logoColor=white" alt="Email"></a>
</p>

---

## License

MIT

---

<p align="center">
Built with React Three Fiber, Three.js, Zustand, GSAP, and D3.
</p>
