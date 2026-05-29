// ==========================================
// ENDLESS PRACTICE ARENA (FREE API LOGIC)
// ==========================================

let currentPracticeQ = null;

function startPracticeArena() {
    nav('practice');
    fetchNewPracticeQ();
}

async function fetchNewPracticeQ() {
    var area = document.getElementById('practice-area');
    area.innerHTML = `<div class="spinner-container" style="padding:3rem 0;"><div class="spinner"></div><div style="margin-top:10px; color:var(--color-text-secondary);">Fetching next challenge...</div></div>`;
    
    try {
        let res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
        let data = await res.json();
        
        if(data.results && data.results.length > 0) {
            currentPracticeQ = data.results[0];
            renderPracticeQ();
        } else {
            throw new Error("No data");
        }
    } catch (e) {
        area.innerHTML = `<div style="padding:2rem; color:#A32D2D;"><i class="ti ti-wifi-off" style="font-size:40px; margin-bottom:10px;"></i><br>Network Error. Could not fetch question.</div>
        <button class="btn btn-primary" onclick="fetchNewPracticeQ()">Try Again</button>`;
    }
}

function decodeHTML(html) {
    var txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}

function renderPracticeQ() {
    var area = document.getElementById('practice-area');
    var q = currentPracticeQ;
    
    var options = [...q.incorrect_answers, q.correct_answer];
    options.sort(() => Math.random() - 0.5);
    
    var diffColor = q.difficulty === 'hard' ? '#A32D2D' : (q.difficulty === 'medium' ? '#854F0B' : '#3B6D11');
    var diffBg = q.difficulty === 'hard' ? '#FCEBEB' : (q.difficulty === 'medium' ? '#FAEEDA' : '#EAF3DE');

    var html = `
        <div style="display:flex; justify-content:space-between; margin-bottom:1.5rem; align-items:center;">
            <span class="badge" style="background:var(--color-background-secondary); color:var(--color-text-secondary);"><i class="ti ti-category"></i> ${decodeHTML(q.category)}</span>
            <span class="badge" style="background:${diffBg}; color:${diffColor}; text-transform:capitalize;">${q.difficulty}</span>
        </div>
        
        <h3 style="font-size:18px; line-height:1.6; margin-bottom:2rem; color:var(--color-text-primary); text-align:left;">
            ${decodeHTML(q.question)}
        </h3>
        
        <div style="display:flex; flex-direction:column; gap:10px; text-align:left;" id="practice-opts">
            ${options.map((opt, i) => `
                <button class="opt-btn p-opt" style="justify-content:flex-start; padding:12px 15px;" onclick="checkPracticeAnswer(this, '${btoa(encodeURIComponent(opt))}', '${btoa(encodeURIComponent(q.correct_answer))}')">
                    <div class="olabel">${String.fromCharCode(65+i)}</div> 
                    <span style="font-size:15px;">${decodeHTML(opt)}</span>
                </button>
            `).join('')}
        </div>
        
        <div style="display:flex; gap:12px; margin-top:2rem; border-top:1px solid var(--color-border-secondary); padding-top:1.5rem;">
            <button class="btn" style="flex:1; background:#f8fafc; border:1px solid #e2e8f0; color:#64748b;" onclick="fetchNewPracticeQ()">
                <i class="ti ti-player-skip-forward"></i> Skip
            </button>
            <button id="p-next-btn" class="btn btn-primary" style="flex:1; display:none;" onclick="fetchNewPracticeQ()">
                Next Question <i class="ti ti-arrow-right"></i>
            </button>
        </div>
        
        <div style="margin-top:15px;">
            <button class="btn btn-sm btn-ghost" style="color:var(--color-text-secondary);" onclick="nav('student-dashboard')"><i class="ti ti-arrow-left"></i> Exit Arena</button>
        </div>
    `;
    area.innerHTML = html;
}

function checkPracticeAnswer(btnElem, selectedBase64, correctBase64) {
    var selected = decodeURIComponent(atob(selectedBase64));
    var correct = decodeURIComponent(atob(correctBase64));
    
    var allBtns = document.querySelectorAll('.p-opt');
    allBtns.forEach(b => {
        b.disabled = true;
        b.style.cursor = 'not-allowed';
        b.style.opacity = '0.7';
    });
    
    if (selected === correct) {
        btnElem.style.background = '#EAF3DE';
        btnElem.style.borderColor = '#3B6D11';
        btnElem.style.color = '#27500A';
        btnElem.innerHTML = `<div class="olabel" style="background:#3B6D11; color:#fff; border-color:#3B6D11;"><i class="ti ti-check"></i></div> <span style="font-size:15px; font-weight:600;">${decodeHTML(selected)}</span> <span style="margin-left:auto; color:#3B6D11; font-weight:bold;">Correct!</span>`;
    } else {
        btnElem.style.background = '#FCEBEB';
        btnElem.style.borderColor = '#A32D2D';
        btnElem.style.color = '#791F1F';
        btnElem.innerHTML = `<div class="olabel" style="background:#A32D2D; color:#fff; border-color:#A32D2D;"><i class="ti ti-x"></i></div> <span style="font-size:15px; font-weight:600;">${decodeHTML(selected)}</span> <span style="margin-left:auto; color:#A32D2D; font-weight:bold;">Wrong</span>`;
        
        allBtns.forEach(b => {
            if(b.innerText.includes(decodeHTML(correct))) {
                b.style.borderColor = '#3B6D11';
                b.style.borderWidth = '2px';
            }
        });
    }
    document.getElementById('p-next-btn').style.display = 'flex';
}
