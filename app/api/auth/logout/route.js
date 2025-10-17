import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ironOptions } from "@/lib/session";

export async function POST(req) {
  const session = await getIronSession(cookies(), ironOptions);
  session.destroy();
  return NextResponse.json({ ok: true });
}