# Update Catalog

## 26.04.14 update

### Multi-provider LLM support

NodePrompt now runs on six LLM back ends instead of one. You can pick the
active provider from the toolbar and every feature — scaffold, fill,
validate, streaming synthesis, and auto-generated node descriptions —
routes through the chosen provider without any code path changes.

Supported providers and default models (snapshot as of 26.04.14):

| Provider  | Fast role           | Flagship role             |
|-----------|---------------------|---------------------------|
| Anthropic | Claude Haiku 4.5    | Claude Sonnet 4.6         |
| OpenAI    | GPT-5.4 Mini        | GPT-5.4                   |
| Google    | Gemini 2.5 Flash    | Gemini 3.1 Pro            |
| xAI       | Grok 4.1 Fast       | Grok 4.1 Fast Reasoning   |
| DeepSeek  | DeepSeek V3.2 Chat  | DeepSeek Reasoner         |
| Alibaba   | Qwen3.5 Flash       | Qwen3 Max                 |

Fast models handle structured extraction (scaffold / fill / validate);
flagship models handle the long-form synthesis stream. This split is
automatic — no manual model picking required.

### Unified provider abstraction

A new `src/services/llm/` layer defines a single interface (`checkConnection`,
`callStructured`, `callSimple`, `stream`) that every provider implements.
`claude.ts` keeps all orchestration logic (four-pass hierarchical
extraction, retry ladders, budget trimming, reference integrity) and
only delegates the network layer to the active provider, so adding more
providers in the future requires nothing but a new adapter file.

- **Anthropic adapter** keeps the native `tool_choice` path so existing
  structured output works without translation.
- **OpenAI-compatible factory** covers OpenAI, Grok, DeepSeek, and Qwen
  from a single file; each is just a different base URL and auth
  header. Structured output is enforced via `response_format:
  json_schema` and streaming uses the standard SSE delta format.
- **Gemini adapter** translates the tool input schema into Gemini’s
  `responseSchema` dialect (uppercased `type`, `nullable: true` instead
  of union types, no `additionalProperties`) and parses
  `streamGenerateContent` SSE for the synthesis panel.

### Key storage and migration

- Per-provider keys are stored in a single `nodeprompt_api_keys` object
  in `localStorage` alongside the active-provider selector.
- The previous `nodeprompt_api_key` entry is migrated once on first
  load into the `anthropic` slot, so existing users keep working with
  zero action required.
- Environment variables (`VITE_ANTHROPIC_API_KEY`, `VITE_OPENAI_API_KEY`,
  `VITE_GEMINI_API_KEY`, `VITE_XAI_API_KEY`, `VITE_DEEPSEEK_API_KEY`,
  `VITE_QWEN_API_KEY`) are honoured as fall-backs for development.

### Toolbar UI

- New inline provider dropdown with six minimal **monotone SVG logos**
  rendered in `currentColor` so they blend into the existing Lombardi
  black-and-white aesthetic. Each menu row shows the logo, the short
  provider name, and a filled / empty marker indicating whether a key
  is stored for that provider.
- The connection indicator and key-input panel now reflect the active
  provider. The panel title, placeholder, and key hint update to the
  selected provider (e.g. `sk-ant-…`, `AIza…`, `xai-…`).

### Model access notes

Some flagship models need extra steps beyond a standard API key. When
the user selects one of the affected providers from the dropdown, a
small **bilingual (Korean / English) note** pops up next to the
selector. Providers with no caveats show nothing:

- **OpenAI**: `gpt-5.4` requires Verified Organization status on the
  OpenAI dashboard. Unverified keys can still reach `gpt-5.4-mini`.
- **Google**: `gemini-3.1-pro` requires a paid-tier key with billing
  enabled. Free AI Studio keys are limited to `gemini-2.5-flash`.
- **Alibaba**: `qwen3-max` requires per-model activation in the
  DashScope console before it can be called. `qwen3.5-flash` is
  enabled by default.

### Vite dev proxy

The dev server now proxies all six provider endpoints so the browser
can reach them without CORS issues:

```
/api/anthropic  → api.anthropic.com
/api/openai     → api.openai.com
/api/gemini     → generativelanguage.googleapis.com
/api/xai        → api.x.ai
/api/deepseek   → api.deepseek.com
/api/qwen       → dashscope-intl.aliyuncs.com
```

Production deployments that expose the browser directly should still
front these with a server-side proxy, since API keys live in the
browser.

### Notes

- All structured-output schemas are shared across providers: the
  existing `input_schema` JSON Schemas used by Anthropic tool calls
  are reused verbatim for OpenAI / Grok / DeepSeek / Qwen, and
  normalized on-the-fly for Gemini.
- No breaking changes for existing Claude users. The first load on an
  upgraded build finds the old key, moves it into the `anthropic`
  slot, and keeps the provider on Anthropic by default.
