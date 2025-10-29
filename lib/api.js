const PROXY = "/api/ps365";
/* -------------------- utilities -------------------- */
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
const DEFAULT_TIMEOUT_MS = 20000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 350;
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function expBackoffDelay(attemptIndex) {
  const base = BASE_DELAY_MS * Math.pow(2, attemptIndex);
  const jitter = Math.floor(Math.random() * 0.25 * base);
  return base + jitter;
}
function shouldRetry({ status, errorLike, json }) {
  if (errorLike) return true;
  if (!status) return true;
  if (status === 408 || status === 429) return true;
  if (status >= 500) return true;
  if (json && !okPayload(json)) return true;
  return false;
}
function withTimeout(promise, ms, externalSignal) {
  if (!ms) return promise;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("Request timeout")), ms);
  if (externalSignal) {
    if (externalSignal.aborted) ctrl.abort();
    else
      externalSignal.addEventListener("abort", () => ctrl.abort(), {
        once: true,
      });
  }
  return Promise.race([
    promise(ctrl.signal),
    new Promise((_, rej) =>
      ctrl.signal.addEventListener(
        "abort",
        () => rej(new Error("Request aborted or timed out")),
        { once: true }
      )
    ),
  ]).finally(() => clearTimeout(timer));
}
function safeJSON(res) {
  return res
    .json()
    .catch(() => ({}))
    .then((j) => (j && typeof j === "object" ? j : {}));
}
function buildUrl(path, query) {
  const clean = String(path || "").replace(/^\//, "");
  const qs =
    query && Object.keys(query).length
      ? `?${new URLSearchParams(query).toString()}`
      : "";
  return `${PROXY}/${clean}${qs}`;
}
function baseHeaders(token) {
  const h = { "content-type": "application/json" };
  if (token) h["x-ps365-token"] = token;
  return h;
}
/* -------------------- core request with retries -------------------- */
async function requestJSON({
  method,
  path,
  body,
  query,
  retries = MAX_RETRIES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
  includeTokenHeader = true,
  attachTokenInQuery = false,
}) {
  const token = getToken();
  const headers = includeTokenHeader ? baseHeaders(token) : baseHeaders("");
  const urlQuery = { ...(query || {}) };
  if (attachTokenInQuery && token && !urlQuery.token) {
    urlQuery.token = token;
  }
  const url = buildUrl(path, urlQuery);
  const wrappedBody =
    method === "POST"
      ? JSON.stringify({
          ...(body || {}),
          api_credentials: {
            ...((body && body.api_credentials) || {}),
            token,
          },
        })
      : undefined;
  let lastJson = null;
  let lastStatus = 0;
  let lastError = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await withTimeout(
        (internalSignal) =>
          fetch(url, {
            method,
            headers,
            body: wrappedBody,
            signal: internalSignal ?? signal,
          }),
        timeoutMs,
        signal
      );
      lastStatus = res.status;
      const json = await safeJSON(res);
      lastJson = json;
      const appOk = okPayload(json);
      const httpOk = res.ok;
      if (httpOk && appOk) {
        return {
          _ok: true,
          _status: res.status,
          _attempts: attempt + 1,
          data: json,
        };
      }
      const retryable = shouldRetry({ status: res.status, json });
      if (attempt < retries && retryable) {
        await sleep(expBackoffDelay(attempt));
        continue;
      }
      const rc =
        json?.response_code ||
        json?.api_response?.response_code ||
        res.status ||
        "unknown";
      const msg =
        json?.response_msg ||
        json?.api_response?.response_msg ||
        res.statusText ||
        "Unknown error";
      lastError = `(${rc}) ${msg}`;
      return {
        _ok: false,
        _status: res.status,
        _attempts: attempt + 1,
        _error: lastError,
        data: json || {},
      };
    } catch (err) {
      lastError = err?.message || "Network error";
      const retryable = shouldRetry({
        status: lastStatus,
        errorLike: true,
        json: lastJson,
      });
      if (attempt < retries && retryable) {
        await sleep(expBackoffDelay(attempt));
        continue;
      }
      return {
        _ok: false,
        _status: lastStatus || 0,
        _attempts: attempt + 1,
        _error: lastError,
        data: lastJson || {},
      };
    }
  }
  return {
    _ok: false,
    _status: 0,
    _attempts: retries + 1,
    _error: "Unknown",
    data: {},
  };
}
/* -------------------- public HTTP helpers -------------------- */
async function postJSON(path, body = {}, { signal, retries, timeoutMs } = {}) {
  const res = await requestJSON({
    method: "POST",
    path,
    body,
    retries,
    timeoutMs,
    signal,
  });
  return res._ok ? res.data : res.data || {};
}
async function getJSON(
  path,
  query = {},
  {
    signal,
    retries,
    timeoutMs,
    includeTokenHeader = true,
    attachTokenInQuery = false,
  } = {}
) {
  const res = await requestJSON({
    method: "GET",
    path,
    query,
    retries,
    timeoutMs,
    signal,
    includeTokenHeader,
    attachTokenInQuery,
  });
  return res._ok ? res.data : res.data || {};
}
/* -------------------- response readers -------------------- */
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
/* -------------------- wrappers -------------------- */
export async function listBatchOrders({
  pageNumber = 1,
  pageSize = 24,
  onlyCounted = "N",
  itemDepartmentSelection = "",
  invoice365Selection = "",
  invoiceSystemStatus = "all",
  signal,
} = {}) {
  const data = await postJSON(
    "list_stock_batch_invoice",
    {
      filter_define: {
        page_number: pageNumber,
        page_size: pageSize,
        only_counted: String(onlyCounted),
        invoice_type: "all",
        invoice_system_status: invoiceSystemStatus,
        invoice_status_selection: "",
        item_department_selection: itemDepartmentSelection || "",
        invoice_customer_selection: "",
        shopping_cart_code_selection: "",
        invoice_365_code_selection: String(invoice365Selection || ""),
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
  const orderspro = {
    ...data,
    list_stock_batch_invoice: readOrdersList(data),
    total_count_list_stock_batch_invoice: readTotalCount(data),
    _ok: okPayload(data),
    _error: okPayload(data)
      ? ""
      : data.response_msg || data.api_response?.response_msg || "",
  };
  //console.log(orderspro);
  return orderspro;
}

export async function listBatchOrderHeaders(opts = {}) {
  const data = await listBatchOrders({ ...opts });
  return data;
}
export async function getBatchOrderByShoppingCart({
  shopping_cart_code,
  by_365_code = true,
  signal,
}) {
  const data = await getJSON(
    "stock_batch_invoice",
    { shopping_cart_code, by_365_code: by_365_code ? "true" : "false" },
    { signal }
  );
  return {
    ...data,
    _ok: okPayload(data),
    _error: okPayload(data)
      ? ""
      : data.response_msg || data.api_response?.response_msg || "",
  };
}
export async function bulkChangeBatchOrderStatus(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0)
    return { _ok: true, skipped: true };
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
  const data = await postJSON("list_stock_batch_invoice_change_status", {
    list_stock_batch_invoice: normalized,
  });
  return {
    ...data,
    _ok: okPayload(data),
    _error: okPayload(data)
      ? ""
      : data.response_msg || data.api_response?.response_msg || "",
  };
}
export async function listTableSettings({
  pageNumber = 1,
  pageSize = 50,
  onlyCounted = "N",
  signal,
} = {}) {
  const data = await postJSON(
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
  return {
    ...data,
    list_table_settings: data?.list_table_settings || [],
    _ok: okPayload(data),
    _error: okPayload(data)
      ? ""
      : data.response_msg || data.api_response?.response_msg || "",
  };
}
export async function listFloorTables({ signal } = {}) {
  const data = await postJSON(
    "list_floor_tables",
    { filter_define: {} },
    { signal }
  );
  return {
    ...data,
    list_floor_tables: data?.list_floor_tables || [],
    _ok: okPayload(data),
    _error: okPayload(data)
      ? ""
      : data.response_msg || data.api_response?.response_msg || "",
  };
}
export async function fetchInvoiceBy365Code(invoice365Code) {
  const res = await listBatchOrders({
    pageNumber: 1,
    pageSize: 1,
    onlyCounted: "N",
    invoice365Selection: String(invoice365Code || ""),
  });
  const list = readOrdersList(res);
  const item = Array.isArray(list) && list.length ? list[0] : null;
  return { invoice: item, _ok: Boolean(item), _error: item ? "" : "" };
}
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
  )
    return { _ok: true, skipped: true };
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
  const data = await postJSON("stock_batch_invoice_add_items", payload, {
    signal,
  });
  return {
    ...data,
    _ok: okPayload(data),
    _error: okPayload(data)
      ? ""
      : data.response_msg || data.api_response?.response_msg || "",
  };
}
/* ---------- Notes helpers ---------- */
export async function getItemsNotesMap(codes) {
  const list = Array.isArray(codes) ? codes : [codes];
  const uniqueCodes = [...new Set(list.filter(Boolean))];
  const map = new Map();
  if (uniqueCodes.length === 0) return map;
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
  for (const it of items) map.set(it.item_code_365, it.notes ?? "");
  for (const code of uniqueCodes) if (!map.has(code)) map.set(code, "");
  return map;
}
export async function getItemNote(code) {
  const map = await getItemsNotesMap([code]);
  return map.get(code) ?? "";
}
/* ---------- Auto-healing status update ---------- */
export async function safeChangeStatus(row, maxRetries = 3, delayMs = 1000) {
  if (!row || !row.status_code_365)
    return { ok: false, error: "Missing status_code_365" };
  let attempt = 0;
  let lastOrder = null;
  while (attempt < maxRetries) {
    await bulkChangeBatchOrderStatus([row]);
    await sleep(delayMs);
    const updated = await getBatchOrderByShoppingCart({
      shopping_cart_code: row.batch_invoice_code_365,
    });
    const list = readOrdersList(updated);
    const order = list?.[0];
    const current = order?.status_code_365 || "";
    if (current === row.status_code_365) {
      return { ok: true, order, attempts: attempt + 1 };
    }
    lastOrder = order;
    attempt++;
  }
  return {
    ok: false,
    error: "Status mismatch after retries",
    order: lastOrder,
    attempts: attempt,
  };
}
/* ---------- Departments (multi-strategy) ---------- */
export async function listItemDepartments({ signal } = {}) {
  const token = getToken();
  const a = await getJSON("list_item_departments", token ? { token } : {}, {
    signal,
    includeTokenHeader: true,
    attachTokenInQuery: Boolean(token),
  });
  if (okPayload(a))
    return {
      ...a,
      list_item_departments: a?.list_item_departments || [],
      _ok: true,
      _error: "",
    };
  const b = await getJSON(
    "list_item_departments",
    {},
    { signal, includeTokenHeader: true }
  );
  if (okPayload(b))
    return {
      ...b,
      list_item_departments: b?.list_item_departments || [],
      _ok: true,
      _error: "",
    };
  const c = await postJSON(
    "list_item_departments",
    { filter_define: {} },
    { signal }
  );
  if (okPayload(c))
    return {
      ...c,
      list_item_departments: c?.list_item_departments || [],
      _ok: true,
      _error: "",
    };
  return {
    ...(a || b || c || {}),
    list_item_departments: [],
    _ok: false,
    _error:
      a?.response_msg ||
      a?.api_response?.response_msg ||
      b?.response_msg ||
      b?.api_response?.response_msg ||
      c?.response_msg ||
      c?.api_response?.response_msg ||
      "",
  };
}
/* -------------------- export http base -------------------- */
export const http = { postJSON, getJSON };

// it must show total
