import { getSession } from "../_lib.js";

export async function onRequestGet(context) {
  const s = await getSession(context.env, context.request);
  const body = s ? { ok: true, test: s.test, tier: s.tier, expiresAt: s.expiresAt } : { ok: false, error: "no_session" };
  return new Response(JSON.stringify(body), { status: s ? 200 : 401, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
