"use client";

import React from "react";
import Script from "next/script";
import { toast } from "sonner";

/**
 * Simple console logger with namespace.
 */
function useLogBus(namespace = "SignalR") {
  const push = (level, msg, data) => {
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
    console[level](`[${namespace}] ${msg}`, data || "");
    window.dispatchEvent?.(new CustomEvent("srlog", { detail: entry }));
  };
  return {
    info: (m, d) => push("info", m, d),
    warn: (m, d) => push("warn", m, d),
    error: (m, d) => push("error", m, d),
  };
}

/**
 * Enhanced SignalR Bridge – listens for real-time events and logs them live.
 */
export default function SignalRBridge({
  hubName = "notificationHub",
  withCredentials = false,
  debug = true,
}) {
  const log = useLogBus("SignalR");
  const [jqReady, setJqReady] = React.useState(false);
  const [sigReady, setSigReady] = React.useState(false);
  const [hubsReady, setHubsReady] = React.useState(false);

  const SIGNALR_BASE = process.env.NEXT_PUBLIC_SIGNALR_BASE || "";
  const SIGNALR_HUBS = process.env.NEXT_PUBLIC_SIGNALR_HUBS || "";
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("ps365_token") || ""
      : "";

  const startedRef = React.useRef(false);
  const stopRequested = React.useRef(false);
  const retryRef = React.useRef(0);

  const scheduleReconnect = React.useCallback(() => {
    if (stopRequested.current) return;
    const delay = Math.min(15000, 2000 * Math.pow(2, retryRef.current++));
    log.warn(`Reconnecting in ${delay}ms`);
    setTimeout(() => !stopRequested.current && startConnection(), delay);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startConnection = React.useCallback(() => {
    try {
      const $ = window.jQuery || window.$;
      if (!jqReady || !sigReady || !hubsReady || !$ || !$.connection) {
        log.warn("SignalR libs not ready yet");
        return;
      }

      if (startedRef.current) {
        log.info("Already connected, skipping start");
        return;
      }

      const hub = $.connection[hubName];
      if (!hub) {
        toast.error(`Hub "${hubName}" not found`);
        log.error("Hub not found", { hubName });
        return;
      }

      // Setup connection
      $.connection.hub.url = SIGNALR_BASE;
      $.connection.hub.qs = {
        token,
        device_id: process.env.NEXT_PUBLIC_PS365_DEVICE_ID || "KDS_WEB",
        application_code_365:
          process.env.NEXT_PUBLIC_PS365_APPLICATION_CODE_365 ||
          "KITCHENDISPLAY",
        item_department_code_365: "FOOD",
      };

      // ==============================
      // ✅ INBOUND EVENTS
      // ==============================
      hub.client.acknowledgeMessage = (message) => {
        log.info("📩 acknowledgeMessage", message);
        console.log("✅ Acknowledge received:", message);
      };

      hub.client.orderChanged = (payload) => {
        log.info("🍽️ orderChanged", payload);
        console.log("🔴 LIVE ORDER UPDATE:", payload);
        toast("🍽️ New order update received!", {
          description:
            typeof payload === "string"
              ? payload
              : JSON.stringify(payload, null, 2),
        });
      };

      hub.client.helloRestaurant = (msg) => {
        log.info("👋 helloRestaurant", msg);
        console.log("👋 Hello Restaurant:", msg);
      };

      // ==============================
      // ✅ OUTBOUND SENDER (optional)
      // ==============================
      window.SignalR = {
        send: async (type, data) => {
          const hub = $.connection[hubName];
          if (!hub?.server) {
            log.error("Hub not ready");
            return;
          }
          try {
            const res = await hub.server[type](data);
            log.info(`Sent ${type}`, res);
            console.log(`📤 Sent ${type}:`, data);
            return res;
          } catch (e) {
            log.error("Send failed", e);
          }
        },
      };

      // ==============================
      // ✅ CONNECTION EVENTS
      // ==============================
      $.connection.hub
        .start({ withCredentials })
        .done(() => {
          startedRef.current = true;
          retryRef.current = 0;
          const hubId = $.connection?.hub?.id;
          log.info("✅ Connected", { hubId });
          console.log(`✅ SignalR connected (Hub ID: ${hubId})`);
          toast.success("✅ SignalR connected", { duration: 1500 });
        })
        .fail((e) => {
          log.error("Connection failed", e);
          console.error("SignalR start failed:", e);
          toast.error("SignalR failed to connect");
          scheduleReconnect();
        });

      $.connection.hub.reconnecting(() => {
        log.warn("Reconnecting...");
        console.log("⚠️ SignalR reconnecting...");
      });
      $.connection.hub.reconnected(() => {
        log.info("Reconnected");
        console.log("🔄 SignalR reconnected");
        toast.success("🔄 SignalR reconnected", { duration: 1000 });
      });
      $.connection.hub.disconnected(() => {
        startedRef.current = false;
        if (stopRequested.current) return;
        log.warn("Disconnected, scheduling reconnect");
        console.warn("⚠️ SignalR disconnected, will reconnect...");
        toast("⚠️ SignalR disconnected", {
          description: "Reconnecting…",
        });
        scheduleReconnect();
      });
    } catch (err) {
      log.error("Init error", err);
      console.error("SignalR init error:", err);
      toast.error("SignalR init error", { description: String(err) });
      scheduleReconnect();
    }
  }, [jqReady, sigReady, hubsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    startConnection();
    return () => {
      stopRequested.current = true;
      try {
        const $ = window.jQuery || window.$;
        if ($?.connection?.hub?.stop) {
          $.connection.hub.stop(true);
          console.log("🧹 SignalR stopped cleanly");
        }
      } catch (e) {
        console.warn("SignalR cleanup error:", e);
      }
    };
  }, [startConnection]);

  return (
    <>
      {/* Load jQuery */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log("✅ jQuery loaded");
          setJqReady(true);
        }}
      />
      {/* Load SignalR core */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/signalr.js/2.4.2/jquery.signalR.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log("✅ SignalR core loaded");
          setSigReady(true);
        }}
      />
      {/* Load the Hubs file */}
      {jqReady && sigReady && (
        <Script
          src={SIGNALR_HUBS}
          strategy="afterInteractive"
          onLoad={() => {
            console.log("✅ /signalr/hubs loaded");
            setHubsReady(true);
          }}
          onError={() => toast.error("❌ Failed to load SignalR hubs script")}
        />
      )}
    </>
  );
}
