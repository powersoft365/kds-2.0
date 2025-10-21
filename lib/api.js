const PROXY = "/api/ps365";

function getToken() {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("ps365_token") || "";
  } catch {
    return "";
  }
}

function okPayload(p) {
  const code = (p && (p.response_code || p.api_response?.response_code)) ?? "";
  return String(code) === "1";
}

async function postJSON(path, body = {}, { signal } = {}) {
  const token = getToken();
  const wrappedBody = {
    ...body,
    api_credentials: {
      ...(body.api_credentials || {}),
      token,
    },
  };

  const res = await fetch(`${PROXY}/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ps365-token": token, // also send header
    },
    body: JSON.stringify(wrappedBody),
    signal,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !okPayload(json)) {
    const rc =
      json?.response_code || json?.api_response?.response_code || res.status;
    const msg =
      json?.response_msg ||
      json?.api_response?.response_msg ||
      res.statusText ||
      "Unknown error";
    throw new Error(`POST ${path} failed (${rc}): ${msg}`);
  }
  return json;
}

async function getJSON(path, query = {}) {
  const token = getToken();
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(
    `${PROXY}/${path.replace(/^\//, "")}${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      headers: {
        "content-type": "application/json",
        "x-ps365-token": token,
      },
    }
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !okPayload(json)) {
    const rc =
      json?.response_code || json?.api_response?.response_code || res.status;
    const msg =
      json?.response_msg ||
      json?.api_response?.response_msg ||
      res.statusText ||
      "Unknown error";
    throw new Error(`GET ${path} failed (${rc}): ${msg}`);
  }
  return json;
}

/* ---- keep your existing wrappers below unchanged ---- */
export async function listBatchOrders({
  pageNumber = 1,
  pageSize = 24,
  onlyCounted = "N",
  itemDepartmentSelection = "",
  invoice365Selection = "",
  signal,
} = {}) {
  return postJSON(
    "list_stock_batch_invoice",
    {
      filter_define: {
        page_number: pageNumber,
        page_size: pageSize,
        only_counted: String(onlyCounted),
        invoice_type: "all",
        invoice_system_status: "all",
        invoice_status_selection: "",
        item_department_selection: itemDepartmentSelection || "",
        invoice_customer_selection: "",
        shopping_cart_code_selection: "",
        invoice_365_code_selection: invoice365Selection || "",
        invoice_customer_email_selection: "",
        invoice_customer_mobile_number_selection: "",
        invoice_store_selection: "",
        invoice_station_selection: "",
        from_invoice_date_utc0: "",
        to_invoice_date_utc0: "",
        from_invoice_delivery_date_utc0: "",
        to_invoice_delivery_date_utc0: "",
        list_modifiers: [],
        list_invoice_payments: [],
      },
    },
    { signal }
  );
}

export async function listBatchOrderHeaders(opts = {}) {
  return listBatchOrders({ ...opts });
}
export async function getBatchOrderByShoppingCart({
  shopping_cart_code,
  by_365_code = true,
}) {
  return getJSON("stock_batch_invoice", {
    shopping_cart_code,
    by_365_code: by_365_code ? "true" : "false",
  });
}
export async function bulkChangeBatchOrderStatus(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0)
    throw new Error("bulkChangeBatchOrderStatus: rows[] required");
  const normalized = rows.map((r) => ({
    batch_invoice_number_365:
      r.batch_invoice_number_365 ?? r.batch_invoice_code_365 ?? "",
    batch_invoice_code_365:
      r.batch_invoice_code_365 ?? r.batch_invoice_number_365 ?? "",
    line_id_365: r.line_id_365 ?? "",
    status_code_365: r.status_code_365,
    item_department_code_365: r.item_department_code_365 ?? "",
    time_to_complete: Number(r.time_to_complete ?? 0),
  }));
  return postJSON("list_stock_batch_invoice_change_status", {
    list_stock_batch_invoice: normalized,
  });
}
export async function listTableSettings({
  pageNumber = 1,
  pageSize = 50,
  onlyCounted = "N",
  signal,
} = {}) {
  return postJSON(
    "list_table_settings",
    {
      filter_define: {
        page_number: pageNumber,
        page_size: pageSize,
        only_counted: String(onlyCounted),
      },
    },
    { signal }
  );
}
export async function listFloorTables({ signal } = {}) {
  return postJSON("list_floor_tables", { filter_define: {} }, { signal });
}
export function readOrdersList(payload) {
  if (!payload || typeof payload !== "object") return [];
  return (
    payload.list_stock_batch_invoice ||
    payload.list_invoices ||
    payload.invoices ||
    payload.list ||
    []
  );
}
export function readTotalCount(payload) {
  if (!payload || typeof payload !== "object") return 0;
  return (
    payload.total_count_list_stock_batch_invoice ||
    payload.total_count_list_invoices ||
    payload.total ||
    0
  );
}
export async function fetchInvoiceBy365Code(invoice365Code) {
  const res = await listBatchOrders({
    pageNumber: 1,
    pageSize: 1,
    onlyCounted: "N",
    invoice365Selection: String(invoice365Code || ""),
  });
  const list = readOrdersList(res);
  return Array.isArray(list) && list.length ? list[0] : null;
}

