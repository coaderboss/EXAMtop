// ==========================================
// EXAMINER: DASHBOARD & GRAPHICAL ANALYTICS
// ==========================================

function renderTestList(){
  var c = document.getElementById('test-list-area');
  
  if(!isOfflineMode && !currentUser) { 
      c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-lock" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">Please Login using Google to view your managed tests.</div></div>`; 
      return; 
  }
  
  var myTests = isOfflineMode ? tests : tests.filter(t => t.creatorUid === currentUser.uid);
  
  if(!myTests.length){ 
      c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-clipboard-off" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">No tests created yet.</div></div>`; 
      return; 
  }
  
  var html = `<div style="display:flex; flex-direction:column; gap:16px; width:100%;">`;
  
  html += myTests.map((t) => {
    var origIdx = tests.findIndex(x => x.id === t.id);
    var isTestActive = t.isActive !== false; 
    var statusColor = isTestActive ? '#3B6D11' : '#A32D2D';
    var statusBg = isTestActive ? '#EAF3DE' : '#FCEBEB';
    var statusIcon = isTestActive ? 'ti-door-enter' : 'ti-door-exit';
    var statusText = isTestActive ? 'Close Intake' : 'Open Intake';
    var statusBadge = isTestActive ? '<span class="badge b-green"><i class="ti ti-activity"></i> Accepting</span>' : '<span class="badge b-red"><i class="ti ti-lock"></i> Intake Closed</span>';

    return `
    <div class="test-entry" style="${!isTestActive ? 'opacity:0.85; border-left:4px solid #A32D2D;' : 'border-left:4px solid #3B6D11;'} display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; padding:1.25rem 1.5rem; background:#fff; border-radius:12px; border:1px solid var(--color-border-secondary); box-shadow:0 2px 8px rgba(0,0,0,0.04);">
      <div class="te-meta" style="flex:1; min-width:250px;">
        <div style="font-weight:600;font-size:16px;color:var(--color-text-primary)">${t.title}</div>
        <div style="font-size:13px;color:var(--color-text-secondary)">${t.subject||'No Subject'} &bull; ${t.questions.length} Questions &bull; ${t.duration} Mins</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap; align-items:center;">
          <span class="badge b-blue" style="cursor:pointer" onclick="copyToClip('${t.code}')" title="Click to copy code"><i class="ti ti-hash" style="font-size:12px"></i> ${t.code}</span>
          <span class="badge b-gray">${t.submissions ? t.submissions.length : 0} Submissions</span>
          ${t.resultVis==='manual' ? (t.released?'<span class="badge b-amber">Results Released</span>':'<span class="badge b-gray">Evaluation Pending</span>') : '<span class="badge b-purple">Instant Results</span>'}
          ${statusBadge}
        </div>
      </div>
      
      <div class="te-actions" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;">
        <button class="btn btn-sm" onclick="autoJoinLocalTest('${t.code}')"><i class="ti ti-player-play"></i> Self-Test</button>      
        <button class="btn btn-sm btn-blue" onclick="viewSubmissions(${origIdx})"><i class="ti ti-users"></i> Submissions</button>
        <button class="btn btn-sm" style="background:#EEEDFE; color:#3C3489; border-color:#CECBF6; font-weight:600;" onclick="openAnalytics(${origIdx})"><i class="ti ti-chart-pie"></i> Deep Analytics</button>
        <button class="btn btn-sm" style="background:#FAEEDA; color:#854F0B; border-color:#FAC775;" onclick="openEditKeyModal(${origIdx})"><i class="ti ti-key"></i> Edit Key</button>
        <button class="btn btn-sm" style="background:${statusBg}; color:${statusColor}; border-color:${statusColor}; font-weight:600;" onclick="toggleTestStatus(${origIdx})"><i class="ti ${statusIcon}"></i> ${statusText}</button>
        ${!t.released && t.resultVis==='manual' ? `<button class="btn btn-sm btn-success" onclick="releaseRes(${origIdx})"><i class="ti ti-send"></i> Publish</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="delTest(${origIdx})" title="Delete Test"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('');
  
  html += `</div>`;
  c.innerHTML = html;
}

function openAnalytics(testIdx) {
    var t = tests[testIdx];
    if (!t.submissions || t.submissions.length === 0) { showToast('Not enough data! At least 1 student must submit the test to generate analytics.', 'error'); return; }

    var totalStudents = t.submissions.length;
    var totalMarks = t.totalMarks || 0;
    
    var scores = t.submissions.map(s => s.score);
    var maxScore = Math.max(...scores);
    var minScore = Math.min(...scores);
    var avgScore = (scores.reduce((a, b) => a + b, 0) / totalStudents).toFixed(2);
    
    var passCount = t.submissions.filter(s => (s.score / totalMarks) >= 0.33).length;
    var passPercentage = Math.round((passCount / totalStudents) * 100);

    var qStats = t.questions.map((q, i) => ({ qIndex: i, text: q.text, wrongCount: 0, correctCount: 0 }));
    t.submissions.forEach(sub => { sub.details.forEach((d, i) => { if (d.status === 'wrong') qStats[i].wrongCount++; else if (d.status === 'correct') qStats[i].correctCount++; }); });

    var toughestQs = [...qStats].sort((a, b) => b.wrongCount - a.wrongCount).slice(0, 3);
    var easiestQs = [...qStats].sort((a, b) => b.correctCount - a.correctCount).slice(0, 3);

    var html = `
    <div style="padding:1.5rem; text-align:left;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:1.5rem;">
            <h3 style="color:#185FA5; margin:0; display:flex; align-items:center; gap:8px;"><i class="ti ti-chart-bar" style="font-size:24px;"></i> Class Analytics</h3>
            <button class="btn btn-sm" onclick="hideModal()">Close</button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:1rem; margin-bottom:2rem;">
            <div class="stat-card" style="border-color:#185FA5; padding:1rem;"><div class="stat-val" style="color:#185FA5; font-size:24px;">${avgScore} <span style="font-size:14px;color:gray">/ ${totalMarks}</span></div><div class="stat-lbl">Average Score</div></div>
            <div class="stat-card" style="border-color:#3B6D11; padding:1rem;"><div class="stat-val" style="color:#3B6D11; font-size:24px;">${maxScore}</div><div class="stat-lbl">Highest Score</div></div>
            <div class="stat-card" style="border-color:#A32D2D; padding:1rem;"><div class="stat-val" style="color:#A32D2D; font-size:24px;">${minScore}</div><div class="stat-lbl">Lowest Score</div></div>
            <div class="stat-card" style="border-color:#854F0B; padding:1rem;"><div class="stat-val" style="color:#854F0B; font-size:24px;">${passPercentage}%</div><div class="stat-lbl">Class Pass Rate</div></div>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.5rem; margin-bottom:1.5rem;">
            
            <div style="background:var(--color-background-primary); border:1px solid var(--color-border-secondary); border-radius:12px; padding:1.5rem; display:flex; flex-direction:column;">
                <h4 style="margin-top:0; margin-bottom:15px; color:var(--color-text-primary);"><i class="ti ti-trending-up"></i> Score Distribution (Bell Curve)</h4>
                <div style="position:relative; width:100%; height:250px; min-height:250px; max-height:250px;">
                    <canvas id="scoreChart" style="max-height:250px;"></canvas>
                </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:1rem;">
                <div style="background:#FCEBEB; border:1px solid #F7C1C1; border-radius:12px; padding:1rem;">
                    <h4 style="margin-top:0; color:#A32D2D; font-size:14px; margin-bottom:8px;"><i class="ti ti-alert-triangle"></i> The Weakest Links (Max Mistakes)</h4>
                    <ul style="margin:0; padding-left:20px; font-size:13px; color:#791F1F;">
                        ${toughestQs.map(q => `<li style="margin-bottom:6px;"><strong>Q${q.qIndex + 1}:</strong> ${q.text.substring(0, 45)}... <br><span class="badge b-red" style="font-size:10px; margin-top:4px;">Failed by ${q.wrongCount} students</span></li>`).join('')}
                    </ul>
                </div>
                
                <div style="background:#EAF3DE; border:1px solid #C0DD97; border-radius:12px; padding:1rem;">
                    <h4 style="margin-top:0; color:#27500A; font-size:14px; margin-bottom:8px;"><i class="ti ti-award"></i> Strong Zones (Most Correct)</h4>
                    <ul style="margin:0; padding-left:20px; font-size:13px; color:#27500A;">
                        ${easiestQs.map(q => `<li style="margin-bottom:6px;"><strong>Q${q.qIndex + 1}:</strong> ${q.text.substring(0, 45)}... <br><span class="badge b-green" style="font-size:10px; margin-top:4px;">Solved by ${q.correctCount} students</span></li>`).join('')}
                    </ul>
                </div>
            </div>
            
        </div>
    </div>`;
    
    document.getElementById('modal-box').style.maxWidth = '900px'; 
    showModal(html);

    setTimeout(() => {
        let brackets = [0, 0, 0, 0]; 
        scores.forEach(s => {
            let pct = (s / totalMarks) * 100;
            if (pct <= 25) brackets[0]++;
            else if (pct <= 50) brackets[1]++;
            else if (pct <= 75) brackets[2]++;
            else brackets[3]++;
        });

        const ctx = document.getElementById('scoreChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['0-25% (Poor)', '26-50% (Avg)', '51-75% (Good)', '76-100% (Excellent)'],
                datasets: [{ label: 'Number of Students', data: brackets, backgroundColor: ['#FCEBEB', '#FAEEDA', '#E6F1FB', '#EAF3DE'], borderColor: ['#A32D2D', '#854F0B', '#185FA5', '#3B6D11'], borderWidth: 2, borderRadius: 6 }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }
        });
    }, 150);
}

// --- EXAMINER ACTIONS (UPGRADED WITH UI REFRESH & CUSTOM MODALS) ---

function autoJoinLocalTest(code) { 
    nav('student'); 
    document.getElementById('s-code').value = code; 
    setTimeout(() => { joinTest(); }, 500); 
}

function toggleTestStatus(idx) { 
    if (tests[idx].isActive === undefined) tests[idx].isActive = true; 
    tests[idx].isActive = !tests[idx].isActive; 
    updateDatabase(); 
    var msg = tests[idx].isActive ? 'Test is now OPEN for new submissions.' : 'Test intake CLOSED. No new students can enter.'; 
    showToast(msg, tests[idx].isActive ? 'success' : 'error'); 
    renderTestList(); // NAYA FIX: Turant UI update hoga
}

// NAYA FIX: Premium Delete Popup with Safety Warning
function delTest(i) { 
    showModal(`
        <div style="text-align:center; padding:1.5rem;">
            <i class="ti ti-alert-triangle" style="font-size:56px; color:#A32D2D; display:block; margin-bottom:1rem;"></i>
            <h3 style="font-size:22px; font-weight:600; margin-bottom:0.5rem; color:#0f172a;">Delete Test Permanently?</h3>
            <p style="color:var(--color-text-secondary); margin-bottom:1.5rem; font-size:15px;">Are you sure you want to delete this test? All student submissions and analytics will be wiped out. This cannot be undone.</p>
            <div style="display:flex; gap:12px; justify-content:center;">
                <button class="btn" style="flex:1; padding:10px; font-weight:600;" onclick="hideModal()">Cancel</button>
                <button class="btn btn-danger" style="flex:1; padding:10px; font-weight:600;" onclick="executeDeleteTest(${i})"><i class="ti ti-trash"></i> Yes, Delete</button>
            </div>
        </div>
    `);
}

// NAYA FIX: Asli Delete function jo modal confirm hone ke baad chalega
window.executeDeleteTest = function(i) {
    hideModal();
    tests.splice(i, 1); 
    updateDatabase(); 
    renderTestList(); // NAYA FIX: Delete hote hi screen se test gayab ho jayega
    showToast('Test deleted successfully.', 'success');
};

function releaseRes(i){ 
    tests[i].released = true; 
    updateDatabase(); 
    renderTestList(); // NAYA FIX: Button ka rang badalne ke liye
    showModal('<div style="text-align:center;padding:2rem"><i class="ti ti-send" style="font-size:42px;color:#3B6D11;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:20px;margin-bottom:1rem">Results Published Successfully!</div><p style="color:var(--color-text-secondary);margin-bottom:1.5rem">Students can now view their checked papers.</p><button class="btn btn-primary" onclick="hideModal()">Done</button></div>'); 
}

function viewSubmissions(testIdx) {
  var t = tests[testIdx];
  if(!t.submissions || t.submissions.length === 0) { showModal('<div style="text-align:center;padding:2rem"><i class="ti ti-users" style="font-size:42px;color:var(--color-text-secondary);display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:18px">No Submissions Yet.</div></div>'); return; }
  
  var html = `<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem">
        <div><h3 style="font-size:18px;font-weight:600">${t.title}</h3><p style="font-size:13px;color:var(--color-text-secondary)">Student Submissions</p></div>
        <button class="btn btn-success btn-sm" onclick="exportToCSV(${t.id})"><i class="ti ti-file-spreadsheet"></i> Export CSV</button>
    </div>`;
  
  html += `<div style="max-height:60vh;overflow-y:auto;padding-right:8px">` + t.submissions.map((s, sIdx) => `
      <div style="display:flex;justify-content:space-between;padding:12px;border:1px solid var(--color-border-secondary);border-radius:var(--border-radius-md);margin-bottom:8px;align-items:center;background:var(--color-background-tertiary)">
          <div><div style="font-weight:600">${s.name}</div><div style="font-size:12px;color:var(--color-text-secondary)">Roll: ${s.roll||'N/A'} &bull; Score: ${s.score}</div></div>
          <button class="btn btn-sm btn-primary" onclick="hideModal(); showResultPageAsExaminer(${testIdx}, ${sIdx})"><i class="ti ti-eye"></i> Evaluate</button>
      </div>`).join('') + `</div><div style="margin-top:1.5rem;text-align:right"><button class="btn" onclick="hideModal()">Close</button></div>`;
  showModal(html);
}

// NAYA FIX: Async laga diya taaki script download hone ka wait kare
async function showResultPageAsExaminer(testIdx, sIdx) {
    var sub = tests[testIdx].submissions[sIdx];
    var t = tests[testIdx];

    // 1. Loading Modal kholo
    showModal(`
        <div style="width:100%; padding: 1rem; box-sizing: border-box;">
            <div id="student-result">
                <div class="spinner-container"><div class="spinner"></div><div style="margin-top:10px; color:var(--color-text-primary);">Loading Checked Paper...</div></div>
            </div>
        </div>
    `);

    // 2. MAGIC: Modal ko jabardasti Full Screen banao (Tumhara pasandeeda method)
    var mBox = document.getElementById('modal-box');
    mBox.style.width = '100vw';         // Screen ki puri width
    mBox.style.maxWidth = '100vw'; 
    mBox.style.height = '100vh';        // Screen ki puri height
    mBox.style.maxHeight = '100vh';
    mBox.style.margin = '0';            // Aas-paas ka space khatam
    mBox.style.borderRadius = '0';      // Gol kinare khatam
    mBox.style.overflowY = 'auto';
    mBox.style.padding = '0';
    
    try {
        if (typeof _generateResultDOM !== 'function') {
            await loadScript('scripts/student-dash.js');
        }

        setTimeout(() => {
            _generateResultDOM(sub, t, true, testIdx, sIdx);
            
            var backBtn = document.querySelector('#student-result .btn-primary');
            if(backBtn && backBtn.innerText.includes('Back')) {
                backBtn.setAttribute('onclick', 'hideModal(); renderTestList();');
                backBtn.innerHTML = '<i class="ti ti-x"></i> Close Paper';
            }
        }, 100);

    } catch(err) {
        document.getElementById('student-result').innerHTML = `<div style="color:#A32D2D; padding:2rem; text-align:center;"><i class="ti ti-alert-triangle" style="font-size:48px;"></i><br><br>Error loading result engine. Please try again.<br><small>${err.message}</small></div>`;
    }
}

function openEditKeyModal(idx) {
    var t = tests[idx];
    var html = `<div style="padding:1.5rem; text-align:left;">
        <h3 style="margin-bottom: 1rem; color: #185FA5; display:flex; align-items:center; gap:8px;"><i class="ti ti-key"></i> Smart Key Update</h3>
        <p style="font-size:13px; color:var(--color-text-secondary); margin-bottom:1.5rem; line-height:1.6;">Fix any wrong answers in your key below. When you save, all <strong>${t.submissions ? t.submissions.length : 0}</strong> existing student submissions will be automatically re-graded instantly.</p>
        <div style="max-height: 50vh; overflow-y: auto; padding-right:10px; margin-bottom:1.5rem;">`;

    t.questions.forEach((q, i) => {
        html += `<div style="margin-bottom:1.25rem; padding:12px; border:1px solid var(--color-border-secondary); border-radius:8px; background:var(--color-background-secondary);">
            <div style="font-weight:600; font-size:14px; margin-bottom:8px; color:#0f172a;">Q${i+1}: ${q.text.substring(0, 70)}...</div>`;
        if (q.type === 'mcq') {
            html += `<div style="display:flex; gap:12px; flex-wrap:wrap;">`;
            q.options.forEach((opt, j) => { let isChecked = q.correct.includes(j) ? 'checked' : ''; html += `<label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;"><input type="radio" name="rekey_${i}" value="${j}" ${isChecked} class="rekey-input-${i}" style="width:16px;height:16px;"> Opt ${String.fromCharCode(65+j)}</label>`; }); html += `</div>`;
        } else if (q.type === 'msq') {
            html += `<div style="display:flex; gap:12px; flex-wrap:wrap;">`;
            q.options.forEach((opt, j) => { let isChecked = q.correct.includes(j) ? 'checked' : ''; html += `<label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;"><input type="checkbox" value="${j}" ${isChecked} class="rekey-input-${i}" style="width:16px;height:16px;"> Opt ${String.fromCharCode(65+j)}</label>`; }); html += `</div>`;
        } else if (q.type === 'integer') { html += `<label style="font-size:13px; font-weight:500;">Correct Integer Key: <input type="number" value="${q.correctInt}" class="rekey-input-${i}" style="width:100px; padding:6px; font-size:14px; border:1px solid #cbd5e1; border-radius:4px; margin-left:8px;"></label>`; } else if (q.type === 'subjective') { html += `<div style="font-size:12px; color:#854F0B; font-weight:500;"><i class="ti ti-info-circle"></i> Subjective question (Requires manual evaluation).</div>`; }
        html += `</div>`;
    });

    html += `</div><div style="display:flex; gap:10px;"><button class="btn" style="flex:1; padding:12px; font-weight:600;" onclick="hideModal()">Cancel</button><button class="btn btn-primary" style="flex:2; background:#854F0B; border-color:#854F0B; padding:12px; font-weight:600;" onclick="saveNewKeyAndReevaluate(${idx})"><i class="ti ti-refresh"></i> Update & Auto-Grade All</button></div></div>`;
    showModal(html);
}

function saveNewKeyAndReevaluate(idx) {
    var t = tests[idx];
    t.questions.forEach((q, i) => {
        if (q.type === 'mcq') { let selected = document.querySelector(`.rekey-input-${i}:checked`); if(selected) q.correct = [parseInt(selected.value)]; } else if (q.type === 'msq') { let selected = document.querySelectorAll(`.rekey-input-${i}:checked`); q.correct = Array.from(selected).map(cb => parseInt(cb.value)); } else if (q.type === 'integer') { let input = document.querySelector(`.rekey-input-${i}`); if(input && input.value !== '') q.correctInt = parseFloat(input.value); }
    });

    if (t.submissions && t.submissions.length > 0) {
        var neg = t.negMarking || 0;
        t.submissions.forEach(sub => {
            let newScore = 0, newCorrect = 0, newWrong = 0, newSkipped = 0;
            sub.details.forEach((d, i) => {
                let q = t.questions[i]; d.q = q; let ans = d.ans;
                let hasVal = ans.val !== null && (!Array.isArray(ans.val) || ans.val.length > 0);
                if (!hasVal) { if(d.status === 'evaluated') { newScore += (d.earned || 0); newSkipped++; } else { d.status = 'skipped'; d.earned = 0; newSkipped++; } } else if (q.type === 'mcq') { if (ans.val === q.correct[0]) { newCorrect++; d.earned = q.marks; newScore += q.marks; d.status = 'correct'; } else { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; } } else if (q.type === 'msq') { var userSel = Array.isArray(ans.val) ? ans.val : []; var corrSel = q.correct; var hasWrongOption = userSel.some(x => !corrSel.includes(x)); var correctlySelected = userSel.filter(x => corrSel.includes(x)).length; if (hasWrongOption) { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; } else if (correctlySelected === corrSel.length) { newCorrect++; d.earned = q.marks; newScore += q.marks; d.status = 'correct'; } else if (correctlySelected > 0) { var partialMarks = (q.marks / corrSel.length) * correctlySelected; let earned = Math.round(partialMarks * 100) / 100; newScore += earned; newCorrect++; d.status = 'partial'; } else { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; } } else if (q.type === 'integer') { if (ans.val === q.correctInt) { newCorrect++; d.earned = q.marks; newScore += q.marks; d.status = 'correct'; } else { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; } } else { if(d.status === 'evaluated') { newScore += (d.earned || 0); if(d.earned > 0) newCorrect++; else newSkipped++; } else { d.status = 'submitted'; d.earned = 0; newSkipped++; } }
            });
            sub.score = Number(newScore.toFixed(2)); sub.correct = newCorrect; sub.wrong = newWrong; sub.skipped = newSkipped;
        });
    }

    updateDatabase(); hideModal(); showToast(`Answer Key Updated! Successfully re-graded ${t.submissions ? t.submissions.length : 0} student(s).`, 'success'); renderTestList();
}

function saveEvaluation(tIdx, sIdx) {
    var sub = tests[tIdx].submissions[sIdx];
    var test = tests[tIdx];
    var overrides = []; 
    var hasError = false;
    var inputs = document.querySelectorAll('.eval-input');
    
    for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i]; var qIdx = parseInt(inp.id.replace('mark_input_', '')); var awardedMarks = parseFloat(inp.value) || 0; var maxMarks = Number(sub.details[qIdx].q.marks); 
        if (awardedMarks > maxMarks) { showToast(`Error: Marks for Q${qIdx + 1} cannot exceed ${maxMarks}!`, 'error'); inp.style.borderColor = '#A32D2D'; inp.style.background = '#FCEBEB'; hasError = true; break; } 
        else { inp.style.borderColor = '#185FA5'; inp.style.background = '#fff'; if(sub.details[qIdx].q.type === 'subjective' || sub.details[qIdx].earned !== awardedMarks) { overrides.push({ qIdx: qIdx, awarded: awardedMarks }); } }
    }

    if (hasError) return; 
    if (overrides.length === 0) { showToast('No changes made to marks.', 'normal'); return; }
    window.tempEvalData = { tIdx, sIdx, overrides }; 
    showModal(`<div style="padding:1.5rem; text-align:left;"><div style="display:flex; align-items:center; gap:10px; margin-bottom:1rem; color:#854F0B;"><i class="ti ti-shield-check" style="font-size:28px;"></i><h3 style="margin:0; font-size:20px;">Evaluation Audit required</h3></div><p style="font-size:14px; color:var(--color-text-secondary); margin-bottom:1rem; line-height:1.5;">You are modifying the marks for <strong>${overrides.length} question(s)</strong>. To ensure transparency, please provide a justification. This will be recorded securely.</p><label style="font-size:13px; font-weight:600; margin-bottom:5px; display:block;">Reason for changing marks: <span style="color:#A32D2D">*</span></label><textarea id="audit-reason" class="input-block" placeholder="e.g., 'Partial marks for correct formula'" style="min-height:80px; margin-bottom:1.5rem; font-size:14px;"></textarea><div style="display:flex; gap:12px;"><button class="btn" style="flex:1" onclick="hideModal()">Cancel</button><button class="btn btn-primary" style="flex:1" onclick="confirmAndSaveEval()"><i class="ti ti-lock"></i> Confirm & Save</button></div></div>`);
}

