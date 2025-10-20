// app/kds-pro/components/Toast.jsx
"use client";

import React from "react";
import { toast } from "sonner";

/**
 * Toast (visual only). Prefer using showActionToast() below to emit one.
 *
 * Props:
 * - message: string
 * - action?: string (fine-grained event key, e.g. "order.complete")
 * - variant?: "success" | "warning" | "error" | "info" (fallback if no action)
 * - major?: boolean (adds emphasis border/scale)
 *
 * Color mapping by action:
 * - settings / filters -> indigo (Color 1)
 * - order.start/mark   -> sky
 * - order.complete     -> emerald
 * - order.revert       -> violet
 * - order.undo         -> slate
 * - order.item.checked -> green
 * - order.item.cancelled -> red
 * - order.item.toggle (generic) -> fuchsia
 * - order.time.changed (ETA) -> amber (Color 3)
 * - order.update (generic) -> blue
 */
export function Toast({ message, action, variant, major }) {
  const norm = String(action || "")
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[_-]/g, ".");

  const getActionClass = () => {
    // Color 1 — settings / filters
    if (
      norm === "settings.changed" ||
      norm === "filters.changed" ||
      norm === "settings" ||
      norm === "filters"
    ) {
      return "bg-indigo-600 text-white border-indigo-500";
    }
    // Order life-cycle
    if (
      norm === "order.start" ||
      norm === "order.mark" ||
      norm === "order.marked"
    ) {
      return "bg-sky-600 text-white border-sky-500";
    }
    if (norm === "order.complete" || norm === "order.completed") {
      return "bg-emerald-600 text-white border-emerald-500";
    }
    if (norm === "order.revert" || norm === "order.reverted") {
      return "bg-violet-600 text-white border-violet-500";
    }
    if (norm === "order.undo" || norm === "order.undone") {
      return "bg-slate-700 text-white border-slate-600";
    }
    // Item-level
    if (norm === "order.item.checked" || norm === "item.checked") {
      return "bg-green-600 text-white border-green-500";
    }
    if (norm === "order.item.cancelled" || norm === "item.cancelled") {
      return "bg-red-600 text-white border-red-500";
    }
    if (norm === "order.item.toggle" || norm === "item.toggle") {
      return "bg-fuchsia-600 text-white border-fuchsia-500";
    }
    // Time / ETA — Color 3
    if (
      norm === "order.time.changed" ||
      norm === "eta.changed" ||
      norm === "time.changed"
    ) {
      return "bg-amber-500 text-black border-amber-500";
    }
    // Generic order update
    if (
      norm === "order.update" ||
      norm === "order.updated" ||
      norm === "order"
    ) {
      return "bg-blue-600 text-white border-blue-500";
    }
    return "";
  };

  const getVariantClass = () => {
    switch (variant) {
      case "success":
        return "bg-emerald-600 text-white border-emerald-500";
      case "warning":
        return "bg-amber-500 text-black border-amber-500";
      case "error":
        return "bg-red-600 text-white border-red-500";
      case "info":
      default:
        return "bg-blue-600 text-white border-blue-500";
    }
  };

  const toneClass = getActionClass() || getVariantClass();

  return (
    <div
      className={`px-5 py-3.5 rounded-lg shadow-lg font-bold text-sm animate-in slide-in-from-right ${
        major ? "scale-105 border-2" : ""
      } ${toneClass}`}
    >
      {message}
    </div>
  );
}

/**
 * Fire a toast with action-based coloring.
 *
 * @param {object} opts
 * @param {string} opts.action  e.g. "order.complete", "order.start", "order.item.checked", "order.time.changed", "settings.changed"
 * @param {string} opts.message The message to display
 * @param {boolean} [opts.major] Emphasis ring/scale
 * @param {"success"|"warning"|"error"|"info"} [opts.variant] Fallback if no action matches
 */
export function showActionToast({
  action,
  message,
  major = false,
  variant = "info",
}) {
  toast.custom(() => (
    <Toast action={action} message={message} major={major} variant={variant} />
  ));
}
