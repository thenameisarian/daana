import { verifyCode } from "../_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    let code = "";
    try {
      const ct = request.headers.get("Content-Type") || "";
      if (ct.includes("application/json")) { const j = await request.json(); code = j.code; }
      else { const f = await request.formData(); code = f.get("code"); }
    } catch (_) {}
    const r = await verifyCode(env, request, code);
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
    if (r.setCookie) headers["Set-Cookie"] = r.setCookie;
    return new Response(JSON.stringify(r.body), { status: r.status, headers });
  } catch (_) {
    return new Response(
      JSON.stringify({ ok: false, error: "server_error", message: "Something went wrong. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
    status: 405, headers: { "Content-Type": "application/json" } });
}
