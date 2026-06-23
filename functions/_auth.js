// Daana account system: users, sessions, PBKDF2 password hashing (WebCrypto).
// Reuses helpers from _lib.js. KV (env.DAANA_KV).
import { parseCookies, randToken, nowMs, normCode } from "./_lib.js";

const PBKDF2_ITER = 100000;
const USER_TTL_DAYS = 60;

function bytesToHex(u8){ return [...u8].map(b => b.toString(16).padStart(2, "0")).join(""); }
function hexToBytes(h){ const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
function randHex(n = 16){ const a = new Uint8Array(n); crypto.getRandomValues(a); return bytesToHex(a); }

export function normEmail(e){ return String(e || "").trim().toLowerCase(); }
export function validEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(e)); }
export function validPassword(p){ return typeof p === "string" && p.length >= 8 && p.length <= 200; }

export async function hashPassword(password, saltHex, iterations = PBKDF2_ITER){
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: hexToBytes(saltHex), iterations, hash: "SHA-256" }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

// constant-time string compare
function ctEqual(a, b){ if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

export async function getUser(kv, email){
  const raw = await kv.get("user:" + normEmail(email));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function saveUser(kv, user){
  await kv.put("user:" + normEmail(user.email), JSON.stringify(user));
}

export async function createUser(kv, email, password){
  const e = normEmail(email);
  const salt = randHex(16);
  const hash = await hashPassword(password, salt);
  const user = { email: e, pwSalt: salt, pwHash: hash, pwIter: PBKDF2_ITER, tier: "none", access: null, createdAt: nowMs() };
  await saveUser(kv, user);
  return user;
}

export async function verifyPassword(user, password){
  if (!user || !user.pwHash) return false;
  const h = await hashPassword(password, user.pwSalt, user.pwIter || PBKDF2_ITER);
  return ctEqual(h, user.pwHash);
}

export async function createUserSession(kv, email, days = 30){
  const token = randToken();
  const ttl = days * 24 * 3600;
  await kv.put("usess:" + token, JSON.stringify({ uid: normEmail(email), expiresAt: nowMs() + ttl * 1000 }), { expirationTtl: ttl });
  return { token, cookie: `daana_user=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttl}` };
}

export async function getAuthedUser(env, request){
  const token = parseCookies(request)["daana_user"];
  if (!token) return null;
  const raw = await env.DAANA_KV.get("usess:" + token);
  if (!raw) return null;
  let sess; try { sess = JSON.parse(raw); } catch { return null; }
  if (!sess || sess.expiresAt <= nowMs()) return null;
  const user = await getUser(env.DAANA_KV, sess.uid);
  if (!user) return null;
  return { token, user };
}

export async function clearUserSession(env, request){
  const token = parseCookies(request)["daana_user"];
  if (token) { try { await env.DAANA_KV.delete("usess:" + token); } catch (e) {} }
  return "daana_user=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

// Public view of a user's access state (never leak the hash).
export function userPublic(user){
  return { email: user.email, tier: user.tier || "none", access: user.access || null };
}

// Redeem an access code onto an account. Mutates+saves the user. Returns { ok, error?, user? }.
export async function redeemCodeForUser(env, user, codeRaw){
  const kv = env.DAANA_KV;
  const c = normCode(codeRaw);
  if (!c) return { ok: false, error: "missing_code" };
  const raw = await kv.get("code:" + c);
  if (!raw) return { ok: false, error: "invalid_code" };
  let rec; try { rec = JSON.parse(raw); } catch { return { ok: false, error: "invalid_code" }; }
  if (rec.active === false) return { ok: false, error: rec.kind === "person" ? "code_used" : "code_revoked" };
  // consume single-use person codes
  if (rec.kind === "person") { rec.active = false; rec.usedAt = nowMs(); rec.usedBy = user.email; await kv.put("code:" + c, JSON.stringify(rec)); }
  user.access = rec.test || "toefl";
  user.tier = rec.tier === "premium" ? "premium" : "free";
  user.codeRedeemed = c;
  await saveUser(kv, user);
  return { ok: true, user };
}
