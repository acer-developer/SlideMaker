@AGENTS.md

# SlideMaker — Developer Guide

SlideMaker takes raw data (CSV / Excel / pasted text), user context, and optional instructions, runs AI-powered insight generation, renders Chart.js charts, and exports everything as a single A4-portrait PowerPoint slide.

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Next.js 14 App Router |
| Styling | Tailwind CSS v4 (PostCSS + Turbopack) |
| Charts | Chart.js + react-chartjs-2 + chartjs-plugin-datalabels |
| PPT export | pptxgenjs |
| Excel parsing | SheetJS (xlsx) |
| CSV parsing | Papa Parse |
| Icons | Lucide React |

---

## Project Structure

```
projects/slidemaker/
  app/
    layout.tsx          — Root layout: APTOEX/Inter fonts via <link>, SlideMaker title
    globals.css         — CSS variables (brand palette, bg, card, border, text, muted)
    page.tsx            — Main page: state management, generate flow, preview/download gate
  components/
    Header.tsx          — Top bar: SlideMaker brand name + API key status button
    ChartBlock.tsx      — Per-chart input card: data upload, context, chart type, instructions
    FileUpload.tsx      — Paste tab (textarea) + Upload tab (drag-and-drop / file picker)
    ChartTypeSelector.tsx — 4-column emoji grid for picking chart type
    ChartRenderer.tsx   — Wraps react-chartjs-2, registers plugins, injects datalabels config
    SlideCanvas.tsx     — Pixel-perfect A4 slide preview (794 x 1123 px)
    PreviewModal.tsx    — Full-screen modal: zoom controls, Fit button, Download PPT
    SettingsModal.tsx   — API key inputs (OpenRouter + NVIDIA NIM), saved to localStorage
  lib/
    types.ts            — ChartBlock, AppSettings interfaces
    colors.ts           — BRAND palette + CHART_PALETTE array
    chartTypes.ts       — CHART_TYPES list with id, label, emoji icon, description
    parseData.ts        — parseCSV(): raw string -> { labels, series[] }
    chartConfig.ts      — buildChartSpec(): parsed data + chart type -> ChartSpec for Chart.js
    pptGenerator.ts     — generatePPT(): replicates SlideCanvas layout in pptxgenjs
```

---

## User Flow

1. User opens the app and clicks the **BYOK** button (bot icon, top-right of header) to open the BYOK modal. They select a provider (OpenRouter or NVIDIA NIM) and enter their API key (saved to localStorage). The button shows red when no key is saved, teal when a key is present.
2. User fills in one to four chart blocks. Each block has:
   - **Data** -- paste CSV/text or upload a .csv/.xlsx/.txt file
   - **Context** -- what the data represents (up to 1200 chars), required for AI
   - **Chart type** -- optional; AI auto-selects if blank
   - **Instructions** -- optional AI directives (up to 1500 chars)
3. User clicks **Generate Slide**.
4. The app validates that every block has data and context, then calls the AI for each block in parallel to generate 3-5 bullet insights.
5. After all insights are generated (with a 600 ms stabilisation pause), `generated` state flips to `true`.
6. The slide preview appears inline (scaled to fit the viewport) and the **Download PPT** button becomes active.
7. Clicking Download PPT calls pptxgenjs which replicates the SlideCanvas layout exactly and triggers a browser download.

---

## AI / BYOK

Architecture: frontend sends data to Express backend (`/api/generate`). Backend calls OpenRouter or NVIDIA NIM using either the user's BYOK key (from request body) or server-side env vars as fallback.

- **Primary model**: OpenRouter `meta-llama/llama-3.3-70b-instruct:free`
- **Fallback model**: NVIDIA NIM `meta/llama-3.1-70b-instruct`
- **BYOK keys** stored in `localStorage`:
  - `slidemaker_provider` -- `"openrouter"` or `"nvidia"`
  - `slidemaker_openrouter_key` -- user's OpenRouter API key
  - `slidemaker_nvidia_key` -- user's NVIDIA NIM API key
- If a BYOK key is present, it is sent in the POST body (`{ apiKey, provider }`). Backend uses it directly and returns an error if it fails (no silent fallback for BYOK).
- If no BYOK key: backend uses `OPENROUTER_API_KEY` env var, then `NVIDIA_API_KEY` env var as fallback.
- Server env vars are set in Render dashboard and never exposed to the frontend.

