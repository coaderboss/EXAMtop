// ==========================================
// EXAMINER DASHBOARD & TEST CREATION LOGIC
// ==========================================

function addQ(data){
  var type = data ? data.type : document.getElementById('add-type').value;
  var q = data || {id:Date.now()+Math.random(), type, text:'', marks:4, options:['','','',''], correct:[], correctInt:null, explanation:''};
  if(!data) q.id = Date.now()+Math.random();
  qList.push(q);
  renderQs();
}

function renderQs(){
  document.getElementById('qcount-badge').textContent = qList.length+' added';
  document.getElementById('q-container').innerHTML = qList.map((q,i)=>`
    <div class="q-block">
      <div class="q-block-header">
        <div class="q-num-badge">${i+1}</div>
        <span class="badge ${tbadge(q.type)}">${tlabel(q.type)}</span>
        <div style="margin-left:auto;display:flex;gap:10px;align-items:center">
          <span style="font-size:13px;color:var(--color-text-secondary);font-weight:600">Marks</span>
          <input type="number" value="${q.marks}" min="0" style="width:70px;font-size:14px;text-align:center" onchange="qList[${i}].marks=+this.value">
          <button class="btn btn-sm btn-danger" onclick="rmQ(${i})"><i class="ti ti-trash"></i> Remove</button>
        </div>
      </div>
      <div style="margin-bottom:1rem">
        <label>Question Text</label>
        <textarea placeholder="Type your question here..." onchange="qList[${i}].text=this.value" class="input-block">${q.text || ''}</textarea>
        
        <div style="margin-top:10px; padding:10px; background:var(--color-background-secondary); border:1px dashed var(--color-border-secondary); border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <label style="font-size:13px; font-weight:500; color:var(--color-text-secondary); margin:0;">
                    <i class="ti ti-photo-plus"></i> Add/Change Image
                </label>
                ${q.imgUrl ? `<span style="font-size:12px; color:#3B6D11; font-weight:bold;"><i class="ti ti-check"></i> Uploaded</span>` : ''}
            </div>
            <input type="file" accept="image/*" style="font-size:13px; width:100%; margin-top:8px;" onchange="uploadQuestionImage(this, ${i})">
            ${q.imgUrl ? `<div style="margin-top:10px;"><img src="${q.imgUrl}" style="max-height:150px; border-radius:6px; border:1px solid var(--color-border-secondary);"></div>` : ''}
        </div>
    </div>
      ${renderQEdit(q,i)}
      <div style="margin-top:1rem"><label>Explanation (Shown in result)</label><input type="text" placeholder="Brief explanation or formula..." value="${q.explanation||''}" onchange="qList[${i}].explanation=this.value"></div>
    </div>`).join('');
}

function renderQEdit(q,i){
  if(q.type==='mcq'){
    return `<div style="margin-bottom:1rem"><label>Options &mdash; Select the correct one</label>
    ${q.options.map((o,j)=>`<div class="opt-row">
      <input type="radio" name="cr${q.id}" ${q.correct[0]===j?'checked':''} onchange="qList[${i}].correct=[${j}]" style="width:20px;height:20px;cursor:pointer;flex-shrink:0">
      <input type="text" placeholder="Option ${String.fromCharCode(65+j)}" value="${o}" onchange="qList[${i}].options[${j}]=this.value">
    </div>`).join('')}
    <button class="btn btn-sm btn-ghost" style="margin-top:8px" onclick="addOpt(${i})"><i class="ti ti-plus"></i> Add Option</button></div>`;
  }else if(q.type==='msq'){
    return `<div style="margin-bottom:1rem"><label>Options &mdash; Check all correct ones</label>
    ${q.options.map((o,j)=>`<div class="opt-row">
      <input type="checkbox" ${q.correct.includes(j)?'checked':''} onchange="togMSQ(${i},${j},this.checked)" style="width:20px;height:20px;cursor:pointer;flex-shrink:0">
      <input type="text" placeholder="Option ${String.fromCharCode(65+j)}" value="${o}" onchange="qList[${i}].options[${j}]=this.value">
    </div>`).join('')}
    <button class="btn btn-sm btn-ghost" style="margin-top:8px" onclick="addOpt(${i})"><i class="ti ti-plus"></i> Add Option</button></div>`;
  }else if(q.type==='integer'){
    return `<div style="margin-bottom:1rem"><label>Correct Integer Answer</label>
    <input type="number" placeholder="e.g. 42" value="${q.correctInt!==null?q.correctInt:''}" onchange="qList[${i}].correctInt=+this.value" style="max-width:200px"></div>`;
  }else{
    return `<div style="margin-bottom:1rem"><label>Model Answer (Examiner Reference)</label>
    <textarea placeholder="Write model answer to guide evaluation..." onchange="qList[${i}].modelAnswer=this.value">${q.modelAnswer||''}</textarea></div>`;
  }
}

