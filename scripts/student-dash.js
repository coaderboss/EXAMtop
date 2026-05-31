// ==========================================
// STUDENT DASHBOARD & RESULTS ANALYTICS
// ==========================================

function launchExistingResult(testId, name, roll) {
    var t = tests.find(x => x.id == testId || x.code == testId);
    var rollToMatch = roll ? roll.toLowerCase() : '';
    var sub = t.submissions.find(s => s.name.toLowerCase() === name.toLowerCase() && (s.roll || '').toLowerCase() === rollToMatch);

    // 1. Asli Page par route karo
    nav('student'); 

    // 2. SMART POLLING: Har 50ms me check karo ki page load hua ya nahi
    let checkExist = setInterval(function() {
        var homeEl = document.getElementById('student-home');
        var testEl = document.getElementById('student-test');
        var resultEl = document.getElementById('student-result');

        // Jaise hi elements screen par aa jayein...
        if (homeEl && resultEl) {
            clearInterval(checkExist); // Polling band karo

            // 3. Form ko Badi Beharmi se chupao (Force hide)
            homeEl.style.display = 'none';
            if(testEl) testEl.style.display = 'none';

            // 4. Result Screen dikhao
            resultEl.style.display = 'block';
            resultEl.classList.remove('hidden');
            resultEl.innerHTML = `<div class="spinner-container"><div class="spinner"></div><div style="margin-top:10px;">Loading Checked Paper...</div></div>`;

            // 5. Engine ko result print karne do
            setTimeout(() => {
                if (typeof _generateResultDOM === 'function') {
                    _generateResultDOM(sub, t, false);
                    // Double security: Phir se Join Test ko hide karo taki router usko wapas na laye
                    document.getElementById('student-home').style.display = 'none';
                } else {
                    resultEl.innerHTML = `<div style="color:#A32D2D; padding:2rem; text-align:center;">Result engine not found. Please refresh.</div>`;
                }
            }, 100);
        }
    }, 50); // Har 50ms me check karega
}

function claimCertificate(name, course, date) {
    showModal(`
        <div id="printable-certificate" class="cert-container" style="background:#fff;">
            <div class="cert-watermark"><i class="ti ti-school"></i></div>
            <div class="cert-content">
                <div class="cert-title">Certificate of Achievement</div>
                <div class="cert-sub">This is proudly presented to</div>
                <div class="cert-name">${name}</div>
                <div style="font-size:16px; color:var(--color-text-secondary); margin-bottom:20px; line-height:1.6;">
                    For successfully passing the assessment<br>
                    <strong>${course}</strong><br>
                    with distinction.
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:40px; border-top:1px solid #e2e8f0; padding-top:20px;">
                    <div style="text-align:left;">
                        <div style="font-size:12px; color:#94a3b8; text-transform:uppercase;">Date</div>
                        <div style="font-weight:600; color:#0f172a;">${date.split(',')[0]}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="width:100px; height:2px; background:#cbd5e1; margin-bottom:5px;"></div>
                        <div style="font-size:12px; color:#94a3b8; text-transform:uppercase;">Platform System</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="no-print" style="margin-top:20px; display:flex; gap:10px;">
            <button class="btn" style="flex:1;" onclick="hideModal()">Close</button>
            <button class="btn btn-primary" style="flex:1; background:#854F0B; border-color:#854F0B;" onclick="window.print()"><i class="ti ti-printer"></i> Print / Save PDF</button>
        </div>
    `);
}

