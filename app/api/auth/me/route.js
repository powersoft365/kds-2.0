import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { ironOptions } from "@/lib/session";

export async function GET(req) {
  const session = await getIronSession(cookies(), ironOptions);

  if (!session.token) {
    return NextResponse.json({ isAuthenticated: false });
  }

  return NextResponse.json({
    isAuthenticated: true,
    // You can add user info here if you store it in the session during login
  });
}