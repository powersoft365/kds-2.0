"use client";

import React from "react";
import Script from "next/script";
import { toast } from "sonner";

/** Lightweight log bus stored on window so other components can subscribe */
function useLogBus(namespace = "SignalR") {
  const push = (level, msg, data) => {
    try {
      const entry = {
        ts: new Date().toISOString(),
        level,
        ns: namespace,
        msg,
        data,
      };
      if (typeof window === "undefined") return;
      window.__srlog = Array.isArray(window.__srlog) ? window.__srlog : [];
      window.__srlog.push(entry);
      window.dispatchEvent?.(new CustomEvent("srlog", { detail: entry }));
    } catch {}
  };

  return {
    info: (m, d) => push("info", m, d),
    warn: (m, d) => {
      console.warn(`[${namespace}]`, m, d ?? "");
      push("warn", m, d);
    },
    error: (m, d) => push("error", m, d),
    group: (title) => console.group?.(`[${namespace}] ${title}`),
    groupEnd: () => console.groupEnd?.(),
    table: (rows) => push("table", rows),
  };
}

/**
 * Classic ASP.NET SignalR (2.x, jQuery-based) bridge for Next.js.
 * Adds robust logging and automatic reconnect.
 */
export default function SignalRBridge({
  onOrderUpdate,
  onAcknowledge,
  hubName = "notificationHub",
  withCredentials = false,
  debug = true,
}) {
  const log = useLogBus("SignalR");

  const SIGNALR_BASE = process.env.NEXT_PUBLIC_SIGNALR_BASE || "";
  const SIGNALR_HUBS = process.env.NEXT_PUBLIC_SIGNALR_HUBS || "";

  // ✅ Safe browser-only localStorage access
  const [token, setToken] = React.useState("");
  React.useEffect(() => {
    try {
      const t = localStorage.getItem("ps365_token") || "";
      setToken(t);
    } catch {
      setToken("");
    }
  }, []);

  // ✅ Build credentials dynamically after token loaded
  const CRED = React.useMemo(
    () => ({
      token,
      device_id: process.env.NEXT_PUBLIC_PS365_DEVICE_ID || "KDS_WEB",
      application_code_365:
        process.env.NEXT_PUBLIC_PS365_APPLICATION_CODE_365 || "KITCHENDISPLAY",
      fallback_dept:
        process.env.NEXT_PUBLIC_PS365_ITEM_DEPARTMENT_CODE_365 || "",
    }),
    [token]
  );

  const [jqReady, setJqReady] = React.useState(false);
  const [sigReady, setSigReady] = React.useState(false);
  const [hubsReady, setHubsReady] = React.useState(false);

  const hubRef = React.useRef(null);
  const startedRef = React.useRef(false);
  const retryRef = React.useRef(0);
  const stopRequested = React.useRef(false);

  React.useEffect(() => {
    if (debug) {
      log.group("Init");
      log.info("Planned API", [
        "send",
        "startCooking",
        "completeOrder",
        "revertOrder",
        "toggleItem",
        "setEta",
      ]);
      log.table([
        { key: "token", value: token ? "…present…" : "(missing!)" },
        { key: "device_id", value: CRED.device_id },
        { key: "application_code_365", value: CRED.application_code_365 },
        { key: "fallback_dept", value: CRED.fallback_dept || "(none)" },
        { key: "SIGNALR_BASE", value: SIGNALR_BASE || "(missing)" },
        { key: "SIGNALR_HUBS", value: SIGNALR_HUBS || "(missing)" },
      ]);
      log.groupEnd();
      if (!token) {
        toast("PS365 token missing", {
          description: "Please login or set ps365_token in localStorage",
        });
      }
    }
  }, [debug, token, SIGNALR_BASE, SIGNALR_HUBS, CRED]);

  const scheduleReconnect = React.useCallback(() => {
    if (stopRequested.current) return;
    const base = 2000;
    const max = 15000;
    const ms = Math.min(max, base * Math.pow(2, retryRef.current++));
    log.warn("Scheduling reconnect in ms", ms);
    setTimeout(() => !stopRequested.current && startConnection(), ms);
  }, []); // eslint-disable-line

  const startConnection = React.useCallback(() => {
    try {
      const $ = window.jQuery || window.$;
      if (
        !jqReady ||
        !sigReady ||
        !hubsReady ||
        !$ ||
        !$.connection ||
        startedRef.current
      )
        return;

      if (!SIGNALR_BASE || !SIGNALR_HUBS) {
        toast.error("SignalR: missing env for BASE/HUBS");
        log.error("ENV missing", { SIGNALR_BASE, SIGNALR_HUBS });
        return;
      }

      const hub = $.connection[hubName];
      if (!hub) {
        toast.error(`SignalR hub "${hubName}" not found`);
        log.error("Hub not found", { hubName, connection: $.connection });
        return;
      }
      hubRef.current = hub;

      // ✅ Add query credentials
      $.connection.hub.qs = {
        token: CRED.token,
        device_id: CRED.device_id,
        application_code_365: CRED.application_code_365,
      };

      // ===== INBOUND =====
      hub.client.acknowledgeMessage = (message) => {
        log.group("acknowledgeMessage");
        log.info("RAW", message);
        try {
          const obj =
            typeof message === "string" ? JSON.parse(message) : message;
          log.table([obj]);
          toast.success(
            obj?.response_msg ||
              (obj?.response_code === "1" ? "OK" : "ACK") ||
              "ACK"
          );
        } catch {
          toast(message || "ACK");
        }
        log.groupEnd();
        onAcknowledge?.(message);
      };

      hub.client.orderChanged = (payload) => {
        log.group("orderChanged");
        log.info("Payload", payload);
        log.groupEnd();
        toast("Order update received");
        onOrderUpdate?.(payload);
      };

      // ===== CONNECT =====
      $.connection.hub.url = SIGNALR_BASE;
      log.info("Connecting…", { url: $.connection.hub.url });

      $.connection.hub
        .start({ withCredentials })
        .done(() => {
          retryRef.current = 0;
          startedRef.current = true;
          const id = $.connection?.hub?.id;
          log.info("Connected", { hubId: id });
          toast.success("SignalR connected", {
            description: id ? `Hub ID: ${id}` : undefined,
            duration: 1500,
          });
        })
        .fail((e) => {
          log.error("Start failed", e);
          toast.error("SignalR connection failed", {
            description: e?.message || String(e),
          });
          scheduleReconnect();
        });

      $.connection.hub.reconnecting(() => {
        log.warn("Reconnecting…");
      });
      $.connection.hub.reconnected(() => {
        log.info("Reconnected");
        toast.success("SignalR reconnected");
      });
      $.connection.hub.disconnected(() => {
        startedRef.current = false;
        if (stopRequested.current) return;
        log.warn("Disconnected — will reconnect");
        toast("SignalR disconnected", { description: "Reconnecting…" });
        scheduleReconnect();
      });

      // ===== OUTBOUND =====
      const clone = (v) => {
        try {
          return typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v;
        } catch {
          return v;
        }
      };
      const withCreds = (payload, dept) => ({
        token: CRED.token,
        device_id: CRED.device_id,
        application_code_365: CRED.application_code_365,
        ...(dept ? { item_department_code_365: dept } : {}),
        ...clone(payload),
      });

      async function call(methodName, payload, dept) {
        const h = hubRef.current;
        if (!h?.server) throw new Error("SignalR hub not ready");
        const body = withCreds(payload, dept);
        log.group(`send → ${methodName}`);
        log.info("Body", body);
        try {
          if (h.server[methodName]) {
            const res = await h.server[methodName](body);
            log.info("Result", res);
            toast.success(`Sent: ${methodName}`);
            return res;
          }
          if (h.server.helloRestaurant) {
            const res = await h.server.helloRestaurant(JSON.stringify(body));
            log.info("Result (fallback)", res);
            toast.success(`Sent: ${methodName} (fallback)`);
            return res;
          }
          if (h.server.send) {
            const res = await h.server.send(body);
            log.info("Result (send)", res);
            toast.success(`Sent: ${methodName} (generic)`);
            return res;
          }
          throw new Error(`No server method for "${methodName}"`);
        } catch (e) {
          log.error(`Send failed (${methodName})`, e);
          toast.error(`SignalR send failed: ${methodName}`);
          throw e;
        } finally {
          log.groupEnd();
        }
      }

      const api = {
        async send(type, payload, dept = CRED.fallback_dept) {
          return call(type, { type, ...clone(payload) }, dept);
        },
        async startCooking(order, dept = CRED.fallback_dept) {
          return call("startCooking", order, dept);
        },
        async completeOrder(order, dept = CRED.fallback_dept) {
          return call("completeOrder", order, dept);
        },
        async revertOrder(order, dept = CRED.fallback_dept) {
          return call("revertOrder", order, dept);
        },
        async toggleItem(
          orderId,
          itemId,
          itemStatus,
          dept = CRED.fallback_dept
        ) {
          return call("toggleItem", { orderId, itemId, itemStatus }, dept);
        },
        async setEta(orderId, etaMinutes, dept = CRED.fallback_dept) {
          return call("setEta", { orderId, etaMinutes }, dept);
        },
      };

      window.SignalR = api;
      log.info("window.SignalR ready", Object.keys(api));
    } catch (e) {
      log.error("Init error", e);
      toast.error("SignalR init error", { description: String(e) });
      scheduleReconnect();
    }
  }, [
    jqReady,
    sigReady,
    hubsReady,
    SIGNALR_BASE,
    SIGNALR_HUBS,
    hubName,
    onAcknowledge,
    onOrderUpdate,
    scheduleReconnect,
    withCredentials,
    CRED,
  ]);

  React.useEffect(() => {
    if (!token) return; // wait until token ready
    startConnection();
    return () => {
      stopRequested.current = true;
      try {
        const $ = window.jQuery || window.$;
        if ($?.connection?.hub?.stop) $.connection.hub.stop();
      } catch {}
      startedRef.current = false;
      delete window.SignalR;
    };
  }, [startConnection, token]);

  return (
    <>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"
        strategy="afterInteractive"
        onLoad={() => setJqReady(true)}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/signalr.js/2.4.2/jquery.signalR.min.js"
        strategy="afterInteractive"
        onLoad={() => setSigReady(true)}
      />
      {jqReady && sigReady ? (
        <Script
          src={SIGNALR_HUBS}
          strategy="afterInteractive"
          onLoad={() => setHubsReady(true)}
          onError={() => toast.error("Failed to load /signalr/hubs")}
        />
      ) : null}
    </>
  );
}
