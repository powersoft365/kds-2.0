"use client";

import React from "react";
import { Button } from "@/components/ui/button";

export function SidebarSkeleton({ sidebarOpen, setSidebarOpen, t = (s) => s }) {
  return (
    <aside
      className={`transition-all border-r bg-gradient-to-b from-background to-muted/20 ${
        sidebarOpen ? "w-[320px]" : "w-[72px]"
      } h-full overflow-hidden flex flex-col shadow-lg`}
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        {sidebarOpen && (
          <div
            className="h-5 w-24 rounded bg-muted animate-pulse"
            aria-hidden
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen((o) => !o)}
          className="shrink-0 rounded-full"
          aria-label="Toggle sidebar"
        >
          <span className="sr-only">toggle</span>
          <div className="w-5 h-5 rounded-full bg-muted" />
        </Button>
      </div>

      <div className="p-4 space-y-3 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="h-9 rounded bg-muted animate-pulse" />
        ))}
      </div>
    </aside>
  );
}
