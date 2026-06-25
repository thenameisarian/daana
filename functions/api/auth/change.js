import { getAuthedUser, verifyPassword, setUserPassword, validPassword } from "../../_auth.js";
function json(o, s = 200){ return new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } }); }
export async function onRequestPost(context){
  const a = await getAuthedUser(context.env, context.request);
  if (!a) return json({ ok: false, error: "unauth", message: "Please sign in." }, 401);
  let body; try { body = await context.request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  const oldp = body && body.oldPassword, newp = body && body.newPassword;
  if (!validPassword(newp)) return json({ ok: false, error: "bad_password", message: "New password must be at least 8 characters." }, 400);
  if (!(await verifyPassword(a.user, oldp))) return json({ ok: false, error: "bad_credentials", message: "Current password is incorrect." }, 401);
  await setUserPassword(context.env.DAANA_KV, a.user, newp);
  return json({ ok: true });
}
