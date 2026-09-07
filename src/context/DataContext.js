// src/context/DataContext.js
"use client";
import { createContext, useContext, useState } from "react";
import { database } from "../lib/firebase";
import { ref, get, query, orderByChild, equalTo } from "firebase/database";

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [tests, setTests] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // 1. EXAMINER VAULT FETCH (Using Firebase Indexes for High Speed)
  const fetchMyTests = async (uid) => {
    if (!uid) return;
    setLoadingData(true);
    try {
      // Naye Architecture se data (Fast Indexed Query)
      const qMeta = query(
        ref(database, "tests_metadata"),
        orderByChild("creatorUid"),
        equalTo(uid),
      );
      const snapMeta = await get(qMeta);
      let newTests = snapMeta.exists()
        ? Object.values(snapMeta.val()).filter(Boolean)
        : [];

      // Purane Architecture se data (Legacy Support)
      const qOld = query(
        ref(database, "tests"),
        orderByChild("creatorUid"),
        equalTo(uid),
      );
      const snapOld = await get(qOld);
      let oldTests = snapOld.exists()
        ? Object.values(snapOld.val()).filter(Boolean)
        : [];

      // Purane data ke arrays fix karo
      oldTests.forEach((t) => {
        if (t.submissions && !Array.isArray(t.submissions)) {
          t.submissions = Object.values(t.submissions).filter(Boolean);
        } else if (!t.submissions) {
          t.submissions = [];
        }
      });

      // Merge and Remove Duplicates (Naye database ko priority)
      const combined = [...newTests, ...oldTests];
      const uniqueTests = Array.from(
        new Map(combined.map((t) => [t.id, t])).values(),
      );

      setTests(uniqueTests);
    } catch (error) {
      console.error("Error fetching metadata:", error);
    } finally {
      setLoadingData(false);
    }
  };

  // 🛡️ STUDENT JOIN FETCH (100% Secure: Uses Server-Side Stripping API)
  const fetchSingleTest = async (code) => {
    try {
      // THE FIX: Client ab seedha Firebase ko query nahi karega test_questions ke liye.
      // Wo sirf Server API ko bulayega, jo Answer Key kaat kar data bhejegi.
      const response = await fetch(
        `/api/exam/fetch?code=${encodeURIComponent(code)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error("Test fetch failed:", data.message);
        return null;
      }

      // Safe, stripped data received from Server!
      return data.testObj;
    } catch (error) {
      console.error("Error finding test:", error);
      return null;
    }
  };

  return (
    <DataContext.Provider
      value={{ tests, setTests, loadingData, fetchMyTests, fetchSingleTest }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
