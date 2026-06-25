// Project-specific fulfillment. The pay-kit calls this on a confirmed payment.
import { getUser, grantProduct } from "./_auth.js";
import { mintCode } from "./_lib.js";
export async function fulfillOrder(env, order){
  const kv = env.DAANA_KV;
  const product = order.item === "course" ? "course" : "tips";
  if (order.customer) {
    const u = await getUser(kv, order.customer);
    if (u) { await grantProduct(kv, u, product); order.fulfilledTo = order.customer; return; }
  }
  // No known account on file -> mint a redeemable product code to hand to the buyer.
  order.deliveredCode = await mintCode(kv, { product, kind: "person", note: "auto " + order.provider + " " + order.id });
}
