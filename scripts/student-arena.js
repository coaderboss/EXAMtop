// ==========================================
// UNIFIED PRACTICE ARENA (OpenTDB + Gemini AI)
// ==========================================

// --- UI DYNAMIC DROPDOWN LOGIC ---
window.switchArenaMode = function() {
    const mode = document.getElementById('arena-mode').value;
    const examConfig = document.getElementById('exam-config-row');
    const actionBtn = document.getElementById('arena-action-btn');
    const practiceArea = document.getElementById('practice-area');

    practiceArea.innerHTML = ''; // Clear screen when switching

    if (mode === 'general') {
        examConfig.style.display = 'none';
        actionBtn.innerHTML = '<i class="ti ti-player-play"></i> Start Random Trivia';
        actionBtn.onclick = fetchNewPracticeQ; // Calls OpenTDB
    } else {
        examConfig.style.display = 'flex';
        actionBtn.innerHTML = '<i class="ti ti-wand"></i> Generate AI Question';
        actionBtn.onclick = fetchAIQuestion; // Calls Gemini
        updateArenaSubjects(); // Initialize subjects based on default selection
    }
};

window.updateArenaSubjects = function() {
    const exam = document.getElementById('arena-exam').value;
    const subjDropdown = document.getElementById('arena-subject');
    const chapterInput = document.getElementById('arena-chapter');

    subjDropdown.innerHTML = ''; // Reset

    if (exam === 'JEE Mains') {
        subjDropdown.innerHTML = '<option value="Physics">Physics</option><option value="Chemistry">Chemistry</option><option value="Mathematics">Mathematics</option>';
        chapterInput.placeholder = "Enter Chapter (e.g., Kinematics, Integration)";
    } else if (exam === 'NEET') {
        subjDropdown.innerHTML = '<option value="Physics">Physics</option><option value="Chemistry">Chemistry</option><option value="Biology">Biology</option>';
        chapterInput.placeholder = "Enter Chapter (e.g., Human Physiology)";
    } else if (exam === 'College (CSE)') {
        subjDropdown.innerHTML = '<option value="Computer Science">Computer Science</option>';
        chapterInput.placeholder = "Enter Topic (e.g., OOPs, Operating Systems, DSA)";
    }
};

// --- 1. GENERAL TRIVIA ENGINE (OpenTDB) ---
let currentPracticeQ = null;

window.fetchNewPracticeQ = async function() {
    var area = document.getElementById('practice-area');
    area.innerHTML = `<div class="spinner-container" style="padding:3rem 0; text-align:center;"><div class="spinner" style="margin: 0 auto;"></div><div style="margin-top:10px; color:var(--color-text-secondary);">Fetching global challenge...</div></div>`;
    
    try {
        let res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
        let data = await res.json();
        
        if(data.results && data.results.length > 0) {
            currentPracticeQ = data.results[0];
            renderPracticeQ(); // Render OpenTDB Question
        } else {
            throw new Error("No data");
        }
    } catch (e) {
        area.innerHTML = `<div class="card" style="text-align:center; color:#A32D2D; background:#FCEBEB; border-color:#F7C1C1; padding:2rem;"><i class="ti ti-wifi-off" style="font-size:40px; margin-bottom:10px;"></i><br>Network Error. Could not fetch question.</div>`;
    }
};

function decodeHTML(html) {
    var txt = document.createElement("textarea"); txt.innerHTML = html; return txt.value;
}

