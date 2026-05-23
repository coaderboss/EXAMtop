const firebaseConfig = {
  apiKey: "AIzaSyCHW5XDpS16BRH2XgsNJ5YbkIPnyl4i7MI",
  authDomain: "examtop-e3263.firebaseapp.com",
  databaseURL: "https://examtop-e3263-default-rtdb.firebaseio.com",
  projectId: "examtop-e3263",
  storageBucket: "examtop-e3263.firebasestorage.app",
  messagingSenderId: "758815189008",
  appId: "1:758815189008:web:6acc172966158abdd64295",
  measurementId: "G-G3NRG0VXTV"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- YE CODE DATABASE SE DATA REALTIME ME LAYEGA ---
db.ref('tests').on('value', (snapshot) => {
  var data = snapshot.val();
  
  // FIREBASE FIX: Agar Firebase array ko object bana de, toh usey wapas array me badalna
  if (!data) {
      tests = [];
  } else if (Array.isArray(data)) {
      tests = data;
  } else {
      tests = Object.values(data).filter(item => item !== null);
  }
  
  // Submissions array ko bhi secure karna taaki test start karne me dikkat na aaye
  tests.forEach(t => {
      if (t.submissions && !Array.isArray(t.submissions)) {
          t.submissions = Object.values(t.submissions).filter(item => item !== null);
      } else if (!t.submissions) {
          t.submissions = [];
      }
  });

  // UI Update karo agar user Tests ya Results page par hai
  if(document.getElementById('page-tests').classList.contains('active')) renderTestList();
  if(document.getElementById('page-results').classList.contains('active')) renderAllResults();
});

function updateDatabase() {
    db.ref('tests').set(tests).catch(error => {
        alert("Error saving data to cloud: " + error.message);
    });
}

var tests=[], qList=[], activeTest=null, activeState=null, timerIv=null;

function nav(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  ['create','tests','student','results'].forEach((n,i)=>{document.querySelectorAll('.nav-tab')[i].classList[n===id?'add':'remove']('active')});
  if(id==='tests') renderTestList();
  if(id==='results') renderAllResults();
  if(id==='student'){
    document.getElementById('student-home').classList.remove('hidden');
    document.getElementById('student-test').classList.add('hidden');
    document.getElementById('student-result').classList.add('hidden');
  }
}

function addQ(data){
  var type=data?data.type:document.getElementById('add-type').value;
  var q=data||{id:Date.now()+Math.random(),type,text:'',marks:4,options:['','','',''],correct:[],correctInt:null,explanation:''};
  if(!data)q.id=Date.now()+Math.random();
  qList.push(q);
  renderQs();
}

function renderQs(){
  document.getElementById('qcount-badge').textContent=qList.length+' added';
  document.getElementById('q-container').innerHTML=qList.map((q,i)=>`
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
        <textarea placeholder="Type your question here..." onchange="qList[${i}].text=this.value">${q.text}</textarea>
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
  var title=document.getElementById('t-title').value.trim();
  if(!title){showModal('<div style="text-align:center;padding:1rem"><i class="ti ti-alert-circle" style="font-size:42px;color:#A32D2D;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:18px;margin-bottom:1rem">Please enter a test title.</div><button class="btn btn-primary" onclick="hideModal()">OK</button></div>');return;}
  if(!qList.length){showModal('<div style="text-align:center;padding:1rem"><i class="ti ti-alert-circle" style="font-size:42px;color:#A32D2D;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:18px;margin-bottom:1rem">Add at least one question.</div><button class="btn btn-primary" onclick="hideModal()">OK</button></div>');return;}
  var code=Math.random().toString(36).substring(2,8).toUpperCase();
  var test={
    id:Date.now(),code,title,
    subject:document.getElementById('t-subject').value,
    duration:+document.getElementById('t-dur').value||60,
    totalMarks:+document.getElementById('t-total').value||100,
    negMarking:+document.getElementById('t-neg').value||0,
    access:document.getElementById('t-access').value,
    resultVis:document.getElementById('t-resultvis').value,
    scoreVis:document.getElementById('t-scorevis').value,
    allowChange:document.getElementById('t-change').checked,
    showPalette:document.getElementById('t-palette').checked,
    allowNav:document.getElementById('t-nav').checked,
    randomOrder:document.getElementById('t-rand').checked,
    questions:JSON.parse(JSON.stringify(qList)),
    submissions:[],released:false,
    createdAt:new Date().toLocaleDateString('en-IN')
  };
  
  tests.push(test);
  updateDatabase(); // NAYI LINE: Cloud me save kar dega
  
  qList=[];renderQs();
  document.getElementById('t-title').value='';
  showModal(`<div style="text-align:center;padding:1rem">
    <div style="width:72px;height:72px;border-radius:50%;background:#EAF3DE;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem"><i class="ti ti-circle-check" style="font-size:40px;color:#3B6D11"></i></div>
    <div style="font-size:22px;font-weight:600;margin-bottom:0.5rem">Test Saved to Cloud!</div>
    <div style="font-size:15px;color:var(--color-text-secondary);margin-bottom:1.5rem">Students can now join using this code from any device:</div>
    <div style="font-size:36px;font-weight:600;letter-spacing:10px;color:#185FA5;background:#E6F1FB;padding:1.5rem;border-radius:var(--border-radius-lg);margin-bottom:2rem; border:1px dashed #b9d7f4;">${code}</div>
    <div style="display:flex;gap:12px;justify-content:center">
      <button class="btn btn-primary" onclick="hideModal();nav('tests')"><i class="ti ti-list-check"></i> View My Tests</button>
      <button class="btn" onclick="hideModal()">Create Another</button>
    </div>
  </div>`);
}

function renderTestList(){
  var c=document.getElementById('test-list-area');
  if(!tests.length){c.innerHTML=`<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-clipboard-off" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">No tests created yet. Go to the Create tab to make one.</div></div>`;return;}
  c.innerHTML=tests.map((t,i)=>`
    <div class="test-entry">
      <div class="te-meta">
        <div style="font-weight:600;font-size:16px;color:var(--color-text-primary)">${t.title}</div>
        <div style="font-size:13px;color:var(--color-text-secondary)">${t.subject||'No Subject'} &bull; ${t.questions.length} Questions &bull; ${t.duration} Mins &bull; Created ${t.createdAt}</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <span class="badge b-blue"><i class="ti ti-hash" style="font-size:12px"></i> ${t.code}</span>
          <span class="badge b-green">${t.submissions.length} Submissions</span>
          ${t.resultVis==='manual' ? (t.released?'<span class="badge b-amber">Results Released</span>':'<span class="badge b-gray">Manual Evaluation Pending</span>') : '<span class="badge b-purple">Instant Results Active</span>'}
        </div>
      </div>
      <div class="te-actions">
        <button class="btn btn-sm" onclick="launchAsStudent(${i})"><i class="ti ti-player-play"></i> Preview</button>
        <button class="btn btn-sm btn-blue" onclick="viewSubmissions(${i})"><i class="ti ti-users"></i> Submissions</button>
        ${!t.released&&t.resultVis==='manual'?`<button class="btn btn-sm btn-success" onclick="releaseRes(${i})"><i class="ti ti-send"></i> Publish Results</button>`:''}
        <button class="btn btn-sm btn-danger" onclick="delTest(${i})" title="Delete Test"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join('');
}

function delTest(i){
  if(confirm('Are you sure you want to delete this test permanently from the database?')){
    tests.splice(i,1);
    updateDatabase(); // NAYI LINE
  }
}

function releaseRes(i){
  tests[i].released=true;
  updateDatabase(); // NAYI LINE
  showModal('<div style="text-align:center;padding:2rem"><i class="ti ti-send" style="font-size:42px;color:#3B6D11;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:20px;margin-bottom:1rem">Results Published Successfully!</div><p style="color:var(--color-text-secondary);margin-bottom:1.5rem">Students can now enter their details with the test code to view their checked papers.</p><button class="btn btn-primary" onclick="hideModal()">Done</button></div>');
}

function viewSubmissions(testIdx) {
  var t = tests[testIdx];
  if(t.submissions.length === 0) {
      showModal('<div style="text-align:center;padding:2rem"><i class="ti ti-users" style="font-size:42px;color:var(--color-text-secondary);display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:18px">No Submissions Yet.</div></div>');
      return;
  }
  var html = `<div style="margin-bottom:1.5rem"><h3 style="font-size:20px;font-weight:600">${t.title}</h3><p style="font-size:13px;color:var(--color-text-secondary)">Student Submissions</p></div>`;
  html += `<div style="max-height:60vh;overflow-y:auto;padding-right:8px">` + t.submissions.map((s, sIdx) => `
      <div style="display:flex;justify-content:space-between;padding:12px;border:1px solid var(--color-border-secondary);border-radius:var(--border-radius-md);margin-bottom:8px;align-items:center;background:var(--color-background-tertiary)">
          <div>
            <div style="font-weight:600">${s.name}</div>
            <div style="font-size:12px;color:var(--color-text-secondary)">Roll: ${s.roll||'N/A'} &bull; Score: ${s.score}</div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="hideModal(); showResultPageAsExaminer(${testIdx}, ${sIdx})"><i class="ti ti-eye"></i> Evaluate</button>
      </div>
  `).join('') + `</div>`;
  html += `<div style="margin-top:1.5rem;text-align:right"><button class="btn" onclick="hideModal()">Close</button></div>`;
  showModal(html);
}

function showResultPageAsExaminer(testIdx, sIdx) {
  var sub = tests[testIdx].submissions[sIdx];
  var t = tests[testIdx];
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-student').classList.add('active');
  document.getElementById('student-home').classList.add('hidden');
  document.getElementById('student-test').classList.add('hidden');
  
  // Naya: Hum index bhi bhej rahe hain taaki aage save kar sakein
  _generateResultDOM(sub, t, true, testIdx, sIdx);
}

function saveEvaluation(tIdx, sIdx) {
    var sub = tests[tIdx].submissions[sIdx];
    var test = tests[tIdx];
    
    // Har ek override input ko check karna
    document.querySelectorAll('.eval-input').forEach(inp => {
        var qIdx = parseInt(inp.id.replace('mark_input_', ''));
        var awardedMarks = parseFloat(inp.value) || 0;
        
        // Agar teacher ne marks change kiye hain ya question subjective hai
        if(sub.details[qIdx].q.type === 'subjective' || sub.details[qIdx].earned !== awardedMarks) {
            sub.details[qIdx].earned = awardedMarks;
            sub.details[qIdx].status = 'evaluated'; // Ye label ko 'Evaluated manually' kar dega
        }
    });
    
    // Naya score aur Stats (Correct/Wrong/Skipped) recalculate karna
    var newTotal = 0, newCorrect = 0, newWrong = 0, newSkipped = 0;
    
    sub.details.forEach(d => {
        newTotal += (d.earned || 0);
        
        // Stats update logic taaki UI charts break na hon
        if (d.status === 'skipped') {
            newSkipped++;
        } else if (d.earned > 0) {
            newCorrect++;
        } else if (d.earned < 0) {
            newWrong++;
        } else {
            // Agar marks 0 diye gaye hain (aur skip nahi kiya tha)
            if (d.q.type === 'subjective') newSkipped++; 
            else newWrong++;
        }
    });
    
    sub.score = Math.max(0, newTotal);
    sub.correct = newCorrect;
    sub.wrong = newWrong;
    sub.skipped = newSkipped;
    
    updateDatabase(); // NAYI LINE: Evaluation save karega
    _generateResultDOM(sub, test, true, tIdx, sIdx);
    
    showModal('<div style="text-align:center;padding:1.5rem"><i class="ti ti-check" style="font-size:48px;color:#3B6D11;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:22px;margin-bottom:0.5rem">Evaluation Overridden & Saved!</div><p style="color:var(--color-text-secondary);margin-bottom:1.5rem">Marks and student statistics have been successfully updated.</p><button class="btn btn-primary" onclick="hideModal(); nav(\'tests\')">Back to Tests</button></div>');
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

function joinTest(){
  var name=document.getElementById('s-name').value.trim();
  var code=document.getElementById('s-code').value.trim().toUpperCase();
  var roll=document.getElementById('s-roll').value.trim();
  if(!name){alert('Please enter your full name.');return;}
  if(!code){alert('Please enter the test code.');return;}
  
  var t=tests.find(x=>x.code===code);
  if(!t){showModal('<div style="text-align:center;padding:1.5rem"><i class="ti ti-alert-triangle" style="font-size:42px;color:#A32D2D;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:20px">Invalid Test Code.</div><div style="font-size:14px;color:var(--color-text-secondary);margin-top:0.5rem;margin-bottom:1.5rem">Please check the code with your examiner and try again.</div><button class="btn btn-primary" onclick="hideModal()">OK</button></div>');return;}
  
  // Check if student already submitted
  var existingSub = t.submissions.find(s => s.name.toLowerCase() === name.toLowerCase() && s.roll === roll);
  if(existingSub) {
      if(t.resultVis === 'instant' || t.released) {
          showModal(`<div style="text-align:center;padding:1.5rem"><i class="ti ti-info-circle" style="font-size:42px;color:#185FA5;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:18px;margin-bottom:1rem">You have already submitted this test.</div><p style="margin-bottom:1.5rem">Opening your evaluated paper.</p><button class="btn btn-primary" onclick="hideModal(); launchExistingResult('${t.id}', '${name}', '${roll}')">View Results</button></div>`);
      } else {
          showModal(`<div style="text-align:center;padding:1.5rem"><i class="ti ti-clock" style="font-size:42px;color:#854F0B;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:18px;margin-bottom:1rem">Submission Received</div><p style="margin-bottom:1.5rem">You have successfully submitted this test. The examiner has not yet released the results. Please check back later.</p><button class="btn btn-primary" onclick="hideModal()">Understood</button></div>`);
      }
      return;
  }
  
  launchTest(t,name,roll);
}

function launchExistingResult(testId, name, roll) {
    var t = tests.find(x => x.id == testId);
    var sub = t.submissions.find(s => s.name.toLowerCase() === name.toLowerCase() && s.roll === roll);
    document.getElementById('student-home').classList.add('hidden');
    document.getElementById('student-test').classList.add('hidden');
    _generateResultDOM(sub, t, false);
}

function launchAsStudent(i){nav('student');launchTest(tests[i],'Demo Student','');}

function launchTest(test,name,roll){
  document.getElementById('student-home').classList.add('hidden');
  document.getElementById('student-result').classList.add('hidden');
  activeTest=test;
  activeState={name,roll,answers:Array(test.questions.length).fill(0).map(()=>({val:null,marked:false})),cur:0,start:Date.now(),done:false};
  renderTest();
  if(timerIv)clearInterval(timerIv);
  var secs=test.duration*60;
  timerIv=setInterval(()=>{
    secs--;
    var el=document.getElementById('timerEl');
    if(el){
      var h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60;
      el.textContent=(h?h+':':'')+(String(m).padStart(2,'0'))+':'+(String(s).padStart(2,'0'));
      if(secs<=300)el.closest('.timer-pill').classList.add('timer-warn');
    }
    if(secs<=0){clearInterval(timerIv);doSubmit();}
  },1000);
}

function renderTest(){
  var t=activeTest,st=activeState,qi=st.cur,q=t.questions[qi],ans=st.answers[qi];
  var answered=st.answers.filter(a=>a.val!==null&&(!Array.isArray(a.val)||a.val.length>0)).length;
  var locked=!t.allowChange&&ans.val!==null&&(!Array.isArray(ans.val)||ans.val.length>0);
  var el=document.getElementById('student-test');
  el.classList.remove('hidden');
  el.innerHTML=`
    <div class="test-topbar">
      <div>
        <div style="font-size:18px;font-weight:600;margin-bottom:2px">${t.title}</div>
        <div style="font-size:13px;opacity:0.85">${st.name}${st.roll?' · '+st.roll:''} &nbsp;&bull;&nbsp; Question ${qi+1} of ${t.questions.length}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="timer-pill"><i class="ti ti-clock" style="font-size:18px"></i><span id="timerEl">--:--</span></div>
        <button class="btn btn-sm" style="background:rgba(255,255,255,0.2);border:none;color:#fff;font-weight:600" onclick="confirmSubmit()"><i class="ti ti-send"></i> Finish Test</button>
      </div>
    </div>

    <div class="test-layout">
      <div class="q-area">
        <div class="q-block-header" style="margin-bottom:1.5rem; border-bottom:1px solid var(--color-border-secondary); padding-bottom:1rem;">
          <div class="q-num-badge" style="width:36px;height:36px;font-size:16px;">${qi+1}</div>
          <span class="badge ${tbadge(q.type)}">${tlabel(q.type)}</span>
          <span class="badge b-blue" style="font-size:13px">${q.marks} Marks</span>
          ${ans.marked?'<span class="badge b-amber"><i class="ti ti-bookmark" style="font-size:12px"></i> Marked for Review</span>':''}
          ${locked?'<span class="badge b-red"><i class="ti ti-lock" style="font-size:12px"></i> Locked</span>':''}
        </div>
        <div style="font-size:16px;line-height:1.7;margin-bottom:2rem;color:var(--color-text-primary);font-weight:500;">${q.text||'<em style="color:var(--color-text-secondary)">No question text set.</em>'}</div>
        ${renderStudentOpts(q,qi,ans,locked)}
        
        <div style="display:flex;gap:10px;margin-top:1.5rem;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="togMark(${qi})" style="${ans.marked?'color:#633806;border-color:#FAC775;background:#FAEEDA;font-weight:600':''}">
            <i class="ti ti-bookmark"></i> ${ans.marked?'Unmark':'Mark for Review'}
          </button>
          ${!locked&&ans.val!==null?`<button class="btn btn-sm btn-danger" onclick="clearAns(${qi})"><i class="ti ti-eraser"></i> Clear Selection</button>`:''}
        </div>
        
        <div class="q-nav-row">
          <button class="btn" onclick="goQ(${qi-1})" ${qi===0||!t.allowNav?'disabled':''}>
            <i class="ti ti-arrow-left"></i> Previous
          </button>
          ${qi<t.questions.length-1?`<button class="btn btn-primary" onclick="goQ(${qi+1})" ${!t.allowNav&&qi<t.questions.length-1?'':''}>Save & Next <i class="ti ti-arrow-right"></i></button>`:`<button class="btn btn-success" style="font-weight:600" onclick="confirmSubmit()"><i class="ti ti-check"></i> Submit Final Test</button>`}
        </div>
      </div>

      ${t.showPalette?`<div class="sidebar-panel">
        <div style="font-size:15px;font-weight:600;margin-bottom:1rem;color:var(--color-text-primary)">Question Palette</div>
        <div class="legend-row">
          <div class="leg"><div class="leg-dot" style="background:var(--color-background-primary);border:1px solid var(--color-border-primary)"></div>Not Visited / Unanswered</div>
          <div class="leg"><div class="leg-dot" style="background:#185FA5"></div>Answered</div>
          <div class="leg"><div class="leg-dot" style="background:#FAC775"></div>Marked for Review</div>
          <div class="leg"><div class="leg-dot" style="background:#CECBF6; border:1px solid #3C3489"></div>Answered & Marked</div>
        </div>
        <div class="palette-grid">
          ${t.questions.map((qq,i)=>{
            var a=st.answers[i];
            var done=a.val!==null&&(!Array.isArray(a.val)||a.val.length>0);
            var cls=a.marked&&done?'p-both':a.marked?'p-marked':done?'p-answered':'p-unanswered';
            return `<button class="pal-btn ${cls}${i===qi?' p-current':''}" onclick="goQ(${i})">${i+1}</button>`;
          }).join('')}
        </div>
        <div class="divider"></div>
        <div style="font-size:13px;color:var(--color-text-secondary);line-height:2">
          Answered: <strong style="color:var(--color-text-primary);font-size:14px">${answered}</strong> / ${t.questions.length}<br>
          Marked: <strong style="color:var(--color-text-primary);font-size:14px">${st.answers.filter(a=>a.marked).length}</strong><br>
          Remaining: <strong style="color:var(--color-text-primary);font-size:14px">${t.questions.length-answered}</strong>
        </div>
        <div class="divider"></div>
        <button class="btn btn-primary" style="width:100%;justify-content:center;font-weight:600" onclick="confirmSubmit()">
          <i class="ti ti-send"></i> Submit Test
        </button>
      </div>`:''}
    </div>`;
}

function renderStudentOpts(q,qi,ans,locked){
  if(q.type==='mcq'){
    return q.options.map((o,j)=>`<button class="opt-btn${ans.val===j?' sel':''}" onclick="${locked?'':`pickMCQ(${qi},${j})`}">
      <div class="olabel">${ans.val===j?'<i class="ti ti-check" style="font-size:14px"></i>':String.fromCharCode(65+j)}</div>
      <span style="font-size:15px">${o||'Option '+String.fromCharCode(65+j)}</span>
    </button>`).join('');
  }else if(q.type==='msq'){
    var arr=Array.isArray(ans.val)?ans.val:[];
    return q.options.map((o,j)=>`<button class="opt-btn${arr.includes(j)?' sel':''}" onclick="${locked?'':`pickMSQ(${qi},${j})`}">
      <div class="olabel" style="border-radius:4px">${arr.includes(j)?'<i class="ti ti-check" style="font-size:14px"></i>':String.fromCharCode(65+j)}</div>
      <span style="font-size:15px">${o||'Option '+String.fromCharCode(65+j)}</span>
    </button>`).join('');
  }else if(q.type==='integer'){
    return `<div style="margin-bottom:1rem"><label style="font-size:15px">Enter your integer answer below:</label>
    <input type="number" value="${ans.val!==null?ans.val:''}" ${locked?'disabled':''} onchange="pickInt(${qi},this.value)" style="max-width:250px;font-size:20px;font-weight:600;text-align:center;padding:12px" placeholder="e.g. 0"></div>`;
  }else{
    return `<div style="margin-bottom:1rem"><label style="font-size:15px">Type your descriptive answer below:</label>
    <textarea style="min-height:160px;font-size:15px" ${locked?'disabled':''} onchange="pickSubj(${qi},this.value)" placeholder="Write your detailed answer here...">${ans.val||''}</textarea></div>`;
  }
}

function pickMCQ(qi,j){activeState.answers[qi].val=j;renderTest();}
function pickMSQ(qi,j){
  if(!Array.isArray(activeState.answers[qi].val))activeState.answers[qi].val=[];
  var a=activeState.answers[qi].val,idx=a.indexOf(j);
  idx>-1?a.splice(idx,1):a.push(j);
  renderTest();
}
function pickInt(qi,v){activeState.answers[qi].val=v===''?null:+v;}
function pickSubj(qi,v){activeState.answers[qi].val=v||null;}
function clearAns(qi){activeState.answers[qi].val=null;renderTest();}
function togMark(qi){activeState.answers[qi].marked=!activeState.answers[qi].marked;renderTest();}
function goQ(i){if(i<0||i>=activeTest.questions.length)return;activeState.cur=i;renderTest();}

function confirmSubmit(){
  var answered=activeState.answers.filter(a=>a.val!==null&&(!Array.isArray(a.val)||a.val.length>0)).length;
  var total=activeTest.questions.length;
  showModal(`<div style="padding:1rem">
    <div style="font-size:22px;font-weight:600;margin-bottom:1rem;color:var(--color-text-primary)">Are you sure you want to submit?</div>
    <div style="font-size:15px;color:var(--color-text-secondary);margin-bottom:1.5rem;line-height:1.6">
      You have answered <strong style="color:var(--color-text-primary)">${answered}</strong> out of <strong style="color:var(--color-text-primary)">${total}</strong> questions.
      ${answered<total?`<br><span style="color:#A32D2D;font-weight:500;display:inline-block;margin-top:5px"><i class="ti ti-alert-circle"></i> Warning: ${total-answered} question${total-answered>1?'s':''} left unanswered.</span>`:''}
    </div>
    <div style="display:flex;gap:12px">
      <button class="btn btn-primary" style="flex:1;font-weight:600;font-size:15px" onclick="hideModal();doSubmit()"><i class="ti ti-check"></i> Yes, Submit Now</button>
      <button class="btn" style="flex:1;font-weight:600" onclick="hideModal()">No, Review Paper</button>
    </div>
  </div>`);
}

function doSubmit(){
  if(!activeTest||activeState.done)return;
  clearInterval(timerIv);
  activeState.done=true;
  var neg=activeTest.negMarking||0;
  var score=0,correct=0,wrong=0,skipped=0;
  var details=activeTest.questions.map((q,i)=>{
    var ans=activeState.answers[i];
    var status,earned=0;
    var hasVal=ans.val!==null&&(!Array.isArray(ans.val)||ans.val.length>0);
    if(!hasVal){skipped++;status='skipped';return{q,ans,status,earned};}
    if(q.type==='mcq'){
      if(ans.val===q.correct[0]){correct++;earned=q.marks;score+=q.marks;status='correct';}
      else{wrong++;earned=-neg;score-=neg;status='wrong';}
    }else if(q.type==='msq'){
      var userSel = Array.isArray(ans.val) ? ans.val : [];
      var corrSel = q.correct;
      
      var hasWrongOption = userSel.some(x => !corrSel.includes(x));
      var correctlySelected = userSel.filter(x => corrSel.includes(x)).length;
      
      if (hasWrongOption) {
        // Rule 1: Ek bhi galat option tick kiya, toh pura answer galat (0 ya negative marks)
        wrong++; earned = -neg; score -= neg; status = 'wrong';
      } else if (correctlySelected === corrSel.length) {
        // Rule 2: Saare sahi options tick kiye (Full marks)
        correct++; earned = q.marks; score += q.marks; status = 'correct';
      } else if (correctlySelected > 0) {
        // Rule 3: Partially Correct (Sahi options me se kuch hi tick kiye, par koi galat nahi kiya)
        var partialMarks = (q.marks / corrSel.length) * correctlySelected;
        earned = Math.round(partialMarks * 100) / 100; // Decimal ko 2 place tak rakha
        score += earned;
        correct++; // Ise correct count me hi daalenge taaki charts theek banein
        status = 'partial';
      } else {
        wrong++; status = 'wrong';
      }
    }
     else if(q.type==='integer'){
      if(ans.val===q.correctInt){correct++;earned=q.marks;score+=q.marks;status='correct';}
      else{wrong++;earned=-neg;score-=neg;status='wrong';}
    }else{skipped++;status='submitted';}
    return{q,ans,status,earned};
  });
  score=Math.max(0,score);
  var sub={name:activeState.name,roll:activeState.roll,score,correct,wrong,skipped,details,time:new Date().toLocaleString('en-IN'),totalMarks:activeTest.totalMarks};
  
  var t=tests.find(x=>x.id===activeTest.id);
  if(t && t.id !== 'prev') {
      if(!t.submissions) t.submissions = []; // Safe check
      t.submissions.push(sub);
      updateDatabase(); // NAYI LINE: Student ka paper save karega
  }
  
  document.getElementById('student-test').classList.add('hidden');
  
  if(activeTest.id !== 'prev' && activeTest.resultVis === 'manual') {
      showModal(`<div style="text-align:center;padding:2rem">
          <i class="ti ti-check" style="font-size:56px;color:#3B6D11;margin-bottom:1rem;display:block"></i>
          <h3 style="font-size:24px;margin-bottom:0.5rem;font-weight:600">Test Submitted Successfully!</h3>
          <p style="color:var(--color-text-secondary);margin-bottom:2rem;font-size:15px">Your answers have been securely saved. The examiner will review the paper and declare the results manually.</p>
          <button class="btn btn-primary" style="font-size:16px;padding:10px 24px" onclick="resetStudent(); hideModal()">Return to Home</button>
      </div>`);
  } else {
      _generateResultDOM(sub, activeTest, false);
  }
}

function _generateResultDOM(sub, test, isExaminerView, tIdx = null, sIdx = null) {
  var el=document.getElementById('student-result');
  el.classList.remove('hidden');
  var pct=Math.round((sub.score/test.totalMarks)*100);
  var accuracy=sub.correct+sub.wrong>0?Math.round((sub.correct/(sub.correct+sub.wrong))*100):0;
  var typeStats={};
  sub.details.forEach(d=>{
    var t=d.q.type;
    if(!typeStats[t])typeStats[t]={correct:0,wrong:0,skipped:0,total:0};
    typeStats[t].total++;
    typeStats[t][d.status==='submitted'||d.status==='evaluated'?'skipped':d.status]++;
  });
  
  function renderCards(filter){
    var filtered=sub.details.filter(d=>filter==='all'||d.status===filter||(filter==='skipped'&&(d.status==='submitted'||d.status==='evaluated')));
    return filtered.map((d)=>{
      var originalQIdx = sub.details.indexOf(d);
      var q=d.q,ans=d.ans;
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
          var isUser=userSel.includes(j),isCorr=corrSel.includes(j);
          var cls='neutral';
          var borderStyle = '';
          
          if(isCorr && isUser) { cls='correct'; borderStyle='border-color:#3B6D11; background:#EAF3DE;'; }
          else if(isCorr && !isUser) { cls='neutral'; borderStyle='border-color:#C0DD97; background:#f4f9ed;'; }
          else if(!isCorr && isUser) { cls='wrong'; borderStyle='border-color:#A32D2D; background:#FCEBEB;'; }
          
          // Clear Badges add kar diye
          var badgeHTML = '';
          if (isUser) badgeHTML += `<span style="font-size:11px;background:#185FA5;color:#fff;padding:2px 6px;border-radius:4px;margin-right:6px">Student Picked</span>`;
          if (isCorr) badgeHTML += `<span style="font-size:11px;background:#3B6D11;color:#fff;padding:2px 6px;border-radius:4px">Correct Key</span>`;

          return `<div class="qr-opt ${cls}" style="${borderStyle}">
            <div style="width:26px;height:26px;border-radius:50%;border:2px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0;background:rgba(255,255,255,0.7)">${String.fromCharCode(65+j)}</div>
            <div style="flex:1; display:flex; flex-direction:column; gap:5px; padding:4px 0;">
                <div style="font-size:15px; font-weight: ${isUser||isCorr?'600':'400'}">${o||'Option '+String.fromCharCode(65+j)}</div>
                ${badgeHTML ? `<div style="display:flex;">${badgeHTML}</div>` : ''}
            </div>
            ${isCorr && isUser?'<i class="ti ti-check" style="font-size:22px;color:#3B6D11;flex-shrink:0"></i>':''}
            ${isUser && !isCorr?'<i class="ti ti-x" style="font-size:22px;color:#A32D2D;flex-shrink:0"></i>':''}
          </div>`;
        }).join('');
      }else if(q.type==='integer'){ // ... Iske neeche ka code waisa hi rahega{
        optHTML=`<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:0.75rem">
          <div class="qr-opt ${d.status}" style="flex:1;font-size:15px">Answer Typed: <strong style="font-size:18px;margin-left:8px">${ans.val!==null?ans.val:'—'}</strong></div>
          <div class="qr-opt correct" style="flex:1;font-size:15px">Correct Key: <strong style="font-size:18px;margin-left:8px">${q.correctInt}</strong></div>
        </div>`;
      }else{
        optHTML=`<div class="qr-opt neutral" style="margin-bottom:0.75rem;align-items:flex-start;padding:1rem"><i class="ti ti-note" style="flex-shrink:0;margin-top:2px;font-size:18px;color:#185FA5"></i><span style="font-size:15px;line-height:1.6">${ans.val||'<em style="color:var(--color-text-secondary)">No answer written.</em>'}</span></div>
        ${q.modelAnswer?`<div class="qr-opt correct" style="align-items:flex-start;padding:1rem"><i class="ti ti-bulb" style="flex-shrink:0;margin-top:2px;font-size:18px"></i><span style="font-size:15px;line-height:1.6"><strong>Model Answer:</strong><br>${q.modelAnswer}</span></div>`:''}`;
      }
      var expHTML=q.explanation?`<div style="margin-top:1.25rem;padding:1rem;background:var(--color-background-tertiary);border-radius:var(--border-radius-md);font-size:14px;display:flex;gap:10px;align-items:flex-start;border:1px solid var(--color-border-secondary)"><i class="ti ti-info-circle" style="flex-shrink:0;color:#185FA5;font-size:18px;margin-top:2px"></i><span style="line-height:1.6"><strong>Explanation:</strong> ${q.explanation}</span></div>`:'';
      
      // NEW logic: Examiner input box sabhi questions ke liye (Override feature)
      var examinerInputHTML = '';
      if(isExaminerView) {
          examinerInputHTML = `<div style="margin-top:15px; padding-top:12px; border-top:1px dashed var(--color-border-secondary); display:flex; align-items:center; justify-content:space-between; gap:10px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="font-size:14px; color:#185FA5; font-weight:600;"><i class="ti ti-edit"></i> Override / Award Marks (Max: ${q.marks}):</div>
              <input type="number" id="mark_input_${originalQIdx}" class="eval-input" max="${q.marks}" step="0.25" value="${d.earned||0}" style="width:90px; padding:6px; font-size:15px; font-weight:bold; color:#185FA5; border:2px solid #185FA5; border-radius:6px; text-align:center; background:#fff; outline:none;">
          </div>`;
      }

      return `<div class="q-review-card">
        <div class="qr-header" style="background:${headerBg};color:${headerColor}">
          <i class="ti ${icon}" style="font-size:20px"></i>
          <span style="font-weight:600;font-size:15px">Question ${originalQIdx+1} &mdash; ${tlabel(q.type)}</span>
          <span style="margin-left:auto;font-size:14px;font-weight:600;background:rgba(255,255,255,0.6);padding:4px 10px;border-radius:12px">${statusLabel} &nbsp; ${earnedStr} marks</span>
        </div>
        <div class="qr-body">
          <div style="font-size:16px;line-height:1.7;margin-bottom:1.5rem;color:var(--color-text-primary);font-weight:500">${q.text||'No question text.'}</div>
          ${optHTML}
          ${expHTML}
          ${examinerInputHTML}
        </div>
      </div>`;
    }).join('');
  }

  var maxH=Math.max(sub.correct,sub.wrong,sub.skipped,1);
  var bH=c=>Math.max(16,Math.round((c/maxH)*80));
  
  // NEW logic: Examiner ke liye save button
  var actionButtons = isExaminerView 
      ? `<button class="btn btn-success" style="font-size:15px;padding:10px 24px;font-weight:600" onclick="saveEvaluation(${tIdx}, ${sIdx})"><i class="ti ti-device-floppy"></i> Save Manual Evaluation</button>
         <button class="btn btn-primary" style="font-size:15px;padding:10px 24px" onclick="nav('tests')"><i class="ti ti-arrow-left"></i> Back to Dashboard</button>`
      : `<button class="btn btn-primary" style="font-size:15px;padding:10px 24px" onclick="resetStudent()"><i class="ti ti-home"></i> Home</button>
         <button class="btn" style="font-size:15px;padding:10px 24px" onclick="nav('results')"><i class="ti ti-chart-bar"></i> View Global Results</button>`;

  el.innerHTML=`
    <div class="result-hero">
      <div style="font-size:15px;opacity:0.85;margin-bottom:0.75rem;font-weight:500;text-transform:uppercase;letter-spacing:1px">${test.title}</div>
      <div style="font-size:24px;font-weight:600;margin-bottom:0.25rem">${sub.name}${sub.roll?' &bull; '+sub.roll:''}</div>
      <div style="font-size:14px;opacity:0.8;margin-bottom:2rem">${sub.time}</div>
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;width:130px;height:130px;line-height:1;display:flex;align-items:center;justify-content:center;flex-direction:column;margin:0 auto 1.5rem;box-shadow:0 0 0 6px rgba(255,255,255,0.1)">
        <div style="font-size:42px;font-weight:600;margin-bottom:4px">${sub.score}</div>
        <div style="font-size:14px;opacity:0.8;font-weight:500">/ ${test.totalMarks}</div>
      </div>
      <div style="font-size:18px;font-weight:600;background:rgba(0,0,0,0.15);display:inline-block;padding:8px 24px;border-radius:30px">${pct}% &nbsp;&bull;&nbsp; ${pct>=90?'Excellent Score!':pct>=75?'Great Job!':pct>=50?'Good Effort':pct>=35?'Keep Practicing':'Needs Improvement'}</div>
    </div>

    <div class="grid4" style="margin-bottom:1.5rem">
      <div class="stat-card"><div class="stat-val" style="color:#185FA5">${sub.score}</div><div class="stat-lbl">Total Score</div></div>
      <div class="stat-card"><div class="stat-val" style="color:#3B6D11">${sub.correct}</div><div class="stat-lbl">Correct</div></div>
      <div class="stat-card"><div class="stat-val" style="color:#A32D2D">${sub.wrong}</div><div class="stat-lbl">Incorrect</div></div>
      <div class="stat-card"><div class="stat-val" style="color:var(--color-text-secondary)">${sub.skipped}</div><div class="stat-lbl">Pending/Skipped</div></div>
    </div>

    <div class="grid2" style="margin-bottom:2rem">
      <div class="card" style="margin-bottom:0">
        <div class="card-title"><i class="ti ti-chart-pie" style="font-size:20px;color:#185FA5"></i> Performance Overview</div>
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px"><span>Total Marks Scored</span><span style="font-weight:600">${sub.score} / ${test.totalMarks}</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:14px;margin:1.25rem 0 8px"><span>Accuracy (Attempted)</span><span style="font-weight:600">${accuracy}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${accuracy}%;background:#3B6D11"></div></div>
        <div style="margin-top:1.5rem" class="bar-chart">
          <div class="bar-col"><div class="bar-val" style="color:#3B6D11">${sub.correct}</div><div class="bar" style="height:${bH(sub.correct)}px;background:#C0DD97"></div><div class="bar-lbl">Correct</div></div>
          <div class="bar-col"><div class="bar-val" style="color:#A32D2D">${sub.wrong}</div><div class="bar" style="height:${bH(sub.wrong)}px;background:#F7C1C1"></div><div class="bar-lbl">Wrong</div></div>
          <div class="bar-col"><div class="bar-val" style="color:var(--color-text-secondary)">${sub.skipped}</div><div class="bar" style="height:${bH(sub.skipped)}px;background:var(--color-border-primary)"></div><div class="bar-lbl">Skipped</div></div>
        </div>
      </div>
      <div class="card" style="margin-bottom:0">
        <div class="card-title"><i class="ti ti-list-details" style="font-size:20px;color:#185FA5"></i> By Question Type</div>
        ${Object.entries(typeStats).map(([type,s])=>`
          <div style="margin-bottom:1rem">
            <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px">
              <span class="badge ${tbadge(type)}">${tlabel(type)}</span>
              <span style="font-size:13px;color:var(--color-text-secondary);font-weight:500">${s.correct}C &bull; ${s.wrong}W &bull; ${s.skipped}S</span>
            </div>
            <div class="progress-track" style="height:6px"><div class="progress-fill" style="width:${Math.round((s.correct/s.total)*100)}%; border-radius:3px"></div></div>
          </div>`).join('')}
        <div class="divider"></div>
        <div style="font-size:14px;color:var(--color-text-secondary);line-height:1.8">
          Total Attempted: <strong style="color:var(--color-text-primary);font-size:15px">${sub.correct+sub.wrong}</strong> / ${test.questions.length}<br>
          Negative Marks: <strong style="color:#A32D2D;font-size:15px">-${(sub.wrong*(test.negMarking||0)).toFixed(2)}</strong>
        </div>
      </div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:12px;padding-bottom:1rem;border-bottom:1px solid var(--color-border-secondary)">
      <div style="font-size:18px;font-weight:600">Question-wise Analysis</div>
      <div class="filter-tabs" id="filter-tabs" style="margin-bottom:0">
        <button class="ftab active" onclick="setFilter('all',this)">All (${sub.details.length})</button>
        <button class="ftab" onclick="setFilter('correct',this)">Correct (${sub.correct})</button>
        <button class="ftab" onclick="setFilter('wrong',this)">Wrong (${sub.wrong})</button>
        <button class="ftab" onclick="setFilter('skipped',this)">Pending/Skipped (${sub.skipped})</button>
      </div>
    </div>
    <div id="q-review-area">${renderCards('all')}</div>

    <div style="display:flex;gap:12px;margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--color-border-secondary)">
      ${actionButtons}
    </div>`;

  window.__renderCards=renderCards;
}

