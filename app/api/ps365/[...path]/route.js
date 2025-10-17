export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { ironOptions } from "@/lib/session";
import { Agent } from "undici";

const BASE = (process.env.PS365_API_BASE || "").replace(/\/$/, "");

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

async function proxyPOST(req, ctx, token) {
  let bodyObj = {};
  try {
    bodyObj = await req.json();
  } catch {}

  // Ensure token is in the body per PS365 convention
  if (!bodyObj.api_credentials) bodyObj.api_credentials = { };
  bodyObj.api_credentials.token = token;

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

async function proxyGET(req, ctx, token) {
  // Build upstream URL and inject token as QUERY (per Postman)
  const urlObj = await upstreamURL(req, ctx.params);

  if (token  && !urlObj.searchParams.has("token")) {
    urlObj.searchParams.set("token", token );
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

async function proxyReqWithTokenFromSession(req, ctx, proxyReqFunc) {
  // 1. Get the session from the incoming request's cookies
  const session = await getIronSession(cookies(), ironOptions);
  const token = session.token;

  // 2. If there is no token, the user is not logged in. Deny the request.
  if (!token) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  // 3. If the token exists, proceed with the proxying, passing the token along.
  return proxyReqFunc(req, ctx, token);
}

export async function GET(req, ctx) {
  return proxyReqWithTokenFromSession(req, ctx, proxyGET);
}
export async function POST(req, ctx) {
  return proxyReqWithTokenFromSession(req, ctx, proxyPOST);
}
export async function PUT(req, ctx) {
  return proxyReqWithTokenFromSession(req, ctx, proxyPOST);
}
export async function PATCH(req, ctx) {
  return proxyReqWithTokenFromSession(req, ctx, proxyPOST);
}
export async function DELETE(req, ctx) {
  return proxyReqWithTokenFromSession(req, ctx, proxyPOST);
}