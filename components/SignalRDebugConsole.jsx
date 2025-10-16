// app/kds-pro/components/SignalRDebugConsole.jsx
"use client";

import React from "react";

export default function SignalRDebugConsole({ initialOpen = false }) {
  const [open, setOpen] = React.useState(initialOpen);
  const [rows, setRows] = React.useState(() => {
    if (typeof window === "undefined") return [];
    return Array.isArray(window.__srlog) ? [...window.__srlog] : [];
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onLog = (e) => setRows((r) => [...r, e.detail]);
    window.addEventListener("srlog", onLog);
    return () => window.removeEventListener("srlog", onLog);
  }, []);

  const clear = () => {
    if (typeof window !== "undefined") window.__srlog = [];
    setRows([]);
  };

  return (
    <div
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 9999,
        width: open ? 420 : 48,
        height: open ? 280 : 48,
        background: "rgba(17,17,17,0.9)",
        color: "white",
        borderRadius: 12,
        boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
        overflow: "hidden",
        transition: "all .2s ease",
        backdropFilter: "blur(4px)",
      }}
      aria-live="polite"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          title={open ? "Collapse" : "Open console"}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
          }}
        >
          {open ? "▾" : "☰"}
        </button>
        {open ? (
          <>
            <strong style={{ fontSize: 12, opacity: 0.9 }}>
              SignalR Console
            </strong>
            <div style={{ flex: 1 }} />
            <button
              onClick={clear}
              title="Clear"
              style={{
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
              }}
            >
              Clear
            </button>
          </>
        ) : null}
      </div>

      {open ? (
        <div
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 11,
            height: "calc(100% - 44px)",
            overflow: "auto",
            padding: 8,
            lineHeight: 1.2,
          }}
        >
          {rows.length === 0 ? (
            <div style={{ opacity: 0.6 }}>No entries yet…</div>
          ) : (
            rows.slice(-300).map((r, i) => (
              <div
                key={`${i}-${r.ts}`}
                style={{
                  marginBottom: 6,
                  paddingBottom: 6,
                  borderBottom: "1px dashed rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ opacity: 0.65 }}>
                  {r.ts} · <b>{r.level.toUpperCase()}</b> · {r.ns}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{String(r.msg)}</div>
                {r.data ? (
                  <pre
                    style={{
                      margin: 0,
                      marginTop: 4,
                      padding: 6,
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: 6,
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(r.data, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
