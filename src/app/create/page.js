// src/app/create/page.js
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { database } from '../../lib/firebase';
import { ref, set, get } from 'firebase/database';

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
  
  // Premium Draft State (For Custom Modal)
  const [pendingDraft, setPendingDraft] = useState(null); 
  const [successModal, setSuccessModal] = useState(null); // Custom popup state

  // Questions State
  const [qList, setQList] = useState([]);
  
  // 🔥 DRAFT CHECK ON MOUNT
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

  // 🔥 MATHJAX AUTO-RENDERER
  useEffect(() => {
    if (typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetClear();
      window.MathJax.typesetPromise().catch((err) => console.log('MathJax Error:', err));
    }
  }, [qList]);

  // 🔥 AUTO-SAVE DRAFT (Every 5 Secs)
  useEffect(() => {
    const interval = setInterval(() => {
      if (title.trim() === '' && qList.length === 0) return;
      
      const userIdent = currentUser ? currentUser.uid : (isOffline ? 'offline_user' : 'guest');
      const draft = {
        title, subject, sections, duration, totalMarks, negMarking, expiryDate, access, resultVis, scoreVis,
        toggles: { 
            change: allowChange, 
            palette: showPalette, 
            nav: allowNav, 
            rand: randomOrder, 
            shuffle: shuffleOpts, 
            anticheat: antiCheat, 
            fullscreen: fullScreenMode 
        },
        qList
      };
      localStorage.setItem('exam_draft_creator_' + userIdent, JSON.stringify(draft));
    }, 5000);
    return () => clearInterval(interval);
  }, [title, subject, sections, duration, totalMarks, negMarking, expiryDate, access, resultVis, scoreVis, allowChange, showPalette, allowNav, randomOrder, shuffleOpts, antiCheat, fullScreenMode, qList, currentUser, isOffline]);

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
    setPendingDraft(null); 
  };

  const handleDiscardDraft = () => {
    const userIdent = currentUser ? currentUser.uid : (isOffline ? 'offline_user' : 'guest');
    localStorage.removeItem('exam_draft_creator_' + userIdent);
    addDefaultQuestion();
    setPendingDraft(null); 
  };

  const addDefaultQuestion = () => {
    setQList([{ id: Date.now(), type: 'mcq', text: 'New Question', marks: 4, options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'], correct: [0], correctInt: null, explanation: '', section: '' }]);
  };

  // --- Question Manipulation Functions ---
  const addQ = (insertAfterIdx = null, type = 'mcq') => {
    const newQ = { id: Date.now() + Math.random(), type, text: '', marks: 4, options: ['', '', '', ''], correct: [], correctInt: null, explanation: '', section: '' };
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

  // --- JSON Import/Export ---
  const downloadTemplate = () => {
    const t = JSON.stringify([{ section: 'Physics', type: 'mcq', text: 'Sample Question?', imgUrl: '', marks: 4, options: ['A', 'B', 'C', 'D'], correct: [0], explanation: 'Logic here' }], null, 2);
    const blob = new Blob([t], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'examitop_template.json';
    a.click();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (!Array.isArray(data)) { alert('Must be a JSON array.'); return; }
        
        let importedSections = new Set(sections.split(',').map(s => s.trim()).filter(s => s));

        const mappedData = data.map(d => {
          if(d.section) importedSections.add(d.section);
          return {
            id: Date.now() + Math.random(),
            type: d.type || 'mcq',
            text: d.text || '',
            imgUrl: d.imgUrl || '',
            marks: d.marks || 4,
            options: d.options || ['', '', '', ''],
            correct: d.correct || [],
            correctInt: d.correctInt || null,
            modelAnswer: d.modelAnswer || '',
            explanation: d.explanation || '',
            section: d.section || ''
          };
        });
        
        setSections(Array.from(importedSections).join(', '));
        setQList([...qList, ...mappedData]);
        alert(`Import Successful! ${data.length} questions mapped.`);
      } catch (ex) { alert('Invalid JSON file format.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Final Save Logic ---
  const saveTest = async () => {
    if (!isOffline && !currentUser) {
      alert("Login Required! You need to log in to save this test to the cloud.");
      return;
    }
    if (!title.trim()) { alert('Please enter a test title.'); return; }
    if (!qList.length) { alert('Add at least one question.'); return; }

    // 🔥 Strict Evaluation Key Validation
    for (let i = 0; i < qList.length; i++) {
        const q = qList[i];
        if (q.type === 'mcq' || q.type === 'msq') {
            if (!q.correct || q.correct.length === 0) {
                alert(`⚠️ Action Required: Please mark the correct option for Question ${i + 1} before saving.`);
                return; 
            }
        }
        if (q.type === 'integer') {
            if (q.correctInt === null || q.correctInt === undefined || q.correctInt === '') {
                alert(`⚠️ Action Required: Please enter the correct integer answer for Question ${i + 1} before saving.`);
                return; 
            }
        }
    }

    const calculatedSum = qList.reduce((sum, q) => sum + Number(q.marks), 0);
    let finalMarks = totalMarks;
    if (calculatedSum !== totalMarks) {
      if (confirm(`⚠️ MARKS MISMATCH!\nYou entered Total Marks: ${totalMarks}\nBut questions sum to: ${calculatedSum}\nUpdate Total Marks to ${calculatedSum} automatically?`)) {
        setTotalMarks(calculatedSum);
        finalMarks = calculatedSum;
      } else {
        return;
      }
    }

    const testCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const parsedSections = sections.split(',').map(s => s.trim()).filter(s => s);

    const newTest = {
      id: Date.now(),
      code: testCode,
      title, subject, duration,
      sections: parsedSections,
      totalMarks: finalMarks,
      negMarking, expiryDate, 
      access, resultVis, scoreVis,
      allowChange, showPalette, allowNav, randomOrder, shuffleOpts, antiCheat, fullScreenMode,
      creatorUid: isOffline ? 'offline_creator' : currentUser.uid,
      questions: qList,
      submissions: [],
      released: false,
      isActive: true,
      createdAt: new Date().toLocaleDateString('en-IN'),
      isLocal: isOffline
    };

    try {
      if (isOffline) {
        let localTests = JSON.parse(localStorage.getItem('examitop_offline_tests') || '[]');
        localTests.push(newTest);
        localStorage.setItem('examitop_offline_tests', JSON.stringify(localTests));
      } else {
        const snapshot = await get(ref(database, 'tests'));
        let currentTests = snapshot.val() || [];
        if (!Array.isArray(currentTests)) currentTests = Object.values(currentTests).filter(item => item !== null);
        currentTests.push(newTest);
        await set(ref(database, 'tests'), currentTests);
      }

      const userIdent = currentUser ? currentUser.uid : (isOffline ? 'offline_user' : 'guest');
      localStorage.removeItem('exam_draft_creator_' + userIdent);

      setSuccessModal({ code: newCode, mode: isOffline ? 'Local Device' : 'Cloud (Firebase)' });  
      router.push('/tests');

    } catch (error) {
      console.error(error);
      alert("Error saving test: " + error.message);
    }
  };

  if (authLoading) return <div className="spinner-container" style={{ paddingTop: '10vh' }}><div className="spinner"></div></div>;
  if (!isOffline && userRole !== 'examiner' && userRole !== 'admin') {
    return <div style={{ textAlign: 'center', padding: '4rem' }}><h3>Access Denied</h3><p>Only Examiners can create tests.</p></div>;
  }

  const parsedSectionsArray = sections.split(',').map(s => s.trim()).filter(s => s);

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}><i className="ti ti-pencil"></i> Test Creator Engine</h2>
          <div style={{ marginTop: '8px' }}>
              <button type="button" onClick={toggleOfflineMode} className="btn btn-sm" style={{ background: isOffline ? '#FEF5E5' : '#EAF3DE', color: isOffline ? '#854F0B' : '#27500A', border: `1px solid ${isOffline ? '#FAC775' : '#C0DD97'}`, fontWeight: 600, borderRadius: '20px', padding: '6px 14px' }}>
                  <i className={`ti ${isOffline ? 'ti-wifi-off' : 'ti-cloud'}`}></i> 
                  {isOffline ? 'Device-Only Mode (Offline)' : 'Cloud Sync (Online)'}
              </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-ghost" onClick={downloadTemplate} style={{ color: '#185FA5', fontWeight: 600 }}><i className="ti ti-download"></i> JSON Template</button>
            <label className="btn btn-ghost" style={{ color: '#3B6D11', fontWeight: 600, margin: 0, cursor: 'pointer' }}>
                <i className="ti ti-upload"></i> Import JSON
                <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
            <button className="btn btn-primary" onClick={saveTest}><i className="ti ti-device-floppy"></i> Save & Publish</button>
        </div>
      </div>

      <div className="grid2" style={{ marginBottom: '2rem' }}>
        {/* Basic Settings Card */}
        <div className="card">
          <h3 className="card-title"><i className="ti ti-settings"></i> Basic Settings</h3>
          <label>Test Title <span style={{ color: '#A32D2D' }}>*</span></label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Mid-Term Physics" style={{ marginBottom: '1rem' }} />
          
          <div className="grid2" style={{ marginBottom: '1rem' }}>
            <div><label>Subject</label><input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Science" /></div>
            <div><label>Sections (Comma separated)</label><input type="text" value={sections} onChange={e => setSections(e.target.value)} placeholder="e.g. Section A, Section B" /></div>
          </div>
          
          <div className="grid2" style={{ marginBottom: '1rem' }}>
            <div><label>Duration (Mins)</label><input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} /></div>
            <div><label>Total Marks</label><input type="number" value={totalMarks} onChange={e => setTotalMarks(Number(e.target.value))} /></div>
          </div>
          
          <div className="grid2" style={{ marginBottom: '1rem' }}>
            <div><label>Negative Marking</label><input type="number" step="0.25" value={negMarking} onChange={e => setNegMarking(Number(e.target.value))} /></div>
            <div><label>Expiry Date & Time</label><input type="datetime-local" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
          </div>

          <div>
            <label>Test Access / Visibility</label>
            <select value={access} onChange={e => setAccess(e.target.value)}>
              <option value="code">Private (Requires Test Code)</option>
              <option value="public">Public (Visible on Home Board)</option>
            </select>
          </div>
        </div>

        {/* Security & Features Card */}
        <div className="card">
          <h3 className="card-title"><i className="ti ti-shield-lock"></i> Security & Experience</h3>
          
          <div className="grid2" style={{ marginBottom: '1rem' }}>
            <div>
                <label>Result Visibility</label>
                <select value={resultVis} onChange={e => setResultVis(e.target.value)}>
                <option value="instant">Instant (Auto-grade & show)</option>
                <option value="manual">Manual (Examiner releases later)</option>
                </select>
            </div>
            <div>
                <label>Score Breakdown</label>
                <select value={scoreVis} onChange={e => setScoreVis(e.target.value)}>
                <option value="show">Detailed (Show exact errors)</option>
                <option value="hide">Basic (Only total score)</option>
                </select>
            </div>
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '10px' }}>
              <div className="toggle-wrap">
                <div><div style={{ fontWeight: 600 }}>Allow Answer Changes</div><div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Students can edit marked answers</div></div>
                <label className="toggle"><input type="checkbox" checked={allowChange} onChange={e => setAllowChange(e.target.checked)} /><span className="tog-slider"></span></label>
              </div>
              <div className="toggle-wrap">
                <div><div style={{ fontWeight: 600 }}>Show Question Palette</div><div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Display navigation map during exam</div></div>
                <label className="toggle"><input type="checkbox" checked={showPalette} onChange={e => setShowPalette(e.target.checked)} /><span className="tog-slider"></span></label>
              </div>
              <div className="toggle-wrap">
                <div><div style={{ fontWeight: 600 }}>Free Navigation</div><div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Allow jumping between questions</div></div>
                <label className="toggle"><input type="checkbox" checked={allowNav} onChange={e => setAllowNav(e.target.checked)} /><span className="tog-slider"></span></label>
              </div>
              <div className="toggle-wrap">
                <div><div style={{ fontWeight: 600 }}>Shuffle Questions</div><div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Randomize order for each student</div></div>
                <label className="toggle"><input type="checkbox" checked={randomOrder} onChange={e => setRandomOrder(e.target.checked)} /><span className="tog-slider"></span></label>
              </div>
              <div className="toggle-wrap">
                <div><div style={{ fontWeight: 600 }}>Shuffle Options (MCQ/MSQ)</div><div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Randomize A/B/C/D order</div></div>
                <label className="toggle"><input type="checkbox" checked={shuffleOpts} onChange={e => setShuffleOpts(e.target.checked)} /><span className="tog-slider"></span></label>
              </div>
              <div className="toggle-wrap">
                <div><div style={{ fontWeight: 600, color: '#A32D2D' }}>Anti-Cheat Engine</div><div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Block tab switching and copy-paste</div></div>
                <label className="toggle"><input type="checkbox" checked={antiCheat} onChange={e => setAntiCheat(e.target.checked)} /><span className="tog-slider"></span></label>
              </div>
              <div className="toggle-wrap">
                <div><div style={{ fontWeight: 600, color: '#A32D2D' }}>Enforce Full-Screen</div><div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Warn if full-screen is exited</div></div>
                <label className="toggle"><input type="checkbox" checked={fullScreenMode} onChange={e => setFullScreenMode(e.target.checked)} /><span className="tog-slider"></span></label>
              </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600 }}><i className="ti ti-list-numbers"></i> Questions List</h3>
        <span className="badge b-gray" style={{ fontSize: '14px' }}>{qList.length} Added</span>
      </div>

      <div id="q-container">
        {qList.map((q, i) => (
          <div key={q.id} className="q-block">
            <div className="q-block-header">
              <div className="q-num-badge">{i + 1}</div>
              <select value={q.type} onChange={e => updateQ(i, 'type', e.target.value)} style={{ width: 'auto', padding: '4px 8px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: '1px solid #185FA5', color: '#185FA5' }}>
                <option value="mcq">Single Correct (MCQ)</option>
                <option value="msq">Multi Correct (MSQ)</option>
                <option value="integer">Integer Type</option>
                <option value="subjective">Subjective</option>
              </select>

              {parsedSectionsArray.length > 0 && (
                  <select value={q.section || ''} onChange={e => updateQ(i, 'section', e.target.value)} style={{ marginLeft: '10px', padding: '4px 8px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', border: '1px solid #185FA5', color: '#185FA5' }}>
                      <option value="">-- Assign Section --</option>
                      {parsedSectionsArray.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
              )}
              
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Marks</span>
                <input type="number" value={q.marks} onChange={e => updateQ(i, 'marks', Number(e.target.value))} style={{ width: '70px', textAlign: 'center', padding: '4px' }} />
                <button className="btn btn-sm btn-danger" onClick={() => rmQ(i)}><i className="ti ti-trash"></i></button>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label>Question Text</label>
              <textarea value={q.text} onChange={e => updateQ(i, 'text', e.target.value)} placeholder="Type your question here..." />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label><i className="ti ti-photo"></i> Question Image URL (Optional)</label>
              <input type="text" value={q.imgUrl || ''} onChange={e => updateQ(i, 'imgUrl', e.target.value)} placeholder="Paste image link here" />
              {q.imgUrl && <img src={q.imgUrl} alt="Preview" style={{ maxHeight: '160px', marginTop: '12px', borderRadius: '8px', border: '1px solid var(--color-border-secondary)' }} />}
            </div>

            {q.type === 'mcq' && (
              <div style={{ marginBottom: '1rem' }}>
                <label>Options &mdash; Select the correct one</label>
                {q.options.map((opt, j) => (
                  <div key={j} className="opt-row">
                    <input type="radio" name={`cr_${q.id}`} checked={q.correct.includes(j)} onChange={() => setCorrectMCQ(i, j)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                    <input type="text" value={opt} onChange={e => updateOption(i, j, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + j)}`} />
                  </div>
                ))}
                <button className="btn btn-sm btn-ghost" onClick={() => addOpt(i)}><i className="ti ti-plus"></i> Add Option</button>
              </div>
            )}

            {q.type === 'msq' && (
              <div style={{ marginBottom: '1rem' }}>
                <label>Options &mdash; Check all correct ones</label>
                {q.options.map((opt, j) => (
                  <div key={j} className="opt-row">
                    <input type="checkbox" checked={q.correct.includes(j)} onChange={e => toggleCorrectMSQ(i, j, e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                    <input type="text" value={opt} onChange={e => updateOption(i, j, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + j)}`} />
                  </div>
                ))}
                <button className="btn btn-sm btn-ghost" onClick={() => addOpt(i)}><i className="ti ti-plus"></i> Add Option</button>
              </div>
            )}

            {q.type === 'integer' && (
              <div style={{ marginBottom: '1rem' }}>
                <label>Correct Integer Answer</label>
                <input type="number" value={q.correctInt !== null ? q.correctInt : ''} onChange={e => updateQ(i, 'correctInt', e.target.value === '' ? null : Number(e.target.value))} style={{ maxWidth: '200px' }} placeholder="e.g. 42" />
              </div>
            )}

            {q.type === 'subjective' && (
              <div style={{ marginBottom: '1rem' }}>
                <label>Model Answer (Examiner Reference)</label>
                <textarea value={q.modelAnswer || ''} onChange={e => updateQ(i, 'modelAnswer', e.target.value)} placeholder="Write model answer to guide evaluation..." />
              </div>
            )}

            <div style={{ marginTop: '1rem' }}>
              <label>Explanation / Solution</label>
              <input type="text" value={q.explanation || ''} onChange={e => updateQ(i, 'explanation', e.target.value)} placeholder="Formula or logic..." />
            </div>

            <button className="btn btn-sm btn-ghost" style={{ width: '100%', marginTop: '1.5rem', border: '1px dashed #cbd5e1', color: '#185FA5', justifyContent: 'center' }} onClick={() => addQ(i)}>
              <i className="ti ti-row-insert-bottom"></i> Add New Question Below
            </button>
          </div>
        ))}
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <button className="btn" style={{ padding: '12px 24px', fontWeight: 600, border: '2px dashed var(--color-border-primary)' }} onClick={() => addQ()}>
          <i className="ti ti-plus"></i> Append Question at End
        </button>
      </div>

      {/* 🔥 Premium Custom Draft Recovery Modal */}
      {pendingDraft && (
          <div className="modal-bg" style={{ zIndex: 9999 }}>
              <div className="modal-box" style={{ maxWidth: '420px', textAlign: 'center', padding: '2rem' }}>
                  <div style={{ width: '64px', height: '64px', background: '#E6F1FB', color: '#185FA5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 1rem' }}>
                      <i className="ti ti-file-symlink"></i>
                  </div>
                  <h3 style={{ fontSize: '22px', marginBottom: '10px', color: '#1e293b' }}>Unsaved Draft Found!</h3>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
                      We found an incomplete test draft with <strong style={{ color: '#185FA5' }}>{pendingDraft.qList ? pendingDraft.qList.length : 0} questions</strong>. Do you want to restore it and continue working?
                  </p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                      <button className="btn" style={{ flex: 1, padding: '12px', justifyContent: 'center', fontWeight: 600, color: '#A32D2D', background: '#FCEBEB', border: 'none' }} onClick={handleDiscardDraft}>Discard Draft</button>
                      <button className="btn btn-primary" style={{ flex: 1, padding: '12px', justifyContent: 'center', fontWeight: 600 }} onClick={handleRestoreDraft}>Yes, Restore</button>
                  </div>
              </div>
          </div>
      )}
      {/* SUCCESS MODAL POPUP */}
      {successModal && (
          <div className="modal-bg" style={{ zIndex: 99999 }}>
              <div className="modal-box" style={{ maxWidth: '400px', textAlign: 'center', padding: '2.5rem 2rem' }}>
                  <div style={{ width: '64px', height: '64px', background: '#EAF3DE', color: '#3B6D11', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 1.5rem' }}>
                      <i className="ti ti-check"></i>
                  </div>
                  <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '10px', color: '#0f172a' }}>Test Saved Successfully!</h2>
                  <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '1.5rem' }}>Your test is ready. Share the code below with your students.</p>
                  
                  <div style={{ background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '15px', marginBottom: '1.5rem', position: 'relative' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>TEST CODE</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: '#185FA5', letterSpacing: '2px', fontFamily: 'monospace' }}>{successModal.code}</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: successModal.mode.includes('Local') ? '#d97706' : '#10B981', marginTop: '5px' }}>
                          <i className={`ti ${successModal.mode.includes('Local') ? 'ti-device-floppy' : 'ti-cloud-check'}`}></i> Saved to {successModal.mode}
                      </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button 
                          className="btn btn-primary" 
                          style={{ width: '100%', padding: '14px', justifyContent: 'center', fontSize: '15px' }}
                          onClick={() => {
                              navigator.clipboard.writeText(successModal.code);
                              alert("Code Copied to Clipboard!");
                          }}
                      >
                          <i className="ti ti-copy"></i> Copy Code
                      </button>
                      <button 
                          className="btn" 
                          style={{ width: '100%', padding: '14px', justifyContent: 'center', background: '#f1f5f9', color: '#475569', border: 'none', fontWeight: 600, fontSize: '15px' }}
                          onClick={() => {
                              setSuccessModal(null);
                              router.push('/tests'); // Direct Vault me jane ka button
                          }}
                      >
                          <i className="ti ti-list-check"></i> Go to My Vault
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}