function _generateResultDOM(sub, test, isExaminerView, tIdx = null, sIdx = null) {
  var mainHeader = document.querySelector('.app-header');
  if(mainHeader) mainHeader.style.display = '';
  var el=document.getElementById('student-result');
  el.classList.remove('hidden');
  var pct=Math.round((sub.score/test.totalMarks)*100);
  var accuracy=sub.correct+sub.wrong>0?Math.round((sub.correct/(sub.correct+sub.wrong))*100):0;
  var typeStats={};
  
  sub.details.forEach(d=>{
    var t=d.q.type;
    if(!typeStats[t]) typeStats[t]={correct:0,wrong:0,skipped:0,total:0};
    typeStats[t].total++;
    typeStats[t][d.status==='submitted'||d.status==='evaluated'?'skipped':d.status]++;
  });
  
  var certBtnHtml = (!isExaminerView && pct >= 75) ? `<button class="btn btn-sm" style="background:#FAEEDA; color:#854F0B; border-color:#FAC775; font-weight:600; margin-top:12px;" onclick="claimCertificate('${sub.name}', '${test.title}', '${sub.time}')"><i class="ti ti-medal"></i> Claim Certificate</button>` : '';

  function renderCards(filter){
    var filtered=sub.details.filter(d=>filter==='all'||d.status===filter||(filter==='skipped'&&(d.status==='submitted'||d.status==='evaluated')));
    return filtered.map((d)=>{
      var originalQIdx = sub.details.indexOf(d);
      var q=d.q, ans=d.ans;
      var headerBg=d.status==='correct'?'#EAF3DE':d.status==='wrong'?'#FCEBEB':d.status==='partial'?'#FAEEDA':(d.status==='submitted'||d.status==='evaluated')?'#EEEDFE':'var(--color-background-secondary)';
      var headerColor=d.status==='correct'?'#27500A':d.status==='wrong'?'#791F1F':d.status==='partial'?'#633806':(d.status==='submitted'||d.status==='evaluated')?'#3C3489':'var(--color-text-secondary)';
      var icon=d.status==='correct'?'ti-circle-check':d.status==='wrong'?'ti-circle-x':d.status==='partial'?'ti-adjustments-alt':(d.status==='submitted'||d.status==='evaluated')?'ti-pencil':'ti-minus';
      var statusLabel=d.status==='correct'?'Correct':d.status==='wrong'?'Wrong':d.status==='partial'?'Partially Correct':d.status==='evaluated'?'Evaluated manually':d.status==='submitted'?'Pending Evaluation':'Skipped';
      var earnedStr=d.earned>0?'+'+d.earned:d.earned<0?''+d.earned:'0';
      var optHTML='';
      
      if(q.type==='mcq'||q.type==='msq'){
        var userSel=Array.isArray(ans.val)?ans.val:(ans.val!==null?[ans.val]:[]);
        var corrSel=q.correct;
        optHTML=q.options.map((o,j)=>{
          var isUser=userSel.includes(j), isCorr=corrSel.includes(j);
          var cls='neutral', borderStyle = '';
          if(isCorr && isUser) { cls='correct'; borderStyle='border-color:#3B6D11; background:#EAF3DE;'; }
          else if(isCorr && !isUser) { cls='neutral'; borderStyle='border-color:#C0DD97; background:#f4f9ed;'; }
          else if(!isCorr && isUser) { cls='wrong'; borderStyle='border-color:#A32D2D; background:#FCEBEB;'; }
          var badgeHTML = '';
          if (isUser) badgeHTML += `<span style="font-size:11px;background:#185FA5;color:#fff;padding:2px 6px;border-radius:4px;margin-right:6px">Student Picked</span>`;
          if (isCorr) badgeHTML += `<span style="font-size:11px;background:#3B6D11;color:#fff;padding:2px 6px;border-radius:4px">Correct Key</span>`;
          return `<div class="qr-opt ${cls}" style="${borderStyle}"><div style="width:26px;height:26px;border-radius:50%;border:2px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0;background:rgba(255,255,255,0.7)">${String.fromCharCode(65+j)}</div><div style="flex:1; display:flex; flex-direction:column; gap:5px; padding:4px 0;"><div style="font-size:15px; font-weight: ${isUser||isCorr?'600':'400'}">${o||'Option '+String.fromCharCode(65+j)}</div>${badgeHTML ? `<div style="display:flex;">${badgeHTML}</div>` : ''}</div>${isCorr && isUser?'<i class="ti ti-check" style="font-size:22px;color:#3B6D11;flex-shrink:0"></i>':''}${isUser && !isCorr?'<i class="ti ti-x" style="font-size:22px;color:#A32D2D;flex-shrink:0"></i>':''}</div>`;
        }).join('');
      }else if(q.type==='integer'){ optHTML=`<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:0.75rem"><div class="qr-opt ${d.status}" style="flex:1;font-size:15px">Answer Typed: <strong style="font-size:18px;margin-left:8px">${ans.val!==null?ans.val:'—'}</strong></div><div class="qr-opt correct" style="flex:1;font-size:15px">Correct Key: <strong style="font-size:18px;margin-left:8px">${q.correctInt}</strong></div></div>`; }
      else{ optHTML=`<div class="qr-opt neutral" style="margin-bottom:0.75rem;align-items:flex-start;padding:1rem"><i class="ti ti-note" style="flex-shrink:0;margin-top:2px;font-size:18px;color:#185FA5"></i><span style="font-size:15px;line-height:1.6">${ans.val||'<em style="color:var(--color-text-secondary)">No answer written.</em>'}</span></div>${q.modelAnswer?`<div class="qr-opt correct" style="align-items:flex-start;padding:1rem"><i class="ti ti-bulb" style="flex-shrink:0;margin-top:2px;font-size:18px"></i><span style="font-size:15px;line-height:1.6"><strong>Model Answer:</strong><br>${q.modelAnswer}</span></div>`:''}`; }
      var expHTML=q.explanation?`<div style="margin-top:1.25rem;padding:1rem;background:var(--color-background-tertiary);border-radius:var(--border-radius-md);font-size:14px;display:flex;gap:10px;align-items:flex-start;border:1px solid var(--color-border-secondary)"><i class="ti ti-info-circle" style="flex-shrink:0;color:#185FA5;font-size:18px;margin-top:2px"></i><span style="line-height:1.6"><strong>Explanation:</strong> ${q.explanation}</span></div>`:'';
      
      var auditHTML = '';
      if (d.auditLogs && d.auditLogs.length > 0) {
          let lastLog = d.auditLogs[d.auditLogs.length - 1]; 
          auditHTML = `<div style="margin-top:12px; padding:10px; background:#FEF5E5; border:1px solid #FAC775; border-radius:6px; font-size:13px; color:#633806;"><div style="font-weight:600; margin-bottom:4px;"><i class="ti ti-shield-check"></i> Audit Log (Manual Evaluation)</div>Marks overridden to <strong>${lastLog.awarded}</strong>. <br><strong>Reason:</strong> "${lastLog.reason}" <br><span style="font-size:11px; opacity:0.7;">By: ${lastLog.examiner} | Date: ${lastLog.date}</span></div>`;
      }
      var examinerInputHTML = '';
      if(isExaminerView) examinerInputHTML = `<div style="margin-top:15px; padding-top:12px; border-top:1px dashed var(--color-border-secondary); display:flex; align-items:center; justify-content:space-between; gap:10px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;"><div style="font-size:14px; color:#185FA5; font-weight:600;"><i class="ti ti-edit"></i> Override / Award Marks (Max: ${q.marks}):</div><input type="number" id="mark_input_${originalQIdx}" class="eval-input" max="${q.marks}" step="0.25" value="${d.earned||0}" style="width:90px; padding:6px; font-size:15px; font-weight:bold; color:#185FA5; border:2px solid #185FA5; border-radius:6px; text-align:center; background:var(--color-background-primary); outline:none;"></div>`;

      return `<div class="q-review-card"><div class="qr-header" style="background:${headerBg};color:${headerColor}"><i class="ti ${icon}" style="font-size:20px"></i><span style="font-weight:600;font-size:15px">Question ${originalQIdx+1} &mdash; ${tlabel(q.type)}</span><span style="margin-left:auto;font-size:14px;font-weight:600;background:rgba(255,255,255,0.6);padding:4px 10px;border-radius:12px">${statusLabel} &nbsp; ${earnedStr} marks</span></div><div class="qr-body"><div style="font-size:16px;line-height:1.7;margin-bottom:1.5rem;color:var(--color-text-primary);font-weight:500">${q.text||'No question text.'}</div>${q.imgUrl ? `<div style="margin-bottom:1.5rem;"><img src="${q.imgUrl}" style="max-width:100%; max-height:250px; border-radius:8px; border:1px solid var(--color-border-secondary);"></div>` : ''}${optHTML}${expHTML}${auditHTML}${examinerInputHTML}</div></div>`;
    }).join('');
  }

  var maxH=Math.max(sub.correct, sub.wrong, sub.skipped, 1);
  var bH=c=>Math.max(16, Math.round((c/maxH)*80));
  var actionButtons = isExaminerView 
      ? `<button class="btn btn-success" style="font-size:15px;padding:10px 24px;font-weight:600" onclick="saveEvaluation(${tIdx}, ${sIdx})"><i class="ti ti-device-floppy"></i> Save Manual Evaluation</button><button class="btn btn-primary" style="font-size:15px;padding:10px 24px" onclick="nav('tests')"><i class="ti ti-arrow-left"></i> Back to Dashboard</button>`
      : `<button class="btn btn-primary" style="font-size:15px;padding:10px 24px" onclick="resetStudent()"><i class="ti ti-arrow-left"></i> Go Back</button>`;

  // NAYA: Security Box Generate karna
  var cheatHtml = '';
  if (sub.cheatLogs && sub.cheatLogs.length > 0) {
      cheatHtml = `<div class="card" style="border-color:#A32D2D; background:#FCEBEB; margin-bottom:1.5rem; box-shadow:0 4px 15px rgba(163, 45, 45, 0.1);">
          <h4 style="color:#A32D2D; margin:0 0 10px 0; font-size:16px;"><i class="ti ti-shield-x" style="font-size:20px;"></i> Security & Proctoring Alerts</h4>
          <p style="font-size:13px; color:#791F1F; margin-bottom:10px;">The system detected suspicious activity during the exam:</p>
          <ul style="margin:0; padding-left:20px; font-size:14px; color:#791F1F; line-height:1.6;">
              ${sub.cheatLogs.map((log, index) => `<li style="margin-bottom:6px;"><strong>Warning ${index + 1} [${log.time}]:</strong> ${log.reason}</li>`).join('')}
          </ul>
          ${sub.cheatLogs.length >= 3 ? `<div class="badge b-red" style="margin-top:10px; padding:6px 10px; font-size:13px;"><i class="ti ti-ban"></i> Test Auto-Submitted due to repeated violations</div>` : ''}
      </div>`;
  }

  el.innerHTML=`
    <div class="result-hero">
      <div style="font-size:15px;opacity:0.85;margin-bottom:0.75rem;font-weight:500;text-transform:uppercase;letter-spacing:1px">${test.title}</div>
      <div style="font-size:24px;font-weight:600;margin-bottom:0.25rem">${sub.name}${sub.roll?' &bull; '+sub.roll:''}</div>
      <div style="font-size:14px;opacity:0.8;margin-bottom:1.5rem">${sub.time}</div>
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;width:130px;height:130px;line-height:1;display:flex;align-items:center;justify-content:center;flex-direction:column;margin:0 auto 1.5rem;box-shadow:0 0 0 6px rgba(255,255,255,0.1)">
        <div style="font-size:42px;font-weight:600;margin-bottom:4px">${sub.score}</div>
        <div style="font-size:14px;opacity:0.8;font-weight:500">/ ${test.totalMarks}</div>
      </div>
      <div style="font-size:18px;font-weight:600;background:rgba(0,0,0,0.15);display:inline-block;padding:8px 24px;border-radius:30px">${pct}% &nbsp;&bull;&nbsp; ${pct>=90?'Excellent Score!':pct>=75?'Great Job!':pct>=50?'Good Effort':pct>=35?'Keep Practicing':'Needs Improvement'}</div>
      <div style="margin-top:10px;">${certBtnHtml}</div>
    </div>
    
    ${cheatHtml}
    
    <div class="grid4" style="margin-bottom:1.5rem">
      <div class="stat-card"><div class="stat-val" style="color:#185FA5">${sub.score}</div><div class="stat-lbl">Total Score</div></div>
      <div class="stat-card"><div class="stat-val" style="color:#3B6D11">${sub.correct}</div><div class="stat-lbl">Correct</div></div>
      <div class="stat-card"><div class="stat-val" style="color:#A32D2D">${sub.wrong}</div><div class="stat-lbl">Incorrect</div></div>
      <div class="stat-card"><div class="stat-val" style="color:var(--color-text-secondary)">${sub.skipped}</div><div class="stat-lbl">Pending/Skipped</div></div>
    </div>
    <div class="grid2" style="margin-bottom:2rem">
      <div class="card" style="margin-bottom:0"><div class="card-title"><i class="ti ti-chart-pie" style="font-size:20px;color:#185FA5"></i> Performance Overview</div><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px"><span>Total Marks Scored</span><span style="font-weight:600">${sub.score} / ${test.totalMarks}</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><div style="display:flex;justify-content:space-between;font-size:14px;margin:1.25rem 0 8px"><span>Accuracy (Attempted)</span><span style="font-weight:600">${accuracy}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${accuracy}%;background:#3B6D11"></div></div><div style="margin-top:1.5rem" class="bar-chart"><div class="bar-col"><div class="bar-val" style="color:#3B6D11">${sub.correct}</div><div class="bar" style="height:${bH(sub.correct)}px;background:#C0DD97"></div><div class="bar-lbl">Correct</div></div><div class="bar-col"><div class="bar-val" style="color:#A32D2D">${sub.wrong}</div><div class="bar" style="height:${bH(sub.wrong)}px;background:#F7C1C1"></div><div class="bar-lbl">Wrong</div></div><div class="bar-col"><div class="bar-val" style="color:var(--color-text-secondary)">${sub.skipped}</div><div class="bar" style="height:${bH(sub.skipped)}px;background:var(--color-border-primary)"></div><div class="bar-lbl">Skipped</div></div></div></div>
      <div class="card" style="margin-bottom:0"><div class="card-title"><i class="ti ti-list-details" style="font-size:20px;color:#185FA5"></i> By Question Type</div>${Object.entries(typeStats).map(([type,s])=>`<div style="margin-bottom:1rem"><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px"><span class="badge ${tbadge(type)}">${tlabel(type)}</span><span style="font-size:13px;color:var(--color-text-secondary);font-weight:500">${s.correct}C &bull; ${s.wrong}W &bull; ${s.skipped}S</span></div><div class="progress-track" style="height:6px"><div class="progress-fill" style="width:${Math.round((s.correct/s.total)*100)}%; border-radius:3px"></div></div></div>`).join('')}<div class="divider"></div><div style="font-size:14px;color:var(--color-text-secondary);line-height:1.8">Total Attempted: <strong style="color:var(--color-text-primary);font-size:15px">${sub.correct+sub.wrong}</strong> / ${test.questions.length}<br>Negative Marks: <strong style="color:#A32D2D;font-size:15px">-${(sub.wrong*(test.negMarking||0)).toFixed(2)}</strong></div></div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:12px;padding-bottom:1rem;border-bottom:1px solid var(--color-border-secondary)"><div style="font-size:18px;font-weight:600">Question-wise Analysis</div><div class="filter-tabs" id="filter-tabs" style="margin-bottom:0"><button class="ftab active" onclick="setFilter('all',this)">All (${sub.details.length})</button><button class="ftab" onclick="setFilter('correct',this)">Correct (${sub.correct})</button><button class="ftab" onclick="setFilter('wrong',this)">Wrong (${sub.wrong})</button><button class="ftab" onclick="setFilter('skipped',this)">Pending/Skipped (${sub.skipped})</button></div></div>
    <div id="q-review-area">${renderCards('all')}</div>
    <div style="display:flex;gap:12px;margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--color-border-secondary)">${actionButtons}</div>`;

  window.__renderCards=renderCards;
  if (typeof renderMath === 'function') renderMath();
}

function setFilter(f,btn){ 
    document.querySelectorAll('.ftab').forEach(b=>b.classList.remove('active')); 
    btn.classList.add('active'); 
    document.getElementById('q-review-area').innerHTML=window.__renderCards(f); 
    if (typeof renderMath === 'function') renderMath();
}

function renderStudentDashboard() {
    var c = document.getElementById('student-analytics-area');
    if (!c) return;
    if(!currentUser) { c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-lock" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">Please Login to view your analytics.</div></div>`; return; }

    c.innerHTML = `<div class="spinner-container"><div class="spinner"></div><div>Loading Dashboard...</div></div>`;

    setTimeout(() => {
        var myHistory = [];
        tests.forEach(t => {
            if(t.submissions) { t.submissions.forEach((s, idx) => { if(s.uid === currentUser.uid || (s.name && currentUser.displayName && s.name.toLowerCase() === currentUser.displayName.toLowerCase())) { myHistory.push({ testId: t.id, testTitle: t.title, testCode: t.code, score: s.score, totalMarks: s.totalMarks, correct: s.correct, wrong: s.wrong, skipped: s.skipped, time: s.time, sIdx: idx }); } }); }
        });

        var practiceBannerHTML = `
            <div style="background: linear-gradient(135deg, #185FA5 0%, #3C3489 100%); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; color: #fff; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px; box-shadow: 0 4px 15px rgba(24,95,165,0.2);">
                <div>
                    <h3 style="font-size:18px; margin-bottom:4px; display:flex; align-items:center; gap:8px;"><i class="ti ti-flame" style="color:#FAC775; font-size:24px;"></i> Practice Arena</h3>
                    <p style="font-size:13px; opacity:0.9; margin:0;">Test your knowledge with endless random questions from Global GK, Science, and Tech.</p>
                </div>
                    <button class="btn" style="background: #fff; color: #185FA5; border: none; font-weight: 600; padding: 10px 20px;" onclick="nav('practice')">Enter Arena <i class="ti ti-arrow-right"></i></button>            </div>
        `;

        if(myHistory.length === 0) { 
            c.innerHTML = practiceBannerHTML + `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-chart-line" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">No tests attempted yet. Join a test to see your analytics!</div></div>`; 
            return; 
        }

        var totalTests = myHistory.length; var totalCorrect = 0, totalWrong = 0, totalEarned = 0, totalMax = 0;
        myHistory.forEach(h => { totalCorrect += h.correct; totalWrong += h.wrong; totalEarned += h.score; totalMax += h.totalMarks; });

        var overallAccuracy = (totalCorrect + totalWrong) > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0;
        var overallPercentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;

        var html = `<div class="grid4" style="margin-bottom:2rem"><div class="stat-card"><div class="stat-val" style="color:#185FA5">${totalTests}</div><div class="stat-lbl">Tests Attempted</div></div><div class="stat-card"><div class="stat-val" style="color:#3B6D11">${overallAccuracy}%</div><div class="stat-lbl">Overall Accuracy</div></div><div class="stat-card"><div class="stat-val" style="color:#A32D2D">${totalWrong}</div><div class="stat-lbl">Total Mistakes</div></div><div class="stat-card"><div class="stat-val" style="color:#854F0B">${overallPercentage}%</div><div class="stat-lbl">Avg Percentage</div></div></div>`;
        html += practiceBannerHTML;
        html += `<h3 style="margin-bottom:1rem; font-size:18px; display:flex; align-items:center; gap:8px;"><i class="ti ti-history" style="color:#185FA5;"></i> Recent Test History</h3><div style="display:flex; flex-direction:column; gap:12px;">`;

        myHistory.reverse().forEach(h => {
            var pct = Math.round((h.score / h.totalMarks) * 100);
            var certBtn = pct >= 75 ? `<button class="btn btn-sm" style="background:#FAEEDA; color:#854F0B; border-color:#FAC775; font-weight:600; margin-top:8px;" onclick="claimCertificate('${currentUser.displayName}', '${h.testTitle}', '${h.time}')"><i class="ti ti-medal"></i> Claim Certificate</button>` : '';
            
            html += `<div class="test-entry" style="align-items:center; padding:1rem 1.5rem;"><div class="te-meta"><div style="font-weight:600;font-size:16px; color:#0f172a;">${h.testTitle} <span class="badge b-gray" style="font-size:11px; margin-left:8px;">Code: ${h.testCode}</span></div><div style="font-size:13px;color:var(--color-text-secondary); margin-top:4px;">Attempted on: ${h.time}</div>${certBtn}</div><div style="display:flex; gap:16px; align-items:center;"><div style="text-align:right;"><div style="font-weight:600; color:#185FA5; font-size:16px;">${h.score} <span style="font-size:12px; font-weight:normal; color:var(--color-text-secondary);">/ ${h.totalMarks}</span></div><div style="font-size:12px; color:var(--color-text-secondary); margin-top:2px;">Accuracy: ${h.correct+h.wrong > 0 ? Math.round((h.correct/(h.correct+h.wrong))*100) : 0}%</div></div><div style="width:46px; height:46px; border-radius:50%; background:${pct>=75?'#EAF3DE':pct>=40?'#FAEEDA':'#FCEBEB'}; color:${pct>=75?'#27500A':pct>=40?'#633806':'#791F1F'}; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px; border:2px solid ${pct>=75?'#C0DD97':pct>=40?'#FAC775':'#F7C1C1'};">${pct}%</div></div></div>`;
        });
        html += `</div>`;
        c.innerHTML = html;
    }, 600);
}

