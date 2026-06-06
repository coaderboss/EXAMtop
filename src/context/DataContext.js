// src/context/DataContext.js
'use client';
import { createContext, useContext, useState } from 'react';
import { database } from '../lib/firebase';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
    // Ab ye by default empty rahega, faltu me data load nahi karega
    const [tests, setTests] = useState([]); 
    const [loadingData, setLoadingData] = useState(false);

    // 🔥 1. EXAMINER VAULT FETCH (Sirf logged-in examiner ke tests laayega)
    const fetchMyTests = async (uid) => {
        if (!uid) return;
        setLoadingData(true);
        try {
            // QUERY: Poore database ki jagah sirf wahi tests jiska creatorUid match kare
            const q = query(ref(database, 'tests'), orderByChild('creatorUid'), equalTo(uid));
            const snapshot = await get(q); // 'get' use kiya hai (1-time fetch) instead of 'onValue'
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                let parsedTests = Array.isArray(data) ? data.filter(Boolean) : Object.values(data).filter(Boolean);
                
                // Old formatting bugs ko clean karna
                parsedTests.forEach(t => {
                    if (t.submissions && !Array.isArray(t.submissions)) {
                        t.submissions = Object.values(t.submissions).filter(Boolean);
                    } else if (!t.submissions) {
                        t.submissions = [];
                    }
                });
                setTests(parsedTests);
            } else {
                setTests([]);
            }
        } catch (error) {
            console.error("Error fetching tests:", error);
        } finally {
            setLoadingData(false);
        }
    };

    // 🔥 2. STUDENT JOIN FETCH (Sirf join code wale test ka 1 page data laayega)
    const fetchSingleTest = async (code) => {
        try {
            // QUERY: Sirf specific Code match karo
            const q = query(ref(database, 'tests'), orderByChild('code'), equalTo(code));
            const snapshot = await get(q);
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                // Find the exact object
                const testObj = Array.isArray(data) ? data.find(t => t?.code === code) : Object.values(data).find(t => t?.code === code);
                return testObj || null;
            }
            return null;
        } catch (error) {
            console.error("Error finding test:", error);
            return null;
        }
    };

    return (
        <DataContext.Provider value={{ 
            tests, setTests, loadingData, fetchMyTests, fetchSingleTest 
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => useContext(DataContext);