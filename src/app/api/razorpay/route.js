import Razorpay from "razorpay";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 🛡️ ACTUAL PRICING CATALOG
const PLAN_PRICES = {
  "starter_pack": 49,
  "growth_pack": 99,
  "unlimited_vip": 199,
};

export async function POST(req) {
  try {
    const { planId, userId } = await req.json(); 

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    if (!planId || !PLAN_PRICES[planId]) {
      return NextResponse.json({ error: "Invalid Plan Selected." }, { status: 400 });
    }

    const exactAmount = PLAN_PRICES[planId];

    const options = {
      amount: exactAmount * 100, // INR in paise
      currency: "INR",
      receipt: `rcpt_${userId.substring(0,5)}_${Date.now()}`,
      notes: { planId, userId }
    };

    const order = await razorpay.orders.create(options);
    return NextResponse.json(order);
  } catch (error) {
    console.error("Razorpay Error:", error);
    return NextResponse.json({ error: "Payment Gateway Error" }, { status: 500 });
  }
}