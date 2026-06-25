// Crypto/USDT provider. Manual: returns receive addresses + WhatsApp proof.
// Automated webhook (NOWPayments / Coinbase-Commerce style) is inert until env.CRYPTO_WEBHOOK_SECRET is set.
const DEFAULT_WALLETS = [
  { label: "USDT · TRON (TRC20)", addr: "YOUR-TRC20-USDT-ADDRESS" },
  { label: "USDT · TON", addr: "YOUR-TON-USDT-ADDRESS" },
  { label: "USDT · BSC (BEP20)", addr: "YOUR-BEP20-USDT-ADDRESS" }
];
export async function createSession(env, order){
  let wallets = DEFAULT_WALLETS;
  if (env.USDT_WALLETS) { try { wallets = JSON.parse(env.USDT_WALLETS); } catch (_) {} }
  return { ok: true, provider: "crypto", manual: true, amount: order.amount, currency: "USDT", wallets, proofContact: env.PROOF_CONTACT || env.WHATSAPP || "", instructions: "Send the amount in USDT to one of the addresses, then send proof on WhatsApp. Access is granted once confirmed." };
}
export async function verifyWebhook(env, request){
  if (!env.CRYPTO_WEBHOOK_SECRET) return { ok: false, status: 503, error: "not_configured" };
  let body = {}; try { body = await request.json(); } catch (_) {}
  const provided = request.headers.get("x-webhook-token") || request.headers.get("x-nowpayments-sig") || body.token;
  if (provided !== env.CRYPTO_WEBHOOK_SECRET) return { ok: false, status: 401, error: "bad_signature" };
  const status = String(body.payment_status || body.status || "").toLowerCase();
  return { ok: true, status, orderId: body.order_id || body.orderId, item: body.item, amount: body.amount || body.price_amount, customer: body.email || body.customer, ref: body.payment_id || body.id };
}
