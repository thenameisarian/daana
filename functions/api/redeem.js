import { getAuthedUser, redeemCodeForUser, userPublic } from "../_auth.js";
function json(o, s = 200){ return new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } }); }
const MSG = { missing_code: "Enter your access code.", invalid_code: "That code isn't valid.", code_used: "This code has already been used.", code_revoked: "This code is no longer active." };
export async function onRequestPost(context){
  const a = await getAuthedUser(context.env, context.request);
  if (!a) return json({ ok: false, error: "unauth", message: "Please sign in first." }, 401);
  let body; try { body = await context.request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  const r = await redeemCodeForUser(context.env, a.user, body && body.code);
  if (!r.ok) return json({ ok: false, error: r.error, message: MSG[r.error] || "Could not redeem that code." }, 403);
  return json({ ok: true, user: userPublic(r.user) });
}
