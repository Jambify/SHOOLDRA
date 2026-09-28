// supabase/functions/flutterwave-webhook/index.ts
//
// Set this as your webhook URL in the Flutterwave dashboard:
//   https://<project-ref>.supabase.co/functions/v1/flutterwave-webhook
// Set the "verif-hash" secret in the dashboard to the SAME value as your
// FLW_WEBHOOK_HASH secret below. Flutterwave sends it back on every call
// in the `verif-hash` header so you can confirm the call really came from
// Flutterwave.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FLW_SECRET_KEY = Deno.env.get("FLW_SECRET_KEY")!;
const FLW_WEBHOOK_HASH = Deno.env.get("FLW_WEBHOOK_HASH")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PRO_DURATION_DAYS = 30;
const EXPECTED_CURRENCY = "NGN";
const EXPECTED_AMOUNT = 3000;

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // 1. Confirm this call actually came from Flutterwave.
  const signature = req.headers.get("verif-hash");
  if (!signature || signature !== FLW_WEBHOOK_HASH) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const eventTx = payload?.data;

  if (payload?.event !== "charge.completed" || !eventTx?.id) {
    return new Response("ignored", { status: 200 });
  }

  // 2. Re-verify with Flutterwave's API directly — never trust the webhook
  // body alone, since a compromised header alone shouldn't be enough.
  const flwRes = await fetch(
    `https://api.flutterwave.com/v3/transactions/${eventTx.id}/verify`,
    { headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` } },
  );
  if (!flwRes.ok) return new Response("verify failed", { status: 502 });
  const flwData = await flwRes.json();
  const tx = flwData?.data;

  if (
    flwData.status !== "success" ||
    !tx ||
    tx.status !== "successful" ||
    tx.currency !== EXPECTED_CURRENCY ||
    Number(tx.amount) < EXPECTED_AMOUNT
  ) {
    return new Response("not a valid successful transaction", { status: 200 });
  }

  const email = tx.customer?.email;
  if (!email) return new Response("no customer email on transaction", { status: 200 });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 3. Find the user by email (webhook has no user JWT to identify them by).
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!profile) return new Response("no matching user", { status: 200 });

  // 4. Skip if verify-payment (browser path) already activated this exact
  // transaction — avoids double-extending the expiry.
  const { data: existingRef } = await admin
    .from("pro_users")
    .select("user_id")
    .eq("payment_reference", tx.tx_ref)
    .maybeSingle();
  if (existingRef) return new Response("already processed", { status: 200 });

  const { data: current } = await admin
    .from("pro_users")
    .select("expires_at")
    .eq("user_id", profile.id)
    .maybeSingle();

  const now = new Date();
  const currentExpiry = current?.expires_at ? new Date(current.expires_at) : now;
  const base = currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  const newExpiry = new Date(base.getTime() + PRO_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await admin.from("pro_users").upsert(
    {
      user_id: profile.id,
      email,
      payment_reference: tx.tx_ref,
      amount: tx.amount,
      currency: tx.currency,
      status: "active",
      plan_type: "monthly",
      expires_at: newExpiry.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) console.error("webhook upsert error", error);

  return new Response("ok", { status: 200 });
});