window.renderPracticeQ = function() {
    var area = document.getElementById('practice-area');
    var q = currentPracticeQ;
    
    var options = [...q.incorrect_answers, q.correct_answer];
    options.sort(() => Math.random() - 0.5);
    
    var diffColor = q.difficulty === 'hard' ? '#A32D2D' : (q.difficulty === 'medium' ? '#854F0B' : '#3B6D11');
    var diffBg = q.difficulty === 'hard' ? '#FCEBEB' : (q.difficulty === 'medium' ? '#FAEEDA' : '#EAF3DE');

    area.innerHTML = `
        <div class="card" style="padding: 2rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:1.5rem; align-items:center;">
                <span class="badge b-gray"><i class="ti ti-category"></i> ${decodeHTML(q.category)}</span>
                <span class="badge" style="background:${diffBg}; color:${diffColor}; text-transform:capitalize;">${q.difficulty}</span>
            </div>
            <h3 style="font-size:18px; line-height:1.6; margin-bottom:2rem; color:var(--color-text-primary);">${decodeHTML(q.question)}</h3>
            <div style="display:flex; flex-direction:column; gap:10px;" id="practice-opts">
                ${options.map((opt, i) => `
                    <button class="opt-btn p-opt" style="padding:14px 16px;" onclick="checkPracticeAnswer(this, '${btoa(encodeURIComponent(opt))}', '${btoa(encodeURIComponent(q.correct_answer))}')">
                        <div class="olabel">${String.fromCharCode(65+i)}</div> 
                        <span style="font-size:15px; font-weight:500;">${decodeHTML(opt)}</span>
                    </button>
                `).join('')}
            </div>
            <button id="p-next-btn" class="btn btn-primary" style="width:100%; padding:14px; margin-top:20px; display:none; justify-content:center;" onclick="fetchNewPracticeQ()">
                Next Question <i class="ti ti-arrow-right"></i>
            </button>
        </div>`;
};

window.checkPracticeAnswer = function(btnElem, selectedBase64, correctBase64) {
    var selected = decodeURIComponent(atob(selectedBase64));
    var correct = decodeURIComponent(atob(correctBase64));
    var allBtns = document.querySelectorAll('.p-opt');
    
    allBtns.forEach(b => { b.disabled = true; b.style.opacity = '0.7'; });
    
    if (selected === correct) {
        btnElem.style.background = '#EAF3DE'; btnElem.style.borderColor = '#3B6D11'; btnElem.style.color = '#27500A'; btnElem.style.opacity = '1';
        btnElem.innerHTML += `<span style="margin-left:auto;"><i class="ti ti-check" style="font-size:20px;"></i></span>`;
    } else {
        btnElem.style.background = '#FCEBEB'; btnElem.style.borderColor = '#A32D2D'; btnElem.style.color = '#791F1F'; btnElem.style.opacity = '1';
        btnElem.innerHTML += `<span style="margin-left:auto;"><i class="ti ti-x" style="font-size:20px;"></i></span>`;
        allBtns.forEach(b => { if(b.innerText.includes(decodeHTML(correct))) { b.style.borderColor = '#3B6D11'; b.style.borderWidth = '2px'; b.style.opacity = '1'; } });
    }
    document.getElementById('p-next-btn').style.display = 'flex';
};

// --- 2. COMPETITIVE EXAM ENGINE (Gemini AI) ---
window.currentAIQuestion = null;