function renderStudentResults() {
    var c = document.getElementById('student-results-area');
    if (!c) return;
    if(!currentUser) { c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-lock" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">Please Login to view your results.</div></div>`; return; }

    c.innerHTML = `<div class="spinner-container"><div class="spinner"></div><div>Fetching Results...</div></div>`;

    setTimeout(() => {
        var myHistory = [];
        tests.forEach(t => { if(t.submissions) { t.submissions.forEach((s, idx) => { if(s.uid === currentUser.uid || (s.name && currentUser.displayName && s.name.toLowerCase() === currentUser.displayName.toLowerCase())) { let canView = (t.resultVis === 'instant') || (t.released === true); myHistory.push({ testId: t.id, testTitle: t.title, testCode: t.code, name: s.name, roll: s.roll, score: s.score, totalMarks: s.totalMarks, time: s.time, canView: canView }); } }); } });

        if(myHistory.length === 0) { c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-file-off" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">No results found.</div></div>`; return; }

        var html = `<div style="display:flex; flex-direction:column; gap:12px;">`;
        myHistory.reverse().forEach(h => {
            
            // 🔥 NAYA FIX: onclick me se "nav('student');" hata diya hai
            var btnHtml = h.canView ? `<button class="btn btn-primary btn-sm" onclick="launchExistingResult('${h.testId}', '${h.name}', '${h.roll}')"><i class="ti ti-eye"></i> Review Paper</button>` : `<span class="badge b-amber" style="font-size:13px; padding:6px 12px"><i class="ti ti-lock"></i> Pending Release</span>`;
            
            html += `<div class="test-entry" style="align-items:center; padding:1.25rem 1.5rem;"><div class="te-meta"><div style="font-weight:600;font-size:16px;">${h.testTitle} <span class="badge b-gray" style="font-size:11px; margin-left:8px;">Code: ${h.testCode}</span></div><div style="font-size:13px;color:var(--color-text-secondary); margin-top:6px;">Submitted: ${h.time}</div><div style="font-size:14px; font-weight:600; color:#185FA5; margin-top:6px;">Score: ${h.score}/${h.totalMarks}</div></div><div>${btnHtml}</div></div>`;
        });
        html += `</div>`;
        c.innerHTML = html;
    }, 600);
}
// MOBILE KEYBOARD AUTO-SCROLL FIX
document.addEventListener('focusin', function(e) {
    // Check agar input type number/text par click hua hai
    if (e.target && e.target.tagName === 'INPUT') {
        setTimeout(function() {
            // Box ko smooth tarike se screen ke center me laao
            e.target.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        }, 300); // 300ms delay taaki keyboard poora upar aa jaye
    }
});

