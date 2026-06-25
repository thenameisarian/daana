import { getAuthedUser } from "../_auth.js";
import * as PR from "../_progress.js";
function json(o, s = 200){ return new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } }); }
function isPremium(u){ return u.tier === "premium" || u.access === "all"; }
function pub(p, u){ const prem = isPremium(u); return { xp: p.xp, gems: p.gems, hearts: prem ? 9999 : p.hearts, heartTs: p.heartTs, nextHeartMs: prem ? 0 : PR.nextHeartMs(p), streak: p.streak, bestStreak: p.bestStreak || 0, lastDay: p.lastDay, dayXp: p.dayXp, dayDone: p.dayDone, done: p.done, claimed: p.claimed, mistakes: p.mistakes, dueReview: PR.dueRefs(p).length, review: PR.dueRefs(p, 15), premium: prem, tier: u.tier || "none", access: u.access || null }; }
export async function onRequestGet(context){
  const a = await getAuthedUser(context.env, context.request); if (!a) return json({ ok: false, error: "unauth" }, 401);
  const kv = context.env.DAANA_KV; const p = await PR.getProgress(kv, a.user.email);
  await PR.saveProgress(kv, a.user.email, p);
  return json({ ok: true, progress: pub(p, a.user) });
}
export async function onRequestPost(context){
  const a = await getAuthedUser(context.env, context.request); if (!a) return json({ ok: false, error: "unauth" }, 401);
  const kv = context.env.DAANA_KV; const premium = isPremium(a.user);
  let body; try { body = await context.request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  const p = await PR.getProgress(kv, a.user.email);
  switch (body && body.type){
    case "lose": PR.loseHeart(p, premium); break;
    case "gem": PR.gemRefill(p); break;
    case "practice": PR.practiceHeart(p); break;
    case "complete": PR.completeNode(p, String(body.nodeId || ""), !!body.isBoss, body.acc); break;
    case "quest": PR.claimQuest(p, String(body.id || "")); break;
    case "chest": PR.openChest(p, String(body.id || "")); break;
    case "miss": PR.logMiss(p, String(body.ref || "")); break;
    case "review": PR.reviewItem(p, String(body.ref || ""), !!body.ok); break;
    default: return json({ ok: false, error: "bad_type" }, 400);
  }
  await PR.saveProgress(kv, a.user.email, p);
  return json({ ok: true, progress: pub(p, a.user) });
}
