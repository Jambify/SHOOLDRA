// supabase/functions/verify-payment/index.ts
//
// Called by the client (ProGate) right after Flutterwave's in-browser
// callback fires. Re-verifies the transaction server-side with Flutterwave
// before writing anything to pro_users. This is the ONLY code path that may
// write status = 'active' to pro_users as a result of a client-initiated
// payment.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FLW_SECRET_KEY = Deno.env.get("FLW_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PRO_DURATION_DAYS = 30;
const EXPECTED_CURRENCY = "NGN";
const EXPECTED_AMOUNT = 3000; // keep in sync with APP_CONFIG.PRICING; consider fetching from a shared config table instead of duplicating this number

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // narrow to your domain in production
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Identify the calling user from their own JWT (not service role —
    // this call must be authenticated as the paying student).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ error: "Invalid session" }, 401);
    }

    const { transaction_id, tx_ref } = await req.json();
    if (!transaction_id || !tx_ref) {
      return json({ error: "transaction_id and tx_ref are required" }, 400);
    }

    // 2. Verify the transaction directly with Flutterwave's servers using
    // the SECRET key. Never trust the amount/status the browser reports.
    const flwRes = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      { headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` } },
    );
    if (!flwRes.ok) {
      const bodyText = await flwRes.text().catch(() => "");
      console.error(
        `verify-payment: Flutterwave verify call failed (status ${flwRes.status})`,
        bodyText,
      );
      // 401/403 here almost always means FLW_SECRET_KEY doesn't match the
      // mode (test vs live) of the public key that opened the checkout,
      // or the secret key wasn't set correctly. A bad transaction_id
      // (Flutterwave returns 404) is the other common cause.
      return json(
        { error: "Could not verify with Flutterwave", flwStatus: flwRes.status },
        502,
      );
    }
    const flwData = await flwRes.json();
    const tx = flwData?.data;

    if (
      flwData.status !== "success" ||
      !tx ||
      tx.status !== "successful" ||
      tx.tx_ref !== tx_ref ||
      tx.currency !== EXPECTED_CURRENCY ||
      Number(tx.amount) < EXPECTED_AMOUNT
    ) {
      return json({ error: "Transaction could not be verified", flwData }, 402);
    }

    // 3. Make sure this tx_ref hasn't already been used to activate someone
    // (prevents replaying the same successful transaction twice).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: existingRef } = await admin
      .from("pro_users")
      .select("user_id")
      .eq("payment_reference", tx_ref)
      .maybeSingle();
    if (existingRef && existingRef.user_id !== user.id) {
      return json({ error: "This transaction reference was already used" }, 409);
    }

    // 4. Extend from the user's current expiry if they still have time left,
    // otherwise start fresh from now.
    const { data: current } = await admin
      .from("pro_users")
      .select("expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const now = new Date();
    const currentExpiry = current?.expires_at ? new Date(current.expires_at) : now;
    const base = currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
    const newExpiry = new Date(base.getTime() + PRO_DURATION_DAYS * 24 * 60 * 60 * 1000);

    // 5. Activate. This upsert runs as the service role, so it bypasses RLS
    // — it does not depend on (and is not weakened by) the client-facing
    // pro_users policies.
    const { error: upsertErr } = await admin.from("pro_users").upsert(
      {
        user_id: user.id,
        email: user.email,
        payment_reference: tx_ref,
        amount: tx.amount,
        currency: tx.currency,
        status: "active",
        plan_type: "monthly",
        expires_at: newExpiry.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (upsertErr) {
      console.error("verify-payment upsert error", upsertErr);
      return json({ error: "Payment verified but activation failed. Contact support.", tx_ref }, 500);
    }

    return json({ ok: true, expires_at: newExpiry.toISOString() });
  } catch (err) {
    console.error("verify-payment error", err);
    return json({ error: "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}