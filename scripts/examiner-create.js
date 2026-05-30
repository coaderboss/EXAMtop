// ==========================================
// EXAMINER: TEST CREATION & BULK IMPORT LOGIC
// ==========================================

function addQ(data, insertAfterIdx = null){
  var type = data ? data.type : document.getElementById('add-type').value;
  var q = data || {id:Date.now()+Math.random(), type, text:'', marks:4, options:['','','',''], correct:[], correctInt:null, explanation:'', section:''};
  if(!data) q.id = Date.now()+Math.random();
  
  if (insertAfterIdx !== null) qList.splice(insertAfterIdx + 1, 0, q);
  else qList.push(q);
  renderQs();
}

function renderQs(){
  document.getElementById('qcount-badge').textContent = qList.length+' added';
  var secInput = document.getElementById('t-sections');
  var sections = secInput && secInput.value.trim() ? secInput.value.split(',').map(s=>s.trim()).filter(s=>s) : [];

  document.getElementById('q-container').innerHTML = qList.map((q,i)=>{
    var secHTML = sections.length > 0 ? `<select onchange="qList[${i}].section=this.value" style="margin-left:10px; padding:4px 8px; font-size:12px; font-weight:600; border-radius:6px; border:1px solid #185FA5; color:#185FA5; outline:none;">
        <option value="">-- Assign Section --</option>
        ${sections.map(s => `<option value="${s}" ${q.section===s?'selected':''}>${s}</option>`).join('')}
    </select>` : '';

    return `
    <div class="q-block">
      <div class="q-block-header">
        <div class="q-num-badge">${i+1}</div>
        <span class="badge ${tbadge(q.type)}">${tlabel(q.type)}</span>
        ${secHTML}
        <div style="margin-left:auto;display:flex;gap:10px;align-items:center">
          <span style="font-size:13px;color:var(--color-text-secondary);font-weight:600">Marks</span>
          <input type="number" value="${q.marks}" min="0" style="width:70px;font-size:14px;text-align:center" onchange="qList[${i}].marks=+this.value">
          <button class="btn btn-sm btn-danger" onclick="rmQ(${i})"><i class="ti ti-trash"></i></button>
        </div>
      </div>
      <div style="margin-bottom:1rem">
        <label>Question Text</label>
        <textarea placeholder="Type your question here..." onchange="qList[${i}].text=this.value" class="input-block">${q.text || ''}</textarea>
      </div>
      
      <div style="margin-bottom:1.5rem">
          <label><i class="ti ti-photo"></i> Question Image URL (Optional)</label>
          <input type="text" placeholder="Paste image link here (e.g., https://.../img.jpg)" value="${q.imgUrl||''}" onchange="qList[${i}].imgUrl=this.value; renderQs();" class="input-block">
          ${q.imgUrl ? `<img src="${q.imgUrl}" style="max-height:160px; margin-top:12px; border-radius:8px; border: 1px solid var(--color-border-secondary); box-shadow: 0 2px 8px rgba(0,0,0,0.05);">` : ''}
      </div>

      ${renderQEdit(q,i)}
      <div style="margin-top:1rem"><label>Explanation / Solution</label><input type="text" placeholder="Formula or logic..." value="${q.explanation||''}" onchange="qList[${i}].explanation=this.value"></div>
      <button class="btn btn-sm btn-ghost" style="width:100%; margin-top:1.5rem; border:1px dashed #cbd5e1; color:#185FA5; justify-content:center;" onclick="addQ(null, ${i})">
          <i class="ti ti-row-insert-bottom"></i> Add New Question Below
      </button>
    </div>`
  }).join('');
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
  if(!isOfflineMode && !currentUser) { 
        showModal(`<div style="text-align:center;padding:1.5rem"><i class="ti ti-lock" style="font-size:46px;color:#A32D2D;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:22px;margin-bottom:0.5rem">Login Required!</div><p style="font-size:14px;color:var(--color-text-secondary);margin-bottom:1.5rem">You need to log in as an examiner to save this test securely to the cloud.</p><div style="display:flex;gap:12px;justify-content:center"><button class="btn" style="background:var(--color-background-secondary); border:1px solid var(--color-border-secondary); color:var(--color-text-primary);" onclick="hideModal()">Cancel</button><button class="btn btn-primary" onclick="hideModal(); toggleLogin()"><i class="ti ti-brand-google"></i> Login Now</button></div></div>`); 
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
    sections: document.getElementById('t-sections') ? document.getElementById('t-sections').value.split(',').map(s=>s.trim()).filter(s=>s) : [],
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
    submissions:[], released:false, isActive: true, 
    createdAt:new Date().toLocaleDateString('en-IN')
  };
  
  tests.push(test); 
  updateDatabase(); 
  qList=[]; renderQs(); document.getElementById('t-title').value='';
  
  var modalMsg = isOfflineMode ? "Saved Locally!" : "Saved to Cloud!";
  var iconCol = isOfflineMode ? "#854F0B" : "#3B6D11";
  var bgCol = isOfflineMode ? "#FAEEDA" : "#EAF3DE";
  var extraTag = isOfflineMode ? '<span class="badge b-amber" style="position:absolute; top:10px; right:10px;">Offline</span>' : '<span class="badge b-green" style="position:absolute; top:10px; right:10px;">Cloud</span>';

  showModal(`<div style="text-align:center;padding:1rem; position:relative;">
    ${extraTag}
    <div style="width:72px;height:72px;border-radius:50%;background:${bgCol};display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem"><i class="ti ti-circle-check" style="font-size:40px;color:${iconCol}"></i></div>
    <div style="font-size:22px;font-weight:600;margin-bottom:0.5rem">Test ${modalMsg}</div>
    <div style="font-size:15px;color:var(--color-text-secondary);margin-bottom:1.5rem">Students can now join using this code:</div>
    <div style="font-size:36px;font-weight:600;letter-spacing:10px;color:#185FA5;background:#E6F1FB;padding:1.5rem;border-radius:var(--border-radius-lg);margin-bottom:1rem; border:1px dashed #b9d7f4;">${code}</div>
    <button class="btn btn-sm btn-blue" style="margin-bottom:2rem; font-weight:600" onclick="copyToClip('${code}')"><i class="ti ti-copy"></i> Copy Code</button>
    <div style="display:flex;gap:12px;justify-content:center"><button class="btn btn-primary" onclick="hideModal();nav('tests')"><i class="ti ti-list-check"></i> Manage Tests</button></div>
  </div>`);
}