window.fetchAIQuestion = async function() {
    const exam = document.getElementById('arena-exam').value;
    const subject = document.getElementById('arena-subject').value;
    const chapterInput = document.getElementById('arena-chapter');
    const chapter = chapterInput.value.trim();
    const btn = document.getElementById('arena-action-btn');
    const area = document.getElementById('practice-area');

    // 1. SMART VALIDATION (No big cards, just input highlight)
    if (!chapter) {
        chapterInput.style.transition = "all 0.3s ease";
        chapterInput.style.borderColor = "#e63946"; // Red warning border
        chapterInput.style.boxShadow = "0 0 0 4px rgba(230, 57, 70, 0.15)";
        chapterInput.placeholder = "⚠️ Please enter a chapter name first!";
        chapterInput.focus();
        
        // 3 second baad wapas normal kar do
        setTimeout(() => {
            chapterInput.style.borderColor = "";
            chapterInput.style.boxShadow = "";
            updateArenaSubjects(); // Reset placeholder text to original
        }, 3000);
        return;
    }

    // Button loading state
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader" style="animation: spin 1s linear infinite;"></i> Generating...';
    
    // 2. PREMIUM SKELETON LOADER (Shimmer Effect)
    area.innerHTML = `
    <style>
        @keyframes pulse-shimmer {
            0% { opacity: 0.4; }
            50% { opacity: 0.8; }
            100% { opacity: 0.4; }
        }
        .skeleton-box { background: #e2e8f0; border-radius: 8px; animation: pulse-shimmer 1.5s infinite ease-in-out; }
    </style>
    <div class="card" style="padding: 2rem; border-top: 4px solid #cbd5e1; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; margin-bottom:2rem; align-items:center;">
            <div class="skeleton-box" style="height: 28px; width: 120px; border-radius: 20px;"></div>
            <div class="skeleton-box" style="height: 28px; width: 150px; border-radius: 20px;"></div>
        </div>
        <div class="skeleton-box" style="height: 22px; width: 100%; margin-bottom: 12px;"></div>
        <div class="skeleton-box" style="height: 22px; width: 85%; margin-bottom: 2.5rem;"></div>
        
        <div style="display:flex; flex-direction:column; gap:12px;">
            <div class="skeleton-box" style="height: 55px; width: 100%; border-radius: 12px; background: #f1f5f9;"></div>
            <div class="skeleton-box" style="height: 55px; width: 100%; border-radius: 12px; background: #f1f5f9;"></div>
            <div class="skeleton-box" style="height: 55px; width: 100%; border-radius: 12px; background: #f1f5f9;"></div>
            <div class="skeleton-box" style="height: 55px; width: 100%; border-radius: 12px; background: #f1f5f9;"></div>
        </div>
        <div style="text-align:center; margin-top: 20px; color: #64748b; font-size: 13px; font-weight: 500;">
            <i class="ti ti-wand"></i> AI is crafting a unique question for you...
        </div>
    </div>`;

    try {
        const res = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ examTarget: exam, subject: subject, chapter: chapter })
        });

        const rawText = await res.text();

        if (!res.ok) {
            if (res.status === 503 || res.status === 504 || rawText.includes("high demand") || rawText.includes("timeout")) {
                throw new Error("HIGH_TRAFFIC");
            }
            throw new Error("API_REJECTED");
        }

        let qData;
        try {
            qData = JSON.parse(rawText);
        } catch (parseError) {
            throw new Error("JSON_ERROR");
        }

        if (qData.error) throw new Error("API_REJECTED");

        window.currentAIQuestion = qData;
        
        // 3. SUCCESS RENDER UI
        area.innerHTML = `
        <div class="card" style="padding: 2rem; border-top: 4px solid #534AB7; border-radius: 16px; box-shadow: 0 10px 40px rgba(83, 74, 183, 0.08);">
            <div style="display:flex; justify-content:space-between; margin-bottom:1.5rem; align-items:center; flex-wrap:wrap; gap:8px;">
                <span class="badge b-purple"><i class="ti ti-wand"></i> AI Generated</span>
                <span class="badge b-blue">${exam} &bull; ${subject}</span>
            </div>
            <h3 style="font-size:18px; line-height:1.6; margin-bottom:2rem; color:var(--color-text-primary);">${qData.question}</h3>
            <div style="display:flex; flex-direction:column; gap:10px;" id="ai-opts-container">
                ${qData.options.map((opt, idx) => `
                    <button class="opt-btn ai-opt" style="padding:14px 16px;" onclick="checkAIAnswer(${idx}, this)">
                        <div class="olabel">${String.fromCharCode(65+idx)}</div> 
                        <span style="font-size:15px; font-weight:500;">${opt}</span>
                    </button>
                `).join('')}
            </div>
            
            <div id="ai-solution-box" style="margin-top: 20px; padding: 18px; background: #EEEDFE; border-left: 5px solid #534AB7; border-radius: 10px; display: none; animation: fadeIn 0.4s ease;">
                <h4 style="color: #3C3489; margin: 0 0 10px 0; font-size: 15px; display: flex; align-items: center; gap: 6px; font-weight: 700;"><i class="ti ti-bulb"></i> AI Solution</h4>
                <p style="color: #1e293b; font-size: 14px; line-height: 1.6; margin: 0;">${qData.solution}</p>
            </div>

            <button id="ai-next-btn" class="btn btn-primary" style="width:100%; padding:14px; margin-top:20px; display:none; justify-content:center; border-radius: 10px; font-size: 15px; font-weight: 600;" onclick="fetchAIQuestion()">
                Generate Another Question <i class="ti ti-arrow-right"></i>
            </button>
        </div>`;

    } catch (err) {
        // 4. SMART ERROR CARDS (Traffic, API, JSON issues)
        let errTitle = "Oops! Something went wrong.";
        let errMsg = "We couldn't generate the question this time.";
        let errIcon = "ti-alert-triangle";
        let errColor = "#A32D2D"; 
        let errBg = "#FCEBEB";
        
        if (err.message === "HIGH_TRAFFIC") {
            errTitle = "AI is taking a coffee break ☕";
            errMsg = "Lots of students are practicing right now! The AI servers are experiencing high traffic. Please wait 10 seconds and try again.";
            errIcon = "ti-hourglass-high";
            errColor = "#854F0B"; 
            errBg = "#FAEEDA";
        } else if (err.message === "JSON_ERROR") {
            errTitle = "The AI got a little confused 🤖";
            errMsg = "We received an incomplete question from the AI. Don't worry, just click try again to get a fresh one!";
            errIcon = "ti-robot-off";
            errColor = "#3C3489"; 
            errBg = "#EEEDFE";
        } else if (err.message === "Failed to fetch" || !navigator.onLine) {
            errTitle = "No Internet Connection 📡";
            errMsg = "Please check your Wi-Fi or mobile data and try again.";
            errIcon = "ti-wifi-off";
        }

        area.innerHTML = `
        <div class="card" style="padding: 2.5rem 1.5rem; text-align: center; border-radius: 16px; border-top: 4px solid ${errColor}; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
            <div style="width: 64px; height: 64px; background: ${errBg}; color: ${errColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; font-size: 32px;">
                <i class="ti ${errIcon}"></i>
            </div>
            <h3 style="font-size: 1.25rem; color: #0f172a; margin-bottom: 0.5rem; font-weight: 700;">${errTitle}</h3>
            <p style="color: #64748b; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; max-width: 400px; margin-left: auto; margin-right: auto;">${errMsg}</p>
            <button class="btn btn-primary" style="padding: 12px 24px; font-weight: 600; border-radius: 8px; background: ${errColor}; border-color: ${errColor};" onclick="fetchAIQuestion()">
                <i class="ti ti-reload"></i> Try Again
            </button>
        </div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-wand"></i> Generate AI Question';
    }
};

window.checkAIAnswer = function(selectedIndex, btnElem) {
    const qData = window.currentAIQuestion;
    if (!qData) return;

    const allBtns = document.querySelectorAll('.ai-opt');
    allBtns.forEach(b => { b.disabled = true; b.style.opacity = '0.7'; b.style.pointerEvents = 'none'; });

    if (selectedIndex === qData.correct_index) {
        btnElem.style.background = '#EAF3DE'; btnElem.style.borderColor = '#3B6D11'; btnElem.style.color = '#27500A'; btnElem.style.opacity = '1';
        btnElem.innerHTML += `<span style="margin-left:auto; color:#3B6D11; font-weight:bold;">Correct!</span>`;
    } else {
        btnElem.style.background = '#FCEBEB'; btnElem.style.borderColor = '#A32D2D'; btnElem.style.color = '#791F1F'; btnElem.style.opacity = '1';
        btnElem.innerHTML += `<span style="margin-left:auto; color:#A32D2D; font-weight:bold;">Wrong</span>`;
        allBtns[qData.correct_index].style.borderColor = '#3B6D11';
        allBtns[qData.correct_index].style.borderWidth = '2px';
        allBtns[qData.correct_index].style.opacity = '1';
    }

    document.getElementById('ai-solution-box').style.display = 'block';
    document.getElementById('ai-next-btn').style.display = 'flex';
};