import { genCode } from "../_lib.js";
import { getUser, setUserPassword, normEmail } from "../_auth.js";

function unauthorized() {
  return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
    status: 401, headers: { "Content-Type": "application/json" } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.DAANA_KV;
  const secret = request.headers.get("x-admin-secret");
  if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) return unauthorized();

  let body = {};
  try { body = await request.json(); } catch (_) {}
  const action = body.action;
  const test = (body.test || "toefl").toString();
  const J = o => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

  if (action === "resetpw") {
    const email = normEmail(body.email || "");
    const u = await getUser(kv, email);
    if (!u) return J({ ok: false, error: "not_found" });
    let np = body.newPassword, generated = null;
    if (!np || String(np).length < 8) { np = genCode("TMP"); generated = np; }
    await setUserPassword(kv, u, np);
    return J({ ok: true, email, tempPassword: generated });
  }

  if (action === "mint") {
    const kind = body.kind === "rotating" ? "rotating" : "person";
    const count = kind === "rotating" ? 1 : Math.min(Math.max(parseInt(body.count || 1, 10), 1), 100);
    if (kind === "rotating") {
      // deactivate existing rotating codes for this test
      const list = await kv.list({ prefix: "code:" });
      for (const k of list.keys) {
        const rec = JSON.parse((await kv.get(k.name)) || "{}");
        if (rec.kind === "rotating" && rec.test === test && rec.active !== false) {
          rec.active = false; await kv.put(k.name, JSON.stringify(rec));
        }
      }
    }
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = (kind !== "rotating" && body.code && count === 1) ? String(body.code).trim().toUpperCase().replace(/[^A-Z0-9-]/g, "") : genCode();
      await kv.put("code:" + code, JSON.stringify({ test, kind, active: true, tier: (body.tier === "premium" ? "premium" : "free"), product: (body.product === "course" || body.product === "tips") ? body.product : undefined, scope: (body.scope === "reading") ? "reading" : undefined, note: body.note || "", createdAt: Date.now() }));
      codes.push(code);
    }
    return J({ ok: true, kind, test, codes });
  }

  if (action === "revoke") {
    const code = (body.code || "").toString().trim().toUpperCase();
    const rec = JSON.parse((await kv.get("code:" + code)) || "null");
    if (!rec) return J({ ok: false, error: "not_found" });
    rec.active = false; await kv.put("code:" + code, JSON.stringify(rec));
    return J({ ok: true, code, active: false });
  }

  if (action === "list") {
    const list = await kv.list({ prefix: "code:" });
    const out = [];
    for (const k of list.keys) {
      const rec = JSON.parse((await kv.get(k.name)) || "{}");
      out.push({ code: k.name.replace(/^code:/, ""), test: rec.test, kind: rec.kind, active: rec.active, note: rec.note, usedAt: rec.usedAt || null });
    }
    return J({ ok: true, count: out.length, codes: out });
  }

  return J({ ok: false, error: "unknown_action", actions: ["mint", "revoke", "list"] });
}