function confirmAndSaveEval() {
    var reason = document.getElementById('audit-reason').value.trim();
    if (!reason) { showToast("You must provide a reason for the audit log!", "error"); return; }
    var { tIdx, sIdx, overrides } = window.tempEvalData; var sub = tests[tIdx].submissions[sIdx]; var test = tests[tIdx];

    overrides.forEach(ov => { sub.details[ov.qIdx].earned = ov.awarded; sub.details[ov.qIdx].status = 'evaluated'; if(!sub.details[ov.qIdx].auditLogs) sub.details[ov.qIdx].auditLogs = []; sub.details[ov.qIdx].auditLogs.push({ date: new Date().toLocaleString('en-IN'), examiner: currentUser ? (currentUser.displayName || currentUser.email || 'Examiner') : 'Examiner', reason: reason, awarded: ov.awarded }); });

    var newTotal = 0, newCorrect = 0, newWrong = 0, newSkipped = 0;
    sub.details.forEach(d => { newTotal += (d.earned || 0); if (d.status === 'skipped') newSkipped++; else if (d.earned > 0) newCorrect++; else if (d.earned < 0) newWrong++; else { if (d.q.type === 'subjective') newSkipped++; else newWrong++; } });

    sub.score = Number(newTotal.toFixed(2)); sub.correct = newCorrect; sub.wrong = newWrong; sub.skipped = newSkipped;
    updateDatabase(); hideModal(); _generateResultDOM(sub, test, true, tIdx, sIdx); showToast('Marks Saved! Audit log securely recorded.', 'success'); window.tempEvalData = null; 
}

function renderAllResults(){
  var c = document.getElementById('results-area');
  if(!isOfflineMode && !currentUser) { c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-lock" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">Please Login using Google to view results.</div></div>`; return; }
  var myTests = isOfflineMode ? tests : tests.filter(t => t.creatorUid === currentUser.uid);
  var all = myTests.flatMap(t => t.submissions ? t.submissions.map(s => ({...s, testTitle: t.title, testCode: t.code})) : []);
  if(!all.length){ c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-chart-off" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">No results available yet. Complete a test to see data here.</div></div>`; return; }
  
  c.innerHTML = all.map(s => `<div class="test-entry"><div class="te-meta"><div style="font-weight:600;font-size:16px">${s.name} ${s.roll?'<span style="font-weight:400;color:var(--color-text-secondary)">· '+s.roll+'</span>':''}</div><div style="font-size:13px;color:var(--color-text-secondary)">${s.testTitle} &bull; ${s.time}</div></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="badge b-blue" style="font-size:13px">Score: ${s.score}</span><span class="badge b-green">${s.correct} Correct</span><span class="badge b-red">${s.wrong} Wrong</span><span class="badge b-gray">${s.skipped} Skipped</span></div></div>`).join('');
}