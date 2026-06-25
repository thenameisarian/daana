import { getAuthedUser } from "../../_auth.js";
import { createCheckout } from "../../_paykit.js";
const CATALOG = { tips: { amount: 14.99, name: "Guided Tests" }, course: { amount: 19.99, name: "Full Course" } };
function json(o, s = 200){ return new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } }); }
export async function onRequestPost(context){
  const a = await getAuthedUser(context.env, context.request);
  if (!a) return json({ ok: false, error: "unauth", message: "Please sign in first." }, 401);
  let body; try { body = await context.request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  const item = (body && body.item) === "course" ? "course" : "tips";
  const provider = (body && body.provider) || "crypto";
  const cat = CATALOG[item];
  const r = await createCheckout(context.env, { provider, item, amount: cat.amount, currency: "USD", customer: a.user.email });
  return json(Object.assign({ item, itemName: cat.name }, r), r.ok ? 200 : (r.error === "not_configured" ? 503 : 400));
}
