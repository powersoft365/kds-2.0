"use client";

// Import React and all necessary hooks from React
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  memo,
} from "react";

// Import toast for notifications
import { toast } from "sonner";

// Import drag and drop functionality from dnd-kit
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";

// Import sortable functionality
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";

// Import CSS utilities for drag and drop
import { CSS } from "@dnd-kit/utilities";

// Import custom components
import SignalRBridge from "@/components/SignalRBridge";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { OrderCard } from "@/components/OrderCard";
import { Pagination } from "@/components/Pagination";
import { SettingsDialog } from "@/components/SettingsDialog";
import { EtaDialog } from "@/components/EtaDialog";
import { FullscreenOrderDialog } from "@/components/FullscreenOrderDialog";
import { OrderSkeleton } from "@/components/OrderSkeleton";
import { SidebarSkeleton } from "@/components/SidebarSkeleton";

// Import internationalization
import i18n from "@/lib/i18n";

// Import API functions
import {
  listBatchOrders,
  listBatchOrderHeaders,
  bulkChangeBatchOrderStatus,
  listTableSettings,
  listFloorTables,
  readOrdersList,
  readTotalCount,
  fetchInvoiceBy365Code,
  listItemDepartments,
} from "@/lib/api";

/* ------------ Sortable wrapper component ------------ */
const SortableOrderCard = memo(function SortableOrderCard({ order, ...props }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    willChange: isDragging ? "transform" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <OrderCard
        order={order}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
        {...props}
      />
    </div>
  );
});

/* ------------ Translation helper function ------------ */
const useT =
  (lng = "en") =>
  (k) =>
    (i18n[lng] && i18n[lng][k]) || k;

/* ------------ Utility functions ------------ */

/**
 * Calculate minutes since a timestamp
 */
const minutesSince = (ts) => {
  const n = typeof ts === "number" ? ts : Date.parse(ts);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.floor((Date.now() - n) / 60000));
};

/**
 * Normalize raw order data from API to consistent format
 */
function normalizeOrders(list, page, pageSize) {
  return list.map((raw, idx) => {
    const header = raw.invoice_header || {};
    const tableObj = raw.table || header.table || {};

    const tableId =
      raw.table_id ||
      header.table_id ||
      tableObj.table_id ||
      tableObj.id ||
      null;

    const code365 =
      raw.batch_invoice_number_365 ||
      raw.batch_invoice_code_365 ||
      raw.invoice_365_code ||
      header.invoice_365_code ||
      header.batch_invoice_number_365 ||
      header.batch_invoice_code_365 ||
      raw.shopping_cart_code;

    const id = code365 || `row-${page}-${idx + 1}`;

    const itemsRaw =
      raw.list_invoice_details || raw.list_invoice_lines || raw.items || [];

    const items = itemsRaw.map((it, i) => {
      const rawStatus = (
        it.status_code_365 ||
        it.status_code ||
        it.line_status_code_365 ||
        ""
      )
        .toString()
        .toUpperCase();

      return {
        id: it.line_id_365 || it.item_code_365 || `${id}-line-${i + 1}`,
        lineId365: it.line_id_365 || "",
        itemCode365: it.item_code_365 || it.item_code || "",
        name: it.item_name || it.item_code_365 || it.name || "Item",
        dept: it.item_department_code_365 || it.dept || "General",
        deptCode: it.item_department_code_365 || "",
        qty: Number(it.line_quantity || it.qty || 1),
        mods: Array.isArray(it.list_modifiers)
          ? it.list_modifiers.map((m) => ({
              modifier_name: m.modifier_name || m.modifier_code_365 || m.name,
              modifier_prefix: m.modifier_prefix || "",
            }))
          : [],
        rawStatus,
        itemStatus: "none",
      };
    });

    const anyInproc =
      items.some((l) => l.rawStatus === "INPROC") ||
      (raw.status_code_365 || header.status_code_365 || "")
        .toString()
        .toUpperCase() === "INPROC";

    const allApproved =
      items.length > 0 &&
      items.every((l) =>
        ["APPROVED", "DONE", "COMPLETED"].includes(l.rawStatus)
      );

    const status = allApproved
      ? "completed"
      : (raw.status_code_365 || header.status_code_365 || "")
          .toString()
          .toUpperCase() || "pending";

    const systemStatus = (header.status_code_365 || "")
      .toString()
      .toUpperCase();

    return {
      id,
      dest:
        header.table_name ||
        header.table_number ||
        raw.agent_code_365 ||
        raw.station_code_365 ||
        "Counter",
      type: header.invoice_type || raw.invoice_type || "I",
      createdAt:
        header.invoice_date_utc0 ||
        raw.invoice_date_utc0 ||
        header.created_at ||
        raw.created_at ||
        Date.now(),
      status,
      systemStatus,
      cooking: anyInproc,
      delayed: false,
      onHold: false,
      eta: 10,
      items,
      tableId,
      _batchCode365: code365 || "",
      _raw: raw,
    };
  });
}