// ==========================================
// GEMINI AI - STATELESS PRACTICE ENGINE
// ==========================================

async function fetchAIQuestion() {
    const btn = document.getElementById('fetch-q-btn');
    const btnText = document.getElementById('btn-text');
    const qBox = document.getElementById('ai-question-box');
    const qText = document.getElementById('ai-q-text');
    const optsContainer = document.getElementById('ai-options-container');
    const solBox = document.getElementById('ai-solution-box');

    // 1. Dropdowns se values uthao
    const exam = document.getElementById('arena-exam').value;
    const subject = document.getElementById('arena-subject').value;
    const chapter = document.getElementById('arena-chapter').value || 'Mixed Concepts';

    // 2. Loading State on karo (Button disable, Spinner on)
    btn.disabled = true;
    btnText.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;margin:0;display:inline-block;vertical-align:middle;"></span> Generating...';
    
    // UI reset karo naye question ke liye
    qBox.style.display = 'block';
    qText.innerHTML = 'AI is crafting a unique question for you...';
    optsContainer.innerHTML = '';
    solBox.style.display = 'none';

    try {
        // 3. Vercel ke "Middleman" API ko call karo
        const res = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                examTarget: exam, 
                subject: subject, 
                chapter: chapter 
            })
        });

        if (!res.ok) throw new Error("API Route Error");

        const qData = await res.json();
        
        // Is question data ko browser ki memory (Global Window) me save kar lo taaki answer check ho sake
        window.currentAIQuestion = qData;

        // 4. Question aur Options ko screen par print karo
        qText.innerHTML = qData.question;
        
        optsContainer.innerHTML = qData.options.map((opt, idx) => `
            <button class="ai-opt-btn" onclick="checkAIAnswer(${idx}, this)">
                <span style="font-weight:bold; margin-right:8px; color:#185FA5;">${String.fromCharCode(65+idx)}.</span> ${opt}
            </button>
        `).join('');
        if (typeof renderMath === 'function') renderMath();

    } catch (err) {
        console.error(err);
        qText.innerHTML = `<span style="color:#A32D2D;"><i class="ti ti-wifi-off"></i> Failed to generate question. Please check your internet or API connection.</span>`;
    } finally {
        // 5. Loading State off karo
        btn.disabled = false;
        btnText.innerHTML = 'Generate Another Question';
    }
}

