"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/* Media query helper */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);
  return matches;
}

/**
 * Sidebar with expandable department sections.
 * ✅ Shows only selected departments (multi-select supported)
 * ✅ Items sorted alphabetically
 * ✅ Department names displayed properly
 */
export function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  totalsByDept,
  t,
  onItemClick, // function(name)
  selectedDepts = [], // multi-select from header
  departmentMap = new Map(), // internal map (code hidden)
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [expandedDepts, setExpandedDepts] = useState({});

  // ✅ Filter departments by selectedDepts
  const filteredTotals = useMemo(() => {
    if (!totalsByDept || typeof totalsByDept !== "object") return {};
    if (selectedDepts.includes("All")) return totalsByDept;
    const subset = {};
    for (const dept of selectedDepts) {
      if (totalsByDept[dept]) {
        subset[dept] = totalsByDept[dept];
      }
    }
    return subset;
  }, [totalsByDept, selectedDepts]);

  // ✅ Sort departments alphabetically, and their items alphabetically
  const deptEntries = useMemo(() => {
    const entries = Object.entries(filteredTotals || {});
    entries.sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { sensitivity: "base" })
    );
    return entries.map(([dept, items]) => {
      const sortedItems = Object.fromEntries(
        Object.entries(items || {}).sort((a, b) =>
          a[0].localeCompare(b[0], undefined, { sensitivity: "base" })
        )
      );
      return [dept, sortedItems];
    });
  }, [filteredTotals]);

  // expand all on desktop, collapse by default on mobile
  useEffect(() => {
    const init = {};
    deptEntries.forEach(([dept]) => {
      init[dept] = isDesktop;
    });
    setExpandedDepts(init);
  }, [deptEntries, isDesktop]);

  const toggleDeptExpand = (dept) =>
    setExpandedDepts((p) => ({ ...p, [dept]: !p[dept] }));

  const fmtQty = (q) => {
    const n = Number(q);
    if (Number.isNaN(n)) return String(q);
    return n % 1 === 0 ? n.toString() : n.toFixed(2);
  };

  // Overlay for mobile
  const Overlay =
    !isDesktop && sidebarOpen ? (
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
    ) : null;

  // Mobile launcher when closed
  const MobileLauncher =
    !isDesktop && !sidebarOpen ? (
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open totals"
        className="fixed z-30 left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg border border-primary/40 flex items-center justify-center active:scale-95"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    ) : null;

  const asideBase =
    "bg-gradient-to-b from-background to-muted/20 border-r flex flex-col shadow-lg";
  const asideDesktop =
    "relative h-full min-h-0 transition-all " +
    (sidebarOpen ? "w-[320px]" : "w-[72px]");
  const asideMobile =
    "fixed z-50 top-0 left-0 h-[100dvh] min-h-0 w-[86vw] max-w-[360px] transition-transform duration-300 " +
    (sidebarOpen ? "translate-x-0" : "-translate-x-full");

  return (
    <>
      {Overlay}
      {MobileLauncher}

      <aside
        className={`${asideBase} ${isDesktop ? asideDesktop : asideMobile}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          {(isDesktop ? sidebarOpen : true) && (
            <h2 className="font-extrabold text-lg tracking-wide bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {t ? t("totals") : "TOTALS"}
            </h2>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen((o) => !o)}
            className="shrink-0 rounded-full hover:bg-accent"
            aria-label={sidebarOpen ? "Collapse totals" : "Expand totals"}
          >
            {sidebarOpen ? (
              <ChevronLeft className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 lg:p-4">
          {deptEntries.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              No totals to show.
            </div>
          ) : (
            <div className="space-y-4">
              {deptEntries.map(([dept, items]) => {
                const expanded =
                  (isDesktop ? sidebarOpen : true) && expandedDepts[dept];

                return (
                  <div key={dept} className="group">
                    {/* Department header */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleDeptExpand(dept);
                      }}
                      className={`w-full rounded-lg px-3 py-2.5 flex items-center justify-between transition
                        ${
                          isDesktop && !sidebarOpen
                            ? "bg-transparent hover:bg-muted/40"
                            : "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm hover:opacity-90"
                        }`}
                      aria-expanded={!!expanded}
                      title={dept}
                    >
                      {/* ✅ Show proper department name */}
                      <span
                        className={`font-bold truncate ${
                          isDesktop && !sidebarOpen
                            ? "text-foreground"
                            : "text-white"
                        }`}
                      >
                        {dept}
                      </span>

                      <span
                        className={`inline-flex items-center justify-center h-6 min-w-[1.75rem] rounded-full text-xs font-bold tabular-nums
                          ${
                            isDesktop && !sidebarOpen
                              ? "bg-muted text-foreground"
                              : "bg-white/20 text-white"
                          }`}
                      >
                        {Object.keys(items || {}).length}
                      </span>
                    </button>

                    {/* Items list */}
                    {isDesktop && !sidebarOpen ? null : (
                      <div
                        className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
                          expanded
                            ? "opacity-100 max-h-[600px]"
                            : "opacity-0 max-h-0"
                        }`}
                      >
                        <ul className="mt-3 space-y-2.5">
                          {Object.entries(items).map(([name, qty]) => (
                            <li key={`${dept}-${name}`} className="px-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (typeof onItemClick === "function") {
                                    onItemClick(name);
                                  }
                                }}
                                title={name}
                                className="w-full grid grid-cols-[1fr_auto] items-center gap-3 text-sm px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                              >
                                <span className="truncate font-medium">
                                  {name}
                                </span>
                                <span className="font-bold tabular-nums text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                                  {fmtQty(qty)}x
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
