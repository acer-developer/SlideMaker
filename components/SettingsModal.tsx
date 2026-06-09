"use client";
import { useState } from "react";
import { X, Key, ExternalLink, Check } from "lucide-react";
import type { AppSettings } from "@/lib/types";

interface Props {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}

export default function SettingsModal({ settings, onSave, onClose }: Props) {
  const [form, setForm] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onSave(form);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(10,30,30,0.6)" }}>
      <div className="w-full max-w-md rounded-2xl bg-white overflow-hidden shadow-2xl" style={{ border: "1px solid var(--border)" }}>
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: "var(--brand-dark-3)", borderBottom: "1px solid var(--brand-dark-2)" }}
        >
          <div className="flex items-center gap-2">
            <Key size={15} color="var(--brand-light-3)" />
            <span className="font-semibold text-sm text-white">API Keys</span>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.5)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div
            className="rounded-xl px-4 py-3 text-xs leading-relaxed"
            style={{ background: "var(--brand-light-5)", color: "var(--brand-dark-2)", border: "1px solid var(--brand-light-3)" }}
          >
            Keys are stored in your browser only and never sent to any server. Each team member needs their own free key.
          </div>

          {/* OpenRouter */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                OpenRouter Key
                <span className="ml-1.5 font-normal px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--brand-light-5)", color: "var(--brand-dark-1)" }}>
                  Primary
                </span>
              </label>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs"
                style={{ color: "var(--brand-primary)" }}
              >
                Get free key <ExternalLink size={10} />
              </a>
            </div>
            <input
              type="password"
              placeholder="sk-or-v1-..."
              value={form.openrouterKey}
              onChange={e => setForm(f => ({ ...f, openrouterKey: e.target.value }))}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{
                border: `1.5px solid ${form.openrouterKey ? "var(--brand-light-3)" : "var(--border)"}`,
                background: form.openrouterKey ? "var(--brand-light-5)" : "#fff",
                color: "var(--text)",
              }}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--placeholder)" }}>200 free requests/day, uses Llama 3.3 70B</p>
          </div>

          {/* NVIDIA NIM */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                NVIDIA NIM Key
                <span className="ml-1.5 font-normal px-1.5 py-0.5 rounded text-xs" style={{ background: "#FEF9C3", color: "#854D0E" }}>
                  Fallback
                </span>
              </label>
              <a
                href="https://build.nvidia.com/explore/discover"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs"
                style={{ color: "var(--brand-primary)" }}
              >
                Get free key <ExternalLink size={10} />
              </a>
            </div>
            <input
              type="password"
              placeholder="nvapi-..."
              value={form.nvidiaKey}
              onChange={e => setForm(f => ({ ...f, nvidiaKey: e.target.value }))}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{
                border: `1.5px solid ${form.nvidiaKey ? "var(--brand-light-3)" : "var(--border)"}`,
                background: form.nvidiaKey ? "var(--brand-light-5)" : "#fff",
                color: "var(--text)",
              }}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--placeholder)" }}>1000 free credits/month, uses Llama 3.1 70B</p>
          </div>

          <p className="text-xs text-center" style={{ color: "var(--placeholder)" }}>
            No key? Insights become manual text fields. PPT still works.
          </p>

          <button
            onClick={handleSave}
            className="w-full py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2"
            style={{ background: saved ? "#059669" : "var(--brand-primary)" }}
          >
            {saved ? <><Check size={15} /> Saved</> : "Save Keys"}
          </button>
        </div>
      </div>
    </div>
  );
}
