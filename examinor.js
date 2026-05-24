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
  if(!currentUser) { 
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
    id:Date.now(),code,title,creatorUid: currentUser.uid,
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
    submissions:[],released:false,
    createdAt:new Date().toLocaleDateString('en-IN')
  };
  
  tests.push(test); updateDatabase(); qList=[]; renderQs(); document.getElementById('t-title').value='';
  
  showModal(`<div style="text-align:center;padding:1rem">
    <div style="width:72px;height:72px;border-radius:50%;background:#EAF3DE;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem"><i class="ti ti-circle-check" style="font-size:40px;color:#3B6D11"></i></div>
    <div style="font-size:22px;font-weight:600;margin-bottom:0.5rem">Test Saved to Cloud!</div>
    <div style="font-size:15px;color:var(--color-text-secondary);margin-bottom:1.5rem">Students can now join using this code:</div>
    <div style="font-size:36px;font-weight:600;letter-spacing:10px;color:#185FA5;background:#E6F1FB;padding:1.5rem;border-radius:var(--border-radius-lg);margin-bottom:1rem; border:1px dashed #b9d7f4;">${code}</div>
    <button class="btn btn-sm btn-blue" style="margin-bottom:2rem; font-weight:600" onclick="copyToClip('${code}')"><i class="ti ti-copy"></i> Copy Code</button>
    <div style="display:flex;gap:12px;justify-content:center"><button class="btn btn-primary" onclick="hideModal();nav('tests')"><i class="ti ti-list-check"></i> View My Tests</button></div>
  </div>`);
}

