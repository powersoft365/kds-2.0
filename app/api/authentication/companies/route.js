// app/api/authentication/companies/route.js
import { NextResponse } from "next/server";
import crypto from "crypto";

/* ---------------- helpers ---------------- */
function deriveKey(secret, salt, iterations = 310000) {
  return crypto.pbkdf2Sync(String(secret), salt, iterations, 32, "sha256");
}

function decryptHexWithSecret(secret, blob) {
  const parts = String(blob).split(".");
  if (parts.length < 4) throw new Error("Invalid encrypted blob");

  const [saltHex, ivHex, ctHex, tagHex, itersHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ctHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const iterations = itersHex ? parseInt(itersHex, 16) : 310000;

  const key = deriveKey(secret, salt, iterations);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
  return plaintext;
}

/* ---------------- handler ---------------- */
export async function POST(req) {
  try {
    const { encryptedUsername } = await req.json();
    if (!encryptedUsername)
      return NextResponse.json(
        { ok: false, message: "Missing username" },
        { status: 400 }
      );

    const encryptionKey = (process.env.POWERSOFT_ENCRYPTION_KEY || "").trim();
    if (!encryptionKey)
      return NextResponse.json(
        { ok: false, message: "Server encryption key missing" },
        { status: 500 }
      );

    // decrypt username from encrypted blob
    const username = decryptHexWithSecret(encryptionKey, encryptedUsername);

    // fetch from Powersoft API
    const url = `${
      process.env.PS365_API_BASE
    }/list_user_active_companies?user_name_365=${encodeURIComponent(username)}`;

    const upstream = await fetch(url, { method: "GET" });
    const data = await upstream.json();

    return NextResponse.json(
      {
        ok: true,
        status: upstream.status,
        data,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: "Company list fetch failed", error: String(error) },
      { status: 200 }
    );
  }
}
