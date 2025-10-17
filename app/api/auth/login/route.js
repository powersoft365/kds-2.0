import { NextResponse } from "next/server";
import { Agent } from "undici";

const BASE_URL = (process.env.PS365_API_BASE || "").replace(/\/$/, "");
const REQUEST_PASSWORD_365 = process.env.PS365_REQUEST_PASSWORD || "cGFzc19BUElAMzY1";

const dispatcher =
  process.env.PS365_ALLOW_INSECURE === "true"
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined;

async function postToPs365(path, body) {
  const url = `${BASE_URL}/${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      dispatcher,
    });
    return res.json();
  } catch (error) {
    console.error(`[API Call Error] to ${path}:`, error);
    throw new Error("Failed to communicate with the authentication service.");
  }
}

export async function POST(req) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ message: "Username and password are required." }, { status: 400 });
    }

    const encoded_password = Buffer.from(password).toString("base64");
    const response = await postToPs365("check_user", {
      user: {
        user_name_365: username,
        user_password_365: encoded_password,
        request_password_365: REQUEST_PASSWORD_365,
      },
    });

    if (response?.response_code !== "1") {
      return NextResponse.json({ message: response?.response_msg || "Invalid credentials." }, { status: 401 });
    }

    // Do not return password or sensitive info
    return NextResponse.json({
      success: true,
      user: { username: username }
    });

  } catch (error) {
    console.error("[Login API Error]", error);
    return NextResponse.json({ message: error.message || "An unexpected server error occurred." }, { status: 500 });
  }
}