function renderTestList(){
  var c = document.getElementById('test-list-area');
  if(!currentUser) { c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-lock" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">Please Login using Google to view your managed tests.</div></div>`; return; }
  var myTests = tests.filter(t => t.creatorUid === currentUser.uid);
  if(!myTests.length){ c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-clipboard-off" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">No tests created yet.</div></div>`; return; }
  
  c.innerHTML = myTests.map((t) => {
    var origIdx = tests.findIndex(x => x.id === t.id);
    return `
    <div class="test-entry">
      <div class="te-meta">
        <div style="font-weight:600;font-size:16px;color:var(--color-text-primary)">${t.title}</div>
        <div style="font-size:13px;color:var(--color-text-secondary)">${t.subject||'No Subject'} &bull; ${t.questions.length} Questions &bull; ${t.duration} Mins &bull; Created ${t.createdAt}</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <span class="badge b-blue" style="cursor:pointer" onclick="copyToClip('${t.code}')" title="Click to copy code"><i class="ti ti-hash" style="font-size:12px"></i> ${t.code}</span>
          <span class="badge b-green">${t.submissions ? t.submissions.length : 0} Submissions</span>
          ${t.resultVis==='manual' ? (t.released?'<span class="badge b-amber">Results Released</span>':'<span class="badge b-gray">Manual Evaluation Pending</span>') : '<span class="badge b-purple">Instant Results Active</span>'}
        </div>
      </div>
      <div class="te-actions">
        <div class="te-actions" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;">
        <button class="btn btn-sm" onclick="launchAsStudent(${origIdx})"><i class="ti ti-player-play"></i> Preview</button>      
        <button class="btn btn-sm btn-blue" onclick="viewSubmissions(${origIdx})"><i class="ti ti-users"></i> Submissions</button>
        ${!t.released && t.resultVis==='manual' ? `<button class="btn btn-sm btn-success" onclick="releaseRes(${origIdx})"><i class="ti ti-send"></i> Publish</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="delTest(${origIdx})" title="Delete Test"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function delTest(i){
  if(confirm('Are you sure you want to delete this test permanently from the database?')){
    tests.splice(i,1);
    updateDatabase();
  }
}

function releaseRes(i){
  tests[i].released=true;
  updateDatabase(); 
  showModal('<div style="text-align:center;padding:2rem"><i class="ti ti-send" style="font-size:42px;color:#3B6D11;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:20px;margin-bottom:1rem">Results Published Successfully!</div><p style="color:var(--color-text-secondary);margin-bottom:1.5rem">Students can now enter their details with the test code to view their checked papers.</p><button class="btn btn-primary" onclick="hideModal()">Done</button></div>');
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

function showResultPageAsExaminer(testIdx, sIdx) {
  var sub = tests[testIdx].submissions[sIdx];
  var t = tests[testIdx];
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-student').classList.add('active');
  document.getElementById('student-home').classList.add('hidden');
  document.getElementById('student-test').classList.add('hidden');
  
  _generateResultDOM(sub, t, true, testIdx, sIdx);
}

function saveEvaluation(tIdx, sIdx) {
    var sub = tests[tIdx].submissions[sIdx];
    var test = tests[tIdx];
    
    document.querySelectorAll('.eval-input').forEach(inp => {
        var qIdx = parseInt(inp.id.replace('mark_input_', ''));
        var awardedMarks = parseFloat(inp.value) || 0;
        
        if(sub.details[qIdx].q.type === 'subjective' || sub.details[qIdx].earned !== awardedMarks) {
            sub.details[qIdx].earned = awardedMarks;
            sub.details[qIdx].status = 'evaluated';
        }
    });
    
    var newTotal = 0, newCorrect = 0, newWrong = 0, newSkipped = 0;
    
    sub.details.forEach(d => {
        newTotal += (d.earned || 0);
        if (d.status === 'skipped') {
            newSkipped++;
        } else if (d.earned > 0) {
            newCorrect++;
        } else if (d.earned < 0) {
            newWrong++;
        } else {
            if (d.q.type === 'subjective') newSkipped++; 
            else newWrong++;
        }
    });
    
    sub.score = Number(newTotal.toFixed(2));
    sub.correct = newCorrect;
    sub.wrong = newWrong;
    sub.skipped = newSkipped;
    
    updateDatabase(); 
    _generateResultDOM(sub, test, true, tIdx, sIdx);
    
    showModal('<div style="text-align:center;padding:1.5rem"><i class="ti ti-check" style="font-size:48px;color:#3B6D11;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:22px;margin-bottom:0.5rem">Evaluation Overridden & Saved!</div><p style="color:var(--color-text-secondary);margin-bottom:1.5rem">Marks and student statistics have been successfully updated.</p><button class="btn btn-primary" onclick="hideModal(); nav(\'tests\')">Back to Tests</button></div>');
}

function renderAllResults(){
  var c = document.getElementById('results-area');
  if(!currentUser) {
      c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-lock" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">Please Login using Google to view results.</div></div>`;
      return;
  }

  var myTests = tests.filter(t => t.creatorUid === currentUser.uid);
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
  r.readAsText(f);
  inp.value = ''; 
}

function previewAsStudent(){
  if(!qList.length){alert('Add questions first to preview.');return;}
  var t={id:'prev',code:'DEMO',title:document.getElementById('t-title').value||'Preview Test',subject:'Preview',
    duration:+document.getElementById('t-dur').value||60,totalMarks:300,negMarking:+document.getElementById('t-neg').value||0,
    allowChange:document.getElementById('t-change').checked,showPalette:document.getElementById('t-palette').checked,
    allowNav:document.getElementById('t-nav').checked,questions:JSON.parse(JSON.stringify(qList)),
    submissions:[],resultVis:'instant',scoreVis:'show'};
  nav('student');
  launchTest(t,'Demo Student','');
}

// Pre-fill some demo questions for UIET & Engineering Context
addQ({id:1,type:'mcq',text:'A particle moves with constant acceleration. Its velocity changes from 20 m/s to 60 m/s in 4 seconds. What is the acceleration?',marks:4,options:['5 m/s²','10 m/s²','15 m/s²','20 m/s²'],correct:[1],explanation:'a = (v-u)/t = (60-20)/4 = 10 m/s²'});
addQ({id:2,type:'integer',text:'If log₂(x) = 5, find the value of x.',marks:4,correctInt:32,explanation:'2⁵ = 32'});
addQ({id:3,type:'msq',text:'Which of the following are fundamental forces of nature?',marks:4,options:['Gravitational force','Tension','Electromagnetic force','Strong nuclear force'],correct:[0,2,3],explanation:'Tension is a contact force, not fundamental. The four fundamental forces are gravity, electromagnetic, strong nuclear, and weak nuclear.'});
addQ({id:4,type:'subjective',text:"State and explain Newton's Third Law of Motion with a real-world example.",marks:10,modelAnswer:'Every action has an equal and opposite reaction. Example: when you push a wall, the wall pushes back with equal force.',explanation:'The forces are equal in magnitude and opposite in direction.'});