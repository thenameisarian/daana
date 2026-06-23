import { clearUserSession } from "../../_auth.js";
export async function onRequestPost(context){
  const cookie = await clearUserSession(context.env, context.request);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json", "set-cookie": cookie } });
}
