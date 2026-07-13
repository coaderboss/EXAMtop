// src/app/create/page.js
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { database } from '../../lib/firebase';
import { ref, set, get, runTransaction } from 'firebase/database';
import SmilesViewer from '../../components/SmilesViewer';

export default function CreateTest() {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  const router = useRouter();

  // Basic Settings State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [sections, setSections] = useState(''); // Comma separated sections
  const [duration, setDuration] = useState(60);
  const [totalMarks, setTotalMarks] = useState(300);
  const [negMarking, setNegMarking] = useState(0);
  const [expiryDate, setExpiryDate] = useState('');
  
  // Toggles & Access State
  const [access, setAccess] = useState('code');
  const [resultVis, setResultVis] = useState('instant');
  const [scoreVis, setScoreVis] = useState('show');
  const [allowChange, setAllowChange] = useState(true);
  const [showPalette, setShowPalette] = useState(true);
  const [allowNav, setAllowNav] = useState(true);
  const [randomOrder, setRandomOrder] = useState(false);
  const [shuffleOpts, setShuffleOpts] = useState(false);
  const [antiCheat, setAntiCheat] = useState(true);
  const [fullScreenMode, setFullScreenMode] = useState(false);
  
  // Offline Mode State
  const [isOffline, setIsOffline] = useState(false);
  const [sectionRules, setSectionRules] = useState({});

  const [mismatchModal, setMismatchModal] = useState(null); // For Marks Mismatch Custom Alert
  const [sysAlert, setSysAlert] = useState(null); // { title, msg, type }
  const [jsonModal, setJsonModal] = useState(null);
  // Paste JSON Modal State
  const [pasteModal, setPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  
  // Premium Draft State (For Custom Modal)
  const [pendingDraft, setPendingDraft] = useState(null); 
  const [successModal, setSuccessModal] = useState(null); // Custom popup state

  // Questions State
  const [qList, setQList] = useState([]);

  const [toastMsg, setToastMsg] = useState('');
  
  //  DRAFT CHECK ON MOUNT
  useEffect(() => {
    const offlineStatus = localStorage.getItem('isOfflineMode') === 'true';
    setIsOffline(offlineStatus);

    const userIdent = currentUser ? currentUser.uid : (offlineStatus ? 'offline_user' : 'guest');
    const draftStr = localStorage.getItem('exam_draft_creator_' + userIdent);
    
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        if ((draft.qList && draft.qList.length > 0) || draft.title) {
          setPendingDraft(draft); // Trigger Custom Modal
        } else {
          addDefaultQuestion();
        }
      } catch (e) { console.error("Draft parse error", e); addDefaultQuestion(); }
    } else {
      addDefaultQuestion();
    }
  }, [currentUser]);

  //  MATHJAX AUTO-RENDERER
  useEffect(() => {
    if (typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetClear();
      window.MathJax.typesetPromise().catch((err) => console.log('MathJax Error:', err));
    }
  }, [qList]);

  //  AUTO-SAVE DRAFT (Every 5 Secs)
  useEffect(() => {
    const interval = setInterval(() => {
      if (title.trim() === '' && qList.length === 0) return;
      
      const userIdent = currentUser ? currentUser.uid : (isOffline ? 'offline_user' : 'guest');
      const draft = {
        title, subject, sections, duration, totalMarks, negMarking, expiryDate, access, resultVis, scoreVis,
        toggles: { 
            change: allowChange, palette: showPalette, nav: allowNav, 
            rand: randomOrder, shuffle: shuffleOpts, anticheat: antiCheat, fullscreen: fullScreenMode 
        },
        qList,
        sectionRules // 🔥 NAYA: Draft me rules bhi save honge
      };
      localStorage.setItem('exam_draft_creator_' + userIdent, JSON.stringify(draft));
    }, 5000);
    return () => clearInterval(interval);
  }, [title, subject, sections, duration, totalMarks, negMarking, expiryDate, access, resultVis, scoreVis, allowChange, showPalette, allowNav, randomOrder, shuffleOpts, antiCheat, fullScreenMode, qList, sectionRules, currentUser, isOffline]);

  // --- Handlers for Offline Mode ---
  const toggleOfflineMode = () => {
    const newVal = !isOffline;
    setIsOffline(newVal);
    localStorage.setItem('isOfflineMode', newVal.toString());
  };

  // --- Handlers for Draft Custom Modal ---
  const handleRestoreDraft = () => {
    const draft = pendingDraft;
    setTitle(draft.title || '');
    setSubject(draft.subject || '');
    setSections(draft.sections || '');
    setDuration(draft.duration || 60);
    setTotalMarks(draft.totalMarks || 300);
    setNegMarking(draft.negMarking || 0);
    setExpiryDate(draft.expiryDate || '');
    setAccess(draft.access || 'code');
    setResultVis(draft.resultVis || 'instant');
    setScoreVis(draft.scoreVis || 'show');
    
    if (draft.toggles) {
      setAllowChange(draft.toggles.change !== undefined ? draft.toggles.change : true);
      setShowPalette(draft.toggles.palette !== undefined ? draft.toggles.palette : true);
      setAllowNav(draft.toggles.nav !== undefined ? draft.toggles.nav : true);
      setRandomOrder(draft.toggles.rand || false);
      setShuffleOpts(draft.toggles.shuffle || false);
      setAntiCheat(draft.toggles.anticheat !== undefined ? draft.toggles.anticheat : true);
      setFullScreenMode(draft.toggles.fullscreen || false);
    }
    setQList(draft.qList || []);
    setSectionRules(draft.sectionRules || {}); // 🔥 NAYA: Rules restore honge
    setPendingDraft(null); 
  };

  const handleDiscardDraft = () => {
    const userIdent = currentUser ? currentUser.uid : (isOffline ? 'offline_user' : 'guest');
    localStorage.removeItem('exam_draft_creator_' + userIdent);
    addDefaultQuestion();
    setPendingDraft(null); 
  };

  const addDefaultQuestion = () => {
    setQList([{ id: Date.now(), type: 'mcq', text: 'New Question', figureType: 'none', figureData: '', marks: 4, options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'], correct: [0], correctInt: null, explanation: '', section: '' }]);
  };

  const addQ = (insertAfterIdx = null, type = 'mcq') => {
    const newQ = { id: Date.now() + Math.random(), type, text: '', figureType: 'none', figureData: '', marks: 4, options: ['', '', '', ''], correct: [], correctInt: null, explanation: '', section: '' };
    let newList = [...qList];
    if (insertAfterIdx !== null) newList.splice(insertAfterIdx + 1, 0, newQ);
    else newList.push(newQ);
    setQList(newList);
  };

  const rmQ = (idx) => {
    let newList = [...qList];
    newList.splice(idx, 1);
    setQList(newList);
  };

  const updateQ = (idx, field, value) => {
    let newList = [...qList];
    newList[idx][field] = value;
    setQList(newList);
  };

  const updateOption = (qIdx, optIdx, value) => {
    let newList = [...qList];
    newList[qIdx].options[optIdx] = value;
    setQList(newList);
  };

  const addOpt = (qIdx) => {
    let newList = [...qList];
    newList[qIdx].options.push('');
    setQList(newList);
  };

  const setCorrectMCQ = (qIdx, optIdx) => {
    let newList = [...qList];
    newList[qIdx].correct = [optIdx];
    setQList(newList);
  };

  const toggleCorrectMSQ = (qIdx, optIdx, isChecked) => {
    let newList = [...qList];
    if (isChecked) newList[qIdx].correct.push(optIdx);
    else newList[qIdx].correct = newList[qIdx].correct.filter(x => x !== optIdx);
    setQList(newList);
  };

  // 🔥 1. UNIVERSAL JSON TEMPLATE (With SVG, TikZ, SMILES) 🔥
  const downloadTemplate = () => {
    const universalTemplate = {
      title: "Sample Smart Test",
      subject: "Physics & Chemistry",
      duration: 180,
      totalMarks: 16,
      sections: ["Section A", "Section B"],
      sectionRules: { "Section B": 5 }, // Meaning: Attempt any 5 in Section B
      questions: [
        {
          _comment: "TYPE 1: MCQ with RAW SVG (AI Generated Circuit)",
          type: "mcq", section: "Section A", marks: 4,
          text: "Find the equivalent resistance between A and B.",
          figureType: "svg",
          figureData: "<svg viewBox='0 0 200 100' width='100%' height='150' xmlns='http://www.w3.org/2000/svg'><path d='M20 50 L50 50 L55 40 L65 60 L75 40 L85 60 L90 50 L120 50' stroke='black' stroke-width='2' fill='none'/><text x='10' y='55' font-family='Arial'>A</text><text x='130' y='55' font-family='Arial'>B</text><text x='65' y='30' font-family='Arial'>5 Ω</text></svg>",
          options: ["2 Ω", "5 Ω", "10 Ω", "15 Ω"], correct: [1], correctInt: null
        },
        {
          _comment: "TYPE 2: Integer Type with Math/TikZ",
          type: "integer", section: "Section B", marks: 4,
          text: "If a particle moves with velocity $v = 3t^2$, find displacement at $t=2$.",
          figureType: "tikz",
          figureData: "\\begin{tikzpicture}\\draw[->] (0,0) -- (4,0) node[right] {$t$}; \\draw[->] (0,0) -- (0,3) node[above] {$v$}; \\draw[thick, blue] (0,0) parabola (3,2.5);\\end{tikzpicture}",
          options: [], correct: [], correctInt: 8
        },
        {
          _comment: "TYPE 3: Multiple Correct (MSQ) without figure",
          type: "msq", section: "Section A", marks: 4,
          text: "Which of these are non-conservative forces?",
          figureType: "none", figureData: "",
          options: ["Friction", "Gravity", "Viscous Drag", "Electrostatic"], correct: [0, 2], correctInt: null
        },
        {
          _comment: "TYPE 4: Chemistry MCQ with SMILES",
          type: "mcq", section: "Section B", marks: 4,
          text: "Identify this IUPAC structure:",
          figureType: "smiles", figureData: "CC(=O)OC1=CC=CC=C1C(=O)O",
          options: ["Aspirin", "Paracetamol", "Benzene", "Phenol"], correct: [0], correctInt: null
        }
      ]
    };
    const blob = new Blob([JSON.stringify(universalTemplate, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'examitop_universal_template.json';
    a.click();
  };

  // 🔥 2. SMART JSON VALIDATOR & IMPORTER 🔥
  const validateAndImportJSON = (rawText) => {
    let errors = [];
    let parsedData;

    // Phase 1: Syntax Check (Missing commas, brackets, etc.)
    try {
      parsedData = JSON.parse(rawText);
    } catch (e) {
      setJsonModal({ text: rawText, errors: [`🚨 Syntax Error: ${e.message}. Please check for missing commas, unclosed brackets, or extra quotes.`] });
      return;
    }

    // Determine if it's an array directly or an object containing a 'questions' array
    let qArray = Array.isArray(parsedData) ? parsedData : (parsedData.questions ? parsedData.questions : null);

    if (!qArray || !Array.isArray(qArray)) {
      setJsonModal({ text: rawText, errors: ["🚨 Structure Error: JSON must be an Array of questions OR an object containing a 'questions' array."] });
      return;
    }

    // Phase 2: Deep Schema Validation (Finding exact logical mistakes)
    const mappedData = [];
    let importedSections = new Set(sections.split(',').map(s => s.trim()).filter(s => s));

    qArray.forEach((q, idx) => {
      let qNum = idx + 1;
      
      if (!q.text || q.text.trim() === '') errors.push(`❌ Question ${qNum}: Missing 'text' (Question body cannot be empty).`);
      if (!q.type || !['mcq', 'msq', 'integer', 'subjective'].includes(q.type)) errors.push(`❌ Question ${qNum}: Invalid type. Must be 'mcq', 'msq', 'integer', or 'subjective'.`);
      
      if (q.type === 'mcq' || q.type === 'msq') {
        if (!q.options || !Array.isArray(q.options) || q.options.length < 2) errors.push(`❌ Question ${qNum} (${q.type}): Must have an 'options' array with at least 2 choices.`);
        if (!q.correct || !Array.isArray(q.correct) || q.correct.length === 0) errors.push(`❌ Question ${qNum} (${q.type}): Missing 'correct' array (e.g., [0] for A).`);
      }
      
      if (q.type === 'integer' && (q.correctInt === undefined || q.correctInt === null || q.correctInt === '')) {
        errors.push(`❌ Question ${qNum} (integer): Missing 'correctInt' value.`);
      }

      // If no errors for this specific question, map it to be ready for import
      if (errors.length === 0) {
        if (q.section) importedSections.add(q.section);
        mappedData.push({
          id: Date.now() + Math.random() + idx,
          type: q.type || 'mcq',
          text: q.text || '',
          figureType: q.figureType || 'none',
          figureData: q.figureData || '',
          marks: q.marks || 4,
          options: q.options || ['', '', '', ''],
          correct: q.correct || [],
          correctInt: q.correctInt !== undefined ? q.correctInt : null,
          modelAnswer: q.modelAnswer || '',
          explanation: q.explanation || '',
          section: q.section || ''
        });
      }
    });

    // Phase 3: Action based on Validation
    if (errors.length > 0) {
      // Show editor modal with errors
      setJsonModal({ text: JSON.stringify(parsedData, null, 2), errors });
    } else {
      // 100% Perfect! Import it.
      setSections(Array.from(importedSections).join(', '));
      if (!Array.isArray(parsedData)) {
          if (parsedData.title) setTitle(parsedData.title);
          if (parsedData.subject) setSubject(parsedData.subject);
          if (parsedData.duration) setDuration(Number(parsedData.duration));
          if (parsedData.totalMarks) setTotalMarks(Number(parsedData.totalMarks));
          if (parsedData.negMarking) setNegMarking(Number(parsedData.negMarking));
          if (parsedData.sectionRules) setSectionRules(parsedData.sectionRules);
      }
      setQList([...qList, ...mappedData]);
      setJsonModal(null); // Close modal if open
      setSysAlert({ title: 'Import Successful', msg: `${mappedData.length} questions mapped perfectly from JSON.`, type: 'success' });
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        validateAndImportJSON(evt.target.result);
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  //  UNIVERSAL BASE64 IMAGE CONVERTER
  const handleImageUpload = (e, qIndex) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
       setSysAlert({ title: 'File Too Large', msg: 'Please keep images under 2MB for seamless offline execution.', type: 'warning' });
       return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      // Direct Base64 string ko figureData me dal diya
      updateQ(qIndex, 'figureData', reader.result); 
    };
    reader.readAsDataURL(file);
  };

  const saveTest = () => {
    //  Teeno Alerts ko SysAlert se replace kar diya
    if (!isOffline && !currentUser) { setSysAlert({ title: 'Authentication Error', msg: "Login Required! You need to log in to save this test to the cloud.", type: 'error' }); return; }
    if (!title.trim()) { setSysAlert({ title: 'Missing Field', msg: 'Please enter a test title before saving.', type: 'warning' }); return; }
    if (!qList.length) { setSysAlert({ title: 'Empty Test', msg: 'Please add at least one question to the test.', type: 'warning' }); return; }

    //  Strict Evaluation Key Validation (Isko bhi SysAlert kar diya)
    for (let i = 0; i < qList.length; i++) {
        const q = qList[i];
        if (q.type === 'mcq' || q.type === 'msq') {
            if (!q.correct || q.correct.length === 0) { setSysAlert({ title: 'Action Required', msg: `Please mark the correct option for Question ${i + 1}.`, type: 'warning' }); return; }
        }
        if (q.type === 'integer') {
            if (q.correctInt === null || q.correctInt === undefined || q.correctInt === '') { setSysAlert({ title: 'Action Required', msg: `Please enter the correct integer answer for Question ${i + 1}.`, type: 'warning' }); return; }
        }
    }
    

    const calculatedSum = qList.reduce((sum, q) => sum + Number(q.marks), 0);
    
    // Yahan Custom Modal Trigger Hoga agar marks match nahi kiye
    if (calculatedSum !== totalMarks) {
      setMismatchModal({ entered: totalMarks, actual: calculatedSum });
      return;
    }

    proceedWithSave(totalMarks);
  };

  // --- Actual DB Saving Logic ---
  const proceedWithSave = async (finalMarks) => {
    const testCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const parsedSections = sections.split(',').map(s => s.trim()).filter(s => s);

    const newTest = {
      id: Date.now(), code: testCode, title, subject, duration, sections: parsedSections,
      totalMarks: finalMarks, negMarking, expiryDate, access, resultVis, scoreVis,
      allowChange, showPalette, allowNav, randomOrder, shuffleOpts, antiCheat, fullScreenMode,
      creatorUid: isOffline ? 'offline_creator' : currentUser.uid,
      questions: qList, submissions: [], released: false, isActive: true,
      sectionRules, // 🔥 NAYA: Database me rules save honge
      createdAt: new Date().toLocaleDateString('en-IN'), isLocal: isOffline
    };

    try {
      if (isOffline) {
        let localTests = JSON.parse(localStorage.getItem('examitop_offline_tests') || '[]');
        localTests.push(newTest);
        localStorage.setItem('examitop_offline_tests', JSON.stringify(localTests));
      } else {
        await runTransaction(ref(database, 'tests'), (currentTests) => {
            let testsArr = currentTests || [];
            // Arrays ko handle karna taaki structure break na ho
            if (!Array.isArray(testsArr)) testsArr = Object.values(testsArr).filter(item => item !== null);
            testsArr.push(newTest);
            return testsArr; 
        });
      }

      const userIdent = currentUser ? currentUser.uid : (isOffline ? 'offline_user' : 'guest');
      localStorage.removeItem('exam_draft_creator_' + userIdent);

      setMismatchModal(null);
      setSuccessModal({ code: testCode, mode: isOffline ? 'Local Device' : 'Cloud' });  
    } catch (error) { console.error(error); alert("Error saving test: " + error.message); }
  };

  if (authLoading) return <div className="spinner-container" style={{ paddingTop: '10vh' }}><div className="spinner"></div></div>;
  if (!isOffline && userRole !== 'examiner' && userRole !== 'admin') {
    return <div style={{ textAlign: 'center', padding: '4rem' }}><h3>Access Denied</h3><p>Only Examiners can create tests.</p></div>;
  }

  const parsedSectionsArray = sections.split(',').map(s => s.trim()).filter(s => s);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-[fadeIn_0.3s_ease] pb-[30vh]">
      
      {/* 🔥 NATIVE APP HEADER 🔥 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
              <h2 className="text-2xl sm:text-[28px] font-black text-slate-800 tracking-tight flex items-center gap-3 m-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
                      <i className="ti ti-pencil-code text-xl sm:text-2xl"></i>
                  </div>
                  Test Creator Engine
              </h2>
              <div className="mt-3 flex gap-2">
                  <button type="button" onClick={toggleOfflineMode} className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 transition-colors border ${isOffline ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                      <i className={`ti ${isOffline ? 'ti-wifi-off' : 'ti-cloud'} text-sm`}></i> 
                      {isOffline ? 'Offline Mode Active' : 'Cloud Sync Active'}
                  </button>
              </div>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3 w-full sm:w-auto mt-2 sm:mt-0">
              <button className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-slate-200 text-blue-600 font-bold text-[13px] rounded-xl shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 active:scale-95" onClick={downloadTemplate}>
                  <i className="ti ti-download text-lg"></i> <span className="hidden sm:inline">JSON</span> Template
              </button>
              
              {/* NAYA: Paste JSON Button */}
              <button className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-slate-200 text-indigo-600 font-bold text-[13px] rounded-xl shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 active:scale-95" onClick={() => { setPasteText(''); setPasteModal(true); }}>
                  <i className="ti ti-clipboard text-lg"></i> Paste <span className="hidden sm:inline">JSON</span>
              </button>

              <label className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-slate-200 text-emerald-600 font-bold text-[13px] rounded-xl shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-95">
                  <i className="ti ti-upload text-lg"></i> Import <span className="hidden sm:inline">JSON</span>
                  <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
              <button className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white font-bold text-[13px] rounded-xl shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2" onClick={saveTest}>
                  <i className="ti ti-device-floppy text-lg"></i> Save & Publish
              </button>
          </div>
      </div>

      {/* SLEEK INLINE DRAFT BANNER (No annoying modals!)  */}
      {pendingDraft && (
          <div className="bg-amber-50 border border-amber-200 p-4 sm:p-5 rounded-2xl mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-[slideDown_0.3s_ease]">
              <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0 shadow-inner">
                      <i className="ti ti-file-symlink text-2xl"></i>
                  </div>
                  <div>
                      <h4 className="text-[15px] font-black text-amber-900 leading-none mb-1.5">Unsaved Draft Recovered</h4>
                      <p className="text-[12px] font-semibold text-amber-700/80 leading-none">Contains {pendingDraft.qList ? pendingDraft.qList.length : 0} questions. Continue from where you left off?</p>
                  </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                  <button onClick={handleDiscardDraft} className="flex-1 sm:flex-none px-5 py-2.5 bg-white border border-amber-200 text-amber-700 text-[13px] font-bold rounded-xl hover:bg-amber-100 transition-colors active:scale-95">Discard</button>
                  <button onClick={handleRestoreDraft} className="flex-1 sm:flex-none px-5 py-2.5 bg-amber-500 text-white text-[13px] font-bold rounded-xl shadow-md shadow-amber-500/20 hover:bg-amber-600 transition-colors active:scale-95 flex items-center justify-center gap-1.5"><i className="ti ti-refresh text-base"></i> Restore</button>
              </div>
          </div>
      )}

      {/* 🔥 BENTO BOX CONFIGURATION 🔥 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 mb-8">
        
        {/* Basic Settings Card */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col">
          <h3 className="text-[13px] font-extrabold text-slate-800 uppercase tracking-widest mb-5 flex items-center gap-2">
              <i className="ti ti-settings text-blue-500 text-lg"></i> Basic Settings
          </h3>
          
          <div className="mb-4">
              <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">Test Title <span className="text-rose-500">*</span></label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Mid-Term Physics" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
                <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">Subject</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Science" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 transition-all" />
            </div>
            <div>
                <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">Sections (Comma separated)</label>
                <input type="text" value={sections} onChange={e => setSections(e.target.value)} placeholder="e.g. Maths, Physics" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 transition-all" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
                <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">Duration (Mins)</label>
                <div className="relative">
                    <i className="ti ti-clock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                    <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-400 transition-all" />
                </div>
            </div>
            <div>
                <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">Total Marks</label>
                <div className="relative">
                    <i className="ti ti-target absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                    <input type="number" value={totalMarks} onChange={e => setTotalMarks(Number(e.target.value))} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-400 transition-all" />
                </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
                <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">Negative Marking</label>
                <div className="relative">
                    <i className="ti ti-minus absolute left-3.5 top-1/2 -translate-y-1/2 text-rose-500 text-lg"></i>
                    <input type="number" step="0.25" min="0" value={Math.abs(negMarking)} onChange={e => setNegMarking(Math.abs(Number(e.target.value)))} placeholder="0.25" className="w-full pl-10 pr-4 py-3 bg-rose-50/50 border border-slate-200 rounded-xl text-sm font-bold text-rose-700 outline-none focus:border-rose-400 transition-all" />
                </div>
            </div>
            <div>
                <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">Expiry Date & Time</label>
                <input type="datetime-local" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 transition-all" />
            </div>
          </div>

          <div className="mt-auto">
            <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">Test Access / Visibility</label>
            <div className="relative">
                <select value={access} onChange={e => setAccess(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-400 transition-all appearance-none cursor-pointer">
                    <option value="code">Private (Requires Test Code)</option>
                    <option value="public">Public (Visible on Home Board)</option>
                </select>
                <i className="ti ti-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
            </div>
          </div>
        </div>

        {/* Security & Features Card */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col">
          <h3 className="text-[13px] font-extrabold text-slate-800 uppercase tracking-widest mb-5 flex items-center gap-2">
              <i className="ti ti-shield-lock text-emerald-500 text-lg"></i> Security & Experience
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
                <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">Result Visibility</label>
                <div className="relative">
                    <select value={resultVis} onChange={e => setResultVis(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 outline-none focus:border-blue-400 transition-all appearance-none cursor-pointer">
                        <option value="instant">Instant Auto-grade</option>
                        <option value="manual">Manual Release</option>
                    </select>
                    <i className="ti ti-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                </div>
            </div>
            <div>
                <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">Score Breakdown</label>
                <div className="relative">
                    <select value={scoreVis} onChange={e => setScoreVis(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 outline-none focus:border-blue-400 transition-all appearance-none cursor-pointer">
                        <option value="show">Detailed Analytics</option>
                        <option value="hide">Basic Score Only</option>
                    </select>
                    <i className="ti ti-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 custom-scrollbar flex flex-col gap-2 max-h-[300px]">
              
              {/* Toggles */}
              {[
                  { label: "Allow Answer Changes", desc: "Students can edit marked answers", state: allowChange, set: setAllowChange },
                  { label: "Show Question Palette", desc: "Display navigation map during exam", state: showPalette, set: setShowPalette },
                  { label: "Free Navigation", desc: "Allow jumping between questions", state: allowNav, set: setAllowNav },
                  { label: "Shuffle Questions", desc: "Randomize order for each student", state: randomOrder, set: setRandomOrder },
                  { label: "Shuffle Options", desc: "Randomize A/B/C/D order", state: shuffleOpts, set: setShuffleOpts },
              ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div>
                          <div className="font-bold text-[13px] text-slate-800">{item.label}</div>
                          <div className="text-[11px] font-medium text-slate-500">{item.desc}</div>
                      </div>
                      <div className={`w-10 h-5 sm:w-11 sm:h-6 rounded-full cursor-pointer relative transition-colors duration-300 shrink-0 border border-black/5 ${item.state ? 'bg-blue-600' : 'bg-slate-300'}`} onClick={() => item.set(!item.state)}>
                          <div className={`absolute top-[2px] w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${item.state ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                      </div>
                  </div>
              ))}

              {/* Danger Toggles */}
              {[
                  { label: "Anti-Cheat Engine", desc: "Block tab switching and copy-paste", state: antiCheat, set: setAntiCheat },
                  { label: "Enforce Full-Screen", desc: "Warn if full-screen is exited", state: fullScreenMode, set: setFullScreenMode },
              ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-rose-50/50 border border-rose-100 rounded-xl">
                      <div>
                          <div className="font-bold text-[13px] text-rose-700"><i className="ti ti-shield-half-filled"></i> {item.label}</div>
                          <div className="text-[11px] font-medium text-rose-600/70">{item.desc}</div>
                      </div>
                      <div className={`w-10 h-5 sm:w-11 sm:h-6 rounded-full cursor-pointer relative transition-colors duration-300 shrink-0 border border-black/5 ${item.state ? 'bg-rose-500' : 'bg-slate-300'}`} onClick={() => item.set(!item.state)}>
                          <div className={`absolute top-[2px] w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${item.state ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                      </div>
                  </div>
              ))}
          </div>
        </div>
      </div>

      {/* 🔥 JEE STYLE OPTIONAL QUESTIONS SECTION 🔥 */}
      {parsedSectionsArray.length > 0 && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-indigo-100 shadow-sm mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4"></div>
            
            <h3 className="text-[13px] font-extrabold text-indigo-900 uppercase tracking-widest mb-2 flex items-center gap-2 relative z-10">
                <i className="ti ti-list-check text-indigo-500 text-lg"></i> Optional Questions
            </h3>
            <p className="text-[12px] font-semibold text-slate-500 mb-5 leading-relaxed relative z-10 max-w-3xl">
                Define the maximum number of questions a student needs to attempt in each section (e.g. Attempt any 5 out of 10). Leave empty if all questions are mandatory.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
                {parsedSectionsArray.map(sec => (
                    <div key={sec} className="flex items-center justify-between p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                        <span className="text-[13px] font-bold text-indigo-900 truncate pr-2"><i className="ti ti-folder text-indigo-400 mr-1"></i> {sec}</span>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-extrabold text-slate-500 uppercase">Attempt Any:</span>
                            <input 
                                type="number" 
                                min="1" 
                                placeholder="All" 
                                value={sectionRules[sec] || ''} 
                                onChange={e => setSectionRules({...sectionRules, [sec]: e.target.value})} 
                                className="w-14 p-1.5 text-center bg-white border border-indigo-200 rounded-lg text-[13px] font-black text-indigo-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all shadow-sm placeholder:font-semibold placeholder:text-slate-400" 
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* 🔥 QUESTIONS HEADER 🔥 */}
      <div className="flex items-center justify-between mb-5 bg-slate-900 p-4 rounded-2xl shadow-lg border border-slate-800">
        <h3 className="text-[15px] sm:text-[18px] font-black text-white flex items-center gap-2 m-0">
            <i className="ti ti-list-numbers text-blue-400"></i> Questions Builder
        </h3>
        <span className="bg-blue-500/20 border border-blue-500/30 text-blue-300 font-black text-xs px-3 py-1.5 rounded-lg tracking-widest uppercase">
            {qList.length} Added
        </span>
      </div>

      {/* 🔥 PREMIUM QUESTION CARDS (Ultra-Compact Split Grid) 🔥 */}
      <div className="flex flex-col gap-6">
        {qList.map((q, i) => (
          <div key={q.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-blue-300 hover:shadow-md group">
            
            {/* Super Compact Header */}
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
              
              <div className="flex items-center gap-2.5 w-full sm:w-auto overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-lg flex items-center justify-center font-black text-sm shrink-0 shadow-sm">{i + 1}</div>
                  
                  <select value={q.type} onChange={e => updateQ(i, 'type', e.target.value)} className="bg-white border border-slate-200 text-slate-700 font-bold text-[12px] rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 shadow-sm cursor-pointer shrink-0">
                    <option value="mcq">Single Correct (MCQ)</option>
                    <option value="msq">Multi Correct (MSQ)</option>
                    <option value="integer">Integer Type</option>
                    <option value="subjective">Subjective</option>
                  </select>

                  {parsedSectionsArray.length > 0 && (
                      <select value={q.section || ''} onChange={e => updateQ(i, 'section', e.target.value)} className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[12px] rounded-lg px-3 py-1.5 outline-none focus:border-indigo-400 shadow-sm cursor-pointer shrink-0">
                          <option value="">-- No Section --</option>
                          {parsedSectionsArray.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                  )}
              </div>
              
              <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
                {/* 🔥 MARKS BOX FIX: Fixed width and removed native arrows */}
                <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <span className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-2.5 py-1.5 border-r border-slate-200">Marks</span>
                    <input type="number" value={q.marks} onChange={e => updateQ(i, 'marks', Number(e.target.value))} className="w-14 text-center py-1 text-[14px] font-black text-slate-800 outline-none" style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }} />
                </div>
                <button className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-100 transition-all flex items-center justify-center shrink-0" onClick={() => rmQ(i)} title="Delete Question">
                    <i className="ti ti-trash text-base"></i>
                </button>
              </div>
            </div>

            {/* Main Body (Grid Layout to save 50% vertical space on Laptops) */}
            <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
                
                {/* COLUMN 1: Question Text & Figure Engine */}
                <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 block">Question Text</label>
                      <textarea value={q.text} onChange={e => updateQ(i, 'text', e.target.value)} placeholder="Type your question here (MathJax $...$ supported)..." className="w-full p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-800 outline-none focus:border-blue-400 focus:bg-white transition-all min-h-[80px] resize-y custom-scrollbar" />
                    </div>

                    {/* Compact Figure Engine */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <label className="text-[12px] font-extrabold text-slate-700 flex items-center gap-1.5 m-0">
                          <i className="ti ti-vector text-indigo-500 text-base"></i> Figure / Diagram
                        </label>
                        <select 
                          value={q.figureType || 'none'} 
                          onChange={(e) => { updateQ(i, 'figureType', e.target.value); updateQ(i, 'figureData', ''); }}
                          className="bg-white border border-slate-200 text-slate-700 font-bold text-[11px] rounded-md px-2 py-1 outline-none focus:border-indigo-400 shadow-sm cursor-pointer"
                        >
                          <option value="none">No Figure</option>
                          <option value="image">Local Image</option>
                          <option value="url">Web URL</option>
                          <option value="svg">Raw SVG (AI Code)</option>
                          <option value="smiles">Chemistry (SMILES)</option>
                          <option value="tikz">Math (TikZ)</option>
                        </select>
                      </div>

                      {q.figureType === 'image' && (
                        <div className="p-3 bg-white border border-dashed border-slate-300 rounded-lg text-center">
                          <label className="cursor-pointer bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-md text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors">
                            <i className="ti ti-upload text-base"></i> Upload Diagram
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, i)} />
                          </label>
                          {q.figureData && (
                            <div className="mt-3 flex justify-center"><img src={q.figureData} alt="Preview" className="max-w-full max-h-[120px] rounded border border-slate-200 shadow-sm object-contain" /></div>
                          )}
                        </div>
                      )}
                      {q.figureType === 'url' && <input type="text" value={q.figureData || ''} onChange={e => updateQ(i, 'figureData', e.target.value)} placeholder="Paste image link (https://...)" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 transition-colors" />}
                      
                      {q.figureType === 'svg' && (
                        <div className="flex flex-col gap-2">
                          <textarea value={q.figureData || ''} onChange={e => updateQ(i, 'figureData', e.target.value)} placeholder="<svg viewBox='0 0 200 100'> ... </svg>" className="w-full p-2.5 bg-slate-900 text-blue-300 border border-slate-800 rounded-lg text-[10px] font-mono outline-none focus:border-blue-500 transition-colors min-h-[60px] custom-scrollbar" />
                          {q.figureData && (
                             <div className="p-3 bg-white border border-slate-200 rounded-lg flex justify-center shadow-inner overflow-hidden max-w-full" dangerouslySetInnerHTML={{ __html: q.figureData }}></div>
                          )}
                        </div>
                      )}

                      {q.figureType === 'smiles' && <input type="text" value={q.figureData || ''} onChange={e => updateQ(i, 'figureData', e.target.value)} placeholder="e.g. c1ccccc1" className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-mono outline-none focus:border-indigo-400 transition-colors" />}
                      
                      {/* 🔥 SMART TIKZ ENGINE WITH LIVE PREVIEW 🔥 */}
                      {q.figureType === 'tikz' && (
                        <div className="flex flex-col gap-2">
                            <textarea 
                                value={q.figureData || ''} 
                                onChange={e => updateQ(i, 'figureData', e.target.value)} 
                                placeholder="\begin{tikzpicture} ... \end{tikzpicture}" 
                                className="w-full p-3 bg-slate-900 text-emerald-400 border border-slate-800 rounded-lg text-[11px] font-mono outline-none focus:border-emerald-500 transition-colors min-h-[80px] custom-scrollbar" 
                            />
                            {q.figureData && (
                                <div className="mt-1 flex justify-center bg-white p-2 rounded-lg border border-slate-200 shadow-inner max-w-full overflow-x-auto hide-scroll">
                                    <img 
                                        src={`https://i.upmath.me/svg/${encodeURIComponent(
                                            q.figureData.includes('\\begin{tikzpicture}') 
                                            ? q.figureData 
                                            : '\\begin{tikzpicture}\n' + q.figureData + '\n\\end{tikzpicture}'
                                        )}`} 
                                        alt="TikZ Preview" 
                                        className="max-h-[150px] object-contain" 
                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/400x150/f8fafc/ef4444?text=TikZ+Syntax+Error'; }}
                                    />
                                </div>
                            )}
                        </div>
                      )}
                    </div>
                </div>

                {/* COLUMN 2: Options, Logic & Keys */}
                <div className="flex flex-col gap-4">
                    
                    {/* Options Array */}
                    {(q.type === 'mcq' || q.type === 'msq') && (
                      <div>
                        <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-2 block">
                            Options &mdash; <span className={q.type==='mcq' ? 'text-blue-500' : 'text-indigo-500'}>{q.type === 'mcq' ? 'Select correct one' : 'Check all correct'}</span>
                        </label>
                        <div className="flex flex-col gap-2">
                            {q.options.map((opt, j) => (
                            <div key={j} className={`flex items-center gap-2 p-1.5 pr-3 rounded-lg border transition-all ${q.correct.includes(j) ? 'bg-emerald-50 border-emerald-300 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                                <div className="shrink-0 pl-1.5">
                                    {q.type === 'mcq' ? (
                                        <input type="radio" name={`cr_${q.id}`} checked={q.correct.includes(j)} onChange={() => setCorrectMCQ(i, j)} className="w-4 h-4 accent-emerald-600 cursor-pointer" />
                                    ) : (
                                        <input type="checkbox" checked={q.correct.includes(j)} onChange={e => toggleCorrectMSQ(i, j, e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
                                    )}
                                </div>
                                <div className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-black shrink-0 ${q.correct.includes(j) ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                                    {String.fromCharCode(65 + j)}
                                </div>
                                <input type="text" value={opt} onChange={e => updateOption(i, j, e.target.value)} placeholder="Type option..." className="flex-1 bg-transparent border-none text-[13px] font-medium text-slate-700 outline-none" />
                            </div>
                            ))}
                        </div>
                        <button className="mt-2.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold text-[11px] rounded-md transition-colors flex items-center gap-1.5 w-fit" onClick={() => addOpt(i)}>
                            <i className="ti ti-plus"></i> Add Option
                        </button>
                      </div>
                    )}

                    {q.type === 'integer' && (
                      <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl">
                        <label className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-widest mb-1.5 block">Correct Integer Answer</label>
                        <input type="number" value={q.correctInt !== null ? q.correctInt : ''} onChange={e => updateQ(i, 'correctInt', e.target.value === '' ? null : Number(e.target.value))} className="w-28 px-3 py-2 bg-white border border-emerald-200 rounded-lg text-base font-black text-emerald-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all text-center" style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }} placeholder="e.g. 42" />
                      </div>
                    )}

                    {q.type === 'subjective' && (
                      <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl">
                        <label className="text-[11px] font-extrabold text-amber-700 uppercase tracking-widest mb-1.5 block">Model Answer (Reference)</label>
                        <textarea value={q.modelAnswer || ''} onChange={e => updateQ(i, 'modelAnswer', e.target.value)} placeholder="Write key points for evaluation..." className="w-full p-2.5 bg-white border border-amber-200 rounded-lg text-[13px] font-medium text-amber-900 outline-none focus:border-amber-400 transition-all min-h-[60px] resize-y custom-scrollbar" />
                      </div>
                    )}

                    {/* Explanation */}
                    <div className="mt-auto pt-4 border-t border-slate-100">
                      <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><i className="ti ti-bulb text-amber-500 text-base"></i> Solution / Logic</label>
                      <textarea value={q.explanation || ''} onChange={e => updateQ(i, 'explanation', e.target.value)} placeholder="Formula or step-by-step logic..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:border-blue-400 transition-all min-h-[60px] resize-y custom-scrollbar" />
                    </div>
                </div>
            </div>

            {/* Quick Add Button underneath the card */}
            <button className="w-full py-2 bg-slate-50/50 border-t border-slate-100 hover:bg-blue-50 text-slate-400 hover:text-blue-600 font-bold text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5" onClick={() => addQ(i)}>
                <i className="ti ti-row-insert-bottom text-sm"></i> Insert Question Below
            </button>
          </div>
        ))}
      </div>
      
      {/* Append at Bottom */}
      <div className="text-center mt-6">
        <button className="px-6 py-3 bg-white border border-dashed border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-400 font-black text-sm rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 mx-auto" onClick={() => addQ()}>
          <i className="ti ti-plus text-lg"></i> Append Question at End
        </button>
      </div>

      {/* 🔥 PREMIUM SYSTEM MODALS 🔥 */}
      
      {/* Mismatch Modal */}
      {mismatchModal && (
          <div className="modal-bg flex items-center justify-center p-4" style={{ zIndex: 10000, backdropFilter: 'blur(5px)', background: 'rgba(15, 23, 42, 0.6)' }}>
              <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-8 text-center animate-[popIn_0.3s_ease]">
                  <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border border-amber-100 shadow-sm"><i className="ti ti-alert-triangle"></i></div>
                  <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Marks Mismatch Detected!</h3>
                  <p className="text-sm font-semibold text-slate-500 mb-6 leading-relaxed">
                      You entered Total Marks as <strong className="text-rose-500">{mismatchModal.entered}</strong>, but the questions sum up to <strong className="text-blue-600">{mismatchModal.actual}</strong>.
                      <br/><br/>Should we automatically update the total to <strong>{mismatchModal.actual}</strong> and publish?
                  </p>
                  <div className="flex gap-3">
                      <button className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors active:scale-95" onClick={() => setMismatchModal(null)}>Cancel & Edit</button>
                      <button className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-500/30 transition-all active:scale-95" onClick={() => proceedWithSave(mismatchModal.actual)}>Yes, Auto-Update</button>
                  </div>
              </div>
          </div>
      )}

      {/* Sys Alert Modal */}
      {sysAlert && (
          <div className="modal-bg flex items-center justify-center p-4" style={{ zIndex: 10000, backdropFilter: 'blur(5px)', background: 'rgba(15, 23, 42, 0.6)' }}>
              <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-8 text-center animate-[popIn_0.3s_ease]">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-sm ${sysAlert.type === 'success' ? 'bg-emerald-50 text-emerald-500 border border-emerald-100' : sysAlert.type === 'error' ? 'bg-rose-50 text-rose-500 border border-rose-100' : 'bg-amber-50 text-amber-500 border border-amber-100'}`}>
                      <i className={`ti ${sysAlert.type === 'success' ? 'ti-check' : sysAlert.type === 'error' ? 'ti-x' : 'ti-alert-triangle'}`}></i>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">{sysAlert.title}</h3>
                  <p className="text-sm font-semibold text-slate-500 mb-6 leading-relaxed">{sysAlert.msg}</p>
                  <button className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[15px] rounded-xl shadow-md shadow-blue-600/20 transition-all active:scale-95" onClick={() => setSysAlert(null)}>Okay</button>
              </div>
          </div>
      )}

      {/* Success Modal */}
      {successModal && (
          <div className="modal-bg flex items-center justify-center p-4" style={{ zIndex: 100000, backdropFilter: 'blur(5px)', background: 'rgba(15, 23, 42, 0.8)' }}>
              <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-8 text-center animate-[popIn_0.3s_ease]">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-5 border-2 border-emerald-100 shadow-sm"><i className="ti ti-check"></i></div>
                  <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Test Created Successfully!</h2>
                  <p className="text-sm font-semibold text-slate-500 mb-6">Your test is ready and locked. Share the code below with your students to begin.</p>
                  
                  <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-5 mb-6 relative">
                      <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">TEST SECURE CODE</div>
                      <div className="text-4xl font-black text-blue-600 tracking-[0.2em] font-mono">{successModal.code}</div>
                      <div className={`text-[11px] font-extrabold mt-3 flex items-center justify-center gap-1 ${successModal.mode.includes('Local') ? 'text-amber-600' : 'text-emerald-600'}`}>
                          <i className={`ti ${successModal.mode.includes('Local') ? 'ti-device-floppy' : 'ti-cloud-check'} text-sm`}></i> Saved to {successModal.mode}
                      </div>
                  </div>

                  <div className="flex flex-col gap-3">
                      <button 
                          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[15px] rounded-xl shadow-md shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                          onClick={() => { navigator.clipboard.writeText(successModal.code); setToastMsg("✅ Code Copied to Clipboard!"); setTimeout(() => setToastMsg(''), 3000); }}
                      >
                          <i className="ti ti-copy text-lg"></i> Copy Secure Code
                      </button>
                      <button 
                          className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[15px] rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                          onClick={() => { setSuccessModal(null); router.push('/tests'); }}
                      >
                          <i className="ti ti-list-check text-lg"></i> Go to My Vault
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* 🔥 NAYA: PASTE JSON MODAL 🔥 */}
      {pasteModal && (
          <div className="modal-bg flex items-center justify-center p-4 sm:p-6" style={{ zIndex: 100000, backdropFilter: 'blur(8px)', background: 'rgba(15, 23, 42, 0.7)' }}>
              <div className="bg-white w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-[popIn_0.3s_ease]">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-xl shadow-inner border border-indigo-200"><i className="ti ti-clipboard"></i></div>
                          <div>
                              <h3 className="text-[18px] font-black text-slate-800 m-0 leading-none tracking-tight">Paste JSON Data</h3>
                              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">Paste your Universal Template JSON here</p>
                          </div>
                      </div>
                      <button className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-colors" onClick={() => setPasteModal(false)}>
                          <i className="ti ti-x text-lg"></i>
                      </button>
                  </div>
                  
                  <div className="p-4 sm:p-5 flex flex-col bg-[#0d1117] h-[50vh]">
                      <textarea 
                          value={pasteText}
                          onChange={(e) => setPasteText(e.target.value)}
                          placeholder={`
                        [
                           {
                            "type": "mcq | msq | integer | subjective",
                             "section": "Physics (Optional)",
                              "marks": 4,
                              "text": "Your question text here...",
                              "figureType": "none | url | svg | smiles | tikz",
                              "figureData": "Leave empty or paste code/url here",
                              "options": ["Opt A", "Opt B", "Opt C", "Opt D"],
                              "correct": [0],
                              "correctInt": null
                             }
                          ]`}
                              spellCheck="false"
                              className="w-full flex-1 bg-transparent text-[#e6edf3] font-mono text-[13px] outline-none resize-none custom-scrollbar leading-relaxed"
                      />
                  </div>

                  <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0">
                      <button className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors active:scale-95" onClick={() => setPasteModal(false)}>Cancel</button>
                      <button className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2" onClick={() => {
                          if(!pasteText.trim()) {
                              setSysAlert({ title: 'Empty Input', msg: 'Please paste some JSON code first.', type: 'warning' });
                              return;
                          }
                          setPasteModal(false);
                          validateAndImportJSON(pasteText); // 🔥 Direct purane function me bhej diya
                      }}>
                          <i className="ti ti-bolt"></i> Process JSON
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Floating Toast */}
      {toastMsg && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-[0_10px_30px_rgb(0,0,0,0.3)] z-[999999] font-bold text-sm flex items-center gap-2 animate-[slideUp_0.3s_ease]">
              {toastMsg}
          </div>
      )}

      {/* 🔥 THE SMART JSON ERROR & EDITOR MODAL 🔥 */}
      {jsonModal && (
          <div className="modal-bg flex items-center justify-center p-4 sm:p-6" style={{ zIndex: 100000, backdropFilter: 'blur(8px)', background: 'rgba(15, 23, 42, 0.7)' }}>
              <div className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh] animate-[popIn_0.3s_ease]">
                  
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center text-xl shadow-inner border border-rose-200"><i className="ti ti-code-asterix"></i></div>
                          <div>
                              <h3 className="text-[18px] font-black text-slate-800 m-0 leading-none tracking-tight">JSON Validation Failed</h3>
                              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">Fix the errors below and retry</p>
                          </div>
                      </div>
                      <button className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-colors" onClick={() => setJsonModal(null)}>
                          <i className="ti ti-x text-lg"></i>
                      </button>
                  </div>

                  {/* Body: Errors + Code Editor */}
                  <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-100/50">
                      
                      {/* Left: Error List */}
                      <div className="lg:w-1/3 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-5 overflow-y-auto custom-scrollbar shrink-0">
                          <h4 className="text-[12px] font-extrabold text-rose-600 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="ti ti-bug"></i> Detected Errors ({jsonModal.errors.length})</h4>
                          <div className="flex flex-col gap-2">
                              {jsonModal.errors.map((err, i) => (
                                  <div key={i} className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[12px] font-semibold text-rose-700 leading-snug shadow-sm">
                                      {err}
                                  </div>
                              ))}
                          </div>
                          <div className="mt-5 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                              <h4 className="text-[11px] font-extrabold text-blue-700 uppercase tracking-widest mb-1">Quick Tip</h4>
                              <p className="text-[11px] font-medium text-blue-600/80 leading-relaxed">Find the exact question number in the editor on the right, correct the missing values (like adding [0] to correct arrays), and click Re-Validate.</p>
                          </div>
                      </div>

                      {/* Right: Code Editor */}
                      <div className="flex-1 p-4 sm:p-5 flex flex-col bg-[#0d1117]">
                           <div className="flex justify-between items-center mb-3">
                                <span className="text-[11px] font-bold font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-md">test_data.json</span>
                                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1"><i className="ti ti-edit"></i> Live Editable</span>
                           </div>
                           <textarea 
                              value={jsonModal.text}
                              onChange={(e) => setJsonModal({...jsonModal, text: e.target.value})}
                              spellCheck="false"
                              className="w-full flex-1 bg-transparent text-[#e6edf3] font-mono text-[13px] outline-none resize-none custom-scrollbar leading-relaxed"
                           />
                      </div>
                  </div>

                  {/* Footer */}
                  <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0">
                      <button className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors active:scale-95" onClick={() => setJsonModal(null)}>Cancel Import</button>
                      <button className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2" onClick={() => validateAndImportJSON(jsonModal.text)}>
                          <i className="ti ti-refresh"></i> Re-Validate & Import
                      </button>
                  </div>

              </div>
          </div>
      )}
    </div>
  );
}