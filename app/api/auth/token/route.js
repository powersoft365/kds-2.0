import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { ironOptions } from "@/lib/session";
import { Agent } from "undici";

const BASE_URL = (process.env.PS365_API_BASE || "").replace(/\/$/, "");
const APP_CODE_365 = process.env.PS365_APP_CODE;
const DEVICE_ID = process.env.PS365_DEVICE_ID || "121121212";
const COMMENTS = process.env.PS365_TOKEN_COMMENTS || "Token for KDS Application";

if (!APP_CODE_365 || !BASE_URL || ! DEVICE_ID  || !COMMENTS) {
  throw new Error("PS365_APP_CODE, BASE_URL, DEVICE_ID, or COMMENTS are not defined in environment variables.");
}

const dispatcher =
  process.env.PS365_ALLOW_INSECURE === "true"
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined;

const API_RESPONSE_CODES = {
  SUCCESS: "1",
  ALREADY_EXISTS: ["319", "993"],
  NOT_FOUND: "307",
  SPECIAL_SUCCESS: ["316", "991"],
};

async function postToPs365(path, body) {
  const url = `${BASE_URL}/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    dispatcher,
  });
  return res.json();
}

async function _tryCreateToken(databaseId, username, password) {
  const requestBody = {
    application_code_365: APP_CODE_365,
    database_code_365: databaseId,
    user_name_365: username,
    user_password: Buffer.from(password).toString("base64"),
    device_id: DEVICE_ID,
    comments: COMMENTS,
  };

  const data = await postToPs365("create_token_by_device_id", requestBody);

  if (data.response_code === API_RESPONSE_CODES.SUCCESS || API_RESPONSE_CODES.SPECIAL_SUCCESS.includes(data.response_code)) {
    return { isSuccess: true, token: data.response_id };
  }
  if (API_RESPONSE_CODES.ALREADY_EXISTS.includes(data.response_code)) {
    const oldDeviceId = data.response_id || data.response_msg?.trim().split(" ").pop();
    return { isSuccess: false, needsRelocation: true, oldDeviceId };
  }
  return { isSuccess: false, message: data.response_msg || "Token creation failed." };
}

async function _tryDeleteToken(oldDeviceId, databaseId, username) {
  const requestBody = {
    application_code_365: APP_CODE_365,
    database_code_365: databaseId,
    user_name_365: username,
    device_id: oldDeviceId,
    reason: "Relocating KDS user connection.",
  };
  const data = await postToPs365("delete_token_by_device_id_and_user", requestBody);
  return data.response_code === API_RESPONSE_CODES.SUCCESS || data.response_code === API_RESPONSE_CODES.NOT_FOUND;
}

export async function POST(req) {
  const session = await getIronSession(cookies(), ironOptions);

  try {
    const { databaseId, username, password } = await req.json();
    if (!databaseId || !username || !password) {
      return NextResponse.json({ message: "Database ID, username, and password are required." }, { status: 400 });
    }

    let finalToken = null;

    const initialResult = await _tryCreateToken(databaseId, username, password);
    if (initialResult.isSuccess) {
      finalToken = initialResult.token;
    } else if (initialResult.needsRelocation && initialResult.oldDeviceId) {
      const deleteSuccess = await _tryDeleteToken(initialResult.oldDeviceId, databaseId, username);
      if (deleteSuccess) {
        const finalResult = await _tryCreateToken(databaseId, username, password);
        if (finalResult.isSuccess) {
          finalToken = finalResult.token;
        } else {
          return NextResponse.json({ message: `Failed to create token after relocation: ${finalResult.message}` }, { status: 500 });
        }
      } else {
        return NextResponse.json({ message: "Failed to delete existing token during relocation." }, { status: 500 });
      }
    } else {
      return NextResponse.json({ message: initialResult.message || "An unknown error occurred during token creation." }, { status: 500 });
    }
    
    if (finalToken) {
        // Save the token and databaseId in the secure session cookie
        session.token = finalToken;
        session.databaseId = databaseId;
        await session.save();

        return NextResponse.json({ ok: true });
    }
    
    // This should not be reached if logic is correct, but as a fallback:
    throw new Error("Could not obtain a token.");

  } catch (error) {
    console.error("[Token API Error]", error);
    // Ensure session is cleared on failure
    session.destroy();
    return NextResponse.json({ message: "An unexpected server error occurred during token creation." }, { status: 500 });
  }
}