"use client";
import { useState, useCallback, useEffect } from "react";
import { Plus, Download, Loader2, AlertTriangle, X } from "lucide-react";
import Header from "@/components/Header";
import ChartBlock from "@/components/ChartBlock";
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
  const [blocks, setBlocks]           = useState<ChartBlockType[]>([makeBlock()]);
  const [showSettings, setShowSettings] = useState(false);
  const [hasKey, setHasKey]           = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState("");
  const [error, setError]             = useState<string | null>(null);

  // Read BYOK state from localStorage on mount
  useEffect(() => {
    const provider   = localStorage.getItem("slidemaker_provider") || "openrouter";
    const useDefault = localStorage.getItem("slidemaker_use_default") === "true";
    setHasKey(useDefault || !!localStorage.getItem(`slidemaker_${provider}_key`));
  }, []);

  // Keep-alive ping — prevents Render free-tier cold start
  useEffect(() => {
    const ping = () => fetch("/api/ping").catch(() => {});
    ping();
    const id = setInterval(ping, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  function handleSettingsSave() {
    const provider   = localStorage.getItem("slidemaker_provider") || "openrouter";
    const useDefault = localStorage.getItem("slidemaker_use_default") === "true";
    setHasKey(useDefault || !!localStorage.getItem(`slidemaker_${provider}_key`));
    setShowSettings(false);
  }

  const updateBlock = useCallback((id: string, updates: Partial<ChartBlockType>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  }, []);

  function addBlock() {
    if (blocks.length >= 4) { setError("Maximum 4 charts per slide."); return; }
    setBlocks(prev => [...prev, makeBlock()]);
  }

  function validate(): string | null {
    for (let i = 0; i < blocks.length; i++) {
      if (!blocks[i].dataRaw.trim()) return `Chart ${i + 1}: data is required.`;
      if (!blocks[i].context.trim()) return `Chart ${i + 1}: context is required.`;
    }
    return null;
  }

  // Return a loading label based on current BYOK settings
  function loadingLabel(): string {
    const prov       = localStorage.getItem("slidemaker_provider") || "openrouter";
    const useDefault = localStorage.getItem("slidemaker_use_default") === "true";
    const hasByok    = !!localStorage.getItem(`slidemaker_${prov}_key`);
    if (!useDefault && hasByok)
      return prov === "nvidia" ? "Your NVIDIA NIM key is working…" : "Your OpenRouter key is working…";
    return "Default NVIDIA NIM generating…";
  }

  async function handleGenerate() {
    const err = validate();
    if (err) { setError(err); return; }

    setIsGenerating(true);
    setError(null);
    setGeneratingStep(loadingLabel());

    try {
      const { generatePPT } = await import("@/lib/pptGenerator");
      await generatePPT(blocks);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsGenerating(false);
      setGeneratingStep("");
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
            Add your data and context — AI picks the best chart type and generates a professional A4 PPT.
          </p>
        </div>

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

        {/* Generate & Download button */}
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
            <><Loader2 size={16} className="animate-spin" /> {generatingStep || "Generating…"}</>
          ) : (
            <><Download size={16} /> Generate &amp; Download PPT</>
          )}
        </button>

        {/* Info note */}
        {!isGenerating && (
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: -20 }}>
            AI picks the best chart type · Native editable charts · ~30–60s
          </p>
        )}

      </main>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} onSave={handleSettingsSave} />
      )}

      {/* ── Error Popup ─────────────────────────────────────────────────────── */}
      {error && (
        <div
          onClick={() => setError(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(10,20,20,0.55)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
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
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={22} color="#DC2626" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#991B1B", marginBottom: 4 }}>
                  Generation failed
                </div>
                <p style={{ fontSize: 14, color: "#6B7280", margin: 0, lineHeight: 1.5, whiteSpace: "pre-line" }}>
                  {error}
                </p>
              </div>
              <button
                onClick={() => setError(null)}
                style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: "#6B7280" }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              {error.toLowerCase().includes("key") && (
                <button
                  onClick={() => { setError(null); setShowSettings(true); }}
                  style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "var(--brand-primary)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 }}
                >
                  Open Settings
                </button>
              )}
              <button
                onClick={() => setError(null)}
                style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: 14 }}
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