function setFilter(f,btn){
  document.querySelectorAll('.ftab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('q-review-area').innerHTML=window.__renderCards(f);
}

function resetStudent(){
  activeTest=null;activeState=null;
  document.getElementById('student-home').classList.remove('hidden');
  document.getElementById('student-test').classList.add('hidden');
  document.getElementById('student-result').classList.add('hidden');
}

function renderAllResults(){
  var c=document.getElementById('results-area');
  var all=tests.flatMap(t=>t.submissions.map(s=>({...s,testTitle:t.title,testCode:t.code})));
  if(!all.length){c.innerHTML=`<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-chart-off" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">No results available yet. Complete a test to see data here.</div></div>`;return;}
  c.innerHTML=all.map(s=>`
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

function showModal(html){
  document.getElementById('modal-box').innerHTML=html;
  document.getElementById('modal-area').classList.remove('hidden');
}
function hideModal(){document.getElementById('modal-area').classList.add('hidden');}

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
  inp.value = ''; // Reset input
}

// Pre-fill some demo questions
addQ({id:1,type:'mcq',text:'A particle moves with constant acceleration. Its velocity changes from 20 m/s to 60 m/s in 4 seconds. What is the acceleration?',marks:4,options:['5 m/s²','10 m/s²','15 m/s²','20 m/s²'],correct:[1],explanation:'a = (v-u)/t = (60-20)/4 = 10 m/s²'});
addQ({id:2,type:'integer',text:'If log₂(x) = 5, find the value of x.',marks:4,correctInt:32,explanation:'2⁵ = 32'});
addQ({id:3,type:'msq',text:'Which of the following are fundamental forces of nature?',marks:4,options:['Gravitational force','Tension','Electromagnetic force','Strong nuclear force'],correct:[0,2,3],explanation:'Tension is a contact force, not fundamental. The four fundamental forces are gravity, electromagnetic, strong nuclear, and weak nuclear.'});
addQ({id:4,type:'subjective',text:"State and explain Newton's Third Law of Motion with a real-world example.",marks:10,modelAnswer:'Every action has an equal and opposite reaction. Example: when you push a wall, the wall pushes back with equal force.',explanation:'The forces are equal in magnitude and opposite in direction.'});