/**
 * Build totals by department for sidebar display
 */
function buildTotalsByDept(orders) {
  const acc = {};

  for (const o of orders) {
    for (const it of o.items || []) {
      const dept = it.dept || "General";
      if (!acc[dept]) acc[dept] = {};
      acc[dept][it.name] = (acc[dept][it.name] || 0) + (it.qty || 1);
    }
  }

  return acc;
}

/**
 * Determine border color based on order status
 */
const statusBorder = (o) => {
  if (o?.status === "completed") return "border-emerald-500";
  if (o?.onHold) return "border-violet-500";
  if (o?.cooking) return "border-amber-500";
  return "border-slate-500";
};

/**
 * Get CSS class for item state checkbox
 */
const triBoxCls = (state) => {
  const base =
    "w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 mr-3";

  if (state === "checked")
    return `${base} bg-emerald-600 border-emerald-600 text-white`;
  if (state === "cancelled")
    return `${base} bg-red-600 border-red-600 text-white`;
  return `${base} border-slate-500`;
};

/* ------------ Main KDS Pro Component ------------ */
function KdsPro() {
  const [language, setLanguage] = useState("en");
  const t = useT(language);

  const [orders, setOrders] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [activeCount, setActiveCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  const [departments, setDepartments] = useState(["All"]);
  const [selectedDepts, setSelectedDepts] = useState(["All"]);
  const [departmentMap, setDepartmentMap] = useState(new Map());

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(24);
  const [totalPages, setTotalPages] = useState(1);

  const [etaDialog, setEtaDialog] = useState({ open: false, orderId: null });
  const [orderDialog, setOrderDialog] = useState({
    open: false,
    orderId: null,
  });
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef(null);
  const requestSeq = useRef(0);

  const [activeId, setActiveId] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /* ---------- Clock Effect ---------- */
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        setCurrentTime(new Date().toLocaleTimeString("en-GB"));
      } catch (error) {}
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  /* ---------- Fetch Departments Effect ---------- */
  useEffect(() => {
    async function fetchDepartments() {
      try {
        const data = await listItemDepartments();
        const list =
          data?.list_item_departments || data?.departments || data?.list || [];

        if (Array.isArray(list) && list.length > 0) {
          const map = new Map();
          const names = ["All"];

          for (const d of list) {
            const name =
              d.item_department_name ||
              d.department_name ||
              d.name ||
              "Unknown";
            const code =
              d.item_department_code_365 || d.department_code || d.code || "";

            map.set(name, code);
            names.push(name);
          }

          setDepartmentMap(map);
          setDepartments(names);
        }
      } catch (err) {}
    }

    fetchDepartments();
  }, []);

  /* ---------- Fetch Orders Function ---------- */
  const fetchPage = useCallback(async () => {
    const mySeq = ++requestSeq.current;

    try {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    } catch (error) {}

    abortRef.current = new AbortController();

    const deptFilter = selectedDepts.includes("All")
      ? ""
      : selectedDepts.join(",");

    setIsLoading(true);

    try {
      const activeCountPayload = await listBatchOrders({
        pageNumber: "1",
        pageSize: "24",
        onlyCounted: "Y",
        itemDepartmentSelection: deptFilter,
        invoiceSystemStatus: "NEW,INPROC",
        signal: abortRef.current.signal,
      });

      const completedCountPayload = await listBatchOrders({
        pageNumber: "1",
        pageSize: "24",
        onlyCounted: "Y",
        itemDepartmentSelection: deptFilter,
        invoiceSystemStatus: "APPROVED,REJECTED",
        signal: abortRef.current.signal,
      });

      const activeOrdersCount = readTotalCount(activeCountPayload);
      const completedOrdersCount = readTotalCount(completedCountPayload);

      setActiveCount(activeOrdersCount);
      setCompletedCount(completedOrdersCount);

      if (mySeq !== requestSeq.current) {
        return;
      }

      let dataPayload;
      if (activeTab === "active") {
        dataPayload = await listBatchOrders({
          pageNumber: currentPage,
          pageSize: itemsPerPage,
          onlyCounted: "N",
          itemDepartmentSelection: deptFilter,
          invoiceSystemStatus: "NEW,INPROC",
          signal: abortRef.current.signal,
        });
      } else {
        dataPayload = await listBatchOrders({
          pageNumber: currentPage,
          pageSize: itemsPerPage,
          onlyCounted: "N",
          itemDepartmentSelection: deptFilter,
          invoiceSystemStatus: "APPROVED,REJECTED",
          signal: abortRef.current.signal,
        });
      }

      if (mySeq !== requestSeq.current) {
        return;
      }

      const list = readOrdersList(dataPayload) || [];
      const normalized = normalizeOrders(list, currentPage, itemsPerPage);

      if (activeTab === "active") {
        setOrders(normalized);
        setCompleted([]);
      } else {
        setOrders([]);
        setCompleted(normalized);
      }

      const deptSet = new Set(["All"]);
      normalized.forEach((o) =>
        (o.items || []).forEach((it) => deptSet.add(it.dept || "General"))
      );

      setDepartments((prev) => {
        const all = new Set([...prev, ...Array.from(deptSet)]);
        return Array.from(all);
      });

      const total =
        activeTab === "active" ? activeOrdersCount : completedOrdersCount;
      const pages = Math.max(1, Math.ceil(total / itemsPerPage));

      setTotalPages(pages);

      if (currentPage > pages) {
        setCurrentPage(pages);
      }
    } catch (e) {
      if (e?.name === "AbortError") {
        return;
      }
      toast.error("Failed to load orders from API");
    } finally {
      if (mySeq === requestSeq.current) {
        setIsLoading(false);
      }
    }
  }, [currentPage, itemsPerPage, selectedDepts, activeTab]);

  /* ---------- Fetch Orders Effect ---------- */
  useEffect(() => {
    fetchPage();

    return () => {
      try {
        if (abortRef.current) {
          abortRef.current.abort();
        }
      } catch (error) {}
    };
  }, [fetchPage]);

  /* ---------- Reset Page Effect ---------- */
  const selectedKey = useMemo(() => selectedDepts.join("|"), [selectedDepts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedKey, activeTab]);

  /* ---------- Warm-up Reads Effect ---------- */
  useEffect(() => {
    listBatchOrderHeaders({
      pageNumber: 1,
      pageSize: 10,
      onlyCounted: "N",
    }).catch(() => {});

    listTableSettings({ pageNumber: 1, pageSize: 20, onlyCounted: "N" }).catch(
      () => {}
    );

    listFloorTables({}).catch(() => {});
  }, []);

  /* ---------- Memoized Data Calculations ---------- */
  const allForTab = useMemo(() => {
    if (activeTab === "completed") {
      return completed;
    }
    if (activeTab === "scheduled") {
      return scheduled;
    }
    return orders;
  }, [activeTab, orders, scheduled, completed]);

  const filtered = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const selectedAll = selectedDepts.includes("All");

    const result = allForTab.filter((order) => {
      const matchesSearch =
        !search ||
        order.id.toString().includes(search) ||
        String(order.dest || "")
          .toLowerCase()
          .includes(search) ||
        (order.items || []).some((i) =>
          String(i.name || "")
            .toLowerCase()
            .includes(search)
        );

      const matchesDept =
        selectedAll ||
        (order.items || []).some((it) => selectedDepts.includes(it.dept));

      return matchesSearch && matchesDept;
    });

    return result;
  }, [allForTab, searchTerm, selectedDepts]);

  const totalsByDept = useMemo(() => {
    return buildTotalsByDept(filtered);
  }, [filtered]);

  /* ---------- Helper Functions ---------- */
  const getBatchCode365 = useCallback((o) => {
    return o._batchCode365 || o.id;
  }, []);

  const buildRowsPerLine = useCallback(
    (order, nextStatus) => {
      const batch = getBatchCode365(order);
      const rows = (order.items || []).map((it) => ({
        batch_invoice_number_365: String(batch),
        batch_invoice_code_365: String(batch),
        line_id_365: it.lineId365 || "",
        status_code_365: nextStatus,
        item_department_code_365: it.deptCode || "",
        time_to_complete: 0,
      }));

      const result = rows.length
        ? rows
        : [
            {
              batch_invoice_number_365: String(batch),
              batch_invoice_code_365: String(batch),
              line_id_365: "",
              status_code_365: nextStatus,
              item_department_code_365: "",
              time_to_complete: 0,
            },
          ];

      return result;
    },
    [getBatchCode365]
  );

  const verifyPersisted = useCallback(
    async (order) => {
      try {
        const batch = getBatchCode365(order);
        if (!batch) {
          return null;
        }

        const fresh = await fetchInvoiceBy365Code(batch);

        if (!fresh) {
          return null;
        }

        const items =
          fresh.list_invoice_details ||
          fresh.list_invoice_lines ||
          fresh.items ||
          [];

        const up = (v) => String(v || "").toUpperCase();

        const anyInproc = items.some(
          (l) => up(l.status_code_365 || l.status_code) === "INPROC"
        );

        const allApproved =
          items.length > 0 &&
          items.every((l) =>
            ["APPROVED", "DONE", "COMPLETED"].includes(
              up(l.status_code_365 || l.status_code)
            )
          );

        const noneInproc = items.every(
          (l) => up(l.status_code_365 || l.status_code) !== "INPROC"
        );

        return { anyInproc, allApproved, noneInproc };
      } catch (err) {
        return null;
      }
    },
    [getBatchCode365]
  );

  /* ---------- SignalR Communication ---------- */
  const SR = () => {
    return typeof window !== "undefined" ? window.SignalR : null;
  };

  const deptForOrderSend = () => {
    return selectedDepts.includes("All") ? undefined : selectedDepts[0];
  };

  const publish = async (fn, ...args) => {
    try {
      const api = SR();
      if (!api || !api[fn]) {
        return;
      }

      const dept = deptForOrderSend();
      args.push(dept);
      await api[fn](...args);
    } catch (e) {
      toast.error(`SignalR send failed: ${e?.message || "unknown error"}`);
    }
  };

  /* ---------- Order Actions ---------- */
  const onPrimaryAction = useCallback(
    async (order) => {
      const isComplete = (order.items || []).every(
        (i) => i.itemStatus === "checked"
      );
      const nextStatus = isComplete ? "APPROVED" : "INPROC";

      const rows = buildRowsPerLine(order, nextStatus);
      //rows
      // console.log("mr rows", rows);
      const rollback = JSON.parse(JSON.stringify(orders));

      const updatedOrders = orders.map((o) =>
        o.id !== order.id
          ? o
          : {
              ...o,
              status: isComplete ? "completed" : "active",
              cooking: !isComplete,
              cookingStartedAt: !isComplete ? Date.now() : o.cookingStartedAt,
            }
      );

      if (isComplete) {
        setOrders(updatedOrders.filter((o) => o.id !== order.id));
        setCompleted((prev) => [
          { ...order, status: "completed", cooking: false },
          ...prev,
        ]);
      } else {
        setOrders(updatedOrders);
      }

      try {
        await bulkChangeBatchOrderStatus(rows);

        const persisted = await verifyPersisted(order);

        if (!persisted) {
        } else if (
          (nextStatus === "INPROC" && !persisted.anyInproc) ||
          (nextStatus === "APPROVED" && !persisted.allApproved)
        ) {
        }

        if (isComplete) {
          toast.success(`Order #${order.id} completed`);
          await publish("completeOrder", order);
        } else {
          toast.success(`Order #${order.id} ${t("started_cooking")}`);
          await publish("startCooking", {
            ...order,
            cookingStartedAt: Date.now(),
          });
        }
      } catch (e) {
        setOrders(rollback);
        if (isComplete) {
          setCompleted((prev) => prev.filter((o) => o.id !== order.id));
          setOrders((prev) => [...prev, order]);
        }
        toast.error("Status update failed");
      }
    },
    [orders, buildRowsPerLine, verifyPersisted, t, selectedDepts]
  );

  const onUndoAction = useCallback(
    async (order) => {
      const rows = buildRowsPerLine(order, "NEW");
      console.log("ROWS", rows);
      const rollbackCompleted = JSON.parse(JSON.stringify(completed));
      const rollbackOrders = JSON.parse(JSON.stringify(orders));

      setCompleted((prev) => prev.filter((o) => o.id !== order.id));
      setOrders((prev) => [
        {
          ...order,
          status: "active",
          cooking: true,
          cookingStartedAt: Date.now(),
        },
        ...prev,
      ]);

      try {
        await bulkChangeBatchOrderStatus(rows);

        const persisted = await verifyPersisted(order);
        if (!persisted || !persisted.anyInproc) {
        }

        toast.success(`Order #${order.id}: ${t("undone_to_active")}`);
        await publish("startCooking", {
          ...order,
          cookingStartedAt: Date.now(),
        });
      } catch (e) {
        setCompleted(rollbackCompleted);
        setOrders(rollbackOrders);
        toast.error("Undo failed");
      }
    },
    [orders, completed, buildRowsPerLine, verifyPersisted, t, selectedDepts]
  );

  const onRevertAction = useCallback(
    async (order) => {
      const rows = buildRowsPerLine(order, "NEW");
      const rollbackOrders = JSON.parse(JSON.stringify(orders));

      setOrders((prev) =>
        prev.map((o) =>
          o.id !== order.id
            ? o
            : {
                ...o,
                status: "pending",
                cooking: false,
                cookingStartedAt: null,
              }
        )
      );

      try {
        await bulkChangeBatchOrderStatus(rows);

        const persisted = await verifyPersisted(order);
        if (!persisted || !persisted.noneInproc) {
        }

        toast.success(`Order #${order.id} reverted to not started`);
        await publish("revertOrder", order);
      } catch (e) {
        setOrders(rollbackOrders);
        toast.error("Revert failed");
      }
    },
    [orders, buildRowsPerLine, verifyPersisted, selectedDepts]
  );

  const toggleItemState = useCallback(
    async (orderId, itemId) => {
      if (activeTab === "completed") {
        return;
      }

      let nextStatusForItem = "none";
      let deptForLine = undefined;

      setOrders((prev) =>
        prev.map((o) =>
          o.id !== orderId
            ? o
            : {
                ...o,
                items: (o.items || []).map((it) => {
                  if (it.id !== itemId) return it;

                  const states = ["none", "checked", "cancelled"];
                  const next =
                    states[(states.indexOf(it.itemStatus) + 1) % states.length];
                  nextStatusForItem = next;
                  deptForLine = it.deptCode || it.dept || undefined;

                  return { ...it, itemStatus: next };
                }),
              }
        )
      );

      try {
        const api = SR();
        if (api?.toggleItem) {
          await api.toggleItem(orderId, itemId, nextStatusForItem, deptForLine);
        }
      } catch (e) {
        toast.error("Failed to send item toggle via SignalR");
      }
    },
    [activeTab]
  );

  /* ---------- Department Filtering ---------- */
  const toggleDept = (dept) => {
    setSearchTerm("");

    if (dept === "All") {
      return setSelectedDepts(["All"]);
    }

    const code = departmentMap.get(dept);

    let next = selectedDepts.filter((d) => d !== "All");

    if (next.includes(dept)) {
      next = next.filter((d) => d !== dept);
    } else {
      next = [...next, dept];
    }

    if (next.length === 0) {
      next = ["All"];
    }

    setSelectedDepts(next);
  };

  /* ---------- UI Helper Functions ---------- */
  const actionLabelAndClass = useCallback(
    (o) => {
      if ((o.items || []).every((i) => i.itemStatus === "checked")) {
        return {
          label: t("complete"),
          cls: "bg-emerald-600 hover:bg-emerald-700",
        };
      }

      if (o.cooking) {
        return { label: t("cooking"), cls: "bg-amber-500 hover:bg-amber-600" };
      }

      return {
        label: t("start_cooking"),
        cls: "bg-blue-600 hover:bg-blue-700",
      };
    },
    [t]
  );

  const calcSubStatus = (o) => {
    if (o.status === "completed") {
      return "completed";
    }
    if (o.cooking) {
      return "cooking";
    }
    if (minutesSince(o.createdAt) > o.eta) {
      return "delayed";
    }
    return "";
  };

  /* ---------- Drag and Drop Handlers ---------- */
  const handleDragStart = useCallback(
    (event) => {
      const { active } = event;
      setActiveId(active.id);
      const foundOrder = filtered.find((order) => order.id === active.id);
      setActiveOrder(foundOrder || null);
    },
    [filtered]
  );

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;

      setActiveId(null);
      setActiveOrder(null);

      if (!over || active.id === over.id) {
        return;
      }

      let currentList, setList;
      if (activeTab === "active") {
        currentList = orders;
        setList = setOrders;
      } else if (activeTab === "completed") {
        currentList = completed;
        setList = setCompleted;
      } else {
        currentList = scheduled;
        setList = setScheduled;
      }

      const oldIndex = currentList.findIndex((item) => item.id === active.id);
      const newIndex = currentList.findIndex((item) => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reorderedItems = arrayMove(currentList, oldIndex, newIndex);
      setList(reorderedItems);
    },
    [activeTab, orders, completed, scheduled, filtered]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setActiveOrder(null);
  }, []);

  /* ---------- Tab Configuration ---------- */
  const headerTabs = [
    { key: "active", label: t("active_orders") },
    { key: "completed", label: t("history") },
  ];

  const counts = {
    active: activeCount,
    scheduled: scheduled.length,
    completed: completedCount,
  };

  const currentSortableItems = useMemo(() => {
    return filtered.map((order) => order.id);
  }, [filtered]);

  /* ---------- Sidebar Item Click Handler ---------- */
  const handleSidebarItemClick = useCallback((itemName) => {
    setSearchTerm(String(itemName || ""));
  }, []);

  /* ---------- SignalR Debug Effect ---------- */
  useEffect(() => {
    const handler = (e) => {};
    window.addEventListener("srlog", handler);

    return () => {
      window.removeEventListener("srlog", handler);
    };
  }, []);

  /* ---------- Render ---------- */
  return (
    <div className="h-dvh flex flex-col bg-background text-foreground transition-colors">
      <SignalRBridge
        onOrderUpdate={fetchPage}
        onAcknowledge={() => {}}
        debug={false}
      />

      <Header
        currentTime={currentTime}
        headerTabs={headerTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        counts={counts}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        t={t}
        departments={departments}
        selectedDepts={selectedDepts}
        toggleDept={toggleDept}
        setSettingsDialog={setSettingsDialogOpen}
        departmentMap={departmentMap}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <SidebarSkeleton
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            t={t}
          />
        ) : (
          <Sidebar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            totalsByDept={totalsByDept}
            t={t}
            onItemClick={handleSidebarItemClick}
            selectedDepts={selectedDepts}
          />
        )}

        <section className="flex-1 min-h-0 p-4 overflow-y-auto">
          {isLoading ? (
            <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: itemsPerPage }).map((_, i) => (
                <OrderSkeleton key={`s-${i}`} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground w-full py-16">
              No orders to display.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragMove={() => {}}
              onDragOver={() => {}}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext
                items={currentSortableItems}
                strategy={rectSortingStrategy}
              >
                <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filtered.map((o, idx) => (
                    <SortableOrderCard
                      key={`${o.id}-${o.createdAt}-${o.dest}-${idx}`}
                      order={o}
                      toggleItemState={toggleItemState}
                      onPrimaryAction={onPrimaryAction}
                      onUndoAction={onUndoAction}
                      onRevertAction={onRevertAction}
                      setEtaDialog={setEtaDialog}
                      setOrderDialog={setOrderDialog}
                      onApplyItemModifiers={() => {}}
                      t={t}
                      timeElapsedMin={(ord) => minutesSince(ord.createdAt)}
                      calcSubStatus={calcSubStatus}
                      actionLabelAndClass={actionLabelAndClass}
                      statusBorder={statusBorder}
                      triBoxCls={triBoxCls}
                      selectedDepts={selectedDepts}
                    />
                  ))}
                </div>
              </SortableContext>

              <DragOverlay dropAnimation={null}>
                {activeOrder ? (
                  <div style={{ pointerEvents: "none" }}>
                    <OrderCard
                      order={activeOrder}
                      isDragging
                      toggleItemState={toggleItemState}
                      onPrimaryAction={onPrimaryAction}
                      onUndoAction={onUndoAction}
                      onRevertAction={onRevertAction}
                      setEtaDialog={setEtaDialog}
                      setOrderDialog={setOrderDialog}
                      onApplyItemModifiers={() => {}}
                      t={t}
                      timeElapsedMin={(ord) => minutesSince(ord.createdAt)}
                      calcSubStatus={calcSubStatus}
                      actionLabelAndClass={actionLabelAndClass}
                      statusBorder={statusBorder}
                      triBoxCls={triBoxCls}
                      selectedDepts={selectedDepts}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </section>
      </div>

      {!isLoading && totalPages > 1 && (
        <Pagination
          totalPages={totalPages}
          currentPage={currentPage}
          onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
          onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          onJump={(n) => setCurrentPage(n)}
        />
      )}

      <EtaDialog
        open={etaDialog.open}
        onOpenChange={(open) =>
          setEtaDialog({ open, orderId: open ? etaDialog.orderId : null })
        }
        orderId={etaDialog.orderId}
        orders={orders}
        setOrders={setOrders}
        toast={toast}
      />

      <FullscreenOrderDialog
        open={orderDialog.open}
        onOpenChange={(open) =>
          setOrderDialog({ open, orderId: open ? orderDialog.orderId : null })
        }
        orderId={orderDialog.orderId}
        orders={orders}
        completed={completed}
        toggleItemState={toggleItemState}
        onPrimaryAction={onPrimaryAction}
        onUndoAction={onUndoAction}
        onRevertAction={onRevertAction}
        setEtaDialog={setEtaDialog}
        t={t}
        timeElapsedMin={(ord) => minutesSince(ord.createdAt)}
        calcSubStatus={calcSubStatus}
        actionLabelAndClass={actionLabelAndClass}
        statusBorder={statusBorder}
        triBoxCls={triBoxCls}
        selectedDepts={selectedDepts}
      />

      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        language={language}
        setLanguage={setLanguage}
        i18n={i18n}
        t={t}
      />
    </div>
  );
}

export default KdsPro;