// Answer Check Karne ka Logic
window.checkAIAnswer = function(selectedIndex, btnElem) {
    const qData = window.currentAIQuestion;
    if (!qData) return;

    // Saare buttons ko click hone se block kar do (taaki ek hi baar answer de sake)
    const allBtns = document.querySelectorAll('.ai-opt-btn');
    allBtns.forEach(b => {
        b.classList.add('disabled'); 
        b.style.pointerEvents = 'none'; 
    });

    // Check karo user ka answer sahi hai ya nahi
    if (selectedIndex === qData.correct_index) {
        btnElem.classList.add('correct');
        btnElem.innerHTML += ' <span style="float:right;"><i class="ti ti-check"></i> Correct!</span>';
    } else {
        btnElem.classList.add('wrong');
        btnElem.innerHTML += ' <span style="float:right;"><i class="ti ti-x"></i> Wrong</span>';
        
        // Sahi answer wala option automatically highlight kar do
        allBtns[qData.correct_index].classList.add('correct');
    }

    // Solution ka dabba display kar do
    const solBox = document.getElementById('ai-solution-box');
    const solText = document.getElementById('ai-solution-text');
    
    solText.innerHTML = qData.solution;
    solBox.style.display = 'block';
    if (typeof renderMath === 'function') renderMath();
}