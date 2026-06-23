import { checkSession } from "./_lib.js";

// Map protected static paths -> required test id.
const PROTECTED = { "/app.html": "toefl", "/app": "toefl", "/app-ielts.html": "ielts", "/app-ielts": "ielts" };

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const requiredTest = PROTECTED[url.pathname];
  if (!requiredTest) return next();

  let reason = "1";
  try {
    const res = await checkSession(context.env, request, requiredTest);
    if (res.ok) return next();
    reason = (res.reason === "expired" || res.reason === "ip_changed") ? "expired" : "1";
  } catch (_) {
    // Fail closed: any error (e.g. KV unavailable) must NOT expose protected content.
    reason = "err";
  }
  const to = new URL("/", url);
  to.searchParams.set("locked", reason);
  return Response.redirect(to.toString(), 302);
}
