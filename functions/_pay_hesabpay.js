// HesabPay provider. Afghan wallet + (per HesabPay) international Visa/MC via its gateway.
// Inert until env.HESABPAY_API_KEY and env.HESABPAY_WEBHOOK_SECRET are set.
// Docs: developers.hesab.com  ·  session API: https://api.hesab.com/api/v1/payment/create-session
const API_BASE = "https://api.hesab.com/api/v1";
export async function createSession(env, order){
  if (!env.HESABPAY_API_KEY) return { ok: false, error: "not_configured", message: "HesabPay is not set up yet." };
  let data = {};
  try {
    const r = await fetch(API_BASE + "/payment/create-session", {
      method: "POST",
      headers: { "Authorization": "API-KEY " + env.HESABPAY_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ items: [{ id: order.item, name: order.item, price: order.amount }], email: order.customer || undefined, order_id: order.id, currency: order.currency || "USD" })
    });
    try { data = await r.json(); } catch (_) {}
    if (!r.ok) return { ok: false, error: "hesabpay_error", detail: data };
  } catch (e) { return { ok: false, error: "hesabpay_unreachable", message: String((e && e.message) || e) }; }
  return { ok: true, provider: "hesabpay", payUrl: data.url || data.payment_url || data.session_url || data.link, sessionId: data.session_id || data.id || null, raw: data };
}
export async function verifyWebhook(env, request){
  if (!env.HESABPAY_WEBHOOK_SECRET) return { ok: false, status: 503, error: "not_configured" };
  let body = {}; try { body = await request.json(); } catch (_) {}
  // TODO: replace this shared-secret check with HesabPay's documented HMAC signature verification.
  const provided = request.headers.get("x-hesab-signature") || request.headers.get("x-webhook-token") || body.token || body.signature;
  if (provided !== env.HESABPAY_WEBHOOK_SECRET) return { ok: false, status: 401, error: "bad_signature" };
  return { ok: true, status: String(body.status || body.payment_status || "").toLowerCase(), orderId: body.order_id || body.orderId || body.id, item: body.item, amount: body.amount, currency: body.currency, customer: body.email || body.customer, ref: body.transaction_id || body.txn_id || body.id };
}
