// ==========================================
// STUDENT EXAM ENGINE & ANTI-CHEAT LOGIC
// ==========================================

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
        ${q.imgUrl ? `<div style="margin-bottom:1.5rem;"><img src="${q.imgUrl}" style="max-width:100%; max-height:250px; border-radius:8px; border:1px solid var(--color-border-secondary);"></div>` : ''}
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
        wrong++; earned = -neg; score -= neg; status = 'wrong';
      } else if (correctlySelected === corrSel.length) {
        correct++; earned = q.marks; score += q.marks; status = 'correct';
      } else if (correctlySelected > 0) {
        var partialMarks = (q.marks / corrSel.length) * correctlySelected;
        earned = Math.round(partialMarks * 100) / 100; 
        score += earned;
        correct++; 
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
  
  score = Number(score.toFixed(2));
  var sub={name:activeState.name,roll:activeState.roll,score,correct,wrong,skipped,details,time:new Date().toLocaleString('en-IN'),totalMarks:activeTest.totalMarks};
  
  var t=tests.find(x=>x.id===activeTest.id);
  if(t && t.id !== 'prev') {
      if(!t.submissions) t.submissions = [];
      t.submissions.push(sub);
      updateDatabase(); 
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
      }else if(q.type==='integer'){ 
        optHTML=`<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:0.75rem">
          <div class="qr-opt ${d.status}" style="flex:1;font-size:15px">Answer Typed: <strong style="font-size:18px;margin-left:8px">${ans.val!==null?ans.val:'—'}</strong></div>
          <div class="qr-opt correct" style="flex:1;font-size:15px">Correct Key: <strong style="font-size:18px;margin-left:8px">${q.correctInt}</strong></div>
        </div>`;
      }else{
        optHTML=`<div class="qr-opt neutral" style="margin-bottom:0.75rem;align-items:flex-start;padding:1rem"><i class="ti ti-note" style="flex-shrink:0;margin-top:2px;font-size:18px;color:#185FA5"></i><span style="font-size:15px;line-height:1.6">${ans.val||'<em style="color:var(--color-text-secondary)">No answer written.</em>'}</span></div>
        ${q.modelAnswer?`<div class="qr-opt correct" style="align-items:flex-start;padding:1rem"><i class="ti ti-bulb" style="flex-shrink:0;margin-top:2px;font-size:18px"></i><span style="font-size:15px;line-height:1.6"><strong>Model Answer:</strong><br>${q.modelAnswer}</span></div>`:''}`;
      }
      var expHTML=q.explanation?`<div style="margin-top:1.25rem;padding:1rem;background:var(--color-background-tertiary);border-radius:var(--border-radius-md);font-size:14px;display:flex;gap:10px;align-items:flex-start;border:1px solid var(--color-border-secondary)"><i class="ti ti-info-circle" style="flex-shrink:0;color:#185FA5;font-size:18px;margin-top:2px"></i><span style="line-height:1.6"><strong>Explanation:</strong> ${q.explanation}</span></div>`:'';
      
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
          ${q.imgUrl ? `<div style="margin-bottom:1.5rem;"><img src="${q.imgUrl}" style="max-width:100%; max-height:250px; border-radius:8px; border:1px solid var(--color-border-secondary);"></div>` : ''}
          ${optHTML}
          ${expHTML}
          ${examinerInputHTML}
        </div>
      </div>`;
    }).join('');
  }

  var maxH=Math.max(sub.correct,sub.wrong,sub.skipped,1);
  var bH=c=>Math.max(16,Math.round((c/maxH)*80));
  
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