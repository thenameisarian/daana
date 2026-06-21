# Daana access gate — deploy & admin guide

A real, server-side gate for the TOEFL test. The test now lives in `app.html`; `index.html` is the
public gate (follow funnel + code entry). A Cloudflare Pages Function validates codes against KV and
sets a 7-day HttpOnly session cookie. Viewing source on the gate reveals nothing — `app.html` is
blocked by `functions/_middleware.js` unless a valid session cookie is present.

## What changed
| File | Purpose |
|---|---|
| `index.html` | NEW gate page (was the app). Edit the two follow links in the `CONFIG` block near the bottom. |
| `app.html` | The full TOEFL test (unchanged, just renamed from the old index.html). Protected. |
| `functions/_middleware.js` | Blocks `/app.html` (and `/app`) without a valid session. Fails closed. |
| `functions/api/verify.js` | `POST /api/verify {code}` -> validates, sets session cookie. |
| `functions/api/admin.js`  | `POST /api/admin` (needs `x-admin-secret`) -> mint / list / revoke codes. |
| `functions/api/health.js` | `GET /api/health` -> confirms the KV binding attached. |
| `wrangler.toml` | Binds the `daana-access` KV namespace to the Functions as `DAANA_KV`. |

## One-time setup (do once)
1. **Set the admin secret** (the only secret; never commit it). In the Cloudflare dashboard:
   Pages -> **daana** -> Settings -> **Variables and Secrets** -> Production -> add
   `ADMIN_SECRET` = a long random string -> Encrypt -> Save.
   (Tip: keep the dashboard tab focused — it stalls when backgrounded.)
2. **KV binding** is declared in `wrangler.toml` (verified against Cloudflare docs), so it attaches on deploy.

## Deploy
From your machine, in the project folder:
```
git add -A
git commit -m "Add members-only access gate (follow funnel + code, KV-backed)"
git push origin main
```
Cloudflare auto-builds and deploys. (No build command; output dir is repo root.)

## Verify it's working (deterministic — no guessing)
After the deploy finishes, run:
```
curl -s https://daana.pages.dev/api/health
```
- `{"ok":true,"kv_bound":true,"kv_readable":true,...}` -> backend is ready. Done.
- `kv_bound:false` -> the wrangler.toml binding didn't attach. Add it manually:
  Settings -> **Functions** -> KV namespace bindings -> Variable `DAANA_KV` -> namespace `daana-access`, then redeploy.
- `admin_secret_set:false` -> finish step 1 above before minting codes.

## Mint codes (after health check passes)
Replace SECRET with your ADMIN_SECRET.

Rotating shared code (post it where only followers see it — rotating again disables the old one):
```
curl -s -X POST https://daana.pages.dev/api/admin \
  -H "x-admin-secret: SECRET" -H "Content-Type: application/json" \
  -d '{"action":"mint","kind":"rotating","test":"toefl"}'
```
Per-person codes (single use each — mint 5 at once):
```
curl -s -X POST https://daana.pages.dev/api/admin \
  -H "x-admin-secret: SECRET" -H "Content-Type: application/json" \
  -d '{"action":"mint","kind":"person","test":"toefl","count":5,"note":"June batch"}'
```
List all codes:
```
curl -s -X POST https://daana.pages.dev/api/admin \
  -H "x-admin-secret: SECRET" -H "Content-Type: application/json" \
  -d '{"action":"list"}'
```
Revoke one:
```
curl -s -X POST https://daana.pages.dev/api/admin \
  -H "x-admin-secret: SECRET" -H "Content-Type: application/json" \
  -d '{"action":"revoke","code":"DAANA-XXXX-XXXX"}'
```

## How access works
- A code unlocks ONE test (currently `toefl`). It does not unlock other tests.
- First redemption binds a 7-day window to that test for the redeeming IP, and sets a session cookie.
- Re-entering from the same IP within 7 days reuses the window (does not burn another code).
- After 7 days: blocked -> needs a new code. Person codes are single-use; rotating codes are reusable.

## IP strictness toggle (`wrangler.toml` -> `[vars]`)
- `IP_STRICT = "false"` (default): session is bound to the cookie; IP is recorded but not enforced.
  Recommended — mobile users' IPs change and would otherwise get locked out mid-week.
- `IP_STRICT = "true"`: also requires the request IP to match the one that redeemed the code.

## Rollback
The original app is byte-identical in `app.html`. To revert entirely:
`git mv app.html index.html` (overwrite), delete `functions/` and `wrangler.toml`, push.
