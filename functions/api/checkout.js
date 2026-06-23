function json(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
export async function onRequestPost(context) {
  const { env } = context;
  if (!env.HESABPAY_API_KEY) return json({ ok: false, error: "not_configured", message: "Online HesabPay checkout is not set up yet. Use a payment option on the gate for now." }, 503);
  // TODO: call HesabPay's create-payment API with env.HESABPAY_API_KEY and return the pay URL / QR.
  return json({ ok: false, error: "checkout_pending", message: "HesabPay checkout API integration is pending merchant docs." }, 501);
}
