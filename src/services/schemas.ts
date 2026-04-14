import { z } from 'zod';
import type { ExtractionConfig } from '../types/extraction';

// ── 기존 호환 스키마 (단일 패스 폴백용) ──

export const ExtractedNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['ens', 'res', 'unum', 'aliquid', 'verum', 'bonum']),
  weight: z.number().min(0).max(1),
  description: z.string(),
  parentId: z.string().nullable().default(null),
});

export const ExtractedEdgeSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  relation: z.enum(['causal', 'contrast', 'amplify', 'suppress', 'parallel', 'dependency']),
  strength: z.number().min(0).max(1),
});

export const ExtractionResultSchema = z.object({
  nodes: z.array(ExtractedNodeSchema).min(1),
  edges: z.array(ExtractedEdgeSchema),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ── 계층적 추출 스키마 (다단계) ──

// 6 Transcendentia (Aquinas, De Veritate q.1 a.1)
const NODE_TYPES = ['ens', 'res', 'unum', 'aliquid', 'verum', 'bonum'] as const;
const EDGE_RELATIONS = ['causal', 'contrast', 'amplify', 'suppress', 'parallel', 'dependency', 'parent-child', 'cross-link'] as const;

const FacetSchema = z.object({
  cognitive: z.enum(NODE_TYPES),
  epistemological: z.enum(['empirical', 'theoretical', 'normative', 'methodological']),
  rhetorical: z.enum(['thesis', 'antithesis', 'evidence', 'qualifier', 'warrant']),
}).optional();

// Pass 1: 테마
export const ThemeNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(NODE_TYPES),
  weight: z.number().min(0).max(1),
  description: z.string(),
  abstractionLevel: z.literal('superordinate').default('superordinate'),
});

export const ThemeResultSchema = z.object({
  nodes: z.array(ThemeNodeSchema).min(1),
});

// Pass 2: 기본개념
export const ConceptNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(NODE_TYPES),
  weight: z.number().min(0).max(1),
  description: z.string(),
  parentId: z.string().min(1),
  abstractionLevel: z.literal('basic').default('basic'),
  facets: FacetSchema,
});

export const ConceptResultSchema = z.object({
  nodes: z.array(ConceptNodeSchema).min(1),
});

// Pass 3: 세부
export const DetailNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(NODE_TYPES),
  weight: z.number().min(0).max(1),
  description: z.string(),
  parentId: z.string().min(1),
  abstractionLevel: z.enum(['subordinate', 'instance']).default('subordinate'),
  facets: FacetSchema,
});

export const DetailResultSchema = z.object({
  nodes: z.array(DetailNodeSchema).default([]),
});

// Pass 4: 횡단 연결
export const CrossLinkSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  relation: z.enum(EDGE_RELATIONS),
  strength: z.number().min(0).max(1),
});

export const CrossLinkResultSchema = z.object({
  edges: z.array(CrossLinkSchema),
});

// ── 3-Phase 추출 스키마 ──

// Phase 1: Scaffold (구조만)
export const ScaffoldNodeSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().nullable().default(null),
  abstractionLevel: z.enum(['superordinate', 'basic', 'subordinate', 'instance']),
});

export const ScaffoldResultSchema = z.object({
  nodes: z.array(ScaffoldNodeSchema).default([]),
});

export type ScaffoldNode = z.infer<typeof ScaffoldNodeSchema>;

// Phase 2: Fill (내용 채움)
export const FillNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(NODE_TYPES),
  weight: z.number().min(0).max(1),
  description: z.string(),
});

export const FillResultSchema = z.object({
  nodes: z.array(FillNodeSchema).default([]),
});

export type FillNode = z.infer<typeof FillNodeSchema>;

// Phase 3: Validate (검증 및 패치)
export const PatchNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  type: z.enum(NODE_TYPES).optional(),
  weight: z.number().min(0).max(1).optional(),
  description: z.string().optional(),
});

export const ValidateResultSchema = z.object({
  patches: z.array(PatchNodeSchema).default([]),
  edges: z.array(z.object({
    sourceId: z.string().min(1),
    targetId: z.string().min(1),
    relation: z.enum(EDGE_RELATIONS),
    strength: z.number().min(0).max(1),
  })).default([]),
});

export type PatchNode = z.infer<typeof PatchNodeSchema>;
export type ValidateResult = z.infer<typeof ValidateResultSchema>;

// ── 3-Phase Tool 정의 ──

export const SCAFFOLD_TOOL = {
  name: 'scaffold_tree',
  description: 'Create the hierarchical tree structure with exact node count and depth.',
  input_schema: {
    type: 'object' as const,
    properties: {
      nodes: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const, description: 'Short kebab-case id hinting at content' },
            parentId: { type: ['string', 'null'] as const, description: 'Parent node id, null for root themes' },
            abstractionLevel: { type: 'string' as const, enum: ['superordinate', 'basic', 'subordinate', 'instance'] },
          },
          required: ['id', 'parentId', 'abstractionLevel'] as const,
        },
      },
    },
    required: ['nodes'] as const,
  },
};

