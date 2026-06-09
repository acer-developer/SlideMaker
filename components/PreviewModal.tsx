"use client";
import { X, Download, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useState } from "react";
import type { ChartBlock } from "@/lib/types";
import SlideCanvas from "./SlideCanvas";

interface Props {
  blocks: ChartBlock[];
  onClose: () => void;
  onDownload: () => void;
  isExporting: boolean;
}

export default function PreviewModal({ blocks, onClose, onDownload, isExporting }: Props) {
  const [zoom, setZoom] = useState(0.65);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(8,18,18,0.92)" }}>
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ background: "#0A1E1F", borderBottom: "1px solid #1A4A4C" }}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-white">Slide Preview</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "#1A4A4C", color: "#91DFE2" }}
          >
            A4 Portrait
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom */}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid #1A4A4C" }}>
            <button
              onClick={() => setZoom(z => Math.max(0.3, z - 0.08))}
              className="px-2 py-1.5"
              style={{ background: "#0A1E1F", color: "#6EC7CB" }}
            >
              <ZoomOut size={13} />
            </button>
            <span
              className="px-2.5 text-xs font-mono"
              style={{ background: "#1A4A4C", color: "#D5F6F7", minWidth: 46, textAlign: "center" }}
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(1.1, z + 0.08))}
              className="px-2 py-1.5"
              style={{ background: "#0A1E1F", color: "#6EC7CB" }}
            >
              <ZoomIn size={13} />
            </button>
          </div>

          <button
            onClick={() => setZoom(0.65)}
            className="px-2.5 py-1.5 rounded-lg text-xs"
            style={{ background: "#1A4A4C", color: "#91DFE2" }}
          >
            Fit
          </button>

          <button
            onClick={onDownload}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: isExporting ? "#374151" : "var(--brand-primary)" }}
          >
            <Download size={14} />
            {isExporting ? "Building..." : "Download PPT"}
          </button>

          <button onClick={onClose} className="ml-1" style={{ color: "#4B6365" }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Preview canvas */}
      <div className="flex-1 overflow-auto flex items-start justify-center py-12 px-6">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center", lineHeight: 0 }}>
          <SlideCanvas blocks={blocks} />
        </div>
      </div>

      <div className="text-center pb-4 text-xs" style={{ color: "#2E4A4C" }}>
        What you see here is exactly what exports to PPT
      </div>
    </div>
  );
}
