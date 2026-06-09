"use client";
import { useState } from "react";
import { X, Key, ExternalLink } from "lucide-react";

type Provider = "openrouter" | "nvidia";

interface Props {
  onClose: () => void;
  onSave: () => void;
}

const PROVIDERS: { id: Provider; name: string; hint: string; url: string; placeholder: string }[] = [
  { id: "openrouter", name: "OpenRouter",  hint: "Free: 200 req/day",       url: "https://openrouter.ai/keys",       placeholder: "sk-or-v1-..." },
  { id: "nvidia",     name: "NVIDIA NIM",  hint: "Free: 1000 credits/mo",   url: "https://build.nvidia.com/",        placeholder: "nvapi-..."     },
];

export default function SettingsModal({ onClose, onSave }: Props) {
  const [provider, setProvider] = useState<Provider>(() => {
    if (typeof window === "undefined") return "openrouter";
    return (localStorage.getItem("slidemaker_provider") as Provider) || "openrouter";
  });
  const [key, setKey] = useState(() => {
    if (typeof window === "undefined") return "";
    const p = (localStorage.getItem("slidemaker_provider") as Provider) || "openrouter";
    return localStorage.getItem(`slidemaker_${p}_key`) || "";
  });
  const [useDefault, setUseDefault] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("slidemaker_use_default") === "true";
  });

  function handleProviderSwitch(p: Provider) {
    setProvider(p);
    setKey(typeof window !== "undefined" ? localStorage.getItem(`slidemaker_${p}_key`) || "" : "");
  }

  function save() {
    localStorage.setItem("slidemaker_provider", provider);
    localStorage.setItem("slidemaker_use_default", useDefault ? "true" : "false");
    if (key.trim()) {
      localStorage.setItem(`slidemaker_${provider}_key`, key.trim());
    } else {
      localStorage.removeItem(`slidemaker_${provider}_key`);
    }
    onSave();
  }

  const info = PROVIDERS.find(p => p.id === provider)!;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(10,30,31,0.55)", backdropFilter: "blur(6px)",
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 20,
        width: "100%", maxWidth: 460, margin: "0 20px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "22px 28px 18px",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Key size={16} color="var(--brand-primary)" />
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--brand-dark-3)" }}>BYOK — Bring Your Own Key</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex", alignItems: "center", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "28px 28px 8px" }}>

          {/* Provider selector */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)", marginBottom: 12 }}>
              Select AI Provider
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleProviderSwitch(p.id)}
                  style={{
                    padding: "14px 12px",
                    borderRadius: 12,
                    border: `2px solid ${provider === p.id ? "var(--brand-primary)" : "#B0C8CA"}`,
                    background: provider === p.id ? "var(--brand-light-5)" : "#fff",
                    color: provider === p.id ? "var(--brand-dark-2)" : "var(--muted)",
                    fontWeight: 700, fontSize: 15,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                  }}
                >
                  <span>{p.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: provider === p.id ? "var(--brand-dark-1)" : "var(--placeholder)" }}>
                    {p.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* API Key input */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)" }}>
                API Key (BYOK)
              </label>
              <a
                href={info.url} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--brand-primary)", textDecoration: "none", fontWeight: 600 }}
              >
                Get free key <ExternalLink size={11} />
              </a>
            </div>
            <input
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder={info.placeholder}
              style={{
                display: "block", width: "100%",
                padding: "13px 16px", fontSize: 14,
                border: `1.5px solid ${key ? "var(--brand-light-3)" : "#B0C8CA"}`,
                borderRadius: 10,
                background: key ? "var(--brand-light-5)" : "#fff",
                color: "var(--text)", outline: "none",
                fontFamily: "monospace", letterSpacing: "0.04em",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 7 }}>
              <p style={{ fontSize: 12, color: "var(--placeholder)", margin: 0 }}>
                Stored in your browser only · never sent to our servers
              </p>
              {key && (
                <button
                  onClick={() => setKey("")}
                  style={{ fontSize: 12, color: "#EF4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Use Default API toggle */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px", borderRadius: 10,
            background: useDefault ? "var(--brand-light-5)" : "#F8FAFC",
            border: `1px solid ${useDefault ? "var(--brand-light-3)" : "#E2E8F0"}`,
            marginBottom: 24, cursor: "pointer", transition: "all 0.2s",
          }}
            onClick={() => setUseDefault(v => !v)}
          >
            <span style={{ fontSize: 15, fontWeight: 600, color: useDefault ? "var(--brand-dark-3)" : "var(--muted)" }}>
              Use Default API
            </span>
            {/* Toggle pill */}
            <div style={{
              position: "relative", flexShrink: 0,
              width: 44, height: 24, borderRadius: 12,
              background: useDefault ? "var(--brand-primary)" : "#CBD5E1",
              transition: "background 0.2s",
            }}>
              <span style={{
                position: "absolute",
                top: 3, left: useDefault ? 22 : 3,
                width: 18, height: 18, borderRadius: 9,
                background: "#fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                transition: "left 0.2s",
                display: "block",
              }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0 28px 28px" }}>
          <button
            onClick={save}
            style={{
              width: "100%", padding: "15px", borderRadius: 12, border: "none",
              background: "var(--brand-dark-3)", color: "#fff",
              fontSize: 16, fontWeight: 700, cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
