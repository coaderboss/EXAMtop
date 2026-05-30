// scripts/app.js

// 1. Script Tracker (Taaki ek file 2 baar download na ho)
const loadedScripts = new Set();

// 2. Dynamic Script Loader Function
// 2. Dynamic Script Loader Function (With Cache-Busting)
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (loadedScripts.has(src)) {
            resolve();
            return;
        }
        
        console.log(`Lazy Loading: ${src}...`);
        const script = document.createElement('script');
        // NAYA FIX: Har baar naya version number lagayenge taaki browser purani file na chalaye
        const cacheBuster = Date.now(); 
        script.src = `${src}?v=${cacheBuster}`; 
        
        script.onload = () => {
            loadedScripts.add(src);
            resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.body.appendChild(script); 
    });
}

// 3. Dynamic Page Loader Engine
async function loadComponent(pageName) {
    const viewport = document.getElementById('app-viewport');
    
    // Show Loading Spinner while fetching
    viewport.innerHTML = `
        <div class="spinner-container" style="padding-top: 10vh;">
            <div class="spinner"></div>
            <div style="font-weight: 500; color: var(--color-text-secondary);">Loading ${pageName}...</div>
        </div>
    `;

    try {
        // A. Fetch HTML Component
        const response = await fetch(`components/${pageName}.html`);
        if (!response.ok) throw new Error(`Page ${pageName} not found (404)`);
        const htmlContent = await response.text();
        
        // B. Decide which JS files are needed for this page (Array approach)
        let requiredScripts = [];
        
        if (pageName === 'create') {
            requiredScripts = ['scripts/examiner-create.js'];
        } 
        else if (pageName === 'tests' || pageName === 'results') {
            requiredScripts = ['scripts/examiner-manage.js'];
        }
        else if (pageName === 'student' || pageName === 'student-dashboard' || pageName === 'student-results') {
            requiredScripts = ['scripts/student-dash.js', 'scripts/student-engine.js'];
        } 
        else if (pageName === 'practice') {
            requiredScripts = ['scripts/student-arena.js'];
        } 
        else if (pageName === 'admin') {
            requiredScripts = ['scripts/admin.js'];
        }

        // C. Fetch all required JS files BEFORE showing the HTML
        for (let src of requiredScripts) {
            await loadScript(src);
        }

        // D. Inject HTML into screen
        viewport.innerHTML = htmlContent;

        // E. POST-LOAD TRIGGERS: Data fetch karo
        setTimeout(() => {
            if(pageName === 'home' && typeof updateSmartHubCards === 'function') {
                updateSmartHubCards(window.userRole);
            }
            if(pageName === 'create' && typeof checkAndPromptCreatorDraft === 'function') checkAndPromptCreatorDraft();

            if(pageName === 'tests' && typeof renderTestList === 'function') renderTestList();
            if(pageName === 'results' && typeof renderAllResults === 'function') renderAllResults();
            if(pageName === 'student-dashboard' && typeof renderStudentDashboard === 'function') renderStudentDashboard();
            if(pageName === 'student-results' && typeof renderStudentResults === 'function') renderStudentResults();
            if(pageName === 'admin' && typeof renderAdminDashboard === 'function') renderAdminDashboard();
            
            if(pageName === 'practice' && typeof fetchNewPracticeQ === 'function') fetchNewPracticeQ();
        }, 500);

    } catch (error) {
        console.error("Routing Error:", error);
        
        const viewport = document.getElementById('app-viewport');

        // SMART ERROR UI BUILDER
        if (!navigator.onLine) {
            // Case 1: Agar sach me internet band hai (Offline)
            viewport.innerHTML = `
                <div style="text-align:center; padding:5rem 1.5rem; max-width: 450px; margin: 0 auto; animation: fadeIn 0.4s ease;">
                    <div style="width:80px; height:80px; background:#FCEBEB; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1.5rem; box-shadow: 0 10px 25px rgba(163, 45, 45, 0.1);">
                        <i class="ti ti-wifi-off" style="font-size:38px; color:#A32D2D;"></i>
                    </div>
                    <h2 style="color:#0f172a; margin-bottom:10px; font-size:22px; font-weight:700;">No Internet Connection</h2>
                    <p style="color:#64748b; font-size:15px; line-height:1.6; margin-bottom:2rem;">
                        You are currently offline. Please check your Wi-Fi or mobile data to open the <b>${pageName}</b> page.
                    </p>
                    <div style="display:flex; gap:12px; justify-content:center;">
                        <button class="btn" style="padding:12px 20px; font-weight:600; border:1px solid #cbd5e1;" onclick="nav('home')">
                            <i class="ti ti-home"></i> Go Back
                        </button>
                        <button class="btn btn-primary" style="padding:12px 20px; font-weight:600; background:#A32D2D; border-color:#A32D2D;" onclick="loadComponent('${pageName}')">
                            <i class="ti ti-reload"></i> Try Again
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Case 2: Agar internet chal raha hai, par file sach me delete ho gayi hai (404 Error)
            viewport.innerHTML = `
                <div style="text-align:center; padding:5rem 1.5rem; max-width: 450px; margin: 0 auto; animation: fadeIn 0.4s ease;">
                    <div style="width:80px; height:80px; background:#f1f5f9; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1.5rem;">
                        <i class="ti ti-file-unknown" style="font-size:38px; color:#64748b;"></i>
                    </div>
                    <h2 style="color:#0f172a; margin-bottom:10px; font-size:22px; font-weight:700;">Page Not Found</h2>
                    <p style="color:#64748b; font-size:15px; line-height:1.6; margin-bottom:2rem;">
                        Oops! We couldn't load the <b>${pageName}</b> page. It seems to be missing or broken.
                    </p>
                    <button class="btn btn-primary" onclick="nav('home')" style="padding:12px 24px; font-weight:600;">
                        <i class="ti ti-arrow-left"></i> Return Home
                    </button>
                </div>
            `;
        }
    }
}

// 4. Global Navigation Function
window.nav = function(pageId) {
    window.location.hash = pageId;
    loadComponent(pageId);
    
    // Update active state on nav tabs
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    var tab = document.querySelector(`.nav-tab[onclick="nav('${pageId}')"]`);
    if(tab) tab.classList.add('active');
};

// 5. Initial Load Setup
document.addEventListener('DOMContentLoaded', () => {
    let initialHash = window.location.hash.replace('#', '') || 'home';
    nav(initialHash);
});

// 6. Handle browser back/forward buttons
window.addEventListener('popstate', function() {
    let hash = window.location.hash.replace('#', '') || 'home';
    loadComponent(hash);
});