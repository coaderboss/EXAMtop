// src/app/practice/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PracticeArena() {
  const router = useRouter();

  // Mode States
  const [mode, setMode] = useState('general'); // 'general' or 'exam'
  const [exam, setExam] = useState('JEE Mains');
  const [subject, setSubject] = useState('Physics');
  const [chapter, setChapter] = useState('');
  
  // Question States
  const [loading, setLoading] = useState(false);
  const [qData, setQData] = useState(null);
  const [selectedOpt, setSelectedOpt] = useState(null);
  const [error, setError] = useState(null);

  // MathJax Re-render
  useEffect(() => {
    if (typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetClear();
      window.MathJax.typesetPromise().catch((err) => console.log('MathJax Error:', err));
    }
  }, [qData, selectedOpt]);

  // Update Subjects based on Exam choice
  const handleExamChange = (e) => {
    const val = e.target.value;
    setExam(val);
    if (val === 'JEE Mains') setSubject('Physics');
    else if (val === 'NEET') setSubject('Physics');
    else if (val === 'College (CSE)') setSubject('Computer Science');
  };

  const decodeHTML = (html) => {
    if (typeof document === 'undefined') return html;
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  const fetchQuestion = async () => {
    setLoading(true);
    setError(null);
    setQData(null);
    setSelectedOpt(null);

    try {
        if (mode === 'general') {
            const res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                let q = data.results[0];
                let opts = [...q.incorrect_answers, q.correct_answer];
                opts.sort(() => Math.random() - 0.5); // Shuffle
                setQData({
                    source: 'opentdb',
                    category: q.category,
                    difficulty: q.difficulty,
                    question: decodeHTML(q.question),
                    options: opts.map(decodeHTML),
                    correct_index: opts.indexOf(q.correct_answer),
                    solution: `The correct answer is ${decodeHTML(q.correct_answer)}.`
                });
            } else throw new Error("No data");
        } else {
            if (!chapter.trim()) {
                setError("Please enter a chapter name first!");
                setLoading(false);
                return;
            }
            
            // Hit our secure Next.js backend which talks to Gemini
            const res = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examTarget: exam, subject, chapter })
            });

            if (!res.ok) throw new Error("API_REJECTED");
            const data = await res.json();
            
            if (data.error) throw new Error("API_REJECTED");
            
            setQData({
                source: 'gemini',
                question: data.question,
                options: data.options,
                correct_index: data.correct_index,
                solution: data.solution
            });
        }
    } catch (err) {
        setError("Failed to fetch question. Please check your internet or API connection.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '900px', margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease' }}>
        
        <button className="btn btn-ghost" style={{ marginBottom: '1.25rem', padding: 0, fontSize: '15px', color: '#475569', fontWeight: 600 }} onClick={() => router.push('/')}>
            <i className="ti ti-arrow-left"></i> Back to Home
        </button>

        <div className="page-header" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '32px', color: '#185FA5' }}>
                <i className="ti ti-flame" style={{ color: '#e63946' }}></i> Practice Arena
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px', fontSize: '15px' }}>
                Endless questions to sharpen your brain. Stateless engine, zero data saved!
            </p>
        </div>

        {/* Control Panel */}
        <div className="card" style={{ boxShadow: '0 10px 30px rgba(24, 95, 165, 0.08)', borderRadius: '16px', padding: '25px', borderTop: '4px solid #185FA5', marginBottom: '2rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '8px', display: 'block' }}>Select Arena Mode</label>
                <select className="input-block" style={{ padding: '14px', fontSize: '16px', borderRadius: '10px', cursor: 'pointer', width: '100%' }} value={mode} onChange={(e) => { setMode(e.target.value); setQData(null); }}>
                    <option value="general">🌍 General Knowledge & Trivia (Global)</option>
                    <option value="exam">🎓 Competitive Exams & College (AI Powered)</option>
                </select>
            </div>

            {mode === 'exam' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--color-border-secondary)' }}>
                    <div className="grid2">
                        <div>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block' }}>Target Exam</label>
                            <select className="input-block" style={{ padding: '12px', borderRadius: '8px', width: '100%' }} value={exam} onChange={handleExamChange}>
                                <option value="JEE Mains">JEE Mains</option>
                                <option value="NEET">NEET</option>
                                <option value="College (CSE)">College (B.Tech CSE)</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block' }}>Subject</label>
                            <select className="input-block" style={{ padding: '12px', borderRadius: '8px', width: '100%' }} value={subject} onChange={e => setSubject(e.target.value)}>
                                {exam === 'JEE Mains' && <><option>Physics</option><option>Chemistry</option><option>Mathematics</option></>}
                                {exam === 'NEET' && <><option>Physics</option><option>Chemistry</option><option>Biology</option></>}
                                {exam === 'College (CSE)' && <option>Computer Science</option>}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'block' }}>Specific Topic / Chapter (Required)</label>
                        <input type="text" className="input-block" style={{ padding: '12px', borderRadius: '8px', width: '100%', borderColor: error && !chapter ? '#e63946' : 'var(--color-border-primary)' }} placeholder="e.g., Kinematics or Operating Systems" value={chapter} onChange={e => setChapter(e.target.value)} />
                    </div>
                </div>
            )}

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '16px', fontWeight: 600, borderRadius: '10px' }} onClick={fetchQuestion} disabled={loading}>
                {loading ? <><span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', margin: 0 }}></span> Generating...</> : <><i className={`ti ${mode === 'exam' ? 'ti-wand' : 'ti-player-play'}`}></i> {mode === 'exam' ? 'Generate AI Question' : 'Start Random Trivia'}</>}
            </button>
        </div>

        {/* Display Area */}
        {error && (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', borderRadius: '16px', borderTop: '4px solid #A32D2D', background: '#FCEBEB' }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: '40px', color: '#A32D2D', marginBottom: '10px', display: 'block' }}></i>
                <div style={{ color: '#791F1F', fontWeight: 500 }}>{error}</div>
            </div>
        )}

        {qData && (
            <div className="card" style={{ padding: '2rem', borderTop: `4px solid ${qData.source === 'gemini' ? '#534AB7' : '#3B6D11'}`, borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    {qData.source === 'gemini' ? (
                        <><span className="badge b-purple"><i className="ti ti-wand"></i> AI Generated</span><span className="badge b-blue">{exam} &bull; {subject}</span></>
                    ) : (
                        <><span className="badge b-gray"><i className="ti ti-category"></i> {qData.category}</span><span className="badge" style={{ background: '#FAEEDA', color: '#854F0B', textTransform: 'capitalize' }}>{qData.difficulty}</span></>
                    )}
                </div>
                
                <h3 style={{ fontSize: '18px', lineHeight: 1.6, marginBottom: '2rem', color: 'var(--color-text-primary)' }}>{qData.question}</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {qData.options.map((opt, idx) => {
                        let isCorrect = qData.correct_index === idx;
                        let isSelected = selectedOpt === idx;
                        let btnStyle = { padding: '14px 16px', width: '100%', justifyContent: 'flex-start', opacity: selectedOpt !== null && !isSelected && !isCorrect ? 0.6 : 1 };
                        
                        if (selectedOpt !== null) {
                            if (isCorrect) {
                                btnStyle.background = '#EAF3DE'; btnStyle.borderColor = '#3B6D11'; btnStyle.color = '#27500A';
                            } else if (isSelected) {
                                btnStyle.background = '#FCEBEB'; btnStyle.borderColor = '#A32D2D'; btnStyle.color = '#791F1F';
                            }
                        }

                        return (
                            <button key={idx} className="btn opt-btn" style={btnStyle} onClick={() => { if(selectedOpt === null) setSelectedOpt(idx); }} disabled={selectedOpt !== null}>
                                <div className="olabel" style={{ background: selectedOpt !== null && (isCorrect || isSelected) ? 'transparent' : '#fff' }}>{String.fromCharCode(65 + idx)}</div> 
                                <span style={{ fontSize: '15px', fontWeight: 500, flex: 1, textAlign: 'left' }}>{opt}</span>
                                {selectedOpt !== null && isCorrect && <i className="ti ti-check" style={{ color: '#3B6D11', fontSize: '20px' }}></i>}
                                {selectedOpt !== null && isSelected && !isCorrect && <i className="ti ti-x" style={{ color: '#A32D2D', fontSize: '20px' }}></i>}
                            </button>
                        );
                    })}
                </div>

                {selectedOpt !== null && (
                    <div style={{ marginTop: '20px', padding: '18px', background: qData.source === 'gemini' ? '#EEEDFE' : '#f8fafc', borderLeft: `5px solid ${qData.source === 'gemini' ? '#534AB7' : '#cbd5e1'}`, borderRadius: '10px', animation: 'fadeIn 0.4s ease' }}>
                        <h4 style={{ color: qData.source === 'gemini' ? '#3C3489' : '#0f172a', margin: '0 0 10px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                            <i className="ti ti-bulb"></i> Solution
                        </h4>
                        <p style={{ color: '#1e293b', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>{qData.solution}</p>
                    </div>
                )}
            </div>
        )}
    </div>
  );
}