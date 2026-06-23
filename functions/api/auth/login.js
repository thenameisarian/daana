import { getUser, verifyPassword, createUserSession, validEmail, normEmail, userPublic } from "../../_auth.js";
function json(o, s = 200, cookie){ const h = { "content-type": "application/json" }; if (cookie) h["set-cookie"] = cookie; return new Response(JSON.stringify(o), { status: s, headers: h }); }
export async function onRequestPost(context){
  const { request, env } = context;
  let body; try { body = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  const email = normEmail(body && body.email); const pw = body && body.password;
  if (!validEmail(email) || !pw) return json({ ok: false, error: "bad_input", message: "Enter your email and password." }, 400);
  const user = await getUser(env.DAANA_KV, email);
  const ok = user ? await verifyPassword(user, pw) : false;
  if (!ok) return json({ ok: false, error: "bad_credentials", message: "Email or password is incorrect." }, 401);
  const { cookie } = await createUserSession(env.DAANA_KV, email);
  return json({ ok: true, user: userPublic(user) }, 200, cookie);
}
