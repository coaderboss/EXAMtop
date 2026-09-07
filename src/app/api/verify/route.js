import crypto from "crypto";
import { NextResponse } from "next/server";
import { adminDb } from "../../../lib/firebaseAdmin"; 

// 🛡️ SERVER-SIDE REWARD CONFIGURATION
const PLAN_CONFIG = {
  "starter_pack": { name: "Starter Pack", tokens: 10, isUnlimited: false },
  "growth_pack": { name: "Growth Pack", tokens: 30, isUnlimited: false },
  "unlimited_vip": { name: "1 Year Unlimited PRO", tokens: 0, isUnlimited: true }
};

export async function POST(req) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, planId } = await req.json();
    const secret = process.env.RAZORPAY_KEY_SECRET;

    // 1. Verify Signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 });
    }

    // 2. Fetch Secure Rewards based on planId
    const reward = PLAN_CONFIG[planId];
    if (!reward) return NextResponse.json({ success: false, error: "Unknown Plan" }, { status: 400 });

    const userRef = adminDb.ref(`users/${userId}`);
    const snapshot = await userRef.once("value");
    const userData = snapshot.val() || {};

    const history = userData.billingHistory || [];
    const now = new Date().toISOString();

    const newRecord = {
      date: now,
      plan: reward.name,
      tokensAdded: reward.tokens,
      type: reward.isUnlimited ? "Subscription" : "Tokens",
      source: "Razorpay Gateway",
      paymentId: razorpay_payment_id,
    };

    let updates = {
      billingHistory: [newRecord, ...history],
      last_upgrade_date: now,
      last_upgrade_plan: reward.name,
    };

    // 3. Apply Rewards securely
    if (reward.isUnlimited) {
      updates.is_unlimited = true;
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);
      updates.unlimited_expiry_date = expiry.toISOString();
    } else {
      const currentLegacy = userData.available_quota || 0;
      const currentPremium = userData.premium_tokens !== undefined ? userData.premium_tokens : Math.max(0, currentLegacy - 3);
      const currentFree = userData.free_tokens !== undefined ? userData.free_tokens : Math.min(3, currentLegacy);
      
      updates.premium_tokens = currentPremium + reward.tokens; 
      updates.free_tokens = currentFree; 
      updates.available_quota = currentLegacy + reward.tokens;
    }

    await userRef.update(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verification Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}