function addOpt(qi){qList[qi].options.push('');renderQs();}
function rmQ(i){qList.splice(i,1);renderQs();}
function togMSQ(qi,j,v){if(v){qList[qi].correct.push(j)}else{qList[qi].correct=qList[qi].correct.filter(x=>x!==j)}}
function tlabel(t){return{mcq:'Single Correct',msq:'Multi Correct',integer:'Integer Type',subjective:'Subjective'}[t]||t}
function tbadge(t){return{mcq:'b-blue',msq:'b-green',integer:'b-amber',subjective:'b-purple'}[t]||'b-gray'}

function saveTest(){
  // NAYA: Clean Separation - Agar cloud par hai aur login nahi, tab roko. Offline hai toh chalne do.
  if(!isOfflineMode && !currentUser) { 
        showModal(`<div style="text-align:center;padding:1.5rem">
          <i class="ti ti-lock" style="font-size:46px;color:#A32D2D;display:block;margin-bottom:1rem"></i>
          <div style="font-weight:600;font-size:22px;margin-bottom:0.5rem">Login Required!</div>
          <p style="font-size:14px;color:var(--color-text-secondary);margin-bottom:1.5rem">You need to log in as an examiner to save this test securely to the cloud.</p>
          <div style="display:flex;gap:12px;justify-content:center">
              <button class="btn" style="background:var(--color-background-secondary); border:1px solid var(--color-border-secondary); color:var(--color-text-primary);" onclick="hideModal()">Cancel</button>
              <button class="btn btn-primary" onclick="hideModal(); toggleLogin()"><i class="ti ti-brand-google"></i> Login Now</button>
          </div>
        </div>`); 
        return; 
  }  
  
  var title=document.getElementById('t-title').value.trim();
  if(!title){ showToast('Please enter a test title.', 'error'); return;}
  if(!qList.length){ showToast('Add at least one question.', 'error'); return;}
  
  var totalMarksInput = +document.getElementById('t-total').value || 0;
  var calculatedSum = qList.reduce((sum, q) => sum + Number(q.marks), 0);
  
  if (calculatedSum !== totalMarksInput) {
      var confirmUpdate = confirm(`⚠️ MARKS MISMATCH DETECTED!\n\nYou entered Total Marks: ${totalMarksInput}\nBut the sum of your individual questions is: ${calculatedSum}\n\nDo you want to automatically update the Total Marks to ${calculatedSum} and save?`);
      if (confirmUpdate) {
          document.getElementById('t-total').value = calculatedSum;
          totalMarksInput = calculatedSum; 
          showToast('Total Marks automatically updated!', 'success');
      } else {
          showToast('Test saving cancelled. Please fix the marks.', 'error');
          return; 
      }
  }

  var code=Math.random().toString(36).substring(2,8).toUpperCase();
  var test={
    id:Date.now(),code,title,
    creatorUid: isOfflineMode ? 'offline_creator' : currentUser.uid,
    subject:document.getElementById('t-subject').value,
    duration:+document.getElementById('t-dur').value||60,
    totalMarks: totalMarksInput, 
    negMarking:+document.getElementById('t-neg').value||0,
    access:document.getElementById('t-access').value,
    resultVis:document.getElementById('t-resultvis').value,
    scoreVis:document.getElementById('t-scorevis').value,
    allowChange:document.getElementById('t-change').checked,
    showPalette:document.getElementById('t-palette').checked,
    allowNav:document.getElementById('t-nav').checked,
    randomOrder:document.getElementById('t-rand').checked,
    expiryDate: document.getElementById('t-expiry').value || null,
    shuffleOpts: document.getElementById('t-shuffle-opts').checked,
    antiCheat: document.getElementById('t-anticheat').checked,
    fullScreenMode: document.getElementById('t-fullscreen').checked,
    questions:JSON.parse(JSON.stringify(qList)),
    submissions:[],
    released:false,
    isActive: true, 
    createdAt:new Date().toLocaleDateString('en-IN')
  };
  
  tests.push(test); 
  updateDatabase(); // Ab auth.js wala updateDatabase smart ho gaya hai
  qList=[]; renderQs(); document.getElementById('t-title').value='';
  
  var modalMsg = isOfflineMode ? "Saved Locally!" : "Saved to Cloud!";
  var iconCol = isOfflineMode ? "#854F0B" : "#3B6D11";
  var bgCol = isOfflineMode ? "#FAEEDA" : "#EAF3DE";

  showModal(`<div style="text-align:center;padding:1rem">
    <div style="width:72px;height:72px;border-radius:50%;background:${bgCol};display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem"><i class="ti ti-circle-check" style="font-size:40px;color:${iconCol}"></i></div>
    <div style="font-size:22px;font-weight:600;margin-bottom:0.5rem">Test ${modalMsg}</div>
    <div style="font-size:15px;color:var(--color-text-secondary);margin-bottom:1.5rem">Students can now join using this code:</div>
    <div style="font-size:36px;font-weight:600;letter-spacing:10px;color:#185FA5;background:#E6F1FB;padding:1.5rem;border-radius:var(--border-radius-lg);margin-bottom:1rem; border:1px dashed #b9d7f4;">${code}</div>
    <button class="btn btn-sm btn-blue" style="margin-bottom:2rem; font-weight:600" onclick="copyToClip('${code}')"><i class="ti ti-copy"></i> Copy Code</button>
    <div style="display:flex;gap:12px;justify-content:center"><button class="btn btn-primary" onclick="hideModal();nav('tests')"><i class="ti ti-list-check"></i> Manage Tests</button></div>
  </div>`);
}

