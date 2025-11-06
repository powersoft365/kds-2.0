"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  Maximize2,
  Check,
  X,
  Clock,
  Undo2,
  ChevronRight,
  PlusSquare,
  MinusCircle,
  Loader2,
  Info,
} from "lucide-react";
import { getItemNote, getItemsNotesMap } from "@/lib/api";
import { showActionToast } from "@/components/Toast";

/**
 * Parse date string to Date object safely
 */
function parseDate(input) {
  if (!input) return null;
  if (typeof input === "number") return new Date(input);
  if (typeof input !== "string") return null;
  const isoLike = input.trim().replace(" ", "T");
  const date = new Date(isoLike);
  if (!isNaN(date.getTime())) return date;
  const fallback = new Date(input);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Format order creation time to readable time format
 */
function formatOrderTime(createdAt, locale = "en-US") {
  const date = parseDate(createdAt);
  if (!date) return "";
  return date
    .toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s/g, "");
}

/**
 * Main OrderCard component that displays individual order information
 */
export function OrderCard({
  order,
  toggleItemState,
  onPrimaryAction,
  onUndoAction,
  onRevertAction,
  setEtaDialog,
  setOrderDialog,
  t = (s) => s,
  calcSubStatus,
  actionLabelAndClass,
  statusBorder,
  triBoxCls,
  selectedDepts,
  isDragging = false,
  dragHandleProps = {},
}) {
  // Calculate the current substatus of the order
  const sub = calcSubStatus(order);

  // Get the label and CSS class for the primary action button
  const { label: actionText = "Action", cls: actionClass = "" } =
    actionLabelAndClass(order) || {};

  // Check if order is marked as completed in the UI
  const isCompleted = order.status === "completed";

  // Check if order is currently being cooked
  const isCooking = !!order.cooking && !isCompleted;

  // Check if all items in the order are checked (ready to complete)
  const readyToComplete = React.useMemo(
    () =>
      Array.isArray(order.items) &&
      order.items.length > 0 &&
      order.items.every((i) => i.itemStatus === "checked"),
    [order.items]
  );

  // FIX: Check if order has system status of APPROVED or REJECTED to show Undo button
  const hasApprovedOrRejectedSystemStatus =
    order.systemStatus === "APPROVED" || order.systemStatus === "REJECTED";

  // Ref to access the root DOM element of this component
  const rootRef = React.useRef(null);

  // State to track if this card is rendered inside a dialog/modal
  const [insideDialog, setInsideDialog] = React.useState(false);

  // Effect to detect if this component is inside a dialog
  React.useEffect(() => {
    try {
      const el = rootRef.current;
      if (!el) return;
      setInsideDialog(!!el.closest('[role="dialog"]'));
    } catch {
      setInsideDialog(false);
    }
  }, []);

  /* ---------- Slide-to-Undo Functionality ---------- */

  const [undoOpen, setUndoOpen] = React.useState(false);
  const [undoVal, setUndoVal] = React.useState([0]);

  const openUndo = () => {
    setUndoVal([0]);
    setUndoOpen(true);
  };

  const closeUndo = () => setUndoOpen(false);

  const commitUndo = (v) => {
    const n = Array.isArray(v) ? v[0] : v;
    if (n >= 100) {
      onUndoAction && onUndoAction(order);
      showActionToast({
        action: "order.undo",
        message: `Order #${order.id} moved back to Active`,
        major: true,
      });
      setTimeout(() => closeUndo(), 150);
    }
  };

  /* ---------- Slide-to-Revert Functionality ---------- */

  const [revertOpen, setRevertOpen] = React.useState(false);
  const [revertVal, setRevertVal] = React.useState([0]);

  const openRevert = () => {
    setRevertVal([0]);
    setRevertOpen(true);
  };

  const closeRevert = () => setRevertOpen(false);

  const commitRevert = (v) => {
    const n = Array.isArray(v) ? v[0] : v;
    if (n >= 100) {
      onRevertAction && onRevertAction(order);
      showActionToast({
        action: "order.revert",
        message: `Order #${order.id} reverted to Not Started`,
        major: true,
      });
      setTimeout(() => closeRevert(), 150);
    }
  };

  /* ---------- Items Grouped by Department ---------- */

  const itemsByDept = (order.items || []).reduce((acc, it) => {
    const d = it.dept || "General";
    (acc[d] ||= []).push(it);
    return acc;
  }, {});

  const itemsByDeptSorted = React.useMemo(() => {
    const out = {};
    Object.entries(itemsByDept).forEach(([dept, items]) => {
      const sorted = [...items].sort((a, b) =>
        String(a.name || "")
          .toLowerCase()
          .localeCompare(String(b.name || "").toLowerCase())
      );
      out[dept] = sorted;
    });
    return out;
  }, [itemsByDept]);

  const filteredItemsByDept = React.useMemo(() => {
    if (!Array.isArray(selectedDepts) || selectedDepts.includes("All"))
      return itemsByDeptSorted;

    const filtered = {};
    for (const [dept, items] of Object.entries(itemsByDeptSorted)) {
      if (selectedDepts.includes(dept)) filtered[dept] = items;
    }

    if (
      Object.keys(filtered).length === 0 &&
      Object.keys(itemsByDeptSorted).length
    ) {
      const firstDept = Object.keys(itemsByDeptSorted)[0];
      filtered[firstDept] = [];
    }

    return filtered;
  }, [itemsByDeptSorted, selectedDepts]);

  /**
   * Get CSS classes for status badge based on status value
   * FIX: Show REJECTED with red badge and APPROVED with green badge
   */
  const subStatusBadge = (val) => {
    if (!val) return "";
    const base = "px-2.5 py-1 rounded-full text-xs font-bold";

    // FIX: Handle REJECTED and APPROVED system statuses
    if (order.systemStatus === "REJECTED")
      return `${base} bg-red-600 text-white`;
    if (order.systemStatus === "APPROVED")
      return `${base} bg-emerald-600 text-white`;

    // Handle UI statuses
    if (val === "delayed") return `${base} bg-red-600 text-white`;
    if (val === "on-hold") return `${base} bg-violet-600 text-white`;
    if (val === "cooking") return `${base} bg-amber-600 text-white`;
    if (val === "completed") return `${base} bg-emerald-600 text-white`;
    return `${base} bg-slate-600 text-white`;
  };

  /* ---------- Countdown Timer Functionality ---------- */

  const [startedAtMs, setStartedAtMs] = React.useState(() => {
    if (order.cookingStartedAt)
      return typeof order.cookingStartedAt === "number"
        ? order.cookingStartedAt
        : Date.parse(order.cookingStartedAt);
    return null;
  });

  React.useEffect(() => {
    if (isCooking && !startedAtMs) {
      setStartedAtMs(Date.now());
    }
  }, [isCooking, startedAtMs]);

  const etaMin = Math.max(0, Number(order.eta || 0));
  const totalMs = Math.max(1, etaMin * 60_000);

  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = (() => {
    if (!startedAtMs || !isCooking) return totalMs;
    const due = startedAtMs + totalMs;
    return due - now;
  })();

  const fmt = (ms) => {
    const neg = ms < 0;
    const s = Math.abs(Math.ceil(ms / 1000));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const body =
      hh > 0
        ? `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
        : `${mm}:${String(ss).padStart(2, "0")}`;
    return neg ? `-${body}` : body;
  };

  const pctLeft = Math.max(0, Math.min(1, remainingMs / totalMs));

  const countdownTone =
    remainingMs < 0
      ? "text-red-600"
      : pctLeft >= 0.5
      ? "text-emerald-600"
      : pctLeft >= 0.2
      ? "text-amber-600"
      : "text-red-600";

  const overdue =
    remainingMs < 0 ? (
      <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white animate-pulse">
        OVERDUE
      </span>
    ) : null;

  const handlePrimaryClick = () => {
    if (isCooking && !readyToComplete) {
      openRevert();
      return;
    }

    if (readyToComplete) {
      showActionToast({
        action: "order.complete",
        message: `Order #${order.id} completed`,
        major: true,
      });
    } else {
      showActionToast({
        action: "order.start",
        message: `Order #${order.id} started cooking`,
      });
    }
    console.log("order happen", order);
    onPrimaryAction && onPrimaryAction(order);
  };

  /**
   * FIX: Determine border color based on system status
   * REJECTED = red border, APPROVED = green border
   */
  const borderCls = (() => {
    // First check system status for history tab orders
    if (order.systemStatus === "REJECTED") return "border-red-600";
    if (order.systemStatus === "APPROVED") return "border-emerald-600";

    // Then check UI status for active tab orders
    if (sub === "delayed" || remainingMs < 0) return "border-red-600";
    return statusBorder(order);
  })();

  const handleItemClick = (e, orderId, itemId) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (isCompleted) return;
    const target = e.target;
    if (target?.closest?.('[data-stop-item-click="true"]')) return;
    toggleItemState(orderId, itemId);
  };

  /* ---------- Item Notes Functionality ---------- */

  const [notesOpen, setNotesOpen] = React.useState(false);
  const [notesLoading, setNotesLoading] = React.useState(false);
  const [notesError, setNotesError] = React.useState("");
  const [notesText, setNotesText] = React.useState("");
  const [notesItemName, setNotesItemName] = React.useState("");

  const notesCacheRef = React.useRef(new Map());
  const [notesAvailable, setNotesAvailable] = React.useState(() => new Set());

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const codes = (order.items || [])
          .map((it) => it.itemCode365)
          .filter(Boolean);

        if (codes.length === 0) {
          if (alive) setNotesAvailable(new Set());
          return;
        }

        const map = await getItemsNotesMap(codes);
        if (!alive) return;

        const nextSet = new Set();
        for (const [code, note] of map.entries()) {
          const text = String(note || "").trim();
          if (text.length > 0) {
            nextSet.add(code);
            notesCacheRef.current.set(code, text);
          }
        }
        setNotesAvailable(nextSet);
      } catch {
        setNotesAvailable(new Set());
      }
    })();

    return () => {
      alive = false;
    };
  }, [order.items]);

  const openNotesForItem = async (item) => {
    setNotesItemName(item.name || "");
    const code = item.itemCode365 || "";
    setNotesText("");
    setNotesError("");
    setNotesOpen(true);

    if (!code) {
      setNotesError("No item code available for this line.");
      return;
    }

    if (!notesAvailable.has(code)) {
      setNotesText("");
      return;
    }

    const cached = notesCacheRef.current.get(code);
    if (typeof cached === "string") {
      setNotesText(cached);
      return;
    }

    try {
      setNotesLoading(true);
      const note = await getItemNote(code);
      const safe = String(note || "");
      notesCacheRef.current.set(code, safe);
      setNotesText(safe);
    } catch (e) {
      setNotesError(e?.message || "Failed to load notes.");
    } finally {
      setNotesLoading(false);
    }
  };

  /* ---------- Render ---------- */

  const orderTime = formatOrderTime(order.createdAt);

  /**
   * FIX: Get display text for status badge
   * Show REJECTED/APPROVED for system status, otherwise use UI status
   */
  const getStatusDisplayText = () => {
    if (order.systemStatus === "REJECTED") return "REJECTED";
    if (order.systemStatus === "APPROVED") return "APPROVED";
    return sub ? sub.toUpperCase() : "";
  };

  return (
    <>
      <div
        ref={rootRef}
        className={`${
          isDragging
            ? "opacity-50 rotate-2 scale-105 transition-all duration-200"
            : "transition-all duration-200"
        }`}
        {...dragHandleProps}
      >
        <Card
          className={`h-full border-t-8 ${borderCls} ${
            sub === "on-hold" ? "shadow-[0_0_25px_rgba(139,92,246,0.6)]" : ""
          } hover:shadow-lg transition-all duration-200 grid grid-rows-[auto_1fr_auto] overflow-hidden ${
            isDragging
              ? "shadow-2xl border-blue-500 ring-2  ring-blue-400"
              : "cursor-grab active:cursor-grabbing"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between bg-muted/50 py-3">
            <div className="space-y-0.5">
              <div className="font-extrabold text-xs tracking-tight flex items-center gap-2">
                <span>#{order.id}</span>
                {orderTime && (
                  <span className="text-muted-foreground font-normal">
                    {orderTime}
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {order._raw?.invoice_header?.table_number && (
                  <>Table: {order._raw.invoice_header.table_number}</>
                )}
              </div>
            </div>
            {/* FIX: Show status badge with proper system status text */}
            {getStatusDisplayText() ? (
              <span className={subStatusBadge(sub)}>
                {getStatusDisplayText()}
              </span>
            ) : null}
          </CardHeader>

          <CardContent className="pt-4 pb-2 flex-1">
            <div className="relative h-[300px] overflow-y-auto pr-1">
              {Object.entries(filteredItemsByDept || {}).map(
                ([dept, items]) => (
                  <div key={dept} className="mb-3">
                    <div className="font-bold text-base border-b pb-1 mb-2">
                      {dept}
                    </div>
                    <ul className="space-y-2">
                      {Array.isArray(items) && items.length === 0 ? (
                        <li className="text-sm text-muted-foreground italic">
                          No items for this department
                        </li>
                      ) : (
                        (Array.isArray(items) ? items : []).map((it, index) => {
                          const isChecked = it.itemStatus === "checked";
                          const isCancelled = it.itemStatus === "cancelled";
                          const mods = Array.isArray(it.mods) ? it.mods : [];
                          const hasNotes =
                            !!it.itemCode365 &&
                            notesAvailable.has(it.itemCode365);

                          return (
                            <li
                              key={`${order.id}-${dept}-${it.id || index}`}
                              className="grid grid-cols-[auto_auto_1fr_auto] gap-3 items-center pb-2 border-b last:border-0 rounded transition-colors select-none"
                              onClick={(e) =>
                                handleItemClick(e, order.id, it.id)
                              }
                            >
                              <div className={triBoxCls(it.itemStatus)}>
                                {isChecked ? (
                                  <Check className="w-4 h-4" />
                                ) : isCancelled ? (
                                  <X className="w-4 h-4" />
                                ) : null}
                              </div>
                              <div className="font-extrabold text-lg md:text-xl">
                                {it.qty}x
                              </div>
                              <div className="min-w-0">
                                <div
                                  className={`font-bold text-base md:text-lg truncate ${
                                    it.itemStatus !== "none"
                                      ? "line-through text-muted-foreground"
                                      : ""
                                  }`}
                                >
                                  {it.name}
                                </div>
                                <div
                                  className={`text-xs md:text-sm mt-1 ${
                                    isCancelled
                                      ? "line-through text-red-600"
                                      : isChecked
                                      ? "line-through text-muted-foreground"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {mods.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                      {mods.map((m, modIndex) => {
                                        let icon = null;
                                        let bgColor = "bg-gray-100";
                                        if (
                                          typeof m === "object" &&
                                          m.modifier_prefix
                                        ) {
                                          const prefix =
                                            m.modifier_prefix.toLowerCase();
                                          if (prefix === "plus") {
                                            icon = (
                                              <PlusSquare className="w-4 h-4 inline mr-1 text-green-600" />
                                            );
                                            bgColor = "bg-green-50";
                                          } else if (prefix === "no") {
                                            icon = (
                                              <MinusCircle className="w-4 h-4 inline mr-1 text-red-600" />
                                            );
                                            bgColor = "bg-red-50";
                                          }
                                        }
                                        const displayText =
                                          m.modifier_name || String(m);
                                        return (
                                          <span
                                            key={`mod-${modIndex}`}
                                            className={`inline-flex items-center p-1 font-semibold rounded-md ${bgColor} text-md`}
                                          >
                                            {icon}
                                            {displayText}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center">
                                {hasNotes ? (
                                  <button
                                    type="button"
                                    title="View notes"
                                    aria-label="View notes"
                                    data-stop-item-click="true"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openNotesForItem(it);
                                    }}
                                    className="inline-flex items-center justify-center rounded-md border border-muted-foreground/30 hover:bg-white/5 h-8 w-8"
                                  >
                                    <Info className="w-4 h-4" />
                                  </button>
                                ) : null}
                              </div>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                )
              )}
            </div>
          </CardContent>

          <CardFooter className="p-0">
            <div className="bg-muted/50 w-full p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEtaDialog &&
                      setEtaDialog({ open: true, orderId: order.id });
                    showActionToast({
                      action: "order.time.changed",
                      message: `Adjust ETA for #${order.id}`,
                      variant: "info",
                    });
                  }}
                  className="inline-flex items-center justify-center md:justify-start gap-2 font-extrabold text-base rounded-md px-2 py-1 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-blue-500"
                  aria-label="Adjust ETA"
                  title="Adjust ETA"
                >
                  <Clock className={`w-4 h-4 ${countdownTone}`} />
                  <span className={`${countdownTone}`}>{fmt(remainingMs)}</span>
                  {overdue}
                </button>

                {insideDialog ? (
                  !isCompleted ? (
                    <div className="flex justify-center md:justify-end">
                      <Button
                        className={`w-full sm:max-w-xs md:w-auto justify-center font-bold ${actionClass}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrimaryClick();
                        }}
                      >
                        {actionText}
                      </Button>
                    </div>
                  ) : null
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:flex md:gap-3 md:justify-end">
                    {/* FIX: Show Undo button for completed orders OR orders with APPROVED/REJECTED system status */}
                    {isCompleted || hasApprovedOrRejectedSystemStatus ? (
                      <Button
                        className="w-full md:w-auto justify-center font-bold bg-slate-700 hover:bg-slate-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          openUndo();
                        }}
                        title={t("Undo")}
                      >
                        <Undo2 className="w-4 h-4 mr-2" />
                        {t("Undo")}
                      </Button>
                    ) : (
                      <Button
                        className={`w-full md:w-auto justify-center font-bold ${actionClass}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrimaryClick();
                        }}
                      >
                        {actionText}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="w-full md:w-auto justify-center font-bold"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOrderDialog({ open: true, orderId: order.id });
                        showActionToast({
                          action: "order.update",
                          message: `Viewing details for #${order.id}`,
                        });
                      }}
                      aria-label={t("View details")}
                      title={t("View details")}
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>

      <Dialog
        open={undoOpen}
        onOpenChange={(o) => (o ? openUndo() : closeUndo())}
      >
        <DialogContent className="p-0 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="sr-only">
              {t("Slide right to undo")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-3 bg-muted/50">
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
          </div>
          <SlideToConfirm
            value={undoVal[0]}
            setValue={(p) => setUndoVal([p])}
            onCommit={() => commitUndo(undoVal)}
            label={t("Slide right to undo")}
            icon={<Undo2 className="w-5 h-5 mr-2" />}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={revertOpen}
        onOpenChange={(o) => (o ? openRevert() : closeRevert())}
      >
        <DialogContent className="p-0 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="sr-only">Slide right to revert</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-3 bg-muted/50">
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
          </div>
          <SlideToConfirm
            value={revertVal[0]}
            setValue={(p) => setRevertVal([p])}
            onCommit={() => commitRevert(revertVal)}
            label="Slide right to revert"
            icon={<Undo2 className="w-5 h-5 mr-2" />}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Item Notes
            </DialogTitle>
            {notesItemName ? (
              <DialogDescription className="mt-1">
                {notesItemName}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="p-4">
            {notesLoading ? (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading notes…
              </div>
            ) : notesError ? (
              <div className="text-sm text-red-600">{notesError}</div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                {notesText || "No notes found for this item."}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Reusable Slide-to-Confirm component for undo/revert actions
 */
function SlideToConfirm({ value, setValue, onCommit, label, icon }) {
  const railRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);

  const clamp = (n) => Math.max(0, Math.min(100, n));

  const updateFromClientX = (clientX) => {
    const el = railRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setValue(clamp(pct));
  };

  const onPointerDown = (e) => {
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const onPointerMove = (e) => dragging && updateFromClientX(e.clientX);

  const onPointerUp = (e) => {
    if (!dragging) return;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    onCommit?.();
  };

  const onSliderChange = (v) => setValue(Array.isArray(v) ? v[0] : v);
  const onSliderCommit = (v) => {
    const n = Array.isArray(v) ? v[0] : v;
    if (n >= 100) onCommit?.();
  };

  return (
    <div className="p-4 sm:p-6 pt-4">
      <div className="text-center font-bold text-base sm:text-lg mb-3 select-none">
        {label}
      </div>
      <div
        ref={railRef}
        className="relative h-16 w-full rounded-2xl bg-muted border border-muted-foreground/20 shadow-inner select-none touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-2xl bg-emerald-500/25 pointer-events-none"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity"
          style={{ opacity: value < 15 ? 1 : 0 }}
        >
          <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-muted-foreground">
            <ChevronRight className="w-4 h-4" />
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-background border border-muted-foreground/30 shadow flex items-center justify-center font-semibold px-2 h-12 pointer-events-none"
          style={{ left: `calc(${Math.min(value, 100)}% + 8px)` }}
          aria-hidden="true"
        >
          {icon}
        </div>
        <Slider
          value={[value]}
          onValueChange={onSliderChange}
          onValueCommit={onSliderCommit}
          min={0}
          max={100}
          step={1}
          aria-label={label}
          className="absolute inset-0 opacity-0"
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="text-[10px] sm:text-xs text-muted-foreground select-none">
          {Math.round(value)}%
        </div>
        <div className="text-[10px] sm:text-xs text-muted-foreground select-none">
          {value >= 100 ? "Release to confirm" : "Drag to the end"}
        </div>
      </div>
    </div>
  );
}
