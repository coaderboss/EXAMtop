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
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth(); // Auth setup
const provider = new firebase.auth.GoogleAuthProvider();

var tests=[], qList=[], activeTest=null, activeState=null, timerIv=null;
var currentUser = null; 
// ==========================================
// UTILITY FUNCTIONS: Toasts, Copy & CSV
// ==========================================
function showToast(msg, type = 'normal') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    let toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = type === 'error' ? 'ti-alert-circle' : type === 'success' ? 'ti-check' : 'ti-info-circle';
    toast.innerHTML = `<i class="ti ${icon}" style="font-size:18px"></i> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function copyToClip(text) {
    navigator.clipboard.writeText(text).then(() => showToast('Test Code Copied Successfully!', 'success'));
}

function exportToCSV(testIdx) {
    var t = tests.find(x => x.id === testIdx);
    if(!t.submissions || !t.submissions.length) return showToast('No submissions to export yet.', 'error');
    
    var csv = 'Student Name,Roll Number,Total Score,Max Marks,Accuracy (%),Correct Qs,Wrong Qs,Skipped Qs,Submission Time\n';
    t.submissions.forEach(s => {
        var accuracy = s.correct + s.wrong > 0 ? Math.round((s.correct / (s.correct + s.wrong)) * 100) : 0;
        csv += `"${s.name}","${s.roll||'N/A'}",${s.score},${t.totalMarks},${accuracy},${s.correct},${s.wrong},${s.skipped},"${s.time}"\n`;
    });
    
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement("a");
    if (link.download !== undefined) {
        var url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${t.title.replace(/ /g,"_")}_Results.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Excel/CSV File Downloaded!', 'success');
    }
}

// ==========================================
// 1. AUTHENTICATION LISTENER (Login Check)
// ==========================================
auth.onAuthStateChanged(user => {
  currentUser = user;
  const loginBtn = document.getElementById('login-btn');
  
  if(user) {
      // Login hone par
      loginBtn.innerHTML = `<i class="ti ti-logout"></i> Logout (${user.displayName.split(' ')[0]})`;
      loginBtn.style.background = "#FCEBEB";
      loginBtn.style.color = "#A32D2D";
      loginBtn.style.borderColor = "#F7C1C1";
  } else {
      // Logout hone par
      loginBtn.innerHTML = `<i class="ti ti-brand-google"></i> Examiner Login`;
      loginBtn.style.background = "#185FA5";
      loginBtn.style.color = "#fff";
      loginBtn.style.borderColor = "#185FA5";
  }
  
  // UI refresh karo login state change hone par
  if(document.getElementById('page-tests').classList.contains('active')) renderTestList();
  if(document.getElementById('page-results').classList.contains('active')) renderAllResults();
});

// Login button ka function
function toggleLogin() {
    if(currentUser) {
        auth.signOut();
    } else {
        auth.signInWithPopup(provider).catch(error => alert(error.message));
    }
}

// ==========================================
// 2. DATABASE LISTENER (With Array FIX)
// ==========================================
db.ref('tests').on('value', (snapshot) => {
  var data = snapshot.val();
  
  // SAFE ARRAY CONVERSION (Purani error wapas nahi aayegi)
  if (!data) {
      tests = [];
  } else if (Array.isArray(data)) {
      tests = data;
  } else {
      tests = Object.values(data).filter(item => item !== null);
  }
  
  // Submissions ko bhi safe array me rakho
  tests.forEach(t => {
      if (t.submissions && !Array.isArray(t.submissions)) {
          t.submissions = Object.values(t.submissions).filter(item => item !== null);
      } else if (!t.submissions) {
          t.submissions = [];
      }
  });

  // Data aate hi UI refresh karo
  if(document.getElementById('page-tests').classList.contains('active')) renderTestList();
  if(document.getElementById('page-results').classList.contains('active')) renderAllResults();
});

function updateDatabase() {
    db.ref('tests').set(tests).catch(error => {
        alert("Error saving data to cloud: " + error.message);
    });
}

function updateDatabase() {
    db.ref('tests').set(tests).catch(error => {
        alert("Error saving data to cloud: " + error.message);
    });
}

var tests=[], qList=[], activeTest=null, activeState=null, timerIv=null;

// ==========================================
// SPA ROUTER & HISTORY MANAGEMENT
// ==========================================

// 1. Jab bhi phone ka Back Button dabega, ye chalega
window.addEventListener('popstate', function(event) {
    let hash = window.location.hash.replace('#', '') || 'home';
    
    // Agar bacha test de raha hai aur back daba diya, toh warn karo
    if (activeState && !activeState.done && hash !== 'student') {
        if (!confirm("WARNING: You are in an active exam! Going back will cancel your test. Are you sure?")) {
            // Action cancel karo aur URL wapas set karo
            window.history.pushState(null, null, '#student');
            return;
        } else {
            exitToHome(); // Hamara purana exit function
        }
    }
    
    switchPageUI(hash);
});

// 2. Button dabane par URL change karne wala naya nav function
function nav(pageId) {
    window.location.hash = pageId; // Browser history me naya panna jod dega
    switchPageUI(pageId);
}

// 3. UI switch karne ka main engine (Purana nav logic)
function switchPageUI(pageId) {
    // Sab page chupao, target dikhao
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    var target = document.getElementById('page-' + pageId);
    if(target) target.classList.add('active');
    
    // Navbar ki blue line set karo
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    var tab = document.querySelector(`.nav-tab[onclick="nav('${pageId}')"]`);
    if(tab) tab.classList.add('active');
    
    // Tab load hone par data manga lo
    if(pageId === 'tests') renderTestList();
    if(pageId === 'results') renderGlobalResults(); // Agar ye function hai toh chalega
}

// 4. Jab website pehli baar khulegi
window.onload = function() {
    let initialHash = window.location.hash.replace('#', '') || 'home';
    switchPageUI(initialHash);
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

// ==========================================
// SAVE TEST FUNCTION (WITH SMART MARKS & COPY CODE)
// ==========================================
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
  
  // --- NAYA: SMART MARKS VALIDATION ---
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
  // ------------------------------------

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
  
  // --- TEST SAVED MODAL WITH COPY BUTTON ---
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
    return `<div class="test-entry">
      <div class="te-meta">
        <div style="font-weight:600;font-size:16px;color:var(--color-text-primary)">${t.title}</div>
        <div style="font-size:13px;color:var(--color-text-secondary)">${t.subject||'No Subject'} &bull; ${t.questions.length} Qs &bull; ${t.duration} Mins</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <span class="badge b-blue" style="cursor:pointer" onclick="copyToClip('${t.code}')" title="Click to copy code"><i class="ti ti-copy" style="font-size:12px"></i> ${t.code}</span>
          <span class="badge b-green">${t.submissions ? t.submissions.length : 0} Submissions</span>
          ${t.resultVis==='manual' ? (t.released?'<span class="badge b-amber">Results Released</span>':'<span class="badge b-gray">Manual Evaluation Pending</span>') : '<span class="badge b-purple">Instant Results Active</span>'}
        </div>
      </div>
      <div class="te-actions">
        <button class="btn btn-sm btn-blue" onclick="viewSubmissions(${origIdx})"><i class="ti ti-users"></i> Submissions</button>
        ${!t.released && t.resultVis==='manual' ? `<button class="btn btn-sm btn-success" onclick="releaseRes(${origIdx})"><i class="ti ti-send"></i> Publish</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="delTest(${origIdx})"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}
  
  // 4. Sirf filtered tests ko screen par print karo
  c.innerHTML = myTests.map((t) => {
    // IMPORTANT FIX: Original array me is test ka index kya tha, wo dhundo taaki delete/evaluate sahi test par ho
    var origIdx = tests.findIndex(x => x.id === t.id);
    
    return `
    <div class="test-entry">
      <div class="te-meta">
        <div style="font-weight:600;font-size:16px;color:var(--color-text-primary)">${t.title}</div>
        <div style="font-size:13px;color:var(--color-text-secondary)">${t.subject||'No Subject'} &bull; ${t.questions.length} Questions &bull; ${t.duration} Mins &bull; Created ${t.createdAt}</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <span class="badge b-blue"><i class="ti ti-hash" style="font-size:12px"></i> ${t.code}</span>
          <span class="badge b-green">${t.submissions ? t.submissions.length : 0} Submissions</span>
          ${t.resultVis==='manual' ? (t.released?'<span class="badge b-amber">Results Released</span>':'<span class="badge b-gray">Manual Evaluation Pending</span>') : '<span class="badge b-purple">Instant Results Active</span>'}
        </div>
      </div>
      <div class="te-actions">
        <button class="btn btn-sm" onclick="launchAsStudent(${origIdx})"><i class="ti ti-player-play"></i> Preview</button>
        <button class="btn btn-sm btn-blue" onclick="viewSubmissions(${origIdx})"><i class="ti ti-users"></i> Submissions</button>
        ${!t.released && t.resultVis==='manual' ? `<button class="btn btn-sm btn-success" onclick="releaseRes(${origIdx})"><i class="ti ti-send"></i> Publish</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="delTest(${origIdx})" title="Delete Test"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }).join('');


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
    
    sub.score = Number(newTotal.toFixed(2));
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
  if(!name){ showToast('Please enter your full name.', 'error'); return;}
  if(!code){ showToast('Please enter the test code.', 'error'); return;}
  
  var t=tests.find(x=>x.code===code);
  if(!t){ showToast('Invalid Test Code. Check and try again.', 'error'); return;}
  
  if(t.expiryDate && new Date() > new Date(t.expiryDate)) {
      showModal(`<div style="text-align:center;padding:1.5rem"><i class="ti ti-clock-off" style="font-size:42px;color:#A32D2D;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:20px;margin-bottom:0.5rem">Exam Expired!</div><p style="color:var(--color-text-secondary);margin-bottom:1.5rem">The deadline for this exam has passed.</p><button class="btn btn-primary" onclick="hideModal()">Close</button></div>`);
      return;
  }
  
  if(!t.submissions) t.submissions = [];
  var existingSub = t.submissions.find(s => s.name.toLowerCase() === name.toLowerCase() && s.roll === roll);
  if(existingSub) {
      if(t.resultVis === 'instant' || t.released) {
          showModal(`<div style="text-align:center;padding:1.5rem"><i class="ti ti-info-circle" style="font-size:42px;color:#185FA5;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:18px;margin-bottom:1rem">Already Submitted.</div><button class="btn btn-primary" onclick="hideModal(); launchExistingResult('${t.id}', '${name}', '${roll}')">View Results</button></div>`);
      } else {
          showModal(`<div style="text-align:center;padding:1.5rem"><i class="ti ti-clock" style="font-size:42px;color:#854F0B;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:18px;margin-bottom:1rem">Submission Received</div><p>Results pending release.</p><button class="btn btn-primary" onclick="hideModal()">Understood</button></div>`);
      }
      return;
  }
  
  // NAYA: INSTRUCTIONS SCREEN INSTEAD OF DIRECT LAUNCH
  document.getElementById('student-home').classList.add('hidden');
  var el = document.getElementById('student-test');
  el.classList.remove('hidden');
  
  var fsText = t.fullScreenMode ? `<li style="margin-bottom:8px; color:#A32D2D"><strong><i class="ti ti-maximize"></i> Full-Screen Lock:</strong> Exiting full-screen will trigger a warning.</li>` : '';
  var tabText = t.antiCheat ? `<li style="margin-bottom:8px; color:#A32D2D"><strong><i class="ti ti-shield-lock"></i> Tab-Switch Monitored:</strong> Changing tabs will auto-submit the exam.</li>` : '';

  el.innerHTML = `
  <div style="max-width:600px; margin: 2rem auto; background: #fff; padding: 2rem; border-radius: 12px; border: 1px solid var(--color-border-secondary); box-shadow: 0 4px 15px rgba(0,0,0,0.05)">
      <h2 style="margin-bottom:1rem; font-size:24px; color:#185FA5"><i class="ti ti-file-info"></i> Pre-Exam Instructions</h2>
      <div style="font-size:15px; color:var(--color-text-primary); line-height:1.6; margin-bottom:1.5rem">
          <p style="margin-bottom:8px"><strong>Test:</strong> ${t.title}</p>
          <p style="margin-bottom:15px"><strong>Subject:</strong> ${t.subject || 'N/A'}</p>
          <ul style="margin-left: 20px; color:var(--color-text-secondary)">
              <li style="margin-bottom:8px"><strong>Duration:</strong> ${t.duration} Minutes</li>
              <li style="margin-bottom:8px"><strong>Total Marks:</strong> ${t.totalMarks} (Negative Marking: ${t.negMarking ? '-'+t.negMarking : 'None'})</li>
              ${fsText} ${tabText}
          </ul>
      </div>
      <div style="background:var(--color-background-secondary); padding:1rem; border-radius:8px; margin-bottom:1.5rem;">
          <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:500;">
              <input type="checkbox" style="width:18px; height:18px; cursor:pointer" onchange="document.getElementById('start-btn-actual').disabled = !this.checked">
              I have read and understood all instructions.
          </label>
      </div>
      <button id="start-btn-actual" class="btn btn-primary" style="width:100%; justify-content:center; padding:12px; font-size:16px;" disabled onclick="initiateTestStart('${t.id}', '${name}', '${roll}')">
          <i class="ti ti-player-play"></i> Start Exam Now
      </button>
      
      <button class="btn" style="width:100%; justify-content:center; padding:12px; font-size:16px; margin-top:12px; background:var(--color-background-secondary); border:1px solid var(--color-border-secondary); color:var(--color-text-primary);" onclick="exitToHome()">
          <i class="ti ti-arrow-left"></i> Go Back
      </button>

  </div>`;
}


function launchExistingResult(testId, name, roll) {
    var t = tests.find(x => x.id == testId);
    var sub = t.submissions.find(s => s.name.toLowerCase() === name.toLowerCase() && s.roll === roll);
    document.getElementById('student-home').classList.add('hidden');
    document.getElementById('student-test').classList.add('hidden');
    _generateResultDOM(sub, t, false);
}

function launchAsStudent(i){nav('student');launchTest(tests[i],'Demo Student','');}

// Anti-Cheat global function
function handleCheat(event) {
    if (!activeTest || activeState.done) return;
    
    let isTabSwitch = document.hidden && activeTest.antiCheat;
    let isFullScreenExit = event && event.type === 'fullscreenchange' && !document.fullscreenElement && activeTest.fullScreenMode;

    if (isTabSwitch || isFullScreenExit) {
        window.examWarnings = (window.examWarnings || 0) + 1;
        if (window.examWarnings >= 3) {
            alert("SECURITY ALERT: Exam Blocked! Rules violated 3 times. Auto-submitting paper.");
            doSubmit();
        } else {
            let reason = isTabSwitch ? "Tab switching" : "Exiting full-screen";
            alert(`WARNING ${window.examWarnings}/2: ${reason} detected! Please do not leave the exam screen.`);
        }
    }
}

function initiateTestStart(testId, name, roll) {
    var t = tests.find(x => x.id == testId);
    if(t.fullScreenMode) {
        var elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen().catch(err => showToast(`Full-screen blocked by browser`, 'error'));
    }
    launchTest(t, name, roll);
}

function launchTest(dbTest, name, roll){
  var test = JSON.parse(JSON.stringify(dbTest));
  if (test.randomOrder) test.questions = test.questions.sort(() => Math.random() - 0.5);
  if (test.shuffleOpts) {
      test.questions.forEach(q => {
          if (q.type === 'mcq' || q.type === 'msq') {
              let optsWithKeys = q.options.map((opt, idx) => ({ text: opt, isCorrect: q.correct.includes(idx) }));
              optsWithKeys.sort(() => Math.random() - 0.5);
              q.options = optsWithKeys.map(o => o.text);
              q.correct = optsWithKeys.map((o, idx) => o.isCorrect ? idx : -1).filter(idx => idx !== -1);
          }
      });
  }

  activeTest = test;
  activeState={name,roll,answers:Array(test.questions.length).fill(0).map(()=>({val:null,marked:false})),cur:0,start:Date.now(),done:false};
  
  window.examWarnings = 0;
  if (activeTest.antiCheat) document.addEventListener("visibilitychange", handleCheat);
  if (activeTest.fullScreenMode) document.addEventListener("fullscreenchange", handleCheat);

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
  document.removeEventListener("visibilitychange", handleCheat);
  document.removeEventListener("fullscreenchange", handleCheat);
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
  // Negative marks allow karne ke liye aur decimals ko 2 digit tak lock karne ke liye
  score = Number(score.toFixed(2));
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
  var c = document.getElementById('results-area');
  
  // 1. Agar login nahi hai, toh data mat dikhao
  if(!currentUser) {
      c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-lock" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">Please Login using Google to view results.</div></div>`;
      return;
  }

  // 2. Sirf current user ke tests ko filter karo
  var myTests = tests.filter(t => t.creatorUid === currentUser.uid);
  
  // 3. Un filtered tests ke andar se saari submissions nikal kar ek array me daal do
  var all = myTests.flatMap(t => t.submissions ? t.submissions.map(s => ({...s, testTitle: t.title, testCode: t.code})) : []);
  
  // 4. Agar koi bacche ne abhi tak test nahi diya
  if(!all.length){
      c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-chart-off" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">No results available yet. Complete a test to see data here.</div></div>`;
      return;
  }
  
  // 5. Result Cards print karo
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

// --- NAYA: UNIVERSAL EXIT / GO BACK FUNCTION ---
function exitToHome(isTestActive = false) {
    // Agar test start ho chuka hai, toh pehle confirm karo
    if (isTestActive && activeState && !activeState.done) {
        if (!confirm("Are you sure you want to exit? Your exam progress will be lost and test will be cancelled.")) {
            return; // Agar user ne 'Cancel' dabaya toh wahi ruk jao
        }
    }
    
    // Security aur timers band karo
    if(timerIv) clearInterval(timerIv);
    document.removeEventListener("visibilitychange", handleCheat);
    document.removeEventListener("fullscreenchange", handleCheat);
    
    // Agar full-screen me hai toh usse bahar aao
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log(err));
    }

    // State reset karo
    activeTest = null;
    activeState = null;
    
    // Test aur Result screen chhupao
    var testScreen = document.getElementById('student-test');
    if(testScreen) testScreen.classList.add('hidden');
    
    var resultScreen = document.getElementById('student-result');
    if(resultScreen) resultScreen.classList.add('hidden');
    
    // Wapas sahi tab par bhejo (Examiner ko uske tests par, aur student ko join page par)
    document.getElementById('student-home').classList.remove('hidden');
    if(currentUser) {
        nav('tests');
    } else {
        nav('student');
    }
}

// ==========================================
// PLATFORM HELP & INSTRUCTIONS GUIDE
// ==========================================
function showHelpGuide() {
    const helpHtml = `
    <div style="max-width: 700px; text-align: left; padding: 0.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--color-border-secondary); padding-bottom: 1rem;">
            <h2 style="font-size: 22px; color: #185FA5; margin: 0;"><i class="ti ti-book"></i> Platform Documentation</h2>
            <button onclick="hideModal()" style="background:none; border:none; font-size:24px; cursor:pointer; color:var(--color-text-secondary)">&times;</button>
        </div>

        <div style="max-height: 60vh; overflow-y: auto; padding-right: 15px; font-size: 14px; color: var(--color-text-primary); line-height: 1.6;">
            
            <h3 style="color: var(--color-text-primary); border-left: 4px solid #185FA5; padding-left: 10px; margin-bottom: 1rem;">👨‍🏫 For Examiners & Creators</h3>
            
            <div style="background: var(--color-background-secondary); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <h4 style="margin-top:0; color:#A32D2D;"><i class="ti ti-shield-lock"></i> Security & Proctoring Features</h4>
                <ul style="padding-left: 20px; margin-bottom: 0;">
                    <li style="margin-bottom: 6px;"><strong>Strict Anti-Cheat (Tab Switch):</strong> If enabled, the system monitors the student's browser. Switching tabs or opening new windows will issue warnings and auto-submit the exam on the 3rd attempt.</li>
                    <li style="margin-bottom: 6px;"><strong>Enforce Full-Screen:</strong> Forces the student's browser into full-screen mode. Exiting full-screen triggers a security warning.</li>
                    <li><strong>Test Expiry:</strong> Set a strict deadline. Once the date and time pass, the test code automatically expires and blocks new entries.</li>
                </ul>
            </div>

            <div style="margin-bottom: 1.5rem;">
                <h4 style="margin-bottom:0.5rem;"><i class="ti ti-settings"></i> Evaluation & Results</h4>
                <ul style="padding-left: 20px;">
                    <li style="margin-bottom: 6px;"><strong>Instant Release:</strong> Students see their marks, accuracy, and correct answers immediately after clicking submit.</li>
                    <li style="margin-bottom: 6px;"><strong>Manual Release:</strong> Results are hidden. The examiner must go to "Submissions", manually evaluate (and override marks if needed), and click "Publish" to release results globally.</li>
                    <li><strong>Export to CSV:</strong> Click the "Export CSV" button in the submissions panel to download a complete Excel sheet of student performances.</li>
                </ul>
            </div>

            <h3 style="color: var(--color-text-primary); border-left: 4px solid #3B6D11; padding-left: 10px; margin-bottom: 1rem;">📝 Bulk Upload (JSON Format)</h3>
            <p style="margin-bottom: 10px;">To upload multiple questions at once using the "Bulk Import" button, create a <code>.json</code> file following this strict format:</p>
            <pre style="background: #1e293b; color: #a5b4fc; padding: 1rem; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 13px; margin-bottom: 1.5rem;">
[
  {
    "type": "mcq",
    "text": "What is the capital of France?",
    "marks": 4,
    "options": ["London", "Berlin", "Paris", "Madrid"],
    "correct": [2], 
    "explanation": "Paris is the capital of France."
  }
]</pre>
            <p style="font-size: 13px; color: var(--color-text-secondary); margin-top: -10px; margin-bottom: 1.5rem;"><em>Note: The "correct" array uses a 0-based index (0 is the 1st option, 1 is the 2nd, etc.).</em></p>


            <h3 style="color: var(--color-text-primary); border-left: 4px solid #854F0B; padding-left: 10px; margin-bottom: 1rem;">👨‍🎓 For Students</h3>
            <ul style="padding-left: 20px; margin-bottom: 1.5rem;">
                <li style="margin-bottom: 8px;"><strong>Joining a Test:</strong> Navigate to the "Join Test" tab, enter your exact Full Name, Roll Number, and the 6-character Code provided by your instructor.</li>
                <li style="margin-bottom: 8px;"><strong>During the Exam:</strong> Do not refresh the page or switch browser tabs. A built-in timer will auto-submit your paper when the time runs out.</li>
                <li><strong>Viewing Results:</strong> If the instructor allows instant results, you can click "View Results" immediately. If it's manual, re-enter your code on the Join page later to check your evaluated paper.</li>
            </ul>

        </div>
        <div style="text-align: right; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border-secondary);">
            <button class="btn btn-primary" onclick="hideModal()">Understood</button>
        </div>
    </div>`;
    
    showModal(helpHtml);
}

// --- NAYA: QUESTION IMAGE UPLOADER ---
// DHYAN RAHE: Yahan apni ImgBB ki API Key zarur dalna!
const IMGBB_API_KEY = "89d6a61d757a3728bc75a31828160563"; 

async function uploadQuestionImage(inputElement, qIndex) {
    if (!inputElement.files || inputElement.files.length === 0) return;
    
    showToast('Uploading image, please wait...', 'normal');
    inputElement.disabled = true; // Jab tak upload na ho, block kardo
    
    try {
        const formData = new FormData();
        formData.append('image', inputElement.files[0]);
        
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if(data.success) {
            qList[qIndex].imgUrl = data.data.url; // Database me save hone ke liye URL set kar diya
            showToast('Image uploaded successfully!', 'success');
            renderQs(); // Screen refresh kardo taaki photo dikh jaye
        } else {
            throw new Error("Upload failed");
        }
    } catch(e) {
        console.error(e);
        showToast('Failed to upload image. Try again.', 'error');
        inputElement.disabled = false;
    }
}

// Pre-fill some demo questions
addQ({id:1,type:'mcq',text:'A particle moves with constant acceleration. Its velocity changes from 20 m/s to 60 m/s in 4 seconds. What is the acceleration?',marks:4,options:['5 m/s²','10 m/s²','15 m/s²','20 m/s²'],correct:[1],explanation:'a = (v-u)/t = (60-20)/4 = 10 m/s²'});
addQ({id:2,type:'integer',text:'If log₂(x) = 5, find the value of x.',marks:4,correctInt:32,explanation:'2⁵ = 32'});
addQ({id:3,type:'msq',text:'Which of the following are fundamental forces of nature?',marks:4,options:['Gravitational force','Tension','Electromagnetic force','Strong nuclear force'],correct:[0,2,3],explanation:'Tension is a contact force, not fundamental. The four fundamental forces are gravity, electromagnetic, strong nuclear, and weak nuclear.'});
addQ({id:4,type:'subjective',text:"State and explain Newton's Third Law of Motion with a real-world example.",marks:10,modelAnswer:'Every action has an equal and opposite reaction. Example: when you push a wall, the wall pushes back with equal force.',explanation:'The forces are equal in magnitude and opposite in direction.'});
