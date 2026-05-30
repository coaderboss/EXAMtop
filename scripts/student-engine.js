// ==========================================
// STUDENT EXAM ENGINE & ANTI-CHEAT LOGIC
// ==========================================

function cancelJoin() {
    nav('home');
}

function openMobilePalette() {
    var p = document.getElementById('mobile-palette-sheet');
    var o = document.getElementById('palette-overlay');
    if(p && o) { p.classList.add('active'); o.classList.add('active'); }
}

function closeMobilePalette() {
    var p = document.getElementById('mobile-palette-sheet');
    var o = document.getElementById('palette-overlay');
    if(p && o) { p.classList.remove('active'); o.classList.remove('active'); }
}

function joinTest(){
  var name=document.getElementById('s-name').value.trim();
  var code=document.getElementById('s-code').value.trim().toUpperCase();
  var roll=document.getElementById('s-roll').value.trim();
  if(!name){ showToast('Please enter your full name.', 'error'); return;}
  if(!code){ showToast('Please enter the test code.', 'error'); return;}
  
  var t=tests.find(x=>x.code===code);
  if(!t){ showToast('Invalid Test Code. Check and try again.', 'error'); return;}
  if(!t.submissions) t.submissions = [];
  
  var rollToMatch = roll ? roll.toLowerCase() : '';
  var existingSub = t.submissions.find(s => s.name.trim().toLowerCase() === name.toLowerCase() && (s.roll || '').trim().toLowerCase() === rollToMatch);
  
  if(existingSub) {
      if (typeof isOfflineMode !== 'undefined' && !isOfflineMode && existingSub.uid !== 'anonymous' && existingSub.uid !== 'offline_user' && (!currentUser || currentUser.uid !== existingSub.uid)) {
          showModal(`<div style="text-align:center;padding:2rem"><i class="ti ti-shield-lock" style="font-size:56px;color:#A32D2D;display:block;margin-bottom:1rem"></i><h3 style="font-size:22px;color:#A32D2D;margin-bottom:0.5rem;font-weight:600">Access Denied</h3><p style="color:var(--color-text-secondary);margin-bottom:1.5rem;font-size:15px">This result belongs to a registered student. You must <strong>Login with Google</strong> to view this paper.</p><button class="btn btn-danger" style="padding:10px 24px;font-size:15px" onclick="hideModal()">Understood</button></div>`);
          return;
      }
      if(t.resultVis === 'instant' || t.released) {
          showModal(`<div style="text-align:center;padding:1.5rem"><i class="ti ti-info-circle" style="font-size:42px;color:#185FA5;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:18px;margin-bottom:1rem">Already Submitted.</div><button class="btn btn-primary" onclick="hideModal(); launchExistingResult('${t.id}', '${name}', '${roll}')">View Results</button></div>`);
      } else {
          showModal(`<div style="text-align:center;padding:1.5rem"><i class="ti ti-clock" style="font-size:42px;color:#854F0B;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:18px;margin-bottom:1rem">Submission Received</div><p>Results pending release.</p><button class="btn btn-primary" onclick="hideModal()">Understood</button></div>`);
      }
      return;
  }
  
  if (t.isActive === false) {
      showModal(`<div style="text-align:center;padding:2rem"><i class="ti ti-door-exit" style="font-size:56px;color:#A32D2D;display:block;margin-bottom:1rem"></i><h3 style="font-size:22px;color:#A32D2D;margin-bottom:0.5rem;font-weight:600">Intake Closed</h3><p style="color:var(--color-text-secondary);margin-bottom:1.5rem;font-size:15px">The examiner is no longer accepting new submissions for this test.</p><button class="btn btn-danger" style="padding:10px 24px;font-size:15px" onclick="hideModal()">Understood</button></div>`);
      return;
  }

  if(t.expiryDate && new Date() > new Date(t.expiryDate)) {
      showModal(`<div style="text-align:center;padding:1.5rem"><i class="ti ti-clock-off" style="font-size:42px;color:#A32D2D;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:20px;margin-bottom:0.5rem">Exam Expired!</div><p style="color:var(--color-text-secondary);margin-bottom:1.5rem">The deadline for this exam has passed.</p><button class="btn btn-primary" onclick="hideModal()">Close</button></div>`);
      return;
  }
  
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
      <button class="btn" style="width:100%; justify-content:center; padding:12px; font-size:16px; margin-top:12px; background:var(--color-background-secondary); border:1px solid var(--color-border-secondary); color:var(--color-text-primary);" onclick="cancelJoin()">
          <i class="ti ti-arrow-left"></i> Go Back
      </button>
  </div>`;
}

function launchAsStudent(i){
    nav('student');
    document.getElementById('student-home').classList.add('hidden');
    launchTest(tests[i],'Demo Student','');
}

function handleCheat(event) {
    if (!activeTest || activeState.done) return;

    if (window.lastWarningTime && (Date.now() - window.lastWarningTime < 3000)) return; 

    let isTabSwitch = document.hidden && activeTest.antiCheat;
    let isFullScreenExit = event && event.type === 'fullscreenchange' && !document.fullscreenElement && activeTest.fullScreenMode;
    let isWindowBlur = event && event.type === 'blur' && activeTest.antiCheat;

    if (isTabSwitch || isFullScreenExit || isWindowBlur) {
        window.lastWarningTime = Date.now(); 
        window.examWarnings = (window.examWarnings || 0) + 1;
        
        let reason = isTabSwitch ? "Tab switching / App change" : isWindowBlur ? "Opened another window (Focus lost)" : "Exited full-screen mode";
        
        // NAYA: Record exact time and reason for cheating attempt
        if (!activeState.cheatLogs) activeState.cheatLogs = [];
        activeState.cheatLogs.push({ time: new Date().toLocaleTimeString('en-IN'), reason: reason });

        if (window.examWarnings >= 3) {
            alert("SECURITY ALERT: Exam Blocked! Rules violated 3 times. Auto-submitting paper.");
            doSubmit();
        } else {
            alert(`WARNING ${window.examWarnings}/2: ${reason} detected! Please do not leave the exam screen.`);
            setTimeout(() => {
                if (activeTest.fullScreenMode && document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(e => console.log("Auto-fullscreen blocked"));
                }
            }, 500);
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
  
  if (test.randomOrder) {
      if (test.sections && test.sections.length > 0) {
          let groupedQs = [];
          test.sections.forEach(sec => {
              let secQs = test.questions.filter(q => q.section === sec);
              secQs.sort(() => Math.random() - 0.5);
              groupedQs = groupedQs.concat(secQs);
          });
          let noSecQs = test.questions.filter(q => !q.section || !test.sections.includes(q.section));
          if (noSecQs.length > 0) {
              noSecQs.sort(() => Math.random() - 0.5);
              groupedQs = groupedQs.concat(noSecQs);
          }
          test.questions = groupedQs;
      } else {
          test.questions = test.questions.sort(() => Math.random() - 0.5);
      }
  }

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
  
  // 100% FOOLPROOF: AUTO-SAVE & RESUME LOGIC
  var userIdent = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : ((typeof isOfflineMode !== 'undefined' && isOfflineMode) ? 'offline_user' : 'anonymous');
  var draftKey = 'exam_draft_' + activeTest.id + '_' + userIdent;
  var draft = localStorage.getItem(draftKey);

  if (draft) {
      let parsed = JSON.parse(draft);
      if (parsed.endTime > Date.now()) { 
          activeState = parsed.state;
          window.examEndTime = parsed.endTime;
          if(typeof showToast === 'function') showToast("Exam resumed successfully from draft.", "success");
      } else {
          localStorage.removeItem(draftKey); 
      }
  }

  if (!window.examEndTime || !draft || !activeState || activeState.done) {
      activeState={name,roll,answers:Array(test.questions.length).fill(0).map(()=>({val:null,marked:false})),cur:0,start:Date.now(),done:false, cheatLogs:[]};
      window.examEndTime = Date.now() + (test.duration * 60 * 1000);
      window.examWarnings = 0;
  }
  
  var mainHeader = document.querySelector('.app-header');
  if(mainHeader) mainHeader.style.display = 'none';
  
  if (activeTest.antiCheat) {
      document.addEventListener("visibilitychange", handleCheat);
      window.addEventListener("blur", handleCheat); 
  }
  if (activeTest.fullScreenMode) document.addEventListener("fullscreenchange", handleCheat);

  renderTest();
  
  // ABSOLUTE TIMER LOGIC (Throttling Proof)
  if(timerIv) clearInterval(timerIv);
  timerIv=setInterval(()=>{
    var secsLeft = Math.floor((window.examEndTime - Date.now()) / 1000);
    if (secsLeft < 0) secsLeft = 0;
    
    var el=document.getElementById('timerEl');
    if(el){
      var h=Math.floor(secsLeft/3600), m=Math.floor((secsLeft%3600)/60), s=secsLeft%60;
      el.textContent=(h?h+':':'')+(String(m).padStart(2,'0'))+':'+(String(s).padStart(2,'0'));
      if(secsLeft<=300) el.closest('.timer-pill').classList.add('timer-warn');
    }
    if(secsLeft<=0){ clearInterval(timerIv); doSubmit(); }
  },1000);
}

function renderTest(){
  var t=activeTest, st=activeState, qi=st.cur, q=t.questions[qi], ans=st.answers[qi];
  var locked=!t.allowChange&&ans.val!==null&&(!Array.isArray(ans.val)||ans.val.length>0);
  
  var el=document.getElementById('student-test');
  el.classList.remove('hidden');
  document.getElementById('student-home').classList.add('hidden');
  
  var sectionTabsHTML = '';
  if (t.sections && t.sections.length > 0) {
      sectionTabsHTML = `<div style="display:flex; gap:8px; background:var(--color-background-secondary); padding:8px 16px; border-bottom:1px solid var(--color-border-secondary); overflow-x:auto; scrollbar-width:none;">
          ${t.sections.map(sec => {
              var firstQIdx = t.questions.findIndex(qq => qq.section === sec);
              var isCurrentSec = (q.section === sec) || (!q.section && sec === t.sections[0]);
              return `<button class="btn btn-sm" style="${isCurrentSec ? 'background:#185FA5; color:#fff; border-color:#185FA5;' : 'background:#fff; color:var(--color-text-secondary); border-color:#cbd5e1;'} font-weight:600; white-space:nowrap;" onclick="if(${firstQIdx}>-1) { goQ(${firstQIdx}); }">${sec}</button>`;
          }).join('')}
      </div>`;
  }

  var paletteHTML = '';
  if (t.sections && t.sections.length > 0) {
      paletteHTML = t.sections.map(sec => {
          let secQsHtml = '';
          let localQNum = 1;
          t.questions.forEach((qq, i) => {
              if (qq.section === sec || (!qq.section && sec === t.sections[0])) {
                  var a=st.answers[i]; var done=a.val!==null&&(!Array.isArray(a.val)||a.val.length > 0); var cls=a.marked&&done?'p-both':a.marked?'p-marked':done?'p-answered':'p-unanswered';
                  secQsHtml += `<button class="pal-btn ${cls}${i===qi?' p-current':''}" onclick="closeMobilePalette(); goQ(${i})">${localQNum}</button>`;
                  localQNum++;
              }
          });
          if (!secQsHtml) return '';
          return `<div style="font-size:13px; font-weight:700; color:var(--color-text-secondary); margin:15px 0 8px 0; text-transform:uppercase; letter-spacing:0.5px;"><i class="ti ti-folder"></i> ${sec}</div>
                  <div class="palette-grid">${secQsHtml}</div>`;
      }).join('');
  } else {
      paletteHTML = `<div class="palette-grid">
        ${t.questions.map((qq,i)=>{
          var a=st.answers[i]; var done=a.val!==null&&(!Array.isArray(a.val)||a.val.length > 0); var cls=a.marked&&done?'p-both':a.marked?'p-marked':done?'p-answered':'p-unanswered';
          return `<button class="pal-btn ${cls}${i===qi?' p-current':''}" onclick="closeMobilePalette(); goQ(${i})">${i+1}</button>`;
        }).join('')}
      </div>`;
  }

  el.innerHTML=`
    <div class="test-topbar">
      <div>
        <div style="font-size:18px;font-weight:600;margin-bottom:2px">${t.title}</div>
        <div style="font-size:13px;opacity:0.85">${st.name}${st.roll?' · '+st.roll:''} &nbsp;&bull;&nbsp; Q ${qi+1} / ${t.questions.length}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="timer-pill"><i class="ti ti-clock" style="font-size:18px"></i><span id="timerEl">--:--</span></div>
        <button class="btn btn-sm hide-mobile" style="background:rgba(255,255,255,0.2);border:none;color:#fff;font-weight:600" onclick="confirmSubmit()"><i class="ti ti-send"></i> Finish</button>
      </div>
    </div>
    ${sectionTabsHTML}
    <div id="palette-overlay" class="palette-overlay" onclick="closeMobilePalette()"></div>
    
    <div class="test-layout">
      <div class="q-area">
        <div class="q-block-header" style="margin-bottom:1.5rem; border-bottom:1px solid var(--color-border-secondary); padding-bottom:1rem;">
          <div class="q-num-badge" style="width:36px;height:36px;font-size:16px;">${qi+1}</div>
          <span class="badge ${tbadge(q.type)}">${tlabel(q.type)}</span>
          ${q.section ? `<span class="badge b-purple" style="font-weight:600;"><i class="ti ti-layout-grid-add"></i> ${q.section}</span>` : ''} 
          <span class="badge b-blue" style="font-size:13px">${q.marks} Marks</span>
          ${ans.marked?'<span class="badge b-amber"><i class="ti ti-bookmark" style="font-size:12px"></i> Marked</span>':''}
          ${locked?'<span class="badge b-red"><i class="ti ti-lock" style="font-size:12px"></i> Locked</span>':''}
        </div>
        
        <div style="font-size:16px;line-height:1.7;margin-bottom:2rem;color:var(--color-text-primary);font-weight:500;">${q.text||'<em style="color:var(--color-text-secondary)">No question text.</em>'}</div>
        ${q.imgUrl ? `<div style="margin-bottom:1.5rem;"><img src="${q.imgUrl}" style="max-width:100%; max-height:250px; border-radius:8px; border:1px solid var(--color-border-secondary);"></div>` : ''}
        ${renderStudentOpts(q,qi,ans,locked)}
        
        <div style="display:flex;gap:10px;margin-top:1.5rem;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="togMark(${qi})" style="${ans.marked?'color:#633806;border-color:#FAC775;background:#FAEEDA;font-weight:600':''}">
            <i class="ti ti-bookmark"></i> ${ans.marked?'Unmark':'Mark for Review'}
          </button>
          ${!locked&&ans.val!==null?`<button class="btn btn-sm btn-danger" onclick="clearAns(${qi})"><i class="ti ti-eraser"></i> Clear Selection</button>`:''}
        </div>
        
        <div class="q-nav-row" id="mobile-nav-bar">
          <button class="btn" onclick="goQ(${qi-1})" ${qi===0||!t.allowNav?'disabled':''}><i class="ti ti-arrow-left"></i> <span class="hide-mobile">Prev</span></button>
          ${t.showPalette ? `<button class="btn hide-desktop" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#0f172a; flex:0.4;" onclick="openMobilePalette()"><i class="ti ti-layout-grid" style="margin:0; font-size:22px;"></i></button>` : ''}
          ${qi<t.questions.length-1?`<button class="btn btn-primary" onclick="goQ(${qi+1})" ${!t.allowNav&&qi<t.questions.length-1?'':''}>Next <i class="ti ti-arrow-right"></i></button>`:`<button class="btn btn-success" style="font-weight:600" onclick="confirmSubmit()"><i class="ti ti-check"></i> Submit</button>`}
        </div>
      </div>
      
      ${t.showPalette?`<div class="sidebar-panel" id="mobile-palette-sheet">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <div style="font-size:16px;font-weight:600;color:var(--color-text-primary)">Question Palette</div>
            <i class="ti ti-x hide-desktop" style="font-size:24px; cursor:pointer; color:var(--color-text-secondary);" onclick="closeMobilePalette()"></i>
        </div>
        <div class="legend-row">
          <div class="leg"><div class="leg-dot" style="background:var(--color-background-primary);border:1px solid var(--color-border-primary)"></div>Unvisited</div>
          <div class="leg"><div class="leg-dot" style="background:#185FA5"></div>Answered</div>
          <div class="leg"><div class="leg-dot" style="background:#FAC775"></div>Marked</div>
        </div>
        ${paletteHTML}
        <div class="divider"></div>
        <button class="btn btn-primary" style="width:100%;justify-content:center;font-weight:600; padding:12px;" onclick="confirmSubmit()"><i class="ti ti-send"></i> Submit Final Test</button>
      </div>`:''}
    </div>`;
}

function renderStudentOpts(q,qi,ans,locked){
  if(q.type==='mcq'){ return q.options.map((o,j)=>`<button class="opt-btn${ans.val===j?' sel':''}" onclick="${locked?'':`pickMCQ(${qi},${j})`}"><div class="olabel">${ans.val===j?'<i class="ti ti-check" style="font-size:14px"></i>':String.fromCharCode(65+j)}</div><span style="font-size:15px">${o||'Option '+String.fromCharCode(65+j)}</span></button>`).join(''); }
  else if(q.type==='msq'){ var arr=Array.isArray(ans.val)?ans.val:[]; return q.options.map((o,j)=>`<button class="opt-btn${arr.includes(j)?' sel':''}" onclick="${locked?'':`pickMSQ(${qi},${j})`}"><div class="olabel" style="border-radius:4px">${arr.includes(j)?'<i class="ti ti-check" style="font-size:14px"></i>':String.fromCharCode(65+j)}</div><span style="font-size:15px">${o||'Option '+String.fromCharCode(65+j)}</span></button>`).join(''); }
  else if(q.type==='integer'){ return `<div style="margin-bottom:1rem"><label style="font-size:15px">Enter your integer answer below:</label><input type="number" value="${ans.val!==null?ans.val:''}" ${locked?'disabled':''} onchange="pickInt(${qi},this.value)" style="max-width:250px;font-size:20px;font-weight:600;text-align:center;padding:12px" placeholder="0"></div>`; }
  else{ return `<div style="margin-bottom:1rem"><label style="font-size:15px">Type your descriptive answer below:</label><textarea style="min-height:160px;font-size:15px" ${locked?'disabled':''} onchange="pickSubj(${qi},this.value)" placeholder="Write your detailed answer here...">${ans.val||''}</textarea></div>`; }
}

window.saveExamDraft = function() {
    if(!activeTest || !activeState || activeState.done) return;
    var userIdent = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : ((typeof isOfflineMode !== 'undefined' && isOfflineMode) ? 'offline_user' : 'anonymous');
    localStorage.setItem('exam_draft_' + activeTest.id + '_' + userIdent, JSON.stringify({ state: activeState, endTime: window.examEndTime }));
};

function pickMCQ(qi,j){activeState.answers[qi].val=j; window.saveExamDraft(); renderTest();}
function pickMSQ(qi,j){ if(!Array.isArray(activeState.answers[qi].val)) activeState.answers[qi].val=[]; var a=activeState.answers[qi].val, idx=a.indexOf(j); idx>-1?a.splice(idx,1):a.push(j); window.saveExamDraft(); renderTest(); }
function pickInt(qi,v){activeState.answers[qi].val=v===''?null:+v; window.saveExamDraft();}
function pickSubj(qi,v){activeState.answers[qi].val=v||null; window.saveExamDraft();}
function clearAns(qi){activeState.answers[qi].val=null; window.saveExamDraft(); renderTest();}
function togMark(qi){activeState.answers[qi].marked=!activeState.answers[qi].marked; window.saveExamDraft(); renderTest();}

function confirmSubmit(){
  var answered=activeState.answers.filter(a=>a.val!==null&&(!Array.isArray(a.val)||a.val.length>0)).length;
  var total=activeTest.questions.length;
  showModal(`<div style="padding:1rem"><div style="font-size:22px;font-weight:600;margin-bottom:1rem;color:var(--color-text-primary)">Are you sure you want to submit?</div><div style="font-size:15px;color:var(--color-text-secondary);margin-bottom:1.5rem;line-height:1.6">You have answered <strong style="color:var(--color-text-primary)">${answered}</strong> out of <strong style="color:var(--color-text-primary)">${total}</strong> questions.${answered<total?`<br><span style="color:#A32D2D;font-weight:500;display:inline-block;margin-top:5px"><i class="ti ti-alert-circle"></i> Warning: ${total-answered} question(s) left unanswered.</span>`:''}</div><div style="display:flex;gap:12px"><button class="btn btn-primary" style="flex:1;font-weight:600;font-size:15px" onclick="hideModal();doSubmit()"><i class="ti ti-check"></i> Yes, Submit Now</button><button class="btn" style="flex:1;font-weight:600" onclick="hideModal()">No, Review Paper</button></div></div>`);
}

function doSubmit(){
  if(!activeTest||activeState.done)return;
  clearInterval(timerIv); activeState.done=true;

 var userIdent = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : ((typeof isOfflineMode !== 'undefined' && isOfflineMode) ? 'offline_user' : 'anonymous');
  localStorage.removeItem('exam_draft_' + activeTest.id + '_' + userIdent);

  document.removeEventListener("visibilitychange", handleCheat); 
  document.removeEventListener("fullscreenchange", handleCheat);
  window.removeEventListener("blur", handleCheat); 
  
  var neg=activeTest.negMarking||0; var score=0,correct=0,wrong=0,skipped=0;
  
  var details=activeTest.questions.map((q,i)=>{
    var ans=activeState.answers[i]; var status,earned=0;
    var hasVal=ans.val!==null&&(!Array.isArray(ans.val)||ans.val.length>0);
    if(!hasVal){skipped++;status='skipped';return{q,ans,status,earned};}
    if(q.type==='mcq'){ if(ans.val===q.correct[0]){correct++;earned=q.marks;score+=q.marks;status='correct';} else{wrong++;earned=-neg;score-=neg;status='wrong';} }
    else if(q.type==='msq'){ var userSel = Array.isArray(ans.val) ? ans.val : []; var corrSel = q.correct; var hasWrongOption = userSel.some(x => !corrSel.includes(x)); var correctlySelected = userSel.filter(x => corrSel.includes(x)).length; if (hasWrongOption) { wrong++; earned = -neg; score -= neg; status = 'wrong'; } else if (correctlySelected === corrSel.length) { correct++; earned = q.marks; score += q.marks; status = 'correct'; } else if (correctlySelected > 0) { var partialMarks = (q.marks / corrSel.length) * correctlySelected; let earned = Math.round(partialMarks * 100) / 100; score += earned; correct++; status = 'partial'; } else { wrong++; status = 'wrong'; } }
    else if(q.type==='integer'){ if(ans.val===q.correctInt){correct++;earned=q.marks;score+=q.marks;status='correct';} else{wrong++;earned=-neg;score-=neg;status='wrong';} }
    else{skipped++;status='submitted';}
    return{q,ans,status,earned};
  });
  
  score = Number(score.toFixed(2));
  var userIdent = 'anonymous';
  if (typeof isOfflineMode !== 'undefined' && isOfflineMode) userIdent = 'offline_user';
  else if (currentUser) userIdent = currentUser.uid;

  // NAYA: cheatLogs array ko submission package me add kar diya
  var sub = { uid: userIdent, email: currentUser ? currentUser.email : '', name: activeState.name, roll: activeState.roll, score, correct, wrong, skipped, details, time: new Date().toLocaleString('en-IN'), totalMarks: activeTest.totalMarks, cheatLogs: activeState.cheatLogs || [] };
  
  var t=tests.find(x=>x.id===activeTest.id);
  if(t && t.id !== 'prev') { if(!t.submissions) t.submissions = []; t.submissions.push(sub); updateDatabase(); }
  
  document.getElementById('student-test').classList.add('hidden');
  closeMobilePalette();

  if(activeTest.id !== 'prev' && activeTest.resultVis === 'manual') {
      var mainHeader = document.querySelector('.app-header');
      if(mainHeader) mainHeader.style.display = ''; 
      showModal(`<div style="text-align:center;padding:2rem"><i class="ti ti-check" style="font-size:56px;color:#3B6D11;margin-bottom:1rem;display:block"></i><h3 style="font-size:24px;margin-bottom:0.5rem;font-weight:600">Test Submitted Successfully!</h3><p style="color:var(--color-text-secondary);margin-bottom:2rem;font-size:15px">Your answers have been securely saved. The examiner will review the paper and declare the results manually.</p><button class="btn btn-primary" style="font-size:16px;padding:10px 24px" onclick="resetStudent(); hideModal()">Return to Dashboard</button></div>`);
  } else {
      var el = document.getElementById('student-result');
      el.classList.remove('hidden');
      el.innerHTML = `<div class="spinner-container"><div class="spinner"></div><div>Processing Result...</div></div>`;
      setTimeout(() => { _generateResultDOM(sub, activeTest, false); }, 600);
  }
}

function launchDemoTest() {
    var demoTest = { id: 'demo_' + Date.now(), code: 'DEMO', title: 'Platform UI Demo Test', subject: 'Familiarization', duration: 5, totalMarks: 8, negMarking: 0, allowChange: true, showPalette: true, allowNav: true, fullScreenMode: false, antiCheat: false, resultVis: 'instant', questions: [ { type: 'mcq', text: 'How does the question palette work?', marks: 4, options: ['Clicking a number jumps to that question', 'It changes color when answered', 'It helps track pending questions', 'All of the above'], correct: [3], explanation: 'The palette is a navigation map. It turns blue when answered, and yellow when marked for review.' }, { type: 'msq', text: 'Which of the following are features of ExamiTop? (Select multiple)', marks: 4, options: ['Anti-Cheat Tab Lock', 'Live Video Streaming', 'Instant Auto-Evaluation', 'Detailed Analytics'], correct: [0, 2, 3], explanation: 'ExamiTop focuses on secure proctoring and analytics.' } ], submissions: [] };
    var demoName = currentUser ? (currentUser.displayName || 'Demo Student') : 'Guest Explorer';
    nav('student'); 
    document.getElementById('student-home').classList.add('hidden');
    launchTest(demoTest, demoName, 'DEMO-01');
}

function updateStudentUIForRole() {
    var demoContainer = document.getElementById('demo-test-container');
    if (demoContainer) { if (userRole === 'guest') demoContainer.classList.add('hidden'); else demoContainer.classList.remove('hidden'); }
}

function resetStudent(){
  activeTest=null; activeState=null;
  var h = document.getElementById('student-home');
  var t = document.getElementById('student-test');
  var r = document.getElementById('student-result');
  if(h) h.classList.remove('hidden');
  if(t) t.classList.add('hidden');
  if(r) r.classList.add('hidden');
  closeMobilePalette();
  
  var mainHeader = document.querySelector('.app-header');
  if(mainHeader) mainHeader.style.display = '';
  
  if(currentUser && document.getElementById('s-name')) { document.getElementById('s-name').value = currentUser.displayName || ''; }
  if (userRole === 'student') nav('student-dashboard');
  else if (userRole === 'guest') nav('student'); 
  else if (typeof isOfflineMode !== 'undefined' && isOfflineMode) nav('student');
  if (typeof updateStudentUIForRole === 'function') updateStudentUIForRole();
}

// ------------------------------------------------------------------
// KEYBOARD SHORTCUTS & ENTER KEY LISTENER
// ------------------------------------------------------------------
document.addEventListener('keyup', function(e) {
    if (e.key === 'Enter') {
        let activeEl = document.activeElement;
        if (activeEl && (activeEl.id === 's-name' || activeEl.id === 's-roll' || activeEl.id === 's-code')) {
            joinTest();
        }
    }
});

document.addEventListener('keydown', function(e) {
    if (!activeTest || !activeState || activeState.done) return;

    let activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;

    let qi = activeState.cur;
    let q = activeTest.questions[qi];
    let totalQs = activeTest.questions.length;

    if (e.key === 'ArrowRight' && qi < totalQs - 1) { goQ(qi + 1); } 
    else if (e.key === 'ArrowLeft' && qi > 0) { goQ(qi - 1); }
    else if (e.key.toLowerCase() === 'm') { togMark(qi); }
    else if (['1', '2', '3', '4'].includes(e.key)) {
        let optIdx = parseInt(e.key) - 1; 
        if (q.type === 'mcq' && optIdx < q.options.length) { pickMCQ(qi, optIdx); } 
        else if (q.type === 'msq' && optIdx < q.options.length) {
            let currentAns = activeState.answers[qi].val;
            let arr = Array.isArray(currentAns) ? currentAns : [];
            let indexInArray = arr.indexOf(optIdx);
            if (indexInArray > -1) arr.splice(indexInArray, 1);
            else arr.push(optIdx);
            activeState.answers[qi].val = arr;
            renderTest();
        }
    }
});