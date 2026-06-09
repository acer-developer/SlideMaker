"use client";
import { Bot, Settings } from "lucide-react";

interface Props {
  onSettings: () => void;
  hasKey: boolean;
}

export default function Header({ onSettings, hasKey }: Props) {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 40,
      background: "#fff",
      borderBottom: "1px solid var(--border)",
      boxShadow: "0 1px 3px rgba(26,74,76,0.06)",
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto",
        padding: "0 clamp(24px, 5vw, 64px)", height: 72,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "var(--brand-dark-3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Bot size={17} color="var(--brand-light-3)" strokeWidth={2} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 21, color: "var(--brand-dark-3)", letterSpacing: "-0.01em" }}>
            SlideMaker
          </span>
        </div>

        {/* Preferences button */}
        <button
          onClick={onSettings}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "8px 18px", borderRadius: 10,
            border: `1.5px solid ${hasKey ? "var(--brand-primary)" : "#FECACA"}`,
            background: hasKey ? "var(--brand-light-5)" : "#FEF2F2",
            color: hasKey ? "var(--brand-dark-2)" : "#DC2626",
            fontSize: 14, fontWeight: 600, cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <Settings size={14} />
          BYOK
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: hasKey ? "var(--brand-primary)" : "#EF4444", flexShrink: 0 }} />
        </button>
      </div>
    </header>
  );
}

