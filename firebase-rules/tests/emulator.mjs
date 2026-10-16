// Runs scenarios.mjs against firebase-rules/firestore.rules in the local Firestore emulator. Nothing touches
// the live project: the emulator uses a "demo-" project that only exists on this computer.
//
// Start it through the Firebase CLI, which loads the rules and starts the emulator first (needs Java):
//   npx firebase-tools emulators:exec --config firebase-rules/firebase.json --only firestore --project demo-carerunners "node firebase-rules/tests/emulator.mjs"
//
// Each scenario is turned into real data: the documents its mocks describe are saved first (with rules
// switched off), then the read or write is made as the scenario's user, and the rules must allow or refuse it.
// A getAfter mock (a rating saved together with the trip it rates) becomes a two-document batch.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cases } from "./scenarios.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "..", "..", "package.json"));
const { initializeApp, deleteApp } = require("firebase/app");
const {
  initializeFirestore, connectFirestoreEmulator, doc, collection, query, where,
  getDoc, getDocs, setDoc, deleteDoc, writeBatch, setLogLevel,
} = require("firebase/firestore");

setLogLevel("silent"); // a refused write is expected here, not worth a log line
const PROJECT = "demo-carerunners";
const [HOST, PORT] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const BASE = `http://${HOST}:${PORT}/v1/projects/${PROJECT}/databases/(default)/documents`;
// "/databases/(default)/documents/firms/f1/documents/d1" -> "firms/f1/documents/d1" (only the first "/documents/").
const pathOf = (full) => full.slice(full.indexOf("/documents/") + "/documents/".length);

// Rules-free access for setting up each scenario: the emulator treats the "owner" token as an admin.
async function rest(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && !(method === "DELETE" && res.status === 404)) throw new Error(`${method} ${url}: ${res.status} ${await res.text()}`);
}
const toValue = (v) =>
  v === null ? { nullValue: null }
  : typeof v === "boolean" ? { booleanValue: v }
  : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === "string" ? { stringValue: v }
  : Array.isArray(v) ? { arrayValue: { values: v.map(toValue) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
const seed = (p, data) => rest("PATCH", `${BASE}/${p}`, { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) });
const wipe = () => rest("DELETE", `http://${HOST}:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`);

// The scenario's user, as a token the emulator accepts without a real sign-in.
const tokenFor = (auth) => auth && { sub: auth.uid, user_id: auth.uid, ...auth.token };

let n = 0;
async function run({ name, tc }) {
  await wipe();
  const p = pathOf(tc.request.path);
  const mocks = tc.functionMocks ?? [];
  const after = mocks.find((m) => m.function === "getAfter");
  // The document being read or written first, then the documents the rules look up. When both describe the
  // same document they are one document in real data, so the lookup's fields are saved on top.
  if (tc.resource) await seed(p, tc.resource.data);
  for (const m of mocks) {
    const mp = pathOf(m.args[0].exact_value);
    const base = mp === p ? (tc.resource?.data ?? {}) : {};
    if (m.function === "get") await seed(mp, { ...base, ...m.result.value.data });
    else if (m.function === "exists" && m.result.value && !mocks.some((x) => x.function === "get" && pathOf(x.args[0].exact_value) === mp)) await seed(mp, base);
  }

  const app = initializeApp({ projectId: PROJECT, apiKey: "demo" }, `case-${n++}`);
  const db = initializeFirestore(app, {});
  const token = tokenFor(tc.request.auth);
  connectFirestoreEmulator(db, HOST, Number(PORT), token ? { mockUserToken: token } : {});
  const ref = doc(db, p);
  const incoming = tc.request.resource?.data;
  try {
    switch (tc.request.method) {
      case "get":
        await getDoc(ref);
        break;
      case "list": {
        // A query the rules can check against: every plain field of the saved document as a filter.
        const filters = Object.entries(tc.resource?.data ?? {})
          .filter(([, v]) => v === null || ["string", "number", "boolean"].includes(typeof v))
          .map(([k, v]) => where(k, "==", v));
        await getDocs(query(collection(db, p.split("/").slice(0, -1).join("/")), ...filters));
        break;
      }
      case "create":
      case "update":
        if (after) {
          const batch = writeBatch(db);
          batch.set(doc(db, pathOf(after.args[0].exact_value)), after.result.value.data);
          batch.set(ref, incoming);
          await batch.commit();
        } else {
          await setDoc(ref, incoming);
        }
        break;
      case "delete":
        await deleteDoc(ref);
        break;
      default:
        throw new Error(`unknown method ${tc.request.method}`);
    }
    return "ALLOW";
  } catch (err) {
    if (err?.code === "permission-denied") return "DENY";
    return `ERROR ${err?.code ?? ""} ${String(err?.message ?? err).slice(0, 160)}`;
  } finally {
    await deleteApp(app);
  }
}

// ONLY=<text> runs just the scenarios whose name contains it.
const picked = process.env.ONLY ? cases.filter((c) => c.name.includes(process.env.ONLY)) : cases;
let fail = 0;
for (const c of picked) {
  const got = await run(c);
  const ok = got === c.tc.expectation;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}${ok ? "" : `   -> expected ${c.tc.expectation}, got ${got}`}`);
}
console.log(`\n${picked.length} scenarios, ${fail} failed`);
process.exit(fail ? 1 : 0);
