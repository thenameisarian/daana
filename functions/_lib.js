// Daana access-gate shared logic. Pure-ish helpers usable in Pages Functions and node tests.
// KV (env.DAANA_KV): .get(key) -> string|null, .put(key,val,{expirationTtl}), .delete(key), .list({prefix})

export const WEEK = 7 * 24 * 60 * 60; // seconds
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I,L,O,0,1

export function nowMs() { return Date.now(); }

export async function sha256hex(s) {
  const data = new TextEncoder().encode(String(s || ""));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function clientIp(request) {
  return request.headers.get("CF-Connecting-IP")
    || request.headers.get("x-forwarded-for")
    || "0.0.0.0";
}

export function normCode(raw) {
  return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function randToken() {
  if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function genCode(prefix = "DAANA") {
  const pick = n => { const a = new Uint8Array(n); crypto.getRandomValues(a);
    return [...a].map(b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(""); };
  return `${prefix}-${pick(4)}-${pick(4)}`;
}

export function parseCookies(request) {
  const h = request.headers.get("Cookie") || "";
  const out = {};
  h.split(/;\s*/).forEach(p => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i)] = p.slice(i + 1); });
  return out;
}

async function kvGetJson(kv, key) {
  const raw = await kv.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Core verification. Returns { status, body, setCookie? }
export async function verifyCode(env, request, code, opts = {}) {
  const kv = env.DAANA_KV;
  const c = normCode(code);
  if (!c) return { status: 400, body: { ok: false, error: "missing_code", message: "Enter your access code." } };

  const ipHash = await sha256hex(clientIp(request) + "|" + (env.IP_SALT || "daana"));
  const codeRec = await kvGetJson(kv, "code:" + c);

  // If this IP+test already has a live grant, reuse it without consuming a code.
  // We need a test to key the grant; derive from code if present, else reject.
  if (!codeRec) {
    return { status: 403, body: { ok: false, error: "invalid_code", message: "That code isn't valid." } };
  }
  const test = codeRec.test || "toefl";
  const tier = codeRec.tier || "free";
  const now = nowMs();

  const grantKey = `grant:${test}:${ipHash}`;
  let grant = await kvGetJson(kv, grantKey);
  if (grant && grant.expiresAt > now) {
    // Already inside the 7-day window for this test+IP: issue a fresh session, don't burn a code.
    return await issueSession(kv, test, ipHash, grant.expiresAt, now, grant.tier || tier);
  }

  // No live grant -> the code must be usable.
  if (codeRec.active === false) {
    const why = codeRec.kind === "person" ? "code_used" : "code_revoked";
    const msg = codeRec.kind === "person" ? "This code has already been used." : "This code is no longer active.";
    return { status: 403, body: { ok: false, error: why, message: msg } };
  }

  // Consume person codes (single use).
  if (codeRec.kind === "person") {
    codeRec.active = false;
    codeRec.usedAt = now;
    codeRec.usedIpHash = ipHash;
    await kv.put("code:" + c, JSON.stringify(codeRec));
  }

  const expiresAt = now + WEEK * 1000;
  grant = { createdAt: now, expiresAt, code: c, ipHash, tier };
  await kv.put(grantKey, JSON.stringify(grant), { expirationTtl: WEEK });

  return await issueSession(kv, test, ipHash, expiresAt, now, tier);
}

async function issueSession(kv, test, ipHash, expiresAt, now, tier) {
  const token = randToken();
  const ttl = Math.max(60, Math.ceil((expiresAt - now) / 1000));
  await kv.put("sess:" + token, JSON.stringify({ test, ipHash, expiresAt, tier: tier || "free" }), { expirationTtl: ttl });
  const cookie = `daana_sess=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttl}`;
  return { status: 200, body: { ok: true, test, tier: tier || "free", expiresAt }, setCookie: cookie };
}

// Session check for middleware. Returns { ok, reason }
export async function checkSession(env, request, requiredTest) {
  const kv = env.DAANA_KV;
  const token = parseCookies(request)["daana_sess"];
  if (!token) return { ok: false, reason: "no_cookie" };
  const sess = await kvGetJson(kv, "sess:" + token);
  if (!sess) return { ok: false, reason: "no_session" };
  if (sess.expiresAt <= nowMs()) return { ok: false, reason: "expired" };
  if (requiredTest && sess.test !== requiredTest && sess.test !== "all") return { ok: false, reason: "wrong_test" };
  if (String(env.IP_STRICT) === "true") {
    const ipHash = await sha256hex(clientIp(request) + "|" + (env.IP_SALT || "daana"));
    if (ipHash !== sess.ipHash) return { ok: false, reason: "ip_changed" };
  }
  return { ok: true, test: sess.test, tier: sess.tier || "free" };
}

export async function getSession(env, request) {
  const kv = env.DAANA_KV;
  const token = parseCookies(request)["daana_sess"];
  if (!token) return null;
  const sess = await kvGetJson(kv, "sess:" + token);
  if (!sess || sess.expiresAt <= nowMs()) return null;
  return { test: sess.test, tier: sess.tier || "free", expiresAt: sess.expiresAt };
}

// Mint a single code (used by admin and the payment webhook).
export async function mintCode(kv, { test = "toefl", kind = "rotating", tier = "free", note = "", product = null } = {}) {
  const code = genCode(product ? (product === "course" ? "CRS" : "TIP") : "DAANA");
  const rec = { test, kind, active: true, tier, note, createdAt: Date.now() };
  if (product) rec.product = product;
  await kv.put("code:" + code, JSON.stringify(rec));
  return code;
}
