// src/app/arena/page.js
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function PracticeArena() {
  const { currentUser, loading } = useAuth();

  const [activeTab, setActiveTab] = useState('general'); 
  
  // --- GENERAL TRIVIA (OpenTDB) STATES ---
  const [genQ, setGenQ] = useState(null);
  const [genOptions, setGenOptions] = useState([]);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState('');
  const [genSelected, setGenSelected] = useState(null); // The option text user clicked
  const [genStatus, setGenStatus] = useState(null); // 'correct' | 'wrong'

  // --- GEMINI AI STATES ---
  const [gemExam, setGemExam] = useState('JEE Mains');
  const [gemSubject, setGemSubject] = useState('Physics');
  const [gemChapter, setGemChapter] = useState('');
  const [gemQ, setGemQ] = useState(null);
  const [gemLoading, setGemLoading] = useState(false);
  const [gemError, setGemError] = useState('');
  const [gemSelected, setGemSelected] = useState(null); // Option index user clicked
  const [gemStatus, setGemStatus] = useState(null); // 'correct' | 'wrong'

  // MathJax Auto-Renderer
  useEffect(() => {
    if (typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetClear();
      window.MathJax.typesetPromise().catch((err) => console.log('MathJax Error:', err));
    }
  }, [genQ, gemQ, genStatus, gemStatus]);

  // Decode weird HTML chars from OpenTDB
  const decodeHTML = (html) => {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  // --- 1. GENERAL API LOGIC ---
  const fetchGeneralQ = async () => {
    setGenLoading(true); setGenError(''); setGenQ(null); setGenSelected(null); setGenStatus(null);
    try {
        let res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
        let data = await res.json();
        if (data.results && data.results.length > 0) {
            let q = data.results[0];
            let decodedQ = { ...q, question: decodeHTML(q.question), correct_answer: decodeHTML(q.correct_answer) };
            
            // Mix and shuffle options
            let opts = q.incorrect_answers.map(decodeHTML);
            opts.push(decodedQ.correct_answer);
            opts.sort(() => Math.random() - 0.5);
            
            setGenOptions(opts);
            setGenQ(decodedQ);
        } else throw new Error("No data");
    } catch (e) {
        setGenError('Network Error. Could not fetch question.');
    }
    setGenLoading(false);
  };

  const handleGenAns = (opt) => {
    if (genSelected !== null) return; // Prevent multiple clicks
    setGenSelected(opt);
    if (opt === genQ.correct_answer) setGenStatus('correct');
    else setGenStatus('wrong');
  };

  // --- 2. GEMINI API LOGIC ---
  const handleExamChange = (e) => {
      const ex = e.target.value;
      setGemExam(ex);
      if (ex === 'JEE Mains') setGemSubject('Physics');
      else if (ex === 'NEET') setGemSubject('Physics');
      else if (ex === 'College (CSE)') setGemSubject('Computer Science');
  };

  const fetchAIQuestion = async () => {
    if (!gemChapter.trim()) { alert('Please enter a chapter/topic name first!'); return; }
    
    setGemLoading(true); setGemError(''); setGemQ(null); setGemSelected(null); setGemStatus(null);
    try {
        const res = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ examTarget: gemExam, subject: gemSubject, chapter: gemChapter })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch AI question");
        
        setGemQ(data);
    } catch (err) {
        setGemError(err.message || 'Error generating AI question. Try again.');
    }
    setGemLoading(false);
  };

  const handleGemAns = (idx) => {
    if (gemSelected !== null) return; // Prevent multiple clicks
    setGemSelected(idx);
    if (idx === gemQ.correct_index) setGemStatus('correct');
    else setGemStatus('wrong');
  };

  if (loading) return <div className="spinner-container" style={{ paddingTop: '10vh' }}><div className="spinner"></div></div>;
  if (!currentUser) return <div style={{ textAlign: 'center', padding: '4rem' }}><i className="ti ti-lock" style={{ fontSize: '48px', color: '#64748b', marginBottom: '1rem' }}></i><h3>Please Login</h3><p>You need to log in to access the Practice Arena.</p></div>;

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
        
        <div className="page-header" style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ width: '80px', height: '80px', background: '#E6F1FB', color: '#185FA5', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '42px', margin: '0 auto 1rem', boxShadow: '0 10px 25px rgba(24,95,165,0.15)' }}>
                <i className="ti ti-swords"></i>
            </div>
            <h1 className="page-title" style={{ fontSize: '32px' }}>The Practice Arena</h1>
            <p className="page-sub" style={{ fontSize: '16px', maxWidth: '600px', margin: '0 auto' }}>Test your knowledge, improve your logical building, and prepare for exams using our vast general database or custom AI-generated mock tests.</p>
        </div>

        {/* ARENA TABS */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
            <button className="btn" style={{ padding: '14px 32px', fontSize: '16px', fontWeight: 700, borderRadius: '30px', background: activeTab === 'general' ? '#185FA5' : '#fff', color: activeTab === 'general' ? '#fff' : '#64748b', border: activeTab === 'general' ? 'none' : '2px solid #e2e8f0', boxShadow: activeTab === 'general' ? '0 10px 20px rgba(24,95,165,0.2)' : 'none' }} onClick={() => setActiveTab('general')}>
                <i className="ti ti-world"></i> Global Trivia
            </button>
            <button className="btn" style={{ padding: '14px 32px', fontSize: '16px', fontWeight: 700, borderRadius: '30px', background: activeTab === 'gemini' ? 'linear-gradient(135deg, #10B981, #059669)' : '#fff', color: activeTab === 'gemini' ? '#fff' : '#64748b', border: activeTab === 'gemini' ? 'none' : '2px solid #e2e8f0', boxShadow: activeTab === 'gemini' ? '0 10px 20px rgba(16,185,129,0.3)' : 'none' }} onClick={() => setActiveTab('gemini')}>
                <i className="ti ti-sparkles"></i> Gemini AI Mock
            </button>
        </div>

        {/* TAB 1: GENERAL TRIVIA MODE */}
        {activeTab === 'general' && (
            <div className="card" style={{ padding: '3rem 2rem', border: '1px solid #e2e8f0' }}>
                {!genQ && !genLoading && !genError && (
                    <div style={{ textAlign: 'center' }}>
                        <i className="ti ti-books" style={{ fontSize: '48px', color: '#185FA5', marginBottom: '1rem' }}></i>
                        <h2 style={{ fontSize: '24px', color: '#1e293b', marginBottom: '10px' }}>Global Random Trivia</h2>
                        <p style={{ color: '#64748b', marginBottom: '2.5rem' }}>Fetch a random challenging question from the global database.</p>
                        <button className="btn btn-primary" style={{ padding: '14px 32px', fontSize: '16px', fontWeight: 600, borderRadius: '30px' }} onClick={fetchGeneralQ}>
                            <i className="ti ti-player-play"></i> Fetch a Question
                        </button>
                    </div>
                )}

                {genLoading && <div className="spinner-container" style={{ padding: '3rem 0' }}><div className="spinner"></div><div style={{ marginTop: '10px' }}>Fetching global challenge...</div></div>}
                
                {genError && <div style={{ textAlign: 'center', color: '#A32D2D', background: '#FCEBEB', padding: '2rem', borderRadius: '12px' }}><i className="ti ti-wifi-off" style={{ fontSize: '40px', marginBottom: '10px' }}></i><br/>{genError}<br/><button className="btn btn-danger" style={{ marginTop: '1rem' }} onClick={fetchGeneralQ}>Try Again</button></div>}

                {genQ && !genLoading && (
                    <div style={{ maxWidth: '800px', margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                            <span className="badge b-gray" style={{ fontSize: '13px', padding: '6px 12px' }}><i className="ti ti-category"></i> {genQ.category}</span>
                            <span className="badge" style={{ background: genQ.difficulty === 'hard' ? '#FCEBEB' : genQ.difficulty === 'medium' ? '#FAEEDA' : '#EAF3DE', color: genQ.difficulty === 'hard' ? '#A32D2D' : genQ.difficulty === 'medium' ? '#854F0B' : '#3B6D11', textTransform: 'capitalize', padding: '6px 12px' }}>{genQ.difficulty}</span>
                        </div>
                        <h3 style={{ fontSize: '20px', lineHeight: 1.6, marginBottom: '2rem', color: 'var(--color-text-primary)' }}>{genQ.question}</h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {genOptions.map((opt, i) => {
                                let isSelected = genSelected === opt;
                                let isCorrect = opt === genQ.correct_answer;
                                let btnStyle = { padding: '16px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '16px', fontWeight: 500, borderRadius: '12px', border: '2px solid #e2e8f0', background: '#fff', cursor: genSelected ? 'default' : 'pointer', transition: '0.2s', width: '100%', color: '#1e293b' };
                                
                                if (genSelected !== null) {
                                    if (isCorrect) {
                                        btnStyle.background = '#EAF3DE'; btnStyle.borderColor = '#3B6D11'; btnStyle.color = '#27500A';
                                    } else if (isSelected && !isCorrect) {
                                        btnStyle.background = '#FCEBEB'; btnStyle.borderColor = '#A32D2D'; btnStyle.color = '#791F1F';
                                    } else {
                                        btnStyle.opacity = 0.6;
                                    }
                                }

                                return (
                                    <button key={i} style={btnStyle} onClick={() => handleGenAns(opt)} disabled={genSelected !== null}>
                                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', border: '2px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 }}>{String.fromCharCode(65 + i)}</div>
                                        <div style={{ flex: 1 }}>{opt}</div>
                                        {genSelected !== null && isCorrect && <i className="ti ti-check" style={{ fontSize: '24px', color: '#3B6D11' }}></i>}
                                        {genSelected !== null && isSelected && !isCorrect && <i className="ti ti-x" style={{ fontSize: '24px', color: '#A32D2D' }}></i>}
                                    </button>
                                );
                            })}
                        </div>
                        
                        {genSelected !== null && (
                            <button className="btn btn-primary" style={{ width: '100%', padding: '16px', margin: '2rem auto 0', justifyContent: 'center', fontSize: '16px', fontWeight: 600 }} onClick={fetchGeneralQ}>
                                Fetch Next Question <i className="ti ti-arrow-right"></i>
                            </button>
                        )}
                    </div>
                )}
            </div>
        )}

        {/* TAB 2: GEMINI AI MODE */}
        {activeTab === 'gemini' && (
            <div className="card" style={{ padding: '3rem 2rem', border: '1px solid #10B981', background: 'linear-gradient(to bottom, #f0fdf4, #ffffff)' }}>
                {!gemQ && !gemLoading && (
                    <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
                        <div style={{ display: 'inline-block', background: '#d1fae5', color: '#065f46', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
                            Powered by Google Gemini
                        </div>
                        <h2 style={{ fontSize: '28px', color: '#064e3b', marginBottom: '15px' }}>Custom AI Generator</h2>
                        <p style={{ color: '#047857', marginBottom: '2.5rem', lineHeight: 1.6 }}>Type any engineering topic, algorithm, or concept. Our AI will instantly curate a challenging question with a step-by-step solution.</p>
                        
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
                            <select value={gemExam} onChange={handleExamChange} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid #cbd5e1', outline: 'none' }}>
                                <option value="JEE Mains">JEE Mains</option>
                                <option value="NEET">NEET</option>
                                <option value="College (CSE)">College (CSE)</option>
                            </select>
                            <select value={gemSubject} onChange={(e) => setGemSubject(e.target.value)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid #cbd5e1', outline: 'none' }}>
                                {gemExam === 'College (CSE)' ? <option value="Computer Science">Computer Science</option> : (
                                    <>
                                        <option value="Physics">Physics</option>
                                        <option value="Chemistry">Chemistry</option>
                                        {gemExam === 'JEE Mains' ? <option value="Mathematics">Mathematics</option> : <option value="Biology">Biology</option>}
                                    </>
                                )}
                            </select>
                        </div>

                        <div style={{ position: 'relative', marginBottom: '2rem' }}>
                            <i className="ti ti-search" style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', fontSize: '24px', color: '#10B981' }}></i>
                            <input 
                                type="text" 
                                placeholder={gemExam === 'College (CSE)' ? "e.g. Operating Systems, OOPs..." : "e.g. Kinematics, Thermodynamics..."} 
                                value={gemChapter}
                                onChange={(e) => setGemChapter(e.target.value)}
                                style={{ width: '100%', padding: '20px 20px 20px 60px', fontSize: '18px', borderRadius: '16px', border: '2px solid #34d399', boxShadow: '0 10px 25px rgba(16,185,129,0.1)', background: '#fff', color: '#064e3b', fontWeight: 500 }}
                            />
                        </div>
                        
                        <button className="btn btn-primary" onClick={fetchAIQuestion} style={{ width: '100%', padding: '18px', fontSize: '18px', fontWeight: 700, borderRadius: '12px', background: '#10B981', border: 'none', justifyContent: 'center', boxShadow: '0 4px 15px rgba(16,185,129,0.4)' }}>
                            <i className="ti ti-bolt"></i> Generate Practice Test
                        </button>
                    </div>
                )}

                {gemLoading && (
                    <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                        <div className="spinner" style={{ borderColor: '#10B981', borderTopColor: 'transparent', margin: '0 auto', width: '60px', height: '60px', borderWidth: '4px' }}></div>
                        <h3 style={{ color: '#064e3b', marginTop: '1.5rem' }}>AI is crafting a unique question...</h3>
                        <p style={{ color: '#047857' }}>This might take a few seconds.</p>
                    </div>
                )}

                {gemError && (
                    <div style={{ textAlign: 'center', padding: '3rem 2rem', background: '#FCEBEB', borderRadius: '16px', border: '2px solid #F7C1C1', maxWidth: '600px', margin: '0 auto' }}>
                        <i className="ti ti-robot-off" style={{ fontSize: '48px', color: '#A32D2D', marginBottom: '1rem' }}></i>
                        <h3 style={{ color: '#A32D2D', margin: '0 0 10px 0' }}>Generation Failed</h3>
                        <p style={{ color: '#791F1F', marginBottom: '1.5rem' }}>{gemError}</p>
                        <button className="btn btn-danger" onClick={() => setGemError('')}>Go Back</button>
                    </div>
                )}

                {gemQ && !gemLoading && (
                    <div style={{ maxWidth: '800px', margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <span className="badge b-purple" style={{ padding: '6px 12px' }}><i className="ti ti-wand"></i> AI Generated</span>
                            <span className="badge b-blue" style={{ padding: '6px 12px' }}>{gemExam} &bull; {gemSubject} &bull; {gemChapter}</span>
                        </div>
                        
                        <h3 style={{ fontSize: '20px', lineHeight: 1.6, marginBottom: '2rem', color: '#064e3b' }}>{gemQ.question}</h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {gemQ.options.map((opt, i) => {
                                let isSelected = gemSelected === i;
                                let isCorrect = i === gemQ.correct_index;
                                let btnStyle = { padding: '16px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '16px', fontWeight: 500, borderRadius: '12px', border: '2px solid #e2e8f0', background: '#fff', cursor: gemSelected !== null ? 'default' : 'pointer', transition: '0.2s', width: '100%', color: '#1e293b' };
                                
                                if (gemSelected !== null) {
                                    if (isCorrect) {
                                        btnStyle.background = '#EAF3DE'; btnStyle.borderColor = '#3B6D11'; btnStyle.color = '#27500A';
                                    } else if (isSelected && !isCorrect) {
                                        btnStyle.background = '#FCEBEB'; btnStyle.borderColor = '#A32D2D'; btnStyle.color = '#791F1F';
                                    } else {
                                        btnStyle.opacity = 0.5;
                                    }
                                }

                                return (
                                    <button key={i} style={btnStyle} onClick={() => handleGemAns(i)} disabled={gemSelected !== null}>
                                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', border: '2px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 }}>{String.fromCharCode(65 + i)}</div>
                                        <div style={{ flex: 1 }}>{opt}</div>
                                        {gemSelected !== null && isCorrect && <i className="ti ti-check" style={{ fontSize: '24px', color: '#3B6D11' }}></i>}
                                        {gemSelected !== null && isSelected && !isCorrect && <i className="ti ti-x" style={{ fontSize: '24px', color: '#A32D2D' }}></i>}
                                    </button>
                                );
                            })}
                        </div>

                        {gemSelected !== null && (
                            <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#EEEDFE', borderLeft: '5px solid #534AB7', borderRadius: '12px', animation: 'fadeIn 0.4s ease' }}>
                                <h4 style={{ color: '#3C3489', margin: '0 0 10px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="ti ti-bulb"></i> AI Solution Explanation
                                </h4>
                                <p style={{ color: '#1e293b', fontSize: '15px', lineHeight: 1.7, margin: 0 }}>{gemQ.solution}</p>
                            </div>
                        )}
                        
                        {gemSelected !== null && (
                            <button className="btn btn-primary" style={{ width: '100%', padding: '16px', margin: '2rem auto 0', justifyContent: 'center', fontSize: '16px', fontWeight: 600, background: '#10B981', border: 'none' }} onClick={() => { setGemQ(null); setGemSelected(null); setGemStatus(null); }}>
                                Generate Another AI Question <i className="ti ti-refresh"></i>
                            </button>
                        )}
                    </div>
                )}
            </div>
        )}

    </div>
  );
}