function renderTestList(){
  var c = document.getElementById('test-list-area');
  
  // NAYA: Clean separation for render logic
  if(!isOfflineMode && !currentUser) { 
      c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-lock" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">Please Login using Google to view your managed tests.</div></div>`; 
      return; 
  }
  
  var myTests = isOfflineMode ? tests : tests.filter(t => t.creatorUid === currentUser.uid);
  
  if(!myTests.length){ c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-clipboard-off" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">No tests created yet.</div></div>`; return; }
  
  c.innerHTML = myTests.map((t) => {
    var origIdx = tests.findIndex(x => x.id === t.id);
    
    var isTestActive = t.isActive !== false; 
    var statusColor = isTestActive ? '#3B6D11' : '#A32D2D';
    var statusBg = isTestActive ? '#EAF3DE' : '#FCEBEB';
    var statusIcon = isTestActive ? 'ti-door-enter' : 'ti-door-exit';
    var statusText = isTestActive ? 'Close Intake' : 'Open Intake';
    var statusBadge = isTestActive ? '<span class="badge b-green"><i class="ti ti-activity"></i> Accepting</span>' : '<span class="badge b-red"><i class="ti ti-lock"></i> Intake Closed</span>';

    return `
    <div class="test-entry" style="${!isTestActive ? 'opacity:0.85; border-left:4px solid #A32D2D;' : 'border-left:4px solid #3B6D11;'}">
      <div class="te-meta">
        <div style="font-weight:600;font-size:16px;color:var(--color-text-primary)">${t.title}</div>
        <div style="font-size:13px;color:var(--color-text-secondary)">${t.subject||'No Subject'} &bull; ${t.questions.length} Questions &bull; ${t.duration} Mins</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap; align-items:center;">
          <span class="badge b-blue" style="cursor:pointer" onclick="copyToClip('${t.code}')" title="Click to copy code"><i class="ti ti-hash" style="font-size:12px"></i> ${t.code}</span>
          <span class="badge b-gray">${t.submissions ? t.submissions.length : 0} Submissions</span>
          ${t.resultVis==='manual' ? (t.released?'<span class="badge b-amber">Results Released</span>':'<span class="badge b-gray">Evaluation Pending</span>') : '<span class="badge b-purple">Instant Results</span>'}
          ${statusBadge}
        </div>
      </div>
      <div class="te-actions">
        <div class="te-actions" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;">
        <button class="btn btn-sm" onclick="autoJoinLocalTest('${t.code}')"><i class="ti ti-player-play"></i> Self-Test</button>      
        <button class="btn btn-sm btn-blue" onclick="viewSubmissions(${origIdx})"><i class="ti ti-users"></i> Submissions</button>
        <button class="btn btn-sm" style="background:#FAEEDA; color:#854F0B; border-color:#FAC775;" onclick="openEditKeyModal(${origIdx})"><i class="ti ti-key"></i> Edit Key</button>
        
        <button class="btn btn-sm" style="background:${statusBg}; color:${statusColor}; border-color:${statusColor}; font-weight:600;" onclick="toggleTestStatus(${origIdx})">
            <i class="ti ${statusIcon}"></i> ${statusText}
        </button>

        ${!t.released && t.resultVis==='manual' ? `<button class="btn btn-sm btn-success" onclick="releaseRes(${origIdx})"><i class="ti ti-send"></i> Publish</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="delTest(${origIdx})" title="Delete Test"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

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
}

function delTest(i){
  if(confirm('Are you sure you want to delete this test permanently?')){
    tests.splice(i,1);
    updateDatabase();
  }
}

function releaseRes(i){
  tests[i].released=true;
  updateDatabase(); 
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
          <button class="btn btn-sm btn-primary" onclick="hideModal(); showResultPageAsExaminer(${testIdx}, sIdx)"><i class="ti ti-eye"></i> Evaluate</button>
      </div>`).join('') + `</div><div style="margin-top:1.5rem;text-align:right"><button class="btn" onclick="hideModal()">Close</button></div>`;
  showModal(html);
}

function showResultPageAsExaminer(testIdx, sIdx) {
  var sub = tests[testIdx].submissions[sIdx];
  var t = tests[testIdx];
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-student').classList.add('active');
  document.getElementById('student-home').classList.add('hidden');
  document.getElementById('student-test').classList.add('hidden');
  
  _generateResultDOM(sub, t, true, testIdx, sIdx);
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
            q.options.forEach((opt, j) => {
                let isChecked = q.correct.includes(j) ? 'checked' : '';
                html += `<label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;"><input type="radio" name="rekey_${i}" value="${j}" ${isChecked} class="rekey-input-${i}" style="width:16px;height:16px;"> Opt ${String.fromCharCode(65+j)}</label>`;
            });
            html += `</div>`;
        } else if (q.type === 'msq') {
            html += `<div style="display:flex; gap:12px; flex-wrap:wrap;">`;
            q.options.forEach((opt, j) => {
                let isChecked = q.correct.includes(j) ? 'checked' : '';
                html += `<label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;"><input type="checkbox" value="${j}" ${isChecked} class="rekey-input-${i}" style="width:16px;height:16px;"> Opt ${String.fromCharCode(65+j)}</label>`;
            });
            html += `</div>`;
        } else if (q.type === 'integer') {
            html += `<label style="font-size:13px; font-weight:500;">Correct Integer Key: <input type="number" value="${q.correctInt}" class="rekey-input-${i}" style="width:100px; padding:6px; font-size:14px; border:1px solid #cbd5e1; border-radius:4px; margin-left:8px;"></label>`;
        } else if (q.type === 'subjective') {
            html += `<div style="font-size:12px; color:#854F0B; font-weight:500;"><i class="ti ti-info-circle"></i> Subjective question (Requires manual evaluation. Key update will not affect auto-scores).</div>`;
        }
        
        html += `</div>`;
    });

    html += `</div>
        <div style="display:flex; gap:10px;">
            <button class="btn" style="flex:1; padding:12px; font-weight:600;" onclick="hideModal()">Cancel</button>
            <button class="btn btn-primary" style="flex:2; background:#854F0B; border-color:#854F0B; padding:12px; font-weight:600;" onclick="saveNewKeyAndReevaluate(${idx})"><i class="ti ti-refresh"></i> Update & Auto-Grade All</button>
        </div>
    </div>`;
    
    showModal(html);
}

