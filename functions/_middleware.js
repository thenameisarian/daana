import { getAuthedUser } from "./_auth.js";

// Required access per protected path.
//  "<test>" -> needs account access to that test (or premium/all)
//  "all"    -> premium only (hub)
//  "*"      -> any access (free code or premium) — e.g. lessons
const PROTECTED = {
  "/app.html": "toefl", "/app": "toefl",
  "/app-ielts.html": "ielts", "/app-ielts": "ielts",
  "/app-duolingo.html": "duolingo", "/app-duolingo": "duolingo",
  "/app-ged.html": "ged", "/app-ged": "ged",
  "/hub.html": "all", "/hub": "all",
  "/app-lessons.html": "course", "/app-lessons": "course", "/lessons": "course"
};

export async function onRequest(context){
  const { request, next, env } = context;
  const url = new URL(request.url);
  const required = PROTECTED[url.pathname];
  if (!required) return next();

  let a = null;
  try { a = await getAuthedUser(env, request); } catch (_) { a = null; } // fail closed

  if (!a){
    const to = new URL("/login", url);
    to.searchParams.set("need", "login");
    return Response.redirect(to.toString(), 302);
  }

  const access = a.user.access || null;
  const hasCourse = (a.user.products && a.user.products.course) || a.user.tier === "premium";
  const allAccess = access === "all" || a.user.tier === "premium";
  let ok = false;
  if (required === "*") ok = !!access;
  else if (required === "course") ok = hasCourse;
  else if (required === "all") ok = allAccess || hasCourse || !!access;
  else ok = (access === required || access === "all");

  if (ok) return next();

  const to = new URL("/login", url);
  to.searchParams.set("need", required === "course" ? "course" : "access");
  return Response.redirect(to.toString(), 302);
}
