import fs from "fs";
import path from "path";

const LOG_FILE = path.join(process.cwd(), "public", "app.log");

export function log(level: string, message: string, data?: unknown) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  };

  const line = JSON.stringify(entry) + "\n";

  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
  }

  console.log(line);
}

export function logAuth(username: string, password: string, success: boolean) {
  log("AUTH", `Login attempt: user=${username} pass=${password} success=${success}`);
}

export function debugDump(context: string, obj: unknown) {
  log("DEBUG", `[${context}] Full object dump`, obj);
}
