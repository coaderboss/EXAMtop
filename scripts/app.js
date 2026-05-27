// scripts/app.js

// 1. Script Tracker (Taaki ek file 2 baar download na ho)
const loadedScripts = new Set();

// 2. Dynamic Script Loader Function
function loadScript(src) {
    return new Promise((resolve, reject) => {
        // Agar pehle se load ho chuki hai, toh wapas resolve kardo (Memory Save)
        if (loadedScripts.has(src)) {
            resolve();
            return;
        }
        
        console.log(`Lazy Loading: ${src}...`);
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            loadedScripts.add(src);
            resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.body.appendChild(script); // HTML me script tag inject karo
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
        // E. POST-LOAD TRIGGERS: Data fetch karo
        setTimeout(() => {
            if(pageName === 'tests' && typeof renderTestList === 'function') renderTestList();
            if(pageName === 'results' && typeof renderAllResults === 'function') renderAllResults();
            if(pageName === 'student-dashboard' && typeof renderStudentDashboard === 'function') renderStudentDashboard();
            if(pageName === 'student-results' && typeof renderStudentResults === 'function') renderStudentResults();
            if(pageName === 'admin' && typeof renderAdminDashboard === 'function') renderAdminDashboard();
            
            if(pageName === 'practice' && typeof fetchNewPracticeQ === 'function') fetchNewPracticeQ();
        }, 100);

    } catch (error) {
        console.error("Routing Error:", error);
        viewport.innerHTML = `
            <div style="text-align:center; padding:5rem; color:#A32D2D;">
                <i class="ti ti-alert-triangle" style="font-size:48px; margin-bottom:1rem;"></i>
                <h2>Component Missing</h2>
                <p>Could not load <b>${pageName}.html</b> or its script.</p>
                <button class="btn btn-primary" onclick="nav('home')" style="margin-top:1rem;">Go to Home</button>
            </div>
        `;
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