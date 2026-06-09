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

1. User opens the app and clicks the key icon in the header to enter their OpenRouter and/or NVIDIA NIM API keys (saved to localStorage -- never sent to any backend).
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

- **Primary**: OpenRouter free tier -- `meta-llama/llama-3.3-70b-instruct:free`, 200 req/day per key
- **Fallback**: NVIDIA NIM free tier -- `meta/llama-3.1-70b-instruct`, 1000 credits/month per key
- Keys are stored in `localStorage` under `slidemaker_settings`
- The app tries OpenRouter first; if the key is absent or the call fails it falls back to NVIDIA NIM
- 6 team members each use their own free key -- no shared quota, no backend rate-limit collisions

**AI prompt rules:**
- "Do not use em dashes in your response"
- `parseInsights()` additionally strips any surviving em dashes or en dashes to hyphens

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
| Header bar | 72 px | Dark teal (#1A4A4C), slide title from blocks[0].context |
| Content area | flex-fill | White |
| Footer | 36 px | Dark teal, "SLIDEMAKER" |

**Single chart (1 block):** horizontal split -- chart card (fills width minus 180 px gap) + KPI callout panel (180 px) showing Peak / Latest / Last Change metrics, Key Finding callout, and bullet insights.

**Multi-chart (2-4 blocks):** 2-column grid of ExhibitCard components, each with an Exhibit badge, dark title bar, Chart.js chart body, and per-chart insight bullets. A TakeawaysSection at the bottom combines all insights as 2-column checkmark bullets.

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
