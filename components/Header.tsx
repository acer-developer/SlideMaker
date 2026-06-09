"use client";
import { Layers } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 flex items-center px-6 py-3.5"
      style={{ background: "#fff", borderBottom: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg"
          style={{ background: "var(--brand-dark-3)" }}>
          <Layers size={15} color="var(--brand-light-3)" strokeWidth={2} />
        </div>
        <span className="font-bold text-base tracking-tight" style={{ color: "var(--brand-dark-3)" }}>
          SlideMaker
        </span>
      </div>
    </header>
  );
}
