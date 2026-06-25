// Daana server-side progress + game economy. Hearts are server-authoritative (tamper-proof wall).
import { nowMs } from "./_lib.js";

export const HMAX = 5;
export const REFILL_MS = 5 * 3600 * 1000;   // 1 heart per 5h
export const GEM_REFILL = 30;

function todayStr(){ return new Date().toISOString().slice(0, 10); } // UTC day

export function defaultProgress(){
  return { xp: 0, gems: 0, hearts: HMAX, heartTs: null, streak: 0, bestStreak: 0, lastActiveDay: null, lastDay: null, dayXp: 0, dayDone: 0, done: {}, claimed: {}, mistakes: {} };
}

function rollDay(p){ const t = todayStr(); if (p.lastDay !== t){ p.dayXp = 0; p.dayDone = 0; p.lastDay = t; } }

export function regen(p){
  if (p.hearts >= HMAX) { p.heartTs = null; return; }
  if (!p.heartTs) { p.heartTs = nowMs(); return; }
  const g = Math.floor((nowMs() - p.heartTs) / REFILL_MS);
  if (g > 0){ p.hearts = Math.min(HMAX, p.hearts + g); p.heartTs = p.hearts >= HMAX ? null : p.heartTs + g * REFILL_MS; }
}
export function nextHeartMs(p){ if (p.hearts >= HMAX || !p.heartTs) return 0; return Math.max(0, p.heartTs + REFILL_MS - nowMs()); }

export async function getProgress(kv, email){
  let p = null; const raw = await kv.get("progress:" + email);
  if (raw) { try { p = JSON.parse(raw); } catch { p = null; } }
  if (!p) p = defaultProgress();
  const d = defaultProgress(); for (const k in d) if (p[k] === undefined) p[k] = d[k];
  rollDay(p); regen(p);
  return p;
}
export async function saveProgress(kv, email, p){ await kv.put("progress:" + email, JSON.stringify(p)); }

function touchStreak(p){
  const t = todayStr();
  if (p.lastActiveDay === t) return;
  const y = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  p.streak = (p.lastActiveDay === y) ? (p.streak || 0) + 1 : 1;
  p.lastActiveDay = t;
  if (!p.bestStreak || p.streak > p.bestStreak) p.bestStreak = p.streak;
}

export function loseHeart(p, premium){ if (premium) return; regen(p); if (p.hearts >= HMAX) p.heartTs = nowMs(); p.hearts = Math.max(0, p.hearts - 1); }
export function gemRefill(p){ if (p.gems < GEM_REFILL) return false; p.gems -= GEM_REFILL; p.hearts = HMAX; p.heartTs = null; return true; }
export function practiceHeart(p){ if (p.hearts < HMAX) p.hearts++; p.heartTs = p.hearts >= HMAX ? null : nowMs(); }

export function completeNode(p, nodeId, isBoss, accPct){
  if (!nodeId || p.done[nodeId] !== undefined) return false;
  accPct = Math.max(0, Math.min(100, Number(accPct) || 0));
  const gain = (isBoss ? 40 : 20) + Math.round(accPct / 100 * (isBoss ? 60 : 30));
  p.done[nodeId] = Math.round(accPct);
  p.xp += gain; p.dayXp += gain; p.dayDone += 1;
  p.gems += isBoss ? 20 : 8;
  touchStreak(p);
  return true;
}

const QUESTS = {
  xp40:   { need: p => p.dayXp >= 40, gems: 10 },
  do2:    { need: p => p.dayDone >= 2, gems: 15 },
  streak: { need: p => p.dayXp > 0, xp: 20 }
};
export function claimQuest(p, id){
  const q = QUESTS[id]; if (!q) return false;
  const key = "q:" + id + ":" + p.lastDay;
  if (p.claimed[key]) return false;
  if (!q.need(p)) return false;
  if (q.gems) p.gems += q.gems;
  if (q.xp) { p.xp += q.xp; p.dayXp += q.xp; }
  p.claimed[key] = true;
  return true;
}
export function openChest(p, chestId){
  if (!chestId) return false;
  const key = "chest:" + chestId;
  if (p.claimed[key]) return false;
  p.claimed[key] = true;
  p.gems += 40; if (p.hearts < HMAX) p.hearts++;
  return true;
}

// ---- error log + spaced review (Leitner-style) ----
const DAY = 86400000;
export function logMiss(p, ref){ if(!ref) return; p.mistakes = p.mistakes || {}; p.mistakes[ref] = { due: Date.now(), box: 0 }; }
export function reviewItem(p, ref, ok){ p.mistakes = p.mistakes || {}; const m = p.mistakes[ref]; if(!m) return; if(!ok){ m.box = 0; m.due = Date.now(); return; } m.box = (m.box||0) + 1; const steps = [1,3,7,21]; if(m.box > steps.length){ delete p.mistakes[ref]; return; } m.due = Date.now() + steps[m.box-1]*DAY; }
export function dueRefs(p, limit){ p.mistakes = p.mistakes || {}; const now = Date.now(); const out = Object.keys(p.mistakes).filter(k => p.mistakes[k].due <= now); out.sort((a,b)=>p.mistakes[a].due - p.mistakes[b].due); return limit ? out.slice(0,limit) : out; }
