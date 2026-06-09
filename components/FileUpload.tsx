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

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function clearFile() {
    onDataChange("", null);
    setTab("paste");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          Data <span style={{ color: "#EF4444" }}>*</span>
        </label>
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {(["paste", "upload"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-2.5 py-1 text-xs font-medium"
              style={{
                background: tab === t ? "var(--brand-dark-3)" : "#fff",
                color: tab === t ? "#fff" : "var(--muted)",
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
          className="w-full rounded-xl px-3 py-2.5 text-xs outline-none resize-y font-mono leading-relaxed"
          style={{
            border: `1.5px solid ${dataRaw ? "var(--brand-light-3)" : "#B0C8CA"}`,
            background: dataRaw ? "var(--brand-light-5)" : "#fff",
            color: "var(--text)",
            minHeight: "110px",
          }}
        />
      ) : (
        <div>
          {fileName ? (
            <div
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl"
              style={{ background: "var(--brand-light-5)", border: "1.5px solid var(--brand-primary)" }}
            >
              <div className="flex items-center gap-2">
                <FileText size={14} style={{ color: "var(--brand-primary)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--brand-dark-2)" }}>{fileName}</span>
              </div>
              <button onClick={clearFile} style={{ color: "var(--muted)" }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-7 cursor-pointer"
              style={{
                border: `2px dashed ${dragging ? "var(--brand-primary)" : "#B0C8CA"}`,
                background: dragging ? "var(--brand-light-5)" : "#FAFEFE",
              }}
            >
              <UploadCloud size={22} style={{ color: dragging ? "var(--brand-primary)" : "var(--brand-light-2)" }} />
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Drop file or <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>browse</span>
              </p>
              <p className="text-xs" style={{ color: "var(--placeholder)" }}>CSV, Excel (.xlsx), TXT</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={onFileInput} />
        </div>
      )}
    </div>
  );
}
