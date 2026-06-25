// Reusable, provider-agnostic payment core. Drop into any project; set fulfillOrder + providers.
import { PROVIDERS } from "./_pay_providers.js";
import { fulfillOrder } from "./_fulfill.js";
import { randToken } from "./_lib.js";

export function genOrderId(){ return "ord_" + randToken().slice(0, 20); }
export async function getOrder(kv, id){ const r = await kv.get("order:" + id); if (!r) return null; try { return JSON.parse(r); } catch { return null; } }
export async function saveOrder(kv, o){ await kv.put("order:" + o.id, JSON.stringify(o), { expirationTtl: 60 * 60 * 24 * 60 }); }

export async function createCheckout(env, { provider, amount, currency, item, orderId, customer } = {}){
  const kv = env.DAANA_KV;
  const prov = PROVIDERS[provider];
  if (!prov) return { ok: false, error: "unknown_provider" };
  orderId = orderId || genOrderId();
  const order = { id: orderId, status: "pending", provider, item: item || null, amount: amount || null, currency: currency || "USD", customer: customer || null, createdAt: Date.now() };
  await saveOrder(kv, order);
  const res = await prov.createSession(env, order);
  if (res && res.sessionId) { order.sessionId = res.sessionId; await saveOrder(kv, order); }
  return Object.assign({ ok: res ? res.ok !== false : false, orderId }, res || {});
}

const PAID = ["paid", "success", "completed", "finished", "confirmed"];
export async function handleWebhook(env, provider, request){
  const prov = PROVIDERS[provider];
  if (!prov) return { status: 400, body: { ok: false, error: "unknown_provider" } };
  const v = await prov.verifyWebhook(env, request);
  if (!v.ok) return { status: v.status || 401, body: { ok: false, error: v.error || "bad_signature" } };
  if (!PAID.includes(String(v.status || "").toLowerCase())) return { status: 200, body: { ok: true, ignored: true, status: v.status } };
  const kv = env.DAANA_KV;
  let order = v.orderId ? await getOrder(kv, v.orderId) : null;
  if (!order) order = { id: v.orderId || genOrderId(), status: "pending", provider, item: v.item || null, amount: v.amount || null, currency: v.currency || null, customer: v.customer || null, createdAt: Date.now() };
  if (order.status === "paid") return { status: 200, body: { ok: true, idempotent: true } };
  order.status = "paid"; order.paidAt = Date.now(); order.providerRef = v.ref || null;
  if (v.item && !order.item) order.item = v.item;
  if (v.customer && !order.customer) order.customer = v.customer;
  await saveOrder(kv, order);
  try { await fulfillOrder(env, order); } catch (e) { order.fulfillError = String((e && e.message) || e); }
  await saveOrder(kv, order);
  return { status: 200, body: { ok: true, order: { id: order.id, item: order.item, deliveredCode: order.deliveredCode || null } } };
}
