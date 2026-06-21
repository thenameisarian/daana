// GET /api/health -> confirms the KV binding attached. Run once after deploy.
export async function onRequestGet(context) {
  const env = context.env || {};
  const bound = !!env.DAANA_KV;
  let kvReadable = false;
  if (bound) {
    try { await env.DAANA_KV.get("__healthcheck__"); kvReadable = true; } catch (_) {}
  }
  const ok = bound && kvReadable;
  return new Response(JSON.stringify({
    ok,
    kv_bound: bound,
    kv_readable: kvReadable,
    ip_strict: String(env.IP_STRICT || "false"),
    admin_secret_set: !!env.ADMIN_SECRET,
    hint: ok ? "Gate backend is ready."
             : "KV not bound: add DAANA_KV -> daana-access under Pages > Settings > Functions > KV bindings, then redeploy."
  }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