function dlTemplate(){
  var t=JSON.stringify([ { section: 'Physics', type:'mcq', text:'What is the capital of France?', marks:4, options:['London','Berlin','Paris','Madrid'], correct:[2], explanation:'Paris is the capital of France.' } ],null,2);
  var b=new Blob([t],{type:'application/json'}),a=document.createElement('a'); a.href=URL.createObjectURL(b);a.download='examitop_template.json';a.click();
}

function importQ(inp){
  var f=inp.files[0];if(!f)return; var r=new FileReader();
  r.onload=e=>{ 
      try{ 
          var data=JSON.parse(e.target.result); 
          if(!Array.isArray(data)){alert('Must be a JSON array.');return;} 
          var importedSections = new Set();

          data.forEach(d=>{
              if(d.section) importedSections.add(d.section); 
              addQ({
                  id:Date.now()+Math.random(),
                  type:d.type||'mcq',
                  text:d.text||'',
                  marks:d.marks||4,
                  options:d.options||['','','',''],
                  correct:d.correct||[],
                  correctInt:d.correctInt||null,
                  modelAnswer:d.modelAnswer||'',
                  explanation:d.explanation||'',
                  section: d.section || ''
              });
          }); 

          if(importedSections.size > 0) {
              var secInput = document.getElementById('t-sections');
              if(secInput) {
                  var existing = secInput.value.split(',').map(s=>s.trim()).filter(s=>s);
                  importedSections.forEach(s => { if(!existing.includes(s)) existing.push(s); });
                  secInput.value = existing.join(', ');
              }
          }
          showModal(`<div style="text-align:center;padding:1.5rem"><i class="ti ti-check" style="font-size:42px;color:#3B6D11;display:block;margin-bottom:1rem"></i><div style="font-size:20px;font-weight:600;margin-bottom:0.5rem">Import Successful!</div><div style="font-size:14px;color:var(--color-text-secondary);">${data.length} questions mapped.</div></div>`); 
          renderQs(); 
      }catch(ex){ alert('Invalid JSON file.'); } 
  }; 
  r.readAsText(f); inp.value = ''; 
}

function previewAsStudent(){
  if(!qList.length){alert('Add questions first to preview.');return;}
  var t={id:'prev',code:'DEMO',title:document.getElementById('t-title').value||'Preview Test',subject:'Preview',duration:+document.getElementById('t-dur').value||60,totalMarks:300,negMarking:+document.getElementById('t-neg').value||0,allowChange:document.getElementById('t-change').checked,showPalette:document.getElementById('t-palette').checked,allowNav:document.getElementById('t-nav').checked,questions:JSON.parse(JSON.stringify(qList)),submissions:[],resultVis:'instant',scoreVis:'show'}; nav('student'); launchTest(t,'Demo Student','');
}

// Default placeholder Question
addQ({id:1,type:'mcq',text:'A particle moves with constant acceleration. Its velocity changes from 20 m/s to 60 m/s in 4 seconds. What is the acceleration?',marks:4,options:['5 m/s²','10 m/s²','15 m/s²','20 m/s²'],correct:[1],explanation:'a = (v-u)/t = (60-20)/4 = 10 m/s²'});