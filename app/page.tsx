"use client";
import { useState, useCallback, useEffect } from "react";
import { Plus, Sparkles, Loader2, Download, Eye, AlertTriangle, CheckCircle2, X } from "lucide-react";
import Header from "@/components/Header";
import ChartBlock from "@/components/ChartBlock";
import PreviewModal from "@/components/PreviewModal";
import SlideCanvas from "@/components/SlideCanvas";
import SettingsModal from "@/components/SettingsModal";
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
    kpiTitle: "",
    kpiSubtitle: "",
    kpiDescription: "",
    kpiIcon: "",
    annotations: [],
    source: "",
    slideSubtitle: "",
  };
}

export default function Home() {
  const [blocks, setBlocks] = useState<ChartBlockType[]>([makeBlock()]);
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pptError, setPptError] = useState<string | null>(null);
  const [generatingStep, setGeneratingStep] = useState("");

  useEffect(() => {
    const provider = localStorage.getItem("slidemaker_provider") || "openrouter";
    const useDefault = localStorage.getItem("slidemaker_use_default") === "true";
    setHasKey(useDefault || !!localStorage.getItem(`slidemaker_${provider}_key`));
  }, []);

  // Keep Render free-tier warm: ping /api/ping immediately on load, then every 10 min.
  // This prevents the 60-90s cold-start delay for the first Generate request.
  useEffect(() => {
    const ping = () => fetch("/api/ping").catch(() => {});
    ping(); // wake immediately when page opens
    const id = setInterval(ping, 10 * 60 * 1000); // every 10 minutes
    return () => clearInterval(id);
  }, []);

  function handleSettingsSave() {
    const provider = localStorage.getItem("slidemaker_provider") || "openrouter";
    const useDefault = localStorage.getItem("slidemaker_use_default") === "true";
    setHasKey(useDefault || !!localStorage.getItem(`slidemaker_${provider}_key`));
    setShowSettings(false);
  }

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
    if (err) { setError(err); return; }

    setIsGenerating(true);
    setError(null);
    setGenerated(false);

    let anySuccess = false;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      setGeneratingStep(`Generating insights for chart ${i + 1} of ${blocks.length}...`);
      setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, isGeneratingInsights: true } : b));
      try {
        const updates = await generateInsightsFromServer(block);
        setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, ...updates, isGeneratingInsights: false } : b));
        anySuccess = true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(`Chart ${i + 1} failed: ${msg}`);
        setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, insights: [], kpiTitle: "", kpiSubtitle: "", kpiDescription: "", kpiIcon: "", annotations: [], source: "", slideSubtitle: "", isGeneratingInsights: false } : b));
      }
    }

    if (!anySuccess) {
      setIsGenerating(false);
      setGeneratingStep("");
      return; // don't show empty preview
    }

    setGeneratingStep("Building slide preview...");
    // Give Chart.js time to fully render before showing the preview
    await new Promise(r => setTimeout(r, 1200));

    setIsGenerating(false);
    setGeneratingStep("");
    setGenerated(true);
  }

  async function handleDownload() {
    setIsExporting(true);
    setPptError(null);
    try {
      const { generatePPT } = await import("@/lib/pptGenerator");
      await generatePPT(blocks);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setPptError(message);
    } finally {
      setIsExporting(false);
    }
  }

  const allReady = blocks.every(b => b.dataRaw.trim() && b.context.trim());

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <Header onSettings={() => setShowSettings(true)} hasKey={hasKey} />

      <main style={{ flex: 1, width: "100%", maxWidth: 1200, margin: "0 auto", padding: "60px clamp(24px, 5vw, 64px) 120px" }}>

        {/* Page title */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: 34, fontWeight: 700, color: "var(--brand-dark-3)", marginBottom: 8, letterSpacing: "-0.02em" }}>
            Build Your Research Slide
          </h1>
          <p style={{ fontSize: 17, color: "var(--muted)", lineHeight: 1.5 }}>
            Add your data and context below, generate insights, then download as an A4 PPT.
          </p>
        </div>

        {/* Error banner removed — errors now shown in popup modal below */}

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
              background: "transparent", fontSize: 16, fontWeight: 500,
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
              fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 36,
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 600, color: "#059669" }}>
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
                <span style={{ fontSize: 16, fontWeight: 500, color: "#91DFE2" }}>
                  Slide Preview - A4 Portrait
                </span>
                <button
                  onClick={() => setShowPreview(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 17, fontWeight: 600, padding: "6px 12px", borderRadius: 8,
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
                fontSize: 17, fontWeight: 700, color: "#fff",
                background: isExporting ? "#94A3B8" : "var(--brand-primary)",
                cursor: isExporting ? "not-allowed" : "pointer",
                boxShadow: !isExporting ? "0 4px 16px rgba(58,164,169,0.3)" : "none",
                transition: "all 0.2s",
              }}
            >
              {isExporting ? (
                <><Loader2 size={16} className="animate-spin" /> Designing slide&hellip; (~30-60s)</>
              ) : (
                <><Download size={16} /> Download PPT</>
              )}
            </button>

            {/* PPT error shown in popup modal below */}
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

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSave={handleSettingsSave}
        />
      )}

      {/* ── Unified Error Popup ────────────────────────────────────────── */}
      {(error || pptError) && (
        <div
          onClick={() => { setError(null); setPptError(null); }}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(10,20,20,0.55)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 20, padding: "32px 28px",
              maxWidth: 460, width: "100%",
              boxShadow: "0 32px 80px rgba(0,0,0,0.28)",
              border: "1px solid #FCA5A5",
            }}
          >
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <AlertTriangle size={22} color="#DC2626" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#991B1B", marginBottom: 4 }}>
                  {pptError ? "PPT generation failed" : "Generation failed"}
                </div>
                <p style={{ fontSize: 14, color: "#6B7280", margin: 0, lineHeight: 1.5 }}>
                  {error || pptError}
                </p>
              </div>
              <button
                onClick={() => { setError(null); setPptError(null); }}
                style={{
                  background: "#F3F4F6", border: "none", borderRadius: 8,
                  width: 32, height: 32, display: "flex", alignItems: "center",
                  justifyContent: "center", cursor: "pointer", flexShrink: 0,
                  color: "#6B7280",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              {(error || pptError)?.toLowerCase().includes("key") && (
                <button
                  onClick={() => { setError(null); setPptError(null); setShowSettings(true); }}
                  style={{
                    padding: "9px 18px", borderRadius: 10, border: "none",
                    background: "var(--brand-primary)", color: "#fff",
                    fontWeight: 600, cursor: "pointer", fontSize: 14,
                  }}
                >
                  Open Settings
                </button>
              )}
              <button
                onClick={() => { setError(null); setPptError(null); }}
                style={{
                  padding: "9px 18px", borderRadius: 10,
                  border: "1px solid #E5E7EB", background: "#F9FAFB",
                  color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: 14,
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function generateInsightsFromServer(block: ChartBlockType): Promise<Partial<ChartBlockType>> {
  // Always use the relative Next.js proxy route — works on localhost AND Vercel
  // The proxy reads BACKEND_URL server-side so the browser never needs the Render URL
  const provider   = localStorage.getItem("slidemaker_provider") || "openrouter";
  const useDefault = localStorage.getItem("slidemaker_use_default") === "true";
  const apiKey     = useDefault ? undefined : (localStorage.getItem(`slidemaker_${provider}_key`) || undefined);
  const res = await fetch(`/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataRaw: block.dataRaw,
      context: block.context,
      instructions: block.instructions,
      chartType: block.chartType,
      ...(apiKey ? { apiKey, provider } : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Generation failed');
  return {
    insights: data.insights ?? [],
    kpiTitle: data.kpiTitle ?? '',
    kpiSubtitle: data.kpiSubtitle ?? '',
    kpiDescription: data.kpiDescription ?? '',
    kpiIcon: data.kpiIcon ?? '',
    annotations: data.annotations ?? [],
    source: data.source ?? '',
    slideSubtitle: data.slideSubtitle ?? '',
  };
}

