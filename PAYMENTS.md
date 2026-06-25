# Daana Pay — reusable, provider-agnostic payment system

A small payment core you can drop into **any** project on Cloudflare Pages + Workers KV.
Write the payment logic once; each project only configures providers + what "payment
succeeded" should do.

## How it fits together

```
/api/pay/checkout  ──►  _paykit.createCheckout()  ──►  provider.createSession()
                                  │                         (HesabPay API / crypto addresses)
                                  └─► order:<id> = {status:"pending", provider, item, amount, customer}

provider webhook  ──►  /api/pay/webhook/<provider>  ──►  _paykit.handleWebhook()
                                  │  verify signature → idempotent check → mark paid
                                  └─► _fulfill.fulfillOrder(order)   ← the ONE project-specific hook
```

- **`functions/_paykit.js`** — the reusable core. `createCheckout()`, `handleWebhook()`,
  idempotent order tracking in KV (`order:<id>`). Provider-agnostic.
- **`functions/_pay_providers.js`** — the registry: `{ hesabpay, crypto }`. Add providers here.
- **`functions/_pay_hesabpay.js`** / **`functions/_pay_crypto.js`** — each exports
  `createSession(env, order)` and `verifyWebhook(env, request)`. Inert until their env keys exist.
- **`functions/_fulfill.js`** — *project-specific.* `fulfillOrder(order)` is called once a
  payment is confirmed. In Daana it grants the product to the buyer's account, or mints a
  redeemable code if there's no account on file. **To reuse in another project, this is the
  only file you rewrite.**
- **Endpoints:** `functions/api/pay/checkout.js`, `functions/api/pay/webhook/hesabpay.js`,
  `functions/api/pay/webhook/crypto.js`.

## Products (Daana)

| item     | price   | grants                                  |
|----------|---------|-----------------------------------------|
| `tips`   | $14.99  | Guided Tests: all tests + in-test tips  |
| `course` | $19.99  | Full Course: lessons course (+ includes tips) |

Access model lives on the user record: `user.products = { tips, course }`, plus
`hasTips()` / `hasCourse()` helpers in `_auth.js`. A paid product also sets `access:"all"`
(all tests). Legacy `tier:"premium"` still unlocks everything.

## Environment variables (set in Cloudflare → Pages → Settings → Variables)

**Nothing is hardcoded. Providers stay inert until their keys are present, so it's safe to
ship now and add keys later. No live charges happen without these.**

HesabPay (primary rail — Afghan wallet + Visa/MC via its gateway):
- `HESABPAY_API_KEY` — **Arian must create a HesabPay merchant account** (developers.hesab.com)
  and paste the API key. Until then HesabPay checkout returns "not set up yet".
- `HESABPAY_WEBHOOK_SECRET` — shared secret / signature key for the webhook.
  ⚠️ `verifyWebhook` currently does a shared-secret check; replace with HesabPay's documented
  HMAC verification once the merchant docs are in hand (marked `TODO` in `_pay_hesabpay.js`).

Crypto / USDT:
- `USDT_WALLETS` — JSON array of your **public receive** addresses, e.g.
  `[{"label":"USDT · TRON (TRC20)","addr":"T..."},{"label":"USDT · TON","addr":"UQ..."}]`
  (never private keys).
- `PROOF_CONTACT` — WhatsApp/Telegram URL where buyers send payment proof.
- `CRYPTO_WEBHOOK_SECRET` — only if you automate confirmation via NOWPayments/Coinbase
  Commerce. Left unset = manual "send proof → admin mints/grants" flow.

Already in use:
- `ADMIN_SECRET` — guards `/api/admin` (mint/revoke/list/resetpw).
- `DAANA_KV` — the KV namespace binding.

## Reusing in another project

1. Copy `functions/_paykit.js`, `functions/_pay_providers.js`, the `_pay_*.js` providers,
   and `functions/api/pay/*`.
2. Rewrite `functions/_fulfill.js` → `fulfillOrder(env, order)` to do whatever "paid" means
   in that project (grant a role, email a license, flip a flag…).
3. Point your checkout button at `POST /api/pay/checkout { provider, item }` and add a
   price catalog in `checkout.js`.
4. Set the env vars above. Done.

## International cards

Don't add Stripe/PayPal directly — they don't onboard Afghanistan-based merchants. HesabPay
advertises Visa/Mastercard/Amex acceptance on top of the Afghan wallet, so it is the
international-card path here. If that ever falls short, add a Merchant-of-Record provider
(Paddle / Lemonsqueezy / Dodo) as a new module in `_pay_providers.js` — the core doesn't change.