**AI response fields** (7 structured fields):
- `slideSubtitle` -- macro story sentence for slide header
- `kpiTitle` -- 2-4 word noun phrase
- `kpiSubtitle` -- one data-backed sentence with exact metric
- `kpiDescription` -- 2-3 consulting-grade sentences
- `kpiIcon` -- single emoji
- `source` -- data source name (only if explicitly mentioned)
- `annotations[]` -- 3 period annotations with `period`, `label`, `description`, `icon`
- `insights[]` -- 4-5 bullets with `[[keyword]]` syntax for teal highlighting

**AI prompt rules:**
- No em dashes or en dashes -- use hyphens
- `parseResponse()` in `server.js` strips surviving em/en dashes to hyphens
- `[[keyword]]` syntax renders as teal bold via `HighlightText` component in SlideCanvas; stripped to plain text in PPT export

---

## Brand Palette (`lib/colors.ts`)

```
Primary  #3AA4A9
Dark-1   #2E8388   Dark-2   #236567   Dark-3   #1A4A4C
Light-1  #52B5BA   Light-2  #6EC7CB   Light-3  #91DFE2
Light-4  #B5EEEF   Light-5  #D5F6F7
```

CSS variables are declared in `globals.css` and consumed everywhere via `var(--brand-*)`.

---

## Slide Layout (`components/SlideCanvas.tsx`)

Canvas is always **794 x 1123 px** (A4 at 96 dpi).

| Zone | Height | Style |
|---|---|---|
| Header bar | 70 px | White bg, bold dark title + AI `slideSubtitle`, 3px teal bottom border |
| Content area | flex-fill | White |
| Key Takeaways | dynamic | Light teal gradient, ✓ bullets with `[[keyword]]` teal highlights |
| Bottom accent | 3 px | Teal strip (no footer) |

**1-2 charts:** Each chart stacked vertically as `ExhibitWithKPI` -- chart card (fills width minus 190px KPI panel) + KPI panel (emoji circle, title, subtitle, description). Chart card has period annotations row (`ANN_H=80px`) and source attribution row below the chart body.

**3-4 charts:** 2×2 grid of compact `ExhibitCard` components, each with combined badge+title row, chart body, and 2-line insight strip. 3-chart layout centers the 3rd card.

**Key Takeaways** (`TakeawaysSection`): absolute-positioned at bottom, single-column ✓ bullets. `HighlightText` component renders `[[keyword]]` as teal bold `<span>`s.

---

## Chart.js Setup (`components/ChartRenderer.tsx`)

- `ChartJS.register(...)` -- all Chart.js components + ChartDataLabels plugin
- `ChartJS.defaults.set("plugins.datalabels", { display: false })` -- disabled globally to prevent labels on charts that do not request them
- Per-chart datalabels config is injected from `spec.datalabels` inside ChartRenderer

---

## Border Conventions

All empty input fields use `#B0C8CA` as their default border so they are visible against a white card background.

| State | Border color |
|---|---|
| Empty / default | `#B0C8CA` |
| Filled / focused | `var(--brand-light-3)` (#91DFE2) |
| Instructions box | `#FCD34D` (amber) when filled, `var(--border)` when empty |
| Upload drag active | `var(--brand-primary)` |

---

## PPT Export (`lib/pptGenerator.ts`)

- Page size: **8.27" x 11.69"** (A4 portrait)
- Output file: `slidemaker-slide.pptx`
- Layout mirrors SlideCanvas: same header/footer, same grid logic
- Chart images are rendered by capturing the Chart.js canvas as a PNG data URL and placing it in the slide via pptxgenjs `addImage`
- Text insights are placed as text boxes with matching typography

---

## Known Gotchas

- **Turbopack cache**: after editing `globals.css` delete `.next/` and restart the dev server if you see stale PostCSS errors.
- **Google Fonts**: the `@import url()` directive must NOT be in `globals.css` -- it ends up after Tailwind's compiled lines and PostCSS rejects it. Use `<link>` tags in `layout.tsx` instead.
- **chartjs-plugin-datalabels**: must be registered ONCE globally. The `display: false` default is critical -- omitting it causes every chart to show labels.
- **react-chartjs-2 with Next.js**: all Chart.js registration must happen inside a `"use client"` component.

---

## Font

Body font stack: `'APTOEX', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

APTOEX is loaded via a local `@font-face` declaration in `globals.css`. Inter is the web-safe fallback loaded via Google Fonts `<link>` in `layout.tsx`.
