"use client";
import { useState, useCallback } from "react";
import { Plus, Sparkles, Loader2, Download, Eye, AlertTriangle, CheckCircle2 } from "lucide-react";
import Header from "@/components/Header";
import ChartBlock from "@/components/ChartBlock";
import PreviewModal from "@/components/PreviewModal";
import SlideCanvas from "@/components/SlideCanvas";
import type { ChartBlock as ChartBlockType } from "@/lib/types";

function makeBlock(): ChartBlockType {
  return {
    id: crypto.randomUUID(),
    dataRaw: "",
    fileName: null,
    context: "",
    instructions: "",
    chartType: null,
    insights: [],
    isGeneratingInsights: false,
  };
}

export default function Home() {
  const [blocks, setBlocks] = useState<ChartBlockType[]>([makeBlock()]);
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingStep, setGeneratingStep] = useState("");

  const updateBlock = useCallback((id: string, updates: Partial<ChartBlockType>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    setGenerated(false);
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setGenerated(false);
  }, []);

  function addBlock() {
    if (blocks.length >= 4) {
      setError("Maximum 4 charts per slide.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    setBlocks(prev => [...prev, makeBlock()]);
    setGenerated(false);
  }

  function validate(): string | null {
    for (let i = 0; i < blocks.length; i++) {
      if (!blocks[i].dataRaw.trim()) return `Chart ${i + 1}: data is required.`;
      if (!blocks[i].context.trim()) return `Chart ${i + 1}: context is required.`;
    }
    return null;
  }

  async function handleGenerate() {
    const err = validate();
    if (err) { setError(err); setTimeout(() => setError(null), 4000); return; }

    setIsGenerating(true);
    setError(null);
    setGenerated(false);

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      setGeneratingStep(`Generating insights for chart ${i + 1} of ${blocks.length}...`);
      setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, isGeneratingInsights: true } : b));
      try {
        const insights = await generateInsightsFromServer(block);
        setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, insights, isGeneratingInsights: false } : b));
      } catch {
        setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, insights: [], isGeneratingInsights: false } : b));
      }
    }

    setGeneratingStep("Building slide...");
    await new Promise(r => setTimeout(r, 600));

    setIsGenerating(false);
    setGeneratingStep("");
    setGenerated(true);
  }

  async function handleDownload() {
    setIsExporting(true);
    try {
      const { generatePPT } = await import("@/lib/pptGenerator");
      await generatePPT(blocks);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError("PPT export failed: " + message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsExporting(false);
    }
  }

  const allReady = blocks.every(b => b.dataRaw.trim() && b.context.trim());

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-12">

        {/* Page title */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold mb-1.5" style={{ color: "var(--brand-dark-3)" }}>
            Build Your Research Slide
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Add your data and context below, generate insights, then download as an A4 PPT.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm mb-5"
            style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}
          >
            <AlertTriangle size={15} />
            {error}
          </div>
        )}

        {/* Chart blocks */}
        <div className="space-y-4 mb-4">
          {blocks.map((block, i) => (
            <ChartBlock
              key={block.id}
              block={block}
              index={i}
              total={blocks.length}
              onChange={updateBlock}
              onRemove={removeBlock}
              disabled={isGenerating}
            />
          ))}
        </div>

        {/* Add chart */}
        {blocks.length < 4 && !isGenerating && (
          <button
            onClick={addBlock}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium mb-8 border-2 border-dashed"
            style={{
              borderColor: "var(--border)",
              color: "var(--muted)",
              background: "transparent",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => {
              (e.currentTarget).style.borderColor = "var(--brand-primary)";
              (e.currentTarget).style.color = "var(--brand-primary)";
              (e.currentTarget).style.background = "var(--brand-light-5)";
            }}
            onMouseLeave={e => {
              (e.currentTarget).style.borderColor = "var(--border)";
              (e.currentTarget).style.color = "var(--muted)";
              (e.currentTarget).style.background = "transparent";
            }}
          >
            <Plus size={16} />
            Add Chart ({blocks.length}/4)
          </button>
        )}

        {/* Generate button */}
        {!generated && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !allReady}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-bold text-white mb-8"
            style={{
              background: isGenerating || !allReady ? "#94A3B8" : "var(--brand-dark-3)",
              cursor: isGenerating || !allReady ? "not-allowed" : "pointer",
              boxShadow: !isGenerating && allReady ? "0 4px 16px rgba(26,74,76,0.25)" : "none",
              transition: "all 0.2s",
            }}
          >
            {isGenerating ? (
              <><Loader2 size={16} className="animate-spin" /> {generatingStep || "Generating..."}</>
            ) : (
              <><Sparkles size={16} /> Generate Slide</>
            )}
          </button>
        )}

        {/* Post-generation: slide preview + actions */}
        {generated && (
          <div className="space-y-4 mb-8">
            {/* Success badge + re-generate */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#059669" }}>
                <CheckCircle2 size={16} />
                Slide generated
              </div>
              <button
                onClick={() => setGenerated(false)}
                className="text-xs"
                style={{ color: "var(--muted)", transition: "all 0.2s" }}
              >
                Edit and regenerate
              </button>
            </div>

            {/* Slide preview card */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid var(--border)", background: "#0A1E1F" }}
            >
              {/* Preview toolbar */}
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: "1px solid #1A4A4C" }}
              >
                <span className="text-xs font-medium" style={{ color: "#91DFE2" }}>
                  Slide Preview - A4 Portrait
                </span>
                <button
                  onClick={() => setShowPreview(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ background: "#1A4A4C", color: "#D5F6F7", transition: "all 0.2s" }}
                >
                  <Eye size={12} />
                  Full Preview
                </button>
              </div>

              {/* Scaled slide */}
              <div className="flex justify-center py-5 px-4 overflow-hidden" style={{ background: "#111C1C" }}>
                <div style={{ transform: "scale(0.38)", transformOrigin: "top center", height: 427, pointerEvents: "none" }}>
                  <SlideCanvas blocks={blocks} />
                </div>
              </div>
            </div>

            {/* Download button */}
            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-bold text-white"
              style={{
                background: isExporting ? "#94A3B8" : "var(--brand-primary)",
                cursor: isExporting ? "not-allowed" : "pointer",
                boxShadow: !isExporting ? "0 4px 16px rgba(58,164,169,0.3)" : "none",
                transition: "all 0.2s",
              }}
            >
              {isExporting ? (
                <><Loader2 size={16} className="animate-spin" /> Building PPT...</>
              ) : (
                <><Download size={16} /> Download PPT</>
              )}
            </button>
          </div>
        )}
      </main>

      {showPreview && (
        <PreviewModal
          blocks={blocks}
          onClose={() => setShowPreview(false)}
          onDownload={handleDownload}
          isExporting={isExporting}
        />
      )}
    </div>
  );
}

async function generateInsightsFromServer(block: ChartBlockType): Promise<string[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const res = await fetch(`${apiUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataRaw: block.dataRaw, context: block.context, instructions: block.instructions }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Generation failed');
  return data.insights ?? [];
}
