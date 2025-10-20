import { NextResponse } from "next/server";

/**
 * Safely parse JSON, even for empty bodies or invalid JSON.
 */
async function safeJson(resp) {
  try {
    const text = await resp.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Normalize success based on upstream body, not HTTP code.
 * Success if response_code === "200" or 200
 */
function isApiSuccess(payload) {
  if (!payload) return false;
  const code = payload.response_code;
  return code === 200 || code === "200";
}

export async function POST(req) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, message: "Username and password are required." },
        { status: 200 }
      );
    }

    // Upstream appears to expect Base64 for user_password_365 (per your Postman).
    let encodedPassword;
    try {
      encodedPassword = Buffer.from(password, "utf8").toString("base64");
    } catch {
      // Edge runtime fallback
      encodedPassword = btoa(unescape(encodeURIComponent(password)));
    }

    // Put your real key in .env.local as POWERSOFT_REQUEST_PASSWORD_365
    const REQUEST_PASSWORD_365 =
      process.env.POWERSOFT_REQUEST_PASSWORD_365 || "cGFzZ19BUElAN2Y1";

    const payload = {
      user: {
        user_name_365: username,
        user_password_365: encodedPassword,
        request_password_365: REQUEST_PASSWORD_365,
      },
    };
    const upstream = await fetch("https://api.powersoft365.com/check_user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await safeJson(upstream);
    const ok = isApiSuccess(data);
    console.log(upstream);

    // Return normalized shape the frontend relies on
    return NextResponse.json(
      {
        ok,
        status: upstream.status, // typically 200 even for logical errors
        data, // includes response_code, response_msg, etc.
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: "Login check failed.",
        error: String(err),
      },
      { status: 200 }
    );
  }
}