function saveNewKeyAndReevaluate(idx) {
    var t = tests[idx];
    t.questions.forEach((q, i) => {
        if (q.type === 'mcq') {
            let selected = document.querySelector(`.rekey-input-${i}:checked`);
            if(selected) q.correct = [parseInt(selected.value)];
        } else if (q.type === 'msq') {
            let selected = document.querySelectorAll(`.rekey-input-${i}:checked`);
            q.correct = Array.from(selected).map(cb => parseInt(cb.value));
        } else if (q.type === 'integer') {
            let input = document.querySelector(`.rekey-input-${i}`);
            if(input && input.value !== '') q.correctInt = parseFloat(input.value);
        }
    });

    if (t.submissions && t.submissions.length > 0) {
        var neg = t.negMarking || 0;
        t.submissions.forEach(sub => {
            let newScore = 0, newCorrect = 0, newWrong = 0, newSkipped = 0;
            sub.details.forEach((d, i) => {
                let q = t.questions[i]; 
                d.q = q; 
                let ans = d.ans;
                let hasVal = ans.val !== null && (!Array.isArray(ans.val) || ans.val.length > 0);
                
                if (!hasVal) {
                    if(d.status === 'evaluated') { newScore += (d.earned || 0); newSkipped++; } 
                    else { d.status = 'skipped'; d.earned = 0; newSkipped++; }
                } else if (q.type === 'mcq') {
                    if (ans.val === q.correct[0]) { newCorrect++; d.earned = q.marks; newScore += q.marks; d.status = 'correct'; }
                    else { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; }
                } else if (q.type === 'msq') {
                    var userSel = Array.isArray(ans.val) ? ans.val : [];
                    var corrSel = q.correct;
                    var hasWrongOption = userSel.some(x => !corrSel.includes(x));
                    var correctlySelected = userSel.filter(x => corrSel.includes(x)).length;
                    
                    if (hasWrongOption) { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; } 
                    else if (correctlySelected === corrSel.length) { newCorrect++; d.earned = q.marks; newScore += q.marks; d.status = 'correct'; } 
                    else if (correctlySelected > 0) { var partialMarks = (q.marks / corrSel.length) * correctlySelected; d.earned = Math.round(partialMarks * 100) / 100; newScore += d.earned; newCorrect++; d.status = 'partial'; } 
                    else { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; }
                } else if (q.type === 'integer') {
                    if (ans.val === q.correctInt) { newCorrect++; d.earned = q.marks; newScore += q.marks; d.status = 'correct'; }
                    else { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; }
                } else {
                    if(d.status === 'evaluated') { newScore += (d.earned || 0); if(d.earned > 0) newCorrect++; else newSkipped++; } 
                    else { d.status = 'submitted'; d.earned = 0; newSkipped++; }
                }
            });
            sub.score = Number(newScore.toFixed(2)); sub.correct = newCorrect; sub.wrong = newWrong; sub.skipped = newSkipped;
        });
    }

    updateDatabase();
    hideModal();
    showToast(`Answer Key Updated! Successfully re-graded ${t.submissions ? t.submissions.length : 0} student(s).`, 'success');
    renderTestList();
}

