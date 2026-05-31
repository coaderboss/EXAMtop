// ==========================================
// UTILITY FUNCTIONS (Toasts, Modals, CSV, Router)
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

function showModal(html){
    document.getElementById('modal-box').innerHTML=html;
    document.getElementById('modal-area').classList.remove('hidden');
}

function hideModal() {
    var modalArea = document.getElementById('modal-area');
    var mBox = document.getElementById('modal-box');
    if(modalArea) modalArea.classList.add('hidden');
    if(mBox) {
        mBox.innerHTML = '';
        // NAYA FIX: Modal band hone par uske styles wapas default/reset kar do
        mBox.style = ''; 
    }
}

// ==========================================
// SPA ROUTER & HISTORY MANAGEMENT
// ==========================================
window.addEventListener('popstate', function(event) {
    let hash = window.location.hash.replace('#', '') || 'home';
    if (activeState && !activeState.done && hash !== 'student') {
        if (!confirm("WARNING: You are in an active exam! Going back will cancel your test. Are you sure?")) {
            window.history.pushState(null, null, '#student');
            return;
        } else {
            exitToHome();
        }
    }
    switchPageUI(hash);
});

function nav(pageId) {
    window.location.hash = pageId; 
    switchPageUI(pageId);
}

 function switchPageUI(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    var target = document.getElementById('page-' + pageId);
    if(target) target.classList.add('active');
    
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    var tab = document.querySelector(`.nav-tab[onclick="nav('${pageId}')"]`);
    if(tab) tab.classList.add('active');
    
    // 🔥 THE FIX: Safety checks added so it doesn't crash if script is still downloading
    if(pageId === 'tests' && typeof renderTestList === 'function') renderTestList();
    if(pageId === 'results' && typeof renderAllResults === 'function') renderAllResults(); 
    
    if(pageId === 'student-dashboard' && typeof renderStudentDashboard === 'function') renderStudentDashboard();
    if(pageId === 'student-results' && typeof renderStudentResults === 'function') renderStudentResults();
    if(pageId === 'admin' && typeof renderAdminDashboard === 'function') renderAdminDashboard();
}

document.addEventListener('DOMContentLoaded', function() {
    let initialHash = window.location.hash.replace('#', '') || 'home';
    if(!window.location.hash) window.location.hash = 'home';
    switchPageUI(initialHash);
});

function exitToHome(isTestActive = false) {
    if (isTestActive && activeState && !activeState.done) {
        if (!confirm("Are you sure you want to exit? Your exam progress will be lost and test will be cancelled.")) return;
    }
    if(timerIv) clearInterval(timerIv);
    document.removeEventListener("visibilitychange", handleCheat);
    document.removeEventListener("fullscreenchange", handleCheat);
    if (document.fullscreenElement) document.exitFullscreen().catch(err => console.log(err));

    activeTest = null;
    activeState = null;
    
    var testScreen = document.getElementById('student-test');
    if(testScreen) testScreen.classList.add('hidden');
    
    var resultScreen = document.getElementById('student-result');
    if(resultScreen) resultScreen.classList.add('hidden');
    
    document.getElementById('student-home').classList.remove('hidden');
    if(currentUser) nav('tests'); else nav('student');
}

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
            <h3 style="color: var(--color-text-primary); border-left: 4px solid #854F0B; padding-left: 10px; margin-bottom: 1rem;">🎓 For Students</h3>
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

// --- SMART DARK MODE TOGGLE ---
function toggleDarkMode() {
    let body = document.documentElement;
    let icon = document.getElementById('dark-mode-icon');
    let text = document.getElementById('dark-mode-text');

    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        if(icon) icon.className = 'ti ti-moon';
        if(text) text.innerText = 'Dark Mode';
    } else {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        if(icon) icon.className = 'ti ti-sun';
        if(text) text.innerText = 'Light Mode';
    }
}

// Auto-apply theme on load
if(localStorage.getItem('theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    // Page load hone par agar dark mode on hai toh button update karo
    window.addEventListener('DOMContentLoaded', () => {
        let icon = document.getElementById('dark-mode-icon');
        let text = document.getElementById('dark-mode-text');
        if(icon) icon.className = 'ti ti-sun';
        if(text) text.innerText = 'Light Mode';
    });
}

// Auto-apply theme on load
if(localStorage.getItem('theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
}
// --- SMART PWA INSTALLER & TRACKER ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    let installBtn = document.getElementById('install-app-btn');
    if(installBtn) installBtn.style.display = 'flex';
});

window.installApp = async function() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('install-app-btn').style.display = 'none';
        }
        deferredPrompt = null;
    }
};

// 🔥 NAYA: LIVE INSTALL TRACKER
window.addEventListener('appinstalled', () => {
    // Install hote hi button hata do
    let installBtn = document.getElementById('install-app-btn');
    if(installBtn) installBtn.style.display = 'none';
    
    // Firebase me "App Downloads" ka counter +1 kar do
    if(typeof db !== 'undefined') {
        db.ref('platform_stats/total_downloads').set(firebase.database.ServerValue.increment(1))
        .then(() => console.log("App Install securely logged in DB!"))
        .catch((err) => console.error("Could not log install: ", err));
    }
});

// --- PREMIUM SETTINGS DROPDOWN LOGIC ---
function toggleSettings() {
    const menu = document.getElementById('settings-dropdown');
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
    } else {
        menu.classList.add('hidden');
    }
}

// Bahar click karne par menu auto-close ho jayega
document.addEventListener('click', function(event) {
    const wrapper = document.getElementById('settings-wrapper');
    const menu = document.getElementById('settings-dropdown');
    if (wrapper && menu && !wrapper.contains(event.target)) {
        menu.classList.add('hidden');
    }
});

// --- AUTO-UPDATE MECHANISM FOR END USERS ---
if ('serviceWorker' in navigator) {
    let refreshing = false;
    
    // Ye sensor detect karega ki Vercel par naya update aaya hai ya nahi
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            console.log("New Update Detected! Auto-refreshing silently...");
            // User ki screen ko silently refresh karke naya code de dega
            window.location.reload();
        }
    });
}

//🔥 SMART MATH RENDERER TRIGGER (BULLETPROOF VERSION) 🔥
window.renderMath = function() {
    setTimeout(() => {
        if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
            // Pehle engine ki purani memory clear karo (Taaki Next Q me overlap na ho)
            MathJax.typesetClear();
            
            // Phir page par naye equations ko dhoondh kar render kar do
            MathJax.typesetPromise().catch((err) => console.log('MathJax Engine Error:', err));
        }
    }, 150); // 150ms delay is perfect for DOM drawing
};