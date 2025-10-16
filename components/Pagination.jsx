// app/kds-pro/components/Pagination.jsx
"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";

/** Build a compact number range like: 1 … 6 7 [8] 9 10 … 20 */
function makeRange(total, current) {
  const maxButtons = 9;
  if (total <= maxButtons)
    return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([
    1,
    2,
    total - 1,
    total,
    current - 2,
    current - 1,
    current,
    current + 1,
    current + 2,
  ]);

  const arr = Array.from(pages)
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);

  const withDots = [];
  for (let i = 0; i < arr.length; i++) {
    withDots.push(arr[i]);
    if (i < arr.length - 1 && arr[i + 1] > arr[i] + 1) withDots.push("…");
  }
  return withDots;
}

export function Pagination({
  totalPages,
  currentPage,
  setCurrentPage, // optional if you prefer onPrev/onNext/onJump
  onPrev,
  onNext,
  onJump,
}) {
  const total = Math.max(1, Number(totalPages) || 1);
  const current = Math.max(1, Math.min(total, Number(currentPage) || 1));
  const range = useMemo(() => makeRange(total, current), [total, current]);

  const scrollerRef = useRef(null);

  const jump = (n) => {
    if (typeof n !== "number") return;
    if (onJump) onJump(n);
    else if (setCurrentPage) setCurrentPage(n);
  };

  const prev = () => {
    if (onPrev) onPrev();
    else if (setCurrentPage) setCurrentPage(Math.max(1, current - 1));
  };

  const next = () => {
    if (onNext) onNext();
    else if (setCurrentPage) setCurrentPage(Math.min(total, current + 1));
  };

  // Center the active page button inside the horizontal scroller when it overflows
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const activeBtn = scroller.querySelector('button[aria-current="page"]');
    if (!activeBtn) return;

    const desired =
      activeBtn.offsetLeft -
      (scroller.clientWidth / 2 - activeBtn.clientWidth / 2);

    scroller.scrollTo({
      left: Math.max(0, desired),
      behavior: "smooth",
    });
  }, [current, total, range.length]);

  return (
    <footer
      className="sticky bottom-0 z-20 border-t bg-background p-2 md:p-3"
      aria-label="Pagination"
    >
      {/* wrapper centers the whole control when it fits */}
      <div className="w-full flex justify-center">
        {/* horizontal scroller (centers content when it doesn't overflow) */}
        <div
          ref={scrollerRef}
          className="
            w-full max-w-[min(960px,100%)] overflow-x-auto overscroll-x-contain
            scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent
            [scrollbar-width:thin]
          "
          tabIndex={0}
        >
          {/* IMPORTANT: block-level flex with w-fit + mx-auto truly centers content */}
          <div className="flex items-center gap-1 md:gap-2 whitespace-nowrap px-1 w-fit mx-auto">
            <Button
              variant="secondary"
              onClick={prev}
              className="px-3 shrink-0"
              aria-label="Previous page"
            >
              Prev
            </Button>

            {range.map((n, idx) =>
              n === "…" ? (
                <span
                  key={`dots-${idx}`}
                  className="px-2 text-muted-foreground select-none shrink-0"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <Button
                  key={n}
                  variant={n === current ? "default" : "secondary"}
                  onClick={() => jump(n)}
                  className="px-3 shrink-0"
                  aria-current={n === current ? "page" : undefined}
                  aria-label={`Go to page ${n}`}
                >
                  {n}
                </Button>
              )
            )}

            <Button
              variant="secondary"
              onClick={next}
              className="px-3 shrink-0"
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* iOS safe area padding */}
      <div className="pb-[env(safe-area-inset-bottom)]" />
    </footer>
  );
}
