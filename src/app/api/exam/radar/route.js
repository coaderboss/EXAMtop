import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebaseAdmin";
import { verifyCaller } from "../../../../lib/authGuard";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    // 1. Authenticate student caller
    const authResult = await verifyCaller(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, message: authResult.message },
        { status: authResult.status || 401 },
      );
    }

    const { followedList } = await req.json();

    if (!Array.isArray(followedList) || followedList.length === 0) {
      return NextResponse.json({ success: true, feed: [] });
    }

    // 2. Fetch tests_metadata in parallel for all followed creators
    const metadataPromises = followedList.map(async (creatorUid) => {
      try {
        const snap = await adminDb
          .ref("tests_metadata")
          .orderByChild("creatorUid")
          .equalTo(creatorUid)
          .once("value");
        if (snap.exists()) {
          const val = snap.val();
          if (Array.isArray(val)) {
            return val.filter(Boolean);
          }
          return Object.entries(val).map(([key, item]) => ({
            id: item?.id || item?.code || key,
            ...item,
          }));
        }
      } catch (err) {
        console.warn(`Error querying tests_metadata for ${creatorUid}:`, err);
      }
      return [];
    });

    // 3. Fallback to legacy tests node for tests not yet in tests_metadata
    const legacyPromises = followedList.map(async (creatorUid) => {
      try {
        const snap = await adminDb
          .ref("tests")
          .orderByChild("creatorUid")
          .equalTo(creatorUid)
          .once("value");
        if (snap.exists()) {
          const val = snap.val();
          if (Array.isArray(val)) {
            return val.filter(Boolean);
          }
          return Object.entries(val).map(([key, item]) => ({
            id: item?.id || item?.code || key,
            ...item,
          }));
        }
      } catch (err) {
        console.warn(`Error querying legacy tests for ${creatorUid}:`, err);
      }
      return [];
    });

    const [metaResults, legacyResults] = await Promise.all([
      Promise.all(metadataPromises),
      Promise.all(legacyPromises),
    ]);

    const allMetaTests = metaResults.flat().filter(Boolean);
    const allLegacyTests = legacyResults.flat().filter(Boolean);

    // Merge & deduplicate by test id/code (tests_metadata has priority)
    const combinedMap = new Map();
    allLegacyTests.forEach((t) => {
      const id = t.id || t.code;
      if (id) combinedMap.set(String(id), t);
    });
    allMetaTests.forEach((t) => {
      const id = t.id || t.code;
      if (id) combinedMap.set(String(id), t);
    });

    const now = Date.now();
    const EIGHTEEN_HOURS_MS = 18 * 60 * 60 * 1000;
    let feed = [];

    combinedMap.forEach((test) => {
      if (
        test &&
        followedList.includes(test.creatorUid) &&
        test.radarVisible === true &&
        !test.isDeletedByExaminer
      ) {
        const testExpiry = test.expiryDate || test.closeDate;
        if (testExpiry) {
          const expiryTime = new Date(testExpiry).getTime();
          if (!isNaN(expiryTime) && now - expiryTime > EIGHTEEN_HOURS_MS) {
            return;
          }
        }

        // Strip heavy & sensitive data (questions, answers, submissions)
        const { questions, submissions, ...safeTest } = test;
        feed.push(safeTest);
      }
    });

    // Sort newest first
    feed.sort((a, b) => {
      const timeA = a.openDate
        ? new Date(a.openDate).getTime()
        : new Date(a.createdAt || 0).getTime();
      const timeB = b.openDate
        ? new Date(b.openDate).getTime()
        : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({ success: true, feed });
  } catch (error) {
    console.error("Radar API Error:", error);
    return NextResponse.json(
      { success: false, message: "Server Error fetching radar tests" },
      { status: 500 },
    );
  }
}
