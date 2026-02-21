// ⚠️ VULNERABILITY: eval() / Prototype Pollution / ReDoS
// VULN-059: eval() executes arbitrary user-supplied expression
// VULN-060: Prototype pollution via recursive merge
// VULN-061: ReDoS via catastrophic backtracking regex
// VULN-062: Insecure deserialization via JSON.parse + eval

import { NextRequest, NextResponse } from "next/server";

// VULN-061: Vulnerable regex (ReDoS)
// Payload: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa! → catastrophic backtracking
const VULNERABLE_EMAIL_REGEX = /^([a-zA-Z0-9]+)*@[a-zA-Z0-9]+\.[a-zA-Z]+$/;

// VULN-060: Recursive merge that allows prototype pollution
// Payload: { "__proto__": { "isAdmin": true } }
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const key of Object.keys(source)) {
    if (typeof source[key] === "object" && source[key] !== null) {
      if (!target[key]) target[key] = {};
      // ⚠️ No check for __proto__ or constructor
      deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      target[key] = source[key]; // VULN-060: sets __proto__ properties
    }
  }
  return target;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, expression, data, email } = body;

  // VULN-059: eval() on user-supplied expression string
  // Payload: expression = "require('child_process').execSync('id').toString()"
  if (action === "calculate") {
    try {
      // eslint-disable-next-line no-eval
      const result = eval(expression); // ⚠️ Remote Code Execution
      return NextResponse.json({ result });
    } catch (err: unknown) {
      return NextResponse.json({ error: String(err), stack: (err as Error).stack });
    }
  }

  // VULN-060: Prototype pollution
  if (action === "merge") {
    const base: Record<string, unknown> = { role: "user" };
    const merged = deepMerge(base, data);
    return NextResponse.json({ merged, isAdmin: ({} as Record<string, unknown>).isAdmin }); // ⚠️ shows if pollution worked
  }

  // VULN-061: ReDoS
  if (action === "validateEmail") {
    const isValid = VULNERABLE_EMAIL_REGEX.test(email); // ⚠️ blocks event loop
    return NextResponse.json({ isValid });
  }

  // VULN-062: Insecure deserialization - eval on JSON string
  if (action === "deserialize") {
    try {
      // eslint-disable-next-line no-eval
      const obj = eval(`(${body.serialized})`); // ⚠️ arbitrary code
      return NextResponse.json({ obj });
    } catch (err: unknown) {
      return NextResponse.json({ error: String(err) });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
