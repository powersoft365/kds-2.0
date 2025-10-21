import { NextResponse } from "next/server";
import crypto from "crypto";
import { Agent } from "undici";

/* ====================== CONFIG ====================== */
const BASE_URL = (process.env.PS365_API_BASE || "").replace(/\/$/, "");
const APP_CODE_365 = process.env.PS365_APP_CODE;
const DEVICE_ID = process.env.PS365_DEVICE_ID || "121121212";
const COMMENTS =
  process.env.PS365_TOKEN_COMMENTS || "Token for KDS Application";
const ENCRYPTION_KEY = process.env.POWERSOFT_ENCRYPTION_KEY;

if (!APP_CODE_365 || !BASE_URL || !DEVICE_ID || !COMMENTS || !ENCRYPTION_KEY) {
  throw new Error(
    "Missing environment variable(s): PS365_APP_CODE, PS365_API_BASE, PS365_DEVICE_ID, PS365_TOKEN_COMMENTS, POWERSOFT_ENCRYPTION_KEY"
  );
}

const dispatcher =
  process.env.PS365_ALLOW_INSECURE === "true"
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined;

/* ====================== HELPERS ====================== */

const API_CODES = {
  SUCCESS: "1",
  ALREADY_EXISTS: ["319", "993"],
  NOT_FOUND: "307",
  SPECIAL_SUCCESS: ["316", "991"],
};

/**
 * AES-256-GCM Decrypt (used by check-user)
 * format: salt.iv.ciphertext.tag.iters
 */
function decryptHexWithSecret(secret, blob) {
  try {
    const parts = blob.split(".");
    if (parts.length < 5) return "";
    const [saltHex, ivHex, ctHex, tagHex, itersHex] = parts;
    const salt = Buffer.from(saltHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const ciphertext = Buffer.from(ctHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const iterations = parseInt(itersHex, 16) || 310000;

    const key = crypto.pbkdf2Sync(secret, salt, iterations, 32, "sha256");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

/* POST helper to PowerSoft */
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

/* Try creating token */
async function tryCreateToken(databaseId, username, password) {
  const body = {
    application_code_365: APP_CODE_365,
    database_code_365: databaseId,
    user_name_365: username,
    user_password: password, // already base64 from check-user
    device_id: DEVICE_ID,
    comments: COMMENTS,
  };

  const data = await postToPs365("create_token_by_device_id", body);

  if (
    data.response_code === API_CODES.SUCCESS ||
    API_CODES.SPECIAL_SUCCESS.includes(data.response_code)
  ) {
    return { ok: true, token: data.response_id };
  }

  if (API_CODES.ALREADY_EXISTS.includes(data.response_code)) {
    const oldDeviceId =
      data.response_id || data.response_msg?.trim().split(" ").pop();
    return { ok: false, relocate: true, oldDeviceId };
  }

  return { ok: false, message: data.response_msg || "Token creation failed." };
}

/* Try deleting token if duplicate */
async function tryDeleteToken(oldDeviceId, databaseId, username) {
  const body = {
    application_code_365: APP_CODE_365,
    database_code_365: databaseId,
    user_name_365: username,
    device_id: oldDeviceId,
    reason: "Relocating KDS user connection.",
  };

  const data = await postToPs365("delete_token_by_device_id_and_user", body);
  return (
    data.response_code === API_CODES.SUCCESS ||
    data.response_code === API_CODES.NOT_FOUND
  );
}

/* ====================== MAIN ROUTE ====================== */
export async function POST(req) {
  try {
    const { username, password, databaseCode } = await req.json();

    if (!username || !password || !databaseCode) {
      return NextResponse.json(
        { ok: false, message: "Missing username, password or database code." },
        { status: 400 }
      );
    }

    // 🔓 decrypt from cred
    const plainUsername = decryptHexWithSecret(ENCRYPTION_KEY, username);
    const plainPassword = decryptHexWithSecret(ENCRYPTION_KEY, password);

    if (!plainUsername || !plainPassword) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Failed to decrypt credentials. Check POWERSOFT_ENCRYPTION_KEY.",
        },
        { status: 400 }
      );
    }

    // ⚙️ Attempt token creation
    const first = await tryCreateToken(
      databaseCode,
      plainUsername,
      plainPassword
    );

    if (first.ok) {
      return NextResponse.json({ ok: true, token: first.token });
    }

    // 🔁 If relocation needed
    if (first.relocate && first.oldDeviceId) {
      const deleted = await tryDeleteToken(
        first.oldDeviceId,
        databaseCode,
        plainUsername
      );
      if (deleted) {
        const second = await tryCreateToken(
          databaseCode,
          plainUsername,
          plainPassword
        );
        if (second.ok)
          return NextResponse.json({ ok: true, token: second.token });
      }
      return NextResponse.json(
        { ok: false, message: "Token relocation failed." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: false, message: first.message || "Token creation failed." },
      { status: 500 }
    );
  } catch (error) {
    console.error("[Token Error]", error);
    return NextResponse.json(
      { ok: false, message: "Unexpected server error during token creation." },
      { status: 500 }
    );
  }
}
