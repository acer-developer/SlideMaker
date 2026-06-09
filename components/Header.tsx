"use client";
import { Layers } from "lucide-react";

export default function Header() {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 40,
      background: "#fff",
      borderBottom: "1px solid var(--border)",
      boxShadow: "0 1px 3px rgba(26,74,76,0.06)",
    }}>
      <div style={{
        maxWidth: 1000, margin: "0 auto",
        padding: "0 36px", height: 60,
        display: "flex", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "var(--brand-dark-3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Layers size={15} color="var(--brand-light-3)" strokeWidth={2} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--brand-dark-3)", letterSpacing: "-0.01em" }}>
            SlideMaker
          </span>
        </div>
      </div>
    </header>
  );
}
