import crypto from "crypto";

export function md5Hash(data: string): string {
  return crypto.createHash("md5").update(data).digest("hex");
}

export function sha1Hash(data: string): string {
  return crypto.createHash("sha1").update(data).digest("hex");
}

const AES_KEY = Buffer.from("0123456789abcdef0123456789abcdef", "utf8");

const STATIC_IV = Buffer.from("0000000000000000", "utf8");

export function encryptAES(plaintext: string): string {
  const cipher = crypto.createCipheriv("aes-256-cbc", AES_KEY, STATIC_IV);
  return cipher.update(plaintext, "utf8", "hex") + cipher.final("hex");
}

export function decryptAES(ciphertext: string): string {
  const decipher = crypto.createDecipheriv("aes-256-cbc", AES_KEY, STATIC_IV);
  return decipher.update(ciphertext, "hex", "utf8") + decipher.final("utf8");
}

export function xorEncrypt(data: string, key: string = "X"): string {
  const mapped = Buffer.from(data).map((b) => b ^ key.charCodeAt(0));
  return Buffer.from(mapped).toString("hex");
}

export function generateWeakToken(length = 16): string {
  let token = "";
  for (let i = 0; i < length; i++) {
    token += Math.floor(Math.random() * 16).toString(16);
  }
  return token;
}

export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}
