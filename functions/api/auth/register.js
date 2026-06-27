import { getUser, createUser, createUserSession, validEmail, validPassword, normEmail, userPublic, isOwnerEmail, grantOwnerAccess } from "../../_auth.js";
function json(o, s = 200, cookie){ const h = { "content-type": "application/json" }; if (cookie) h["set-cookie"] = cookie; return new Response(JSON.stringify(o), { status: s, headers: h }); }
export async function onRequestPost(context){
  const { request, env } = context;
  let body; try { body = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  const email = normEmail(body && body.email); const pw = body && body.password;
  if (!validEmail(email)) return json({ ok: false, error: "bad_email", message: "Enter a valid email address." }, 400);
  if (!validPassword(pw)) return json({ ok: false, error: "bad_password", message: "Password must be at least 8 characters." }, 400);
  if (await getUser(env.DAANA_KV, email)) return json({ ok: false, error: "exists", message: "That email already has an account. Try signing in." }, 409);
  const user = await createUser(env.DAANA_KV, email, pw);
  if (isOwnerEmail(env, email)) await grantOwnerAccess(env.DAANA_KV, user);
  const { cookie } = await createUserSession(env.DAANA_KV, email);
  return json({ ok: true, user: userPublic(user) }, 200, cookie);
}