export const FILL_TOOL = {
  name: 'fill_content',
  description: 'Fill content (label, type, weight, description) for each node in the skeleton.',
  input_schema: {
    type: 'object' as const,
    properties: {
      nodes: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const, description: 'Existing node id from skeleton' },
            label: { type: 'string' as const, description: '1-4 word label' },
            type: { type: 'string' as const, enum: NODE_TYPES },
            weight: { type: 'number' as const, minimum: 0, maximum: 1 },
            description: { type: 'string' as const, description: '1 sentence explaining importance' },
          },
          required: ['id', 'label', 'type', 'weight', 'description'] as const,
        },
      },
    },
    required: ['nodes'] as const,
  },
};

export const VALIDATE_TOOL = {
  name: 'validate_graph',
  description: 'Validate the completed graph. Return patches for corrections and cross-link edges.',
  input_schema: {
    type: 'object' as const,
    properties: {
      patches: {
        type: 'array' as const,
        description: 'Node corrections. Only include nodes that need changes.',
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const, description: 'Node id to patch' },
            label: { type: 'string' as const },
            type: { type: 'string' as const, enum: NODE_TYPES },
            weight: { type: 'number' as const, minimum: 0, maximum: 1 },
            description: { type: 'string' as const },
          },
          required: ['id'] as const,
        },
      },
      edges: {
        type: 'array' as const,
        description: 'Cross-branch relationships to add.',
        items: {
          type: 'object' as const,
          properties: {
            sourceId: { type: 'string' as const },
            targetId: { type: 'string' as const },
            relation: { type: 'string' as const, enum: EDGE_RELATIONS },
            strength: { type: 'number' as const, minimum: 0, maximum: 1 },
          },
          required: ['sourceId', 'targetId', 'relation', 'strength'] as const,
        },
      },
    },
    required: ['patches', 'edges'] as const,
  },
};

// ── Claude tool 정의 팩토리 ──

export const EXTRACTION_TOOL = {
  name: 'extract_nodes',
  description: 'Extract conceptual nodes and their relationships from the user prompt. Return structured graph data.',
  input_schema: {
    type: 'object' as const,
    properties: {
      nodes: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const, description: 'Short kebab-case id' },
            label: { type: 'string' as const, description: '1-4 word label' },
            type: { type: 'string' as const, enum: NODE_TYPES },
            weight: { type: 'number' as const, minimum: 0, maximum: 1 },
            description: { type: 'string' as const, description: '1 sentence explaining importance' },
            parentId: { type: ['string', 'null'] as const, description: 'Parent node id or null' },
          },
          required: ['id', 'label', 'type', 'weight', 'description'] as const,
        },
      },
      edges: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            sourceId: { type: 'string' as const },
            targetId: { type: 'string' as const },
            relation: { type: 'string' as const, enum: EDGE_RELATIONS },
            strength: { type: 'number' as const, minimum: 0, maximum: 1 },
          },
          required: ['sourceId', 'targetId', 'relation', 'strength'] as const,
        },
      },
    },
    required: ['nodes', 'edges'] as const,
  },
};

export function buildHierarchicalTool(pass: 1 | 2 | 3 | 4, _config: ExtractionConfig) {
  const toolName = ['extract_themes', 'expand_concepts', 'decompose_details', 'discover_cross_links'][pass - 1]!;

  if (pass === 4) {
    return {
      name: toolName,
      description: 'Discover cross-branch relationships between existing concepts.',
      input_schema: {
        type: 'object' as const,
        properties: {
          edges: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                sourceId: { type: 'string' as const },
                targetId: { type: 'string' as const },
                relation: { type: 'string' as const, enum: EDGE_RELATIONS },
                strength: { type: 'number' as const, minimum: 0, maximum: 1 },
              },
              required: ['sourceId', 'targetId', 'relation', 'strength'] as const,
            },
          },
        },
        required: ['edges'] as const,
      },
    };
  }

  const abstractionLevels = pass === 1
    ? ['superordinate']
    : pass === 2 ? ['basic'] : ['subordinate', 'instance'];

  return {
    name: toolName,
    description: `Extract ${pass === 1 ? 'themes' : pass === 2 ? 'basic-level concepts' : 'subordinate details'} from the prompt.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        nodes: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const },
              label: { type: 'string' as const },
              type: { type: 'string' as const, enum: NODE_TYPES },
              weight: { type: 'number' as const, minimum: 0, maximum: 1 },
              description: { type: 'string' as const },
              parentId: pass === 1
                ? { type: ['string', 'null'] as const }
                : { type: 'string' as const, description: 'Parent node id (required)' },
              abstractionLevel: { type: 'string' as const, enum: abstractionLevels },
              facets: pass >= 2 ? {
                type: 'object' as const,
                properties: {
                  cognitive: { type: 'string' as const, enum: NODE_TYPES },
                  epistemological: { type: 'string' as const, enum: ['empirical', 'theoretical', 'normative', 'methodological'] },
                  rhetorical: { type: 'string' as const, enum: ['thesis', 'antithesis', 'evidence', 'qualifier', 'warrant'] },
                },
              } : undefined,
            },
            required: pass === 1
              ? ['id', 'label', 'type', 'weight', 'description'] as const
              : ['id', 'label', 'type', 'weight', 'description', 'parentId'] as const,
          },
        },
      },
      required: ['nodes'] as const,
    },
  };
}
