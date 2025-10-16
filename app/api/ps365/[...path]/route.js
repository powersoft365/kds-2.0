export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Agent } from "undici";

const BASE = (process.env.PS365_API_BASE || "").replace(/\/$/, "");
const TOKEN = process.env.PS365_TOKEN || "";

// dev-only: allow broken TLS from the test host
const dispatcher =
  process.env.PS365_ALLOW_INSECURE === "true"
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined;

function joinPath(seg) {
  if (!seg) return "";
  return Array.isArray(seg) ? seg.join("/") : String(seg);
}

// 🔹 MUST await params (Next.js rule)
async function upstreamURL(req, paramsPromise) {
  const params = await paramsPromise;
  const path = joinPath(params?.path);
  const u = new URL(req.url);

  // We’ll build the upstream URL first…
  const upstream = new URL(`${BASE}/${path}`);
  // copy original query params
  for (const [k, v] of u.searchParams.entries())
    upstream.searchParams.append(k, v);

  return upstream;
}

async function proxyPOST(req, ctx) {
  let bodyObj = {};
  try {
    bodyObj = await req.json();
  } catch {}

  // Ensure token is in the body per PS365 convention
  if (!bodyObj.api_credentials) bodyObj.api_credentials = { token: TOKEN };

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

async function proxyGET(req, ctx) {
  // Build upstream URL and inject token as QUERY (per Postman)
  const urlObj = await upstreamURL(req, ctx.params);
  if (TOKEN && !urlObj.searchParams.has("token")) {
    urlObj.searchParams.set("token", TOKEN);
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
