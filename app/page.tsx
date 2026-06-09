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
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <Header />

      <main style={{ flex: 1, width: "100%", maxWidth: 1000, margin: "0 auto", padding: "60px 36px 100px" }}>

        {/* Page title */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, color: "var(--brand-dark-3)", marginBottom: 8, letterSpacing: "-0.02em" }}>
            Build Your Research Slide
          </h1>
          <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.5 }}>
            Add your data and context below, generate insights, then download as an A4 PPT.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 16px", borderRadius: 12, marginBottom: 20,
            background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B",
            fontSize: 13,
          }}>
            <AlertTriangle size={15} />
            {error}
          </div>
        )}

        {/* Chart blocks */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 20 }}>
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
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "18px 16px", borderRadius: 14,
              border: "2px dashed #B0C8CA", color: "var(--muted)",
              background: "transparent", fontSize: 14, fontWeight: 500,
              cursor: "pointer", marginBottom: 12, transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--brand-primary)"; e.currentTarget.style.color = "var(--brand-primary)"; e.currentTarget.style.background = "var(--brand-light-5)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#B0C8CA"; e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.background = "transparent"; }}
          >
            <Plus size={15} />
            Add Chart ({blocks.length}/4)
          </button>
        )}

        {/* Generate button */}
        {!generated && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !allReady}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 10, padding: "18px 24px", borderRadius: 14, border: "none",
              fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 36,
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
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
            {/* Success badge + re-generate */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#059669" }}>
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
            <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)", background: "#0A1E1F" }}>
              {/* Preview toolbar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid #1A4A4C" }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: "#91DFE2" }}>
                  Slide Preview - A4 Portrait
                </span>
                <button
                  onClick={() => setShowPreview(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 8,
                    background: "#1A4A4C", color: "#D5F6F7", border: "none", cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <Eye size={12} />
                  Full Preview
                </button>
              </div>

              {/* Scaled slide */}
              <div style={{ display: "flex", justifyContent: "center", padding: "20px 16px", overflow: "hidden", background: "#111C1C" }}>
                <div style={{ transform: "scale(0.38)", transformOrigin: "top center", height: 427, pointerEvents: "none" }}>
                  <SlideCanvas blocks={blocks} />
                </div>
              </div>
            </div>

            {/* Download button */}
            <button
              onClick={handleDownload}
              disabled={isExporting}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                gap: 10, padding: "16px 24px", borderRadius: 14, border: "none",
                fontSize: 15, fontWeight: 700, color: "#fff",
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
