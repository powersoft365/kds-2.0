export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Agent } from "undici";

const BASE = (process.env.PS365_API_BASE || "").replace(/\/$/, "");

// dev-only: allow broken TLS
const dispatcher =
  process.env.PS365_ALLOW_INSECURE === "true"
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined;

function joinPath(seg) {
  if (!seg) return "";
  return Array.isArray(seg) ? seg.join("/") : String(seg);
}

// ---------- helpers ----------
async function upstreamURL(req, paramsPromise) {
  const params = await paramsPromise;
  const path = joinPath(params?.path);
  const u = new URL(req.url);
  const upstream = new URL(`${BASE}/${path}`);
  for (const [k, v] of u.searchParams.entries())
    upstream.searchParams.append(k, v);
  return upstream;
}

// ---------- POST ----------
async function proxyPOST(req, ctx) {
  let bodyObj = {};
  try {
    bodyObj = await req.json();
  } catch {}

  // 🔹 Extract token from request header or body
  const tokenHeader = req.headers.get("x-ps365-token");
  const tokenBody = bodyObj?.api_credentials?.token;
  const token = tokenHeader || tokenBody || "";

  // 🔹 Ensure PS365-style api_credentials
  if (!bodyObj.api_credentials) bodyObj.api_credentials = { token };
  else if (!bodyObj.api_credentials.token)
    bodyObj.api_credentials.token = token;

  // 🔹 Reject if token still missing
  if (!bodyObj.api_credentials.token) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: "Missing PowerSoft365 token. Please log in again.",
      }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  const urlObj = await upstreamURL(req, ctx.params);
  const res = await fetch(urlObj.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(bodyObj),
    dispatcher,
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}

// ---------- GET ----------
async function proxyGET(req, ctx) {
  const urlObj = await upstreamURL(req, ctx.params);
  const token = req.headers.get("x-ps365-token");
  if (token && !urlObj.searchParams.has("token")) {
    urlObj.searchParams.set("token", token);
  }

  const res = await fetch(urlObj.toString(), {
    method: "GET",
    headers: { "content-type": "application/json" },
    dispatcher,
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}

// ---------- exports ----------
export async function GET(req, ctx) {
  return proxyGET(req, ctx);
}
export async function POST(req, ctx) {
  return proxyPOST(req, ctx);
}
export async function PUT(req, ctx) {
  return proxyPOST(req, ctx);
}
export async function PATCH(req, ctx) {
  return proxyPOST(req, ctx);
}
export async function DELETE(req, ctx) {
  return proxyPOST(req, ctx);
}