function saveEvaluation(tIdx, sIdx) {
    var sub = tests[tIdx].submissions[sIdx];
    var test = tests[tIdx];
    var overrides = []; 
    var hasError = false;
    var inputs = document.querySelectorAll('.eval-input');
    
    for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        var qIdx = parseInt(inp.id.replace('mark_input_', ''));
        var awardedMarks = parseFloat(inp.value) || 0;
        var maxMarks = Number(sub.details[qIdx].q.marks); 
        
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

    var { tIdx, sIdx, overrides } = window.tempEvalData;
    var sub = tests[tIdx].submissions[sIdx];
    var test = tests[tIdx];

    overrides.forEach(ov => {
        sub.details[ov.qIdx].earned = ov.awarded;
        sub.details[ov.qIdx].status = 'evaluated';
        if(!sub.details[ov.qIdx].auditLogs) sub.details[ov.qIdx].auditLogs = [];
        sub.details[ov.qIdx].auditLogs.push({ date: new Date().toLocaleString('en-IN'), examiner: currentUser ? (currentUser.displayName || currentUser.email || 'Examiner') : 'Examiner', reason: reason, awarded: ov.awarded });
    });

    var newTotal = 0, newCorrect = 0, newWrong = 0, newSkipped = 0;
    sub.details.forEach(d => {
        newTotal += (d.earned || 0);
        if (d.status === 'skipped') newSkipped++;
        else if (d.earned > 0) newCorrect++;
        else if (d.earned < 0) newWrong++;
        else { if (d.q.type === 'subjective') newSkipped++; else newWrong++; }
    });

    sub.score = Number(newTotal.toFixed(2)); sub.correct = newCorrect; sub.wrong = newWrong; sub.skipped = newSkipped;
    updateDatabase(); hideModal(); _generateResultDOM(sub, test, true, tIdx, sIdx); showToast('Marks Saved! Audit log securely recorded.', 'success'); window.tempEvalData = null; 
}

