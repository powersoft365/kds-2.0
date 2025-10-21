// app/api/check-user/route.js
import { NextResponse } from "next/server";
import crypto from "crypto";

/* ========== helpers ========== */
function isBase64(str) {
  return (
    typeof str === "string" &&
    /^[A-Za-z0-9+/=]+$/.test(str) &&
    str.length % 4 === 0
  );
}
function toBase64(str) {
  if (str === undefined || str === null) return "";
  if (isBase64(str)) return str;
  try {
    return Buffer.from(String(str), "utf8").toString("base64");
  } catch {
    // eslint-disable-next-line no-undef
    return btoa(unescape(encodeURIComponent(String(str))));
  }
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

/* ========== encryption (AES-256-GCM + PBKDF2, output as hex) ========== */

/**
 * Derive a 32-byte key using PBKDF2-HMAC-SHA256.
 */
function deriveKey(secret, salt) {
  const SALT = salt || crypto.randomBytes(16);
  const ITER = 310000; // secure, but you can tune it
  const KEYLEN = 32;
  const key = crypto.pbkdf2Sync(String(secret), SALT, ITER, KEYLEN, "sha256");
  return { key, salt: SALT, iterations: ITER };
}

/**
 * Encrypt string using AES-256-GCM, return hex string in the format:
 * salt.iv.ciphertext.tag.iters
 */
function encryptHexWithSecret(secret, plaintext) {
  if (!secret) throw new Error("encryption secret is required");
  const { key, salt, iterations } = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    salt.toString("hex"),
    iv.toString("hex"),
    ciphertext.toString("hex"),
    tag.toString("hex"),
    iterations.toString(16),
  ].join(".");
}

/**
 * Decrypt (for testing)
 */
function decryptHexWithSecret(secret, blob) {
  const parts = String(blob).split(".");
  if (parts.length < 4) throw new Error("invalid encrypted blob");
  const [saltHex, ivHex, ctHex, tagHex, itersHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ctHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const iterations = itersHex ? parseInt(itersHex, 16) : 310000;
  const key = crypto.pbkdf2Sync(String(secret), salt, iterations, 32, "sha256");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/* ========== main route ========== */
export async function POST(req) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, message: "Username and password are required." },
        { status: 200 }
      );
    }

    const user_password_365 = toBase64(password);
    const envSecretRaw = process.env.POWERSOFT_REQUEST_PASSWORD_365 || "";
    const envSecret = String(envSecretRaw).trim();
    const request_password_365 = isBase64(envSecret)
      ? envSecret
      : toBase64(envSecret);

    const payload = {
      user: {
        user_name_365: username,
        user_password_365,
        request_password_365,
      },
    };

    const upstream = await fetch("https://api.powersoft365.com/check_user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await safeJson(upstream)) || {};
    const ok = data.response_code === "1" || data.response_code === 1;

    const responseBody = {
      ok,
      status: upstream.status,
      data,
    };

    if (ok) {
      const encryptionKey = process.env.POWERSOFT_ENCRYPTION_KEY || "";
      if (!String(encryptionKey).trim()) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Encryption key missing. Set POWERSOFT_ENCRYPTION_KEY on the server.",
          },
          { status: 200 }
        );
      }

      // Encrypt both username and password and include inside a single credentials object
      const encryptedUsername = encryptHexWithSecret(encryptionKey, username);
      const encryptedPassword = encryptHexWithSecret(
        encryptionKey,
        user_password_365
      );

      responseBody.credentials = {
        username: encryptedUsername,
        password: encryptedPassword,
      };
    }

    return NextResponse.json(responseBody, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: "Login check failed", error: String(error) },
      { status: 200 }
    );
  }
}
