// src/context/DataContext.js
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { database } from '../lib/firebase';
import { ref, onValue } from 'firebase/database';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
    const [tests, setTests] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        const testsRef = ref(database, 'tests');
        
        // Ye listener database me koi bhi change hone par turant chalega
        const unsubscribe = onValue(testsRef, (snapshot) => {
            const data = snapshot.val();
            let parsedTests = [];
            
            if (Array.isArray(data)) {
                parsedTests = data;
            } else if (data) {
                parsedTests = Object.values(data).filter(item => item !== null);
            }

            // Submissions array ko clean karna (Purana Vanilla JS logic)
            parsedTests.forEach(t => {
                if (t.submissions && !Array.isArray(t.submissions)) {
                    t.submissions = Object.values(t.submissions).filter(item => item !== null);
                } else if (!t.submissions) {
                    t.submissions = [];
                }
            });

            setTests(parsedTests);
            setLoadingData(false);
        });

        // Cleanup function (Jab user app band kare toh connection tod do taaki memory leak na ho)
        return () => unsubscribe();
    }, []);

    return (
        <DataContext.Provider value={{ tests, loadingData }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => useContext(DataContext);