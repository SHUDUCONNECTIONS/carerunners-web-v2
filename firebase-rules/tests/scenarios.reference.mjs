// Runs scenarios.mjs against firebase-rules/firestore.rules using Google's rules test service (a dry run: nothing is released).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { cases } from "./scenarios.mjs";
const root = process.argv[2];
const rulesFile = process.argv[3];
const require = createRequire(path.join(root, "package.json"));
const { GoogleAuth } = require("google-auth-library");
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m || process.env[m[1]]) continue;
  process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
}
const bs = String.fromCharCode(92);
const auth = new GoogleAuth({
  credentials: { client_email: process.env.FIREBASE_CLIENT_EMAIL, private_key: process.env.FIREBASE_PRIVATE_KEY.split(bs + "n").join("\n") },
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const token = (await (await auth.getClient()).getAccessToken()).token;
const source = fs.readFileSync(rulesFile, "utf8");

const res = await fetch("https://firebaserules.googleapis.com/v1/projects/care-runners-fe5b8:test", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ source: { files: [{ name: "firestore.rules", content: source }] }, testSuite: { testCases: cases.map((x) => x.tc) } }),
});
const out = await res.json();
if (!res.ok) { console.log("TEST SERVICE ERROR", JSON.stringify(out).slice(0, 1500)); process.exit(2); }
const issues = out.issues ?? [];
if (issues.length) { console.log("RULES COMPILE ISSUES:"); for (const i of issues) console.log(" ", JSON.stringify(i)); }
let fail = 0;
(out.testResults ?? []).forEach((r, i) => {
  const ok = r.state === "SUCCESS";
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${cases[i].name}${ok ? "" : "   -> " + (r.debugMessages ?? []).join(" | ").slice(0, 160) + " " + (r.errorPosition ? JSON.stringify(r.errorPosition) : "")}`);
});
console.log(`\n${cases.length} scenarios, ${fail} failed`);
process.exit(fail ? 1 : 0);
