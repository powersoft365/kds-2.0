import { NextResponse } from "next/server";
import crypto from "crypto";

function deriveKey(secret, salt) {
  const key = crypto.pbkdf2Sync(secret, salt, 310000, 32, "sha256");
  return key;
}

function decryptHexWithSecret(secret, blob) {
  const parts = blob.split(".");
  if (parts.length < 5) throw new Error("Invalid encrypted format");
  const [saltHex, ivHex, ctHex, tagHex, itersHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ctHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  const key = deriveKey(secret, salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

async function safeJson(resp) {
  try {
    const text = await resp.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const { companyCode, encryptedUsername } = await req.json();
    if (!companyCode || !encryptedUsername) {
      return NextResponse.json(
        { ok: false, message: "Missing companyCode or encryptedUsername" },
        { status: 400 }
      );
    }

    const secret = (process.env.POWERSOFT_ENCRYPTION_KEY || "").trim();
    if (!secret)
      return NextResponse.json(
        { ok: false, message: "Missing POWERSOFT_ENCRYPTION_KEY on server" },
        { status: 500 }
      );

    const decryptedUsername = decryptHexWithSecret(secret, encryptedUsername);

    const url = `${process.env.PS365_API_BASE}/list_company_active_databases?company_code_365=${companyCode}&user_name_365=${decryptedUsername}`;

    const upstream = await fetch(url, { method: "GET" });
    const data = (await safeJson(upstream)) || {};

    const ok = data?.api_response?.response_code === "1";
    return NextResponse.json({ ok, data }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: "Failed to fetch databases", error: String(err) },
      { status: 500 }
    );
  }
}