function renderAllResults(){
  var c = document.getElementById('results-area');
  // NAYA: Offline Mode Support
  if(!isOfflineMode && !currentUser) {
      c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-lock" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">Please Login using Google to view results.</div></div>`;
      return;
  }

  var myTests = isOfflineMode ? tests : tests.filter(t => t.creatorUid === currentUser.uid);
  var all = myTests.flatMap(t => t.submissions ? t.submissions.map(s => ({...s, testTitle: t.title, testCode: t.code})) : []);
  
  if(!all.length){
      c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-chart-off" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">No results available yet. Complete a test to see data here.</div></div>`;
      return;
  }
  
  c.innerHTML = all.map(s => `
    <div class="test-entry">
      <div class="te-meta">
        <div style="font-weight:600;font-size:16px">${s.name} ${s.roll?'<span style="font-weight:400;color:var(--color-text-secondary)">· '+s.roll+'</span>':''}</div>
        <div style="font-size:13px;color:var(--color-text-secondary)">${s.testTitle} &bull; ${s.time}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="badge b-blue" style="font-size:13px">Score: ${s.score}</span>
        <span class="badge b-green">${s.correct} Correct</span>
        <span class="badge b-red">${s.wrong} Wrong</span>
        <span class="badge b-gray">${s.skipped} Skipped</span>
      </div>
    </div>`).join('');
}

