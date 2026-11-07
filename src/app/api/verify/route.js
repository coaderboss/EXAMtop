import crypto from "crypto";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { adminDb } from "../../../lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 🛡️ SERVER-SIDE REWARD CONFIGURATION
const PLAN_CONFIG = {
  starter_pack: { name: "Starter Pack", tokens: 10, isUnlimited: false },
  growth_pack: { name: "Growth Pack", tokens: 30, isUnlimited: false },
  unlimited_vip: { name: "1 Year Unlimited PRO", tokens: 0, isUnlimited: true },
};

export async function POST(req) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
      planId,
    } = await req.json();
    const secret = process.env.RAZORPAY_KEY_SECRET;

    // 1. Cryptographic Signature Verification
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { success: false, error: "Invalid signature" },
        { status: 400 },
      );
    }

    // 2. 🛡️ ANTI-SUBSTITUTION CHECK (CWE-472)
    // Fetch the absolute truth from Razorpay. Do not trust the client's requested planId.
    const order = await razorpay.orders.fetch(razorpay_order_id);
    if (order.notes?.planId !== planId || order.notes?.userId !== userId) {
      console.error("🚨 PLAN SUBSTITUTION DETECTED!");
      return NextResponse.json(
        { success: false, error: "Plan mismatch. Tampering detected." },
        { status: 403 },
      );
    }

    const reward = PLAN_CONFIG[planId];
    if (!reward)
      return NextResponse.json(
        { success: false, error: "Unknown Plan" },
        { status: 400 },
      );

    // 3. 🛡️ ATOMIC ANTI-REPLAY CLAIM (CWE-294 / Race Condition Lock)
    const paymentClaimRef = adminDb.ref(
      `claimed_payments/${razorpay_payment_id}`,
    );
    const claimTx = await paymentClaimRef.transaction((current) => {
      if (current) {
        return; // Already processed! Abort transaction.
      }
      return {
        claimedAt: new Date().toISOString(),
        userId: userId,
        plan: reward.name,
      };
    });

    if (!claimTx.committed) {
      console.warn(
        "⚠️ REPLAY ATTACK BLOCKED via atomic claimed_payments:",
        razorpay_payment_id,
      );
      return NextResponse.json(
        { success: false, error: "Payment already processed." },
        { status: 409 },
      );
    }

    // 4. ATOMIC TOKEN REWARD TRANSACTION (PREVENTS BALANCE OVERWRITES)
    const now = new Date().toISOString();
    const newRecord = {
      date: now,
      plan: reward.name,
      tokensAdded: reward.tokens,
      type: reward.isUnlimited ? "Subscription" : "Tokens",
      source: "Razorpay Gateway",
      paymentId: razorpay_payment_id,
    };

    const userRef = adminDb.ref(`users/${userId}`);
    await userRef.transaction((userData) => {
      if (!userData) {
        userData = { free_tokens: 3, available_quota: 3, premium_tokens: 0 };
      }
      const history = Array.isArray(userData.billingHistory)
        ? userData.billingHistory
        : [];
      userData.billingHistory = [newRecord, ...history];
      userData.last_upgrade_date = now;
      userData.last_upgrade_plan = reward.name;

      if (reward.isUnlimited) {
        userData.is_unlimited = true;
        const expiry = new Date();
        expiry.setFullYear(expiry.getFullYear() + 1);
        userData.unlimited_expiry_date = expiry.toISOString();
      } else {
        const currentLegacy = Number(userData.available_quota || 0);
        const currentPremium =
          userData.premium_tokens !== undefined
            ? Number(userData.premium_tokens)
            : Math.max(0, currentLegacy - 3);
        const currentFree =
          userData.free_tokens !== undefined
            ? Number(userData.free_tokens)
            : Math.min(3, currentLegacy);

        userData.premium_tokens = currentPremium + reward.tokens;
        userData.free_tokens = currentFree;
        userData.available_quota = currentLegacy + reward.tokens;
      }
      return userData;
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verification Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
