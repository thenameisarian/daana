import { handleWebhook } from "../../../_paykit.js";
export async function onRequestPost(context){
  const r = await handleWebhook(context.env, "hesabpay", context.request);
  return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
