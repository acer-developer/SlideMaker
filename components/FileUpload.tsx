"use client";
import { useRef, useState } from "react";
import { UploadCloud, FileText, X } from "lucide-react";

interface Props {
  fileName: string | null;
  dataRaw: string;
  onDataChange: (data: string, fileName: string | null) => void;
}

export default function FileUpload({ fileName, dataRaw, onDataChange }: Props) {
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<"paste" | "upload">(fileName ? "upload" : "paste");
  const fileRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    const name = file.name;
    if (file.name.endsWith(".csv") || file.type === "text/csv" || file.type === "text/plain") {
      const text = await file.text();
      onDataChange(text, name);
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      const arrayBuffer = await file.arrayBuffer();
      const { read, utils } = await import("xlsx");
      const wb = read(arrayBuffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const csv = utils.sheet_to_csv(ws);
      onDataChange(csv, name);
    } else {
      const text = await file.text();
      onDataChange(text, name);
    }
    setTab("upload");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function clearFile() {
    onDataChange("", null);
    setTab("paste");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      {/* Label row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <label style={{ fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
          Data <span style={{ color: "#EF4444" }}>*</span>
        </label>
        <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          {(["paste", "upload"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "4px 12px",
                fontSize: 17,
                fontWeight: 600,
                background: tab === t ? "var(--brand-dark-3)" : "#fff",
                color: tab === t ? "#fff" : "var(--muted)",
                border: "none",
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              {t === "paste" ? "Paste" : "Upload"}
            </button>
          ))}
        </div>
      </div>

      {tab === "paste" ? (
        <textarea
          placeholder={"Paste CSV, table, or raw data here\n\nExample:\nMonth, Revenue\nJan, 120000\nFeb, 145000"}
          value={dataRaw}
          onChange={e => onDataChange(e.target.value, null)}
          rows={5}
          style={{
            display: "block",
            width: "100%",
            minHeight: 150,
            padding: "14px 16px",
            fontSize: 17,
            fontFamily: "monospace",
            lineHeight: 1.7,
            border: `1.5px solid ${dataRaw ? "var(--brand-light-3)" : "#B0C8CA"}`,
            borderRadius: 10,
            background: dataRaw ? "var(--brand-light-5)" : "#fff",
            color: "var(--text)",
            outline: "none",
            resize: "vertical",
          }}
        />
      ) : (
        <div>
          {fileName ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", borderRadius: 10,
              background: "var(--brand-light-5)", border: "1.5px solid var(--brand-primary)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={14} style={{ color: "var(--brand-primary)" }} />
                <span style={{ fontSize: 17, fontWeight: 500, color: "var(--brand-dark-2)" }}>{fileName}</span>
              </div>
              <button onClick={clearFile} style={{ color: "var(--muted)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 8, padding: "40px 16px",
                border: `2px dashed ${dragging ? "var(--brand-primary)" : "#B0C8CA"}`,
                borderRadius: 10,
                background: dragging ? "var(--brand-light-5)" : "#FAFEFE",
                cursor: "pointer",
              }}
            >
              <UploadCloud size={22} style={{ color: dragging ? "var(--brand-primary)" : "var(--brand-light-2)" }} />
              <p style={{ fontSize: 17, color: "var(--muted)", margin: 0 }}>
                Drop file or <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>browse</span>
              </p>
              <p style={{ fontSize: 17, color: "var(--placeholder)", margin: 0 }}>CSV, Excel (.xlsx), TXT</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
        </div>
      )}
    </div>
  );
}

