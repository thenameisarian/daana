import { mintCode } from "../_lib.js";
function json(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.HESABPAY_WEBHOOK_SECRET) return json({ ok: false, error: "not_configured" }, 503);
  let body = {};
  try { body = await request.json(); } catch (_) {}
  // TODO: replace this token check with HesabPay's real signature verification (HMAC) once you have the merchant docs.
  const provided = request.headers.get("x-webhook-token") || body.token;
  if (provided !== env.HESABPAY_WEBHOOK_SECRET) return json({ ok: false, error: "bad_signature" }, 401);
  const status = (body.status || body.payment_status || "").toLowerCase();
  if (status !== "success" && status !== "paid" && status !== "completed") return json({ ok: true, ignored: true });
  const test = body.test || "all";          // default: premium all-access
  const orderId = body.order_id || body.id || ("hp-" + Date.now());
  const code = await mintCode(env.DAANA_KV, { test, kind: "person", tier: "premium", note: "HesabPay " + orderId });
  await env.DAANA_KV.put("order:" + orderId, JSON.stringify({ code, ts: Date.now() }), { expirationTtl: 60 * 60 * 24 * 30 });
  return json({ ok: true, code });
}
