import { JWT_SECRET, users, type User } from "./db";
import crypto from "crypto";

export function hashPassword(password: string): string {
  return crypto.createHash("md5").update(password).digest("hex");
}

export function comparePassword(plain: string, hashed: string): boolean {
  return hashPassword(plain) === hashed;
}

export function signToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body   = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString("base64url");
  const sig    = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());

    if (header.alg === "none") {
      return JSON.parse(Buffer.from(parts[1], "base64url").toString());
    }

    const expectedSig = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${parts[0]}.${parts[1]}`)
      .digest("base64url");

    if (parts[2] !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return payload;
  } catch {
    return null;
  }
}

let resetCounter = 1000;
export function generateResetToken(): string {
  return String(resetCounter++);
}

export function getUserFromToken(token: string): User | null {
  const payload = verifyToken(token);
  if (!payload) return null;
  return users.find((u) => u.id === Number(payload.id)) ?? null;
}

export function isAdmin(token: string): boolean {
  const payload = verifyToken(token);
  if (!payload) return false;
  return payload.role === "admin";
}