/* (optional) keep if you later persist modifiers as lines */
export async function addModifiersToOrder({
  batchInvoiceNumber365,
  tableId,
  parentLineId365,
  selectedModifiers,
  signal,
}) {
  if (
    !batchInvoiceNumber365 ||
    !Array.isArray(selectedModifiers) ||
    selectedModifiers.length === 0
  ) {
    return { ok: true, skipped: true };
  }

  const list_invoice_details = selectedModifiers.map((m, idx) => ({
    line_number: String(idx + 1),
    item_code_365: m.code,
    item_name: m.name,
    line_quantity: "1",
    line_price_incl_vat: 0,
    line_total_grand: 0,
    is_modifier: true,
    is_subitem: false,
    exclude_print: false,
    root_line_id_365: parentLineId365 || "",
  }));

  const payload = {
    batch_invoice: {
      batch_invoice_number_365: String(batchInvoiceNumber365),
      ...(tableId ? { table_id: String(tableId) } : {}),
      list_invoice_details,
    },
  };

  try {
    await postJSON("stock_batch_invoice_add_items", payload, { signal });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || "unknown" };
  }
}

/* ---------- NOTES HELPERS (USED BY OrderCard) ---------- */

/**
 * Fetches notes for a list of item codes (365) and returns a Map(code -> notes).
 */
export async function getItemsNotesMap(codes) {
  const list = Array.isArray(codes) ? codes : [codes];
  const uniqueCodes = [...new Set(list.filter(Boolean))];
  if (uniqueCodes.length === 0) return new Map();

  const data = await postJSON("list_items", {
    filter_define: {
      only_counted: "N",
      page_number: 1,
      page_size: Math.max(1, uniqueCodes.length),
      active_type: "active",
      ecommerce_type: "all",
      categories_selection: "",
      departments_selection: "",
      items_supplier_selection: "",
      brands_selection: "",
      seasons_selection: "",
      models_selection: "",
      items_selection: uniqueCodes.join(","), // CSV of item_code_365
      colours_selection: "",
      sizes_selection: "",
      sizes_group_selection: "",
      attributes_1_selection: "",
      attributes_2_selection: "",
      attributes_3_selection: "",
      attributes_4_selection: "",
      attributes_5_selection: "",
      attributes_6_selection: "",
      keyword_search_item_code_365: "",
      keyword_search_item_name: "",
    },
  });

  const items = data?.list_items || [];
  const map = new Map();
  for (const it of items) {
    map.set(it.item_code_365, it.notes ?? "");
  }
  // Ensure missing codes still present with empty string
  for (const code of uniqueCodes) {
    if (!map.has(code)) map.set(code, "");
  }
  return map;
}

/**
 * Convenience: fetch a single item's notes by 365 code.
 */
export async function getItemNote(code) {
  const map = await getItemsNotesMap([code]);
  return map.get(code) ?? "";
}

/* ---------- DEV UTILS (unchanged) ---------- */

async function consoleItemNotes(codes) {
  if (!Array.isArray(codes)) codes = [codes];
  const uniqueCodes = [...new Set(codes.filter((code) => code))];
  if (uniqueCodes.length === 0) return;

  try {
    const data = await postJSON("list_items", {
      filter_define: {
        only_counted: "N",
        page_number: 1,
        page_size: uniqueCodes.length,
        active_type: "active",
        ecommerce_type: "all",
        categories_selection: "",
        departments_selection: "",
        items_supplier_selection: "",
        brands_selection: "",
        seasons_selection: "",
        models_selection: "",
        items_selection: uniqueCodes.join(","),
        colours_selection: "",
        sizes_selection: "",
        sizes_group_selection: "",
        attributes_1_selection: "",
        attributes_2_selection: "",
        attributes_3_selection: "",
        attributes_4_selection: "",
        attributes_5_selection: "",
        attributes_6_selection: "",
        keyword_search_item_code_365: "",
        keyword_search_item_name: "",
      },
    });
    const items = data?.list_items || [];
    const itemMap = new Map(items.map((item) => [item.item_code_365, item]));
    for (const code of uniqueCodes) {
      const item = itemMap.get(code);
      if (item) {
        console.log(`${item.item_name}: ${item.notes ?? ""}`);
      } else {
        console.log(`${code}: ""`);
      }
    }
  } catch (e) {
    console.error("Error fetching notes:", e);
    for (const code of uniqueCodes) {
      console.log(`${code}: ""`);
    }
  }
}

export async function consoleBatchItemNotes(opts = {}) {
  try {
    const data = await listBatchOrders(opts);
    const orders = readOrdersList(data);
    const codes = [];
    for (const order of orders) {
      const details =
        order.list_invoice_details ||
        order.list_invoice_lines ||
        order.lines ||
        [];
      for (const line of details) {
        const code = line.item_code_365 || "";
        if (code) codes.push(code);
      }
    }
    await consoleItemNotes(codes);
  } catch (e) {
    console.error("Error in consoleBatchItemNotes:", e);
  }
}

consoleBatchItemNotes();

// example usage (safe no-op in prod if you remove)
// consoleBatchItemNotes();
