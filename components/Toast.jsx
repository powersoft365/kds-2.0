// app/kds-pro/components/Toast.jsx
"use client";

import React from "react";

export function Toast({ message, variant, major }) {
  const getVariantClass = () => {
    switch (variant) {
      case "success":
        return "bg-emerald-600 text-white border-emerald-500";
      case "warning":
        return "bg-amber-500 text-black border-amber-500";
      case "error":
        return "bg-red-600 text-white border-red-500";
      default:
        return "bg-blue-600 text-white border-blue-500";
    }
  };

  return (
    <div
      className={`px-5 py-3.5 rounded-lg shadow-lg font-bold text-sm animate-in slide-in-from-right ${
        major ? "scale-105 border-2" : ""
      } ${getVariantClass()}`}
    >
      {message}
    </div>
  );
}