function dlTemplate(){
  var t=JSON.stringify([
    {type:'mcq',text:'What is the capital of France?',marks:4,options:['London','Berlin','Paris','Madrid'],correct:[2],explanation:'Paris is the capital of France.'},
    {type:'integer',text:'Calculate 15 * 4.',marks:4,correctInt:60,explanation:'Basic multiplication.'},
    {type:'msq',text:'Which of these are programming languages?',marks:4,options:['Python','HTML','Java','JPEG'],correct:[0,2],explanation:'Python and Java are programming languages. HTML is markup, JPEG is image format.'},
    {type:'subjective',text:"Explain the process of photosynthesis.",marks:10,modelAnswer:'Process by which plants use sunlight, water, and carbon dioxide to create oxygen and energy in the form of sugar.'}
  ],null,2);
  var b=new Blob([t],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download='examitop_template.json';a.click();
}

function importQ(inp){
  var f=inp.files[0];if(!f)return;
  var r=new FileReader();
  r.onload=e=>{
    try{
      var data=JSON.parse(e.target.result);
      if(!Array.isArray(data)){alert('Must be a JSON array.');return;}
      data.forEach(d=>addQ({id:Date.now()+Math.random(),type:d.type||'mcq',text:d.text||'',marks:d.marks||4,
        options:d.options||['','','',''],correct:d.correct||[],correctInt:d.correctInt||null,
        modelAnswer:d.modelAnswer||'',explanation:d.explanation||''}));
      showModal(`<div style="text-align:center;padding:1.5rem"><i class="ti ti-check" style="font-size:42px;color:#3B6D11;display:block;margin-bottom:1rem"></i><div style="font-size:20px;font-weight:600;margin-bottom:0.5rem">Import Successful!</div><div style="font-size:15px;color:var(--color-text-secondary);margin-bottom:1.5rem">${data.length} questions have been added to your test.</div><button class="btn btn-primary" onclick="hideModal()">Awesome</button></div>`);
    }catch(ex){alert('Invalid JSON file. Please ensure it follows the correct structure.');}
  };
  r.readAsText(f); inp.value = ''; 
}

function previewAsStudent(){
  if(!qList.length){alert('Add questions first to preview.');return;}
  var t={id:'prev',code:'DEMO',title:document.getElementById('t-title').value||'Preview Test',subject:'Preview',
    duration:+document.getElementById('t-dur').value||60,totalMarks:300,negMarking:+document.getElementById('t-neg').value||0,
    allowChange:document.getElementById('t-change').checked,showPalette:document.getElementById('t-palette').checked,
    allowNav:document.getElementById('t-nav').checked,questions:JSON.parse(JSON.stringify(qList)),
    submissions:[],resultVis:'instant',scoreVis:'show'};
  nav('student'); launchTest(t,'Demo Student','');
}

addQ({id:1,type:'mcq',text:'A particle moves with constant acceleration. Its velocity changes from 20 m/s to 60 m/s in 4 seconds. What is the acceleration?',marks:4,options:['5 m/s²','10 m/s²','15 m/s²','20 m/s²'],correct:[1],explanation:'a = (v-u)/t = (60-20)/4 = 10 m/s²'});
addQ({id:2,type:'integer',text:'If log₂(x) = 5, find the value of x.',marks:4,correctInt:32,explanation:'2⁵ = 32'});
addQ({id:3,type:'msq',text:'Which of the following are fundamental forces of nature?',marks:4,options:['Gravitational force','Tension','Electromagnetic force','Strong nuclear force'],correct:[0,2,3],explanation:'Tension is a contact force, not fundamental. The four fundamental forces are gravity, electromagnetic, strong nuclear, and weak nuclear.'});
addQ({id:4,type:'subjective',text:"State and explain Newton's Third Law of Motion with a real-world example.",marks:10,modelAnswer:'Every action has an equal and opposite reaction. Example: when you push a wall, the wall pushes back with equal force.',explanation:'The forces are equal in magnitude and opposite in direction.'});