// src/components/SmilesViewer.js
'use client';
import { useEffect, useRef, useState } from 'react';

export default function SmilesViewer({ smilesCode, width = 300, height = 300 }) {
  const canvasRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Load the script directly from CDN (Bypasses Next.js Build Errors)
  useEffect(() => {
    if (window.SmilesDrawer) {
      setIsLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/smiles-drawer@1.0.10/dist/smiles-drawer.min.js';
    script.async = true;
    script.onload = () => setIsLoaded(true);
    document.body.appendChild(script);
  }, []);

  // 2. Draw the molecule once script is loaded and user types SMILES
  useEffect(() => {
    if (!isLoaded || !smilesCode || !canvasRef.current || !window.SmilesDrawer) return;

    try {
        const options = { 
            width, 
            height, 
            bondThickness: 1.5,
            compactDrawing: false
        };
        
        const smilesDrawer = new window.SmilesDrawer.Drawer(options);

        window.SmilesDrawer.parse(smilesCode, (tree) => {
          smilesDrawer.draw(tree, canvasRef.current, 'light', false);
        }, (err) => {
          // Silent error handling while typing incomplete codes
          console.log('Parsing SMILES...');
        });
    } catch (e) {
        console.error("Smiles Engine Error:", e);
    }
  }, [smilesCode, width, height, isLoaded]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: '8px', padding: '10px', border: '1px solid #cbd5e1' }}>
        <canvas ref={canvasRef} />
    </div>
  );
}