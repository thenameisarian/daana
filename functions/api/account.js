import { getAuthedUser, userPublic } from "../_auth.js";
export async function onRequestGet(context){
  const a = await getAuthedUser(context.env, context.request);
  const body = a ? { ok: true, authed: true, user: userPublic(a.user) } : { ok: true, authed: false };
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
