// ==========================================
// FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================
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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth(); 
const provider = new firebase.auth.GoogleAuthProvider();

// ==========================================
// GLOBAL STATE VARIABLES
// ==========================================
var tests = [], qList = [], activeTest = null, activeState = null, timerIv = null;
var currentUser = null; 
var userRole = null; 
var isOfflineMode = false;
var cloudTestsBackup = []; 

// ==========================================
// DYNAMIC NAVBAR & SMART HUB ENGINE
// ==========================================
function renderNavbar(role) {
    const wrapper = document.getElementById('dynamic-nav-wrapper');
    const tabs = document.getElementById('dynamic-nav-tabs');
    if(!wrapper || !tabs) return;

    if (role === 'examiner') {
        tabs.innerHTML = `<button class="nav-tab" onclick="nav('create')"><i class="ti ti-pencil"></i> Create Test</button><button class="nav-tab active" onclick="nav('tests')"><i class="ti ti-list-check"></i> My Tests</button><button class="nav-tab" onclick="nav('results')"><i class="ti ti-chart-bar"></i> Global Results</button>`;
        wrapper.classList.remove('hidden');
    } else if (role === 'student') {
        tabs.innerHTML = `<button class="nav-tab active" onclick="nav('student')"><i class="ti ti-school"></i> Join Test</button><button class="nav-tab" onclick="nav('student-dashboard')"><i class="ti ti-chart-pie"></i> My Analytics</button><button class="nav-tab" onclick="nav('student-results')"><i class="ti ti-history"></i> My Results</button>`;
        wrapper.classList.remove('hidden');
    } else if (role === 'guest') {
        tabs.innerHTML = `<button class="nav-tab active" onclick="nav('student')"><i class="ti ti-school"></i> Join Test</button>`;
        wrapper.classList.remove('hidden');
    } else if (role === 'admin') {
        tabs.innerHTML = `<button class="nav-tab active" onclick="nav('admin')" style="color:#A32D2D; font-weight:700;"><i class="ti ti-shield-lock"></i> God Mode</button>`;
        wrapper.classList.remove('hidden');
    } else if (role === 'offline') {
        tabs.innerHTML = `<button class="nav-tab" onclick="nav('create')"><i class="ti ti-pencil"></i> Create</button><button class="nav-tab" onclick="nav('tests')"><i class="ti ti-list-check"></i> Manage</button><button class="nav-tab active" onclick="nav('student')"><i class="ti ti-school"></i> Join Test</button><button class="nav-tab" onclick="nav('results')"><i class="ti ti-chart-bar"></i> Results</button><button class="nav-tab" onclick="exitOfflineMode()" style="background:#FCEBEB; color:#A32D2D; border-radius:8px; font-weight:600;"><i class="ti ti-door-exit"></i> Exit Offline Mode</button>`;
        wrapper.classList.remove('hidden');
    } else {
        wrapper.classList.add('hidden');
        tabs.innerHTML = '';
    }
}

// NAYA: SMART HUB (HOME PAGE) UPDATER
// NAYA: SMART HUB (HOME PAGE) UPDATER WITH CLICK EVENT FIX
function updateSmartHubCards(role) {
    const stuCard = document.getElementById('card-student');
    const exmCard = document.getElementById('card-examiner');
    const subtitle = document.getElementById('hub-subtitle');
    
    if(!stuCard || !exmCard) return;

    if (role === 'student') {
        stuCard.classList.remove('card-disabled');
        exmCard.classList.add('card-disabled');
        subtitle.innerHTML = "Welcome back, <b>" + (currentUser.displayName || "Student") + "</b>!";
        document.getElementById('desc-student').innerHTML = "<b>Active Session.</b> Check your latest analytics, history, and results.";
        document.getElementById('btn-student').innerHTML = `<i class="ti ti-layout-dashboard"></i> Go to Dashboard`;
        
        // FIX: Card ka click badal do taaki logout na ho
        stuCard.onclick = () => nav('student-dashboard');
        exmCard.onclick = null; 

        document.getElementById('btn-examiner').innerHTML = `<i class="ti ti-lock"></i> Examiner Locked`;
    } else if (role === 'examiner') {
        exmCard.classList.remove('card-disabled');
        stuCard.classList.add('card-disabled');
        subtitle.innerHTML = "Welcome back, <b>" + (currentUser.displayName || "Examiner") + "</b>!";
        document.getElementById('desc-examiner').innerHTML = "<b>Active Session.</b> Manage your exams, evaluate papers, and track results.";
        document.getElementById('btn-examiner').innerHTML = `<i class="ti ti-layout-dashboard"></i> Go to Dashboard`;
        
        // FIX: Card ka click badal do taaki logout na ho, seedha dashboard jaye
        exmCard.onclick = () => nav('tests');
        stuCard.onclick = null;

        document.getElementById('btn-student').innerHTML = `<i class="ti ti-lock"></i> Student Locked`;
    } else {
        // Reset to Public (Logout ke baad)
        stuCard.classList.remove('card-disabled');
        exmCard.classList.remove('card-disabled');
        subtitle.innerHTML = "Secure & Seamless Proctoring Platform.";
        
        document.getElementById('desc-student').innerHTML = "Join live tests, track your analytics, and view your past performance.";
        document.getElementById('btn-student').innerHTML = `Continue as Student <i class="ti ti-arrow-right"></i>`;
        
        // Wapas default click events laga do
        stuCard.onclick = () => showStudentLoginChoice();

        document.getElementById('desc-examiner').innerHTML = "Create assessments, manage strict proctoring, and evaluate submissions.";
        document.getElementById('btn-examiner').innerHTML = `<i class="ti ti-brand-google" style="font-size: 20px;"></i> Login as Examiner`;
        
        // Wapas login wala click laga do
        exmCard.onclick = () => toggleLogin();
    }
}

// ==========================================
// OFFLINE MODE GATEWAY 
// ==========================================
function showOfflineGateway() {
    showModal(`<div style="padding:2rem; text-align:center;"><i class="ti ti-device-desktop" style="font-size:56px; color:#854F0B; display:block; margin-bottom:1rem;"></i><h3 style="font-size:22px; color:#0f172a; margin-bottom:0.5rem; font-weight:600;">Device-Only Mode</h3><p style="color:var(--color-text-secondary); margin-bottom:1.5rem; font-size:15px; line-height:1.6;">Tests created in this mode are <strong>NOT saved to the cloud</strong>. They will only work on this specific browser and device.<br><br>No internet or login is required to test.</p><div style="display:flex; gap:12px; justify-content:center;"><button class="btn" style="padding:10px 24px;" onclick="hideModal()">Cancel</button><button class="btn btn-primary" style="background:#854F0B; border-color:#854F0B; padding:10px 24px; font-weight:600;" onclick="hideModal(); enterOfflineMode()"><i class="ti ti-player-play"></i> Enter Offline Mode</button></div></div>`);
}

function enterOfflineMode() {
    isOfflineMode = true;
    userRole = 'offline';
    var localData = localStorage.getItem('examitop_offline_tests');
    tests = localData ? JSON.parse(localData) : [];
    renderNavbar('offline');
    nav('create'); 
    showToast('Entered Device-Only Mode. Data is isolated.', 'normal');
}

function exitOfflineMode() {
    isOfflineMode = false;
    tests = [...cloudTestsBackup]; 
    if(currentUser) {
        db.ref('users/' + currentUser.uid).once('value', (snap) => {
            var ud = snap.val();
            if(ud) applyRolePermissions(ud.role); else logoutUser();
        });
    } else {
        userRole = null;
        renderNavbar(null);
        nav('home');
    }
    showToast('Exited Offline Mode. Connected back to Cloud.', 'success');
}

// ==========================================
// ROLE-BASED LOGIN & ROUTING ENGINE
// ==========================================
function loginWithRole(role) {
    localStorage.setItem('desired_role', role);
    if(auth.currentUser) checkAndRouteUser(auth.currentUser);
    else auth.signInWithPopup(provider).catch(error => showToast(error.message, 'error'));
}

function checkAndRouteUser(user) {
    db.ref('users/' + user.uid).once('value', (snapshot) => {
        var userData = snapshot.val();
        var desiredRole = localStorage.getItem('desired_role') || 'student';
        
        if (!userData) {
            if (desiredRole === 'admin') desiredRole = 'student'; 
            userData = { uid: user.uid, name: user.displayName, email: user.email, role: desiredRole, createdAt: new Date().toLocaleDateString('en-IN') };
            db.ref('users/' + user.uid).set(userData).then(() => applyRolePermissions(userData.role));
        } else {
            var actualRole = userData.role;
            if (actualRole === 'student' && desiredRole === 'examiner') {
                showModal(`<div style="text-align:center;padding:2rem"><i class="ti ti-shield-x" style="font-size:56px;color:#A32D2D;display:block;margin-bottom:1rem"></i><h3 style="font-size:22px;color:#A32D2D;margin-bottom:0.5rem;font-weight:600">Unauthorized Access!</h3><p style="color:var(--color-text-secondary);margin-bottom:1.5rem;font-size:15px">This email is registered as a <strong>Student</strong>.</p><button class="btn btn-danger" style="padding:10px 24px;font-size:15px" onclick="hideModal(); logoutUser()">Understood</button></div>`);
                return; 
            }
            if (actualRole === 'examiner' && desiredRole === 'student') {
                showModal(`<div style="text-align:center;padding:2rem"><i class="ti ti-info-circle" style="font-size:56px;color:#185FA5;display:block;margin-bottom:1rem"></i><h3 style="font-size:22px;color:#185FA5;margin-bottom:0.5rem;font-weight:600">Examiner Account Detected</h3><p style="color:var(--color-text-secondary);margin-bottom:1.5rem;font-size:15px">Please use the "Preview" button inside your dashboard.</p><button class="btn btn-primary" style="padding:10px 24px;font-size:15px" onclick="hideModal(); logoutUser()">Go Back</button></div>`);
                return; 
            }
            applyRolePermissions(actualRole);
        }
    });
}

function applyRolePermissions(role) {
    if(isOfflineMode) return; 
    userRole = role;
    const loginBtn = document.getElementById('login-btn');
    if(loginBtn && auth.currentUser) {
        loginBtn.innerHTML = `<i class="ti ti-logout"></i> Logout (${role.toUpperCase()})`;
        loginBtn.style.background = "#FCEBEB";
        loginBtn.style.color = "#A32D2D";
        loginBtn.style.borderColor = "#F7C1C1";
    }
if(document.getElementById('profile-menu-btn')) document.getElementById('profile-menu-btn').classList.remove('hidden');  

    renderNavbar(role);
    updateSmartHubCards(role); // SMART HUB UPDATE

    if (role === 'student') nav('student-dashboard'); 
    else if (role === 'examiner') nav('tests'); 
    else if (role === 'admin') nav('admin'); 
}

function logoutUser() {
    auth.signOut().then(() => {
        if(isOfflineMode) return; 
        userRole = null;
        localStorage.removeItem('desired_role');
        const loginBtn = document.getElementById('login-btn');
        if(loginBtn) {
            loginBtn.innerHTML = `<i class="ti ti-brand-google"></i> Login`;
            loginBtn.style.background = "#185FA5";
            loginBtn.style.color = "#fff";
            loginBtn.style.borderColor = "#185FA5";
        }
        if(document.getElementById('profile-menu-btn')) document.getElementById('profile-menu-btn').classList.add('hidden');
        renderNavbar(null);
        updateSmartHubCards(null); // RESET SMART HUB
        nav('home'); 
    });
}

function toggleLogin() {
    if(auth.currentUser) logoutUser(); else loginWithRole('examiner');
}

auth.onAuthStateChanged(user => {
  currentUser = user;
  if(isOfflineMode) return;
  
  if(user) { // <--- Yahan bracket OPEN karna tha
      checkAndRouteUser(user);
      
      setTimeout(() => {
          let hash = window.location.hash.replace('#', '');
          if(hash === 'tests' && typeof renderTestList === 'function') renderTestList();
      }, 400);
      
  } else { // <--- Yahan bracket CLOSE karke else start karna tha
      const loginBtn = document.getElementById('login-btn');
      if(loginBtn) { 
          loginBtn.innerHTML = `<i class="ti ti-brand-google"></i> Login`; 
          loginBtn.style.background = "#185FA5"; 
          loginBtn.style.color = "#fff"; 
          loginBtn.style.borderColor = "#185FA5"; 
      }
      renderNavbar(null); 
      updateSmartHubCards(null);
      if(window.location.hash !== '#home') nav('home');
      if(document.getElementById('profile-menu-btn')) document.getElementById('profile-menu-btn').classList.add('hidden');
  }
});

// ==========================================
// DATABASE LISTENER (Isolated for Cloud Only)
// ==========================================
// ==========================================
// DATABASE LISTENER (SPA UPGRADED)
// ==========================================
db.ref('tests').on('value', (snapshot) => {
  var data = snapshot.val();
  cloudTestsBackup = [];
  
  if (Array.isArray(data)) cloudTestsBackup = data;
  else if (data) cloudTestsBackup = Object.values(data).filter(item => item !== null);
  
  cloudTestsBackup.forEach(t => {
      if (t.submissions && !Array.isArray(t.submissions)) t.submissions = Object.values(t.submissions).filter(item => item !== null);
      else if (!t.submissions) t.submissions = [];
  });

  if(!isOfflineMode) {
      var localTests = tests.filter(t => t.isLocal === true);
      tests = [...cloudTestsBackup, ...localTests];
      
      // NAYA FIX: ID ki jagah ab hum URL check karke render karenge
      let currentHash = window.location.hash.replace('#', '');
      
      if(currentHash === 'tests' && typeof renderTestList === 'function') renderTestList();
      if(currentHash === 'results' && typeof renderAllResults === 'function') renderAllResults();
      if(currentHash === 'student-dashboard' && typeof renderStudentDashboard === 'function') renderStudentDashboard();
      if(currentHash === 'student-results' && typeof renderStudentResults === 'function') renderStudentResults();
      if(currentHash === 'admin' && typeof renderAdminDashboard === 'function') renderAdminDashboard();
  }
});

function updateDatabase() {
    if (isOfflineMode) {
        localStorage.setItem('examitop_offline_tests', JSON.stringify(tests));
    } else {
        db.ref('tests').set(tests.filter(t => !t.isLocal)).catch(error => showToast("Error saving data: " + error.message, 'error'));
    }
}

// ==========================================
// STUDENT GUEST MODE ENGINE
// ==========================================
function showStudentLoginChoice() {
    showModal(`<div style="padding:1.5rem; text-align:center;"><i class="ti ti-school" style="font-size:56px; color:#185FA5; margin-bottom:1rem; display:block;"></i><h3 style="font-size:24px; font-weight:600; margin-bottom:0.5rem;">Welcome, Student!</h3><p style="color:var(--color-text-secondary); margin-bottom:2rem; font-size:15px;">Choose how you want to access the exam portal.</p><div style="display:flex; flex-direction:column; gap:12px;"><button class="btn btn-primary" style="padding:14px; font-size:16px; font-weight:600;" onclick="hideModal(); loginWithRole('student')"><i class="ti ti-brand-google"></i> Login with Google (Recommended)</button><div style="position: relative; text-align: center; margin: 10px 0;"><span style="background: #fff; padding: 0 10px; color: var(--color-text-secondary); font-size: 13px; position: relative; z-index: 1;">OR</span><div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: var(--color-border-secondary); z-index: 0;"></div></div><button class="btn" style="padding:14px; font-size:16px; font-weight:600; background:#f8fafc; color:#64748b; border:1px solid #e2e8f0;" onclick="showGuestWarning()">Continue Without Login (Guest Mode)</button></div></div>`);
}
function showGuestWarning() {
    showModal(`<div style="padding:1.5rem; text-align:left;"><h3 style="font-size:20px; font-weight:600; margin-bottom:1rem; color:#854F0B; display:flex; align-items:center; gap:8px;"><i class="ti ti-alert-triangle"></i> Guest Mode Limitations</h3><p style="color:var(--color-text-secondary); font-size:14px; margin-bottom:1rem;">You are choosing to proceed without an account. Please note:</p><div style="background:#FCEBEB; border:1px solid #F7C1C1; padding:12px; border-radius:8px; margin-bottom:1.25rem;"><div style="color:#A32D2D; font-size:14px; font-weight:600; margin-bottom:4px;"><i class="ti ti-chart-off"></i> No Analytics Dashboard</div><div style="color:#791F1F; font-size:13px;">You will not get a centralized dashboard to track your overall performance and history.</div></div><div style="background:#FCEBEB; border:1px solid #F7C1C1; padding:12px; border-radius:8px; margin-bottom:1.5rem;"><div style="color:#A32D2D; font-size:14px; font-weight:600; margin-bottom:4px;"><i class="ti ti-file-search"></i> Manual Result Tracking</div><div style="color:#791F1F; font-size:13px;">To view your result again in the future, you MUST remember your exact Test Code, Name, and Roll Number.</div></div><div style="display:flex; gap:10px;"><button class="btn" style="flex:1; padding:12px; font-weight:600;" onclick="hideModal(); proceedAsGuest()">Proceed as Guest</button><button class="btn btn-primary" style="flex:1; padding:12px; font-weight:600;" onclick="hideModal(); loginWithRole('student')">Login Now</button></div></div>`);
}
function proceedAsGuest() {
    userRole = 'guest'; renderNavbar('guest'); nav('student'); showToast('Entered as Guest', 'normal');
}

// ==========================================
// USER PROFILE & ACCOUNT SETTINGS
// ==========================================
function openProfileSettings() {
    if(!currentUser) return;
    db.ref('users/' + currentUser.uid).once('value').then(snapshot => {
        let data = snapshot.val() || {};
        showModal(`<div style="padding: 1.5rem; text-align: left;"><h3 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px; color: #185FA5;"><i class="ti ti-user-edit" style="font-size: 24px;"></i> My Profile Settings</h3><div style="display:flex; gap:10px; margin-bottom:1rem;"><div style="flex:1"><label>Name</label><input type="text" value="${currentUser.displayName || data.name || ''}" disabled style="background: #f1f5f9; cursor: not-allowed; color:#64748b;"></div><div style="flex:1"><label>Role</label><input type="text" value="${(data.role || 'Unknown').toUpperCase()}" disabled style="background: #f1f5f9; cursor: not-allowed; color:#64748b;"></div></div><div style="margin-bottom: 1rem;"><label>Registered Email</label><input type="text" value="${currentUser.email}" disabled style="background: #f1f5f9; cursor: not-allowed; color:#64748b;"></div><div style="margin-bottom: 1rem;"><label>Stream / Branch (Optional)</label><input type="text" id="prof-stream" value="${data.stream || ''}" placeholder="e.g., B.Tech Computer Science"></div><div style="margin-bottom: 1.5rem;"><label>College / School Name (Optional)</label><input type="text" id="prof-college" value="${data.college || ''}" placeholder="e.g., UIET CSJM University"></div><button class="btn btn-primary" style="width: 100%; margin-bottom: 2rem; padding:12px; font-weight:600;" onclick="saveProfileDetails()"><i class="ti ti-device-floppy"></i> Save Details</button><div style="border-top: 1px dashed #e2e8f0; padding-top: 1.5rem;"><h4 style="color: #A32D2D; margin-bottom: 10px; display:flex; align-items:center; gap:6px;"><i class="ti ti-alert-triangle"></i> Danger Zone</h4><p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 1rem; line-height:1.5;">Permanently delete your account and remove all personal data from the system.</p><button class="btn btn-danger" style="width: 100%; font-weight:600;" onclick="deleteMyAccount()"><i class="ti ti-trash"></i> Delete My Account</button></div></div>`);
    });
}
function saveProfileDetails() {
    let stream = document.getElementById('prof-stream').value.trim();
    let college = document.getElementById('prof-college').value.trim();
    db.ref('users/' + currentUser.uid).update({stream: stream, college: college}).then(() => { showToast('Profile updated successfully!', 'success'); hideModal(); }).catch(error => showToast(error.message, 'error'));
}
function deleteMyAccount() {
    let conf = prompt('ACCOUNT DELETION:\nTo confirm, please type the word "DELETE" in all caps:');
    if (conf === 'DELETE') { db.ref('users/' + currentUser.uid).remove().then(() => { currentUser.delete().then(() => { showToast('Account deleted.', 'success'); hideModal(); logoutUser(); }).catch(err => { if (err.code === 'auth/requires-recent-login') alert("SECURITY CHECK: Please logout and login again before deleting your account."); else alert(err.message); }); }); }
}

// ==========================================
// SMART CONTEXT-AWARE HELP GUIDE
// ==========================================
function showHelpGuide() {
    let title = "", icon = "", content = "", bgCol = "";

    if (typeof isOfflineMode !== 'undefined' && isOfflineMode) {
        title = "Device-Only (Offline) Guide"; icon = "ti-device-desktop"; bgCol = "#FAEEDA"; 
        content = `<div style="margin-bottom:15px"><strong><i class="ti ti-wifi-off"></i> 1. Pure Isolation:</strong> Data created here never touches the internet. It lives securely in your browser's local memory.</div><div style="margin-bottom:15px"><strong><i class="ti ti-test-pipe"></i> 2. Self-Testing:</strong> Use this mode to draft questions, check formatting, or conduct local classroom quizzes.</div><div style="margin-bottom:15px; color:#A32D2D;"><strong><i class="ti ti-door-exit"></i> Exit:</strong> Click 'Exit Offline Mode' in the navbar to reconnect to the global cloud platform.</div>`;
    } else if (userRole === 'examiner') {
        title = "Examiner Portal Guide"; icon = "ti-pencil"; bgCol = "#EAF3DE"; 
        // NAYA: Added JSON Template directly inside the Examiner's guide
        content = `<div style="max-height: 60vh; overflow-y: auto; padding-right: 10px;">
            <div style="margin-bottom:15px"><strong><i class="ti ti-list-details"></i> 1. Question Types:</strong> Choose from 4 varieties: MCQ, MSQ, Integer, and Subjective.</div>
            <div style="margin-bottom:15px">
                <strong><i class="ti ti-file-upload"></i> 2. JSON Bulk Import:</strong> Use this strict JSON format to bulk import questions. Adding a "section" is optional.
                <div style="background:#0f172a; color:#e2e8f0; padding:15px; border-radius:8px; font-family: 'Courier New', Courier, monospace; font-size:13px; overflow-x:auto; margin-top:10px; line-height:1.5; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);">
[
  {
    <span style="color:#a78bfa;">"section"</span>: <span style="color:#34d399;">"Physics"</span>,
    <span style="color:#a78bfa;">"type"</span>: <span style="color:#34d399;">"mcq"</span>,
    <span style="color:#a78bfa;">"text"</span>: <span style="color:#34d399;">"What is the capital of France?"</span>,
    <span style="color:#a78bfa;">"marks"</span>: <span style="color:#f472b6;">4</span>,
    <span style="color:#a78bfa;">"options"</span>: [<span style="color:#34d399;">"London"</span>, <span style="color:#34d399;">"Paris"</span>, <span style="color:#34d399;">"Berlin"</span>, <span style="color:#34d399;">"Madrid"</span>],
    <span style="color:#a78bfa;">"correct"</span>: [<span style="color:#f472b6;">1</span>],
    <span style="color:#a78bfa;">"explanation"</span>: <span style="color:#34d399;">"Paris is the correct answer."</span>
  }
]
                </div>
            </div>
            <div style="margin-bottom:15px"><strong><i class="ti ti-hash"></i> 3. The 6-Digit Test Code:</strong> This is your master key. Share this code with your students.</div>
            <div style="margin-bottom:15px"><strong><i class="ti ti-dashboard"></i> 4. Test Management:</strong> Open/Close Intake, Edit Key for Smart Auto-Grade, and manually Evaluate papers.</div>
        </div>`;
    } else if (userRole === 'student' || userRole === 'guest') {
        title = "Student Portal Guide"; icon = "ti-school"; bgCol = "#E6F1FB"; 
        content = `<div style="margin-bottom:15px"><strong><i class="ti ti-login"></i> 1. Guest vs Login:</strong> Login saves your analytics permanently.</div><div style="margin-bottom:15px"><strong><i class="ti ti-shield-lock"></i> 2. Anti-Cheat Rules:</strong> Changing tabs or exiting full-screen will auto-submit your exam!</div><div style="margin-bottom:15px"><strong><i class="ti ti-layout-grid"></i> 3. Exam Palette:</strong> Track answered, skipped, and 'marked for review' questions.</div>`;
    } else if (userRole === 'admin') {
        title = "God Mode Command Center"; icon = "ti-crown"; bgCol = "#FCEBEB"; 
        content = `<div style="margin-bottom:15px"><strong><i class="ti ti-users"></i> 1. User Management:</strong> Upgrade standard users to Examiners instantly.</div><div style="margin-bottom:15px"><strong><i class="ti ti-database"></i> 2. Global Vault:</strong> View, inspect, or forcefully delete any test.</div>`;
    } else {
        title = "Welcome to ExamiTop"; icon = "ti-info-circle"; bgCol = "#f1f5f9"; 
        content = `<div style="margin-bottom:15px; padding:12px; background:#fff; border-radius:8px; border:1px solid #e2e8f0;"><strong style="color:#185FA5; font-size:15px; display:flex; align-items:center; gap:6px;"><i class="ti ti-school"></i> Student Portal</strong><div style="font-size:13px; color:var(--color-text-secondary); margin-top:4px;">Join live tests via 6-digit codes. Get instant evaluations and deep analytics.</div></div><div style="margin-bottom:15px; padding:12px; background:#fff; border-radius:8px; border:1px solid #e2e8f0;"><strong style="color:#3B6D11; font-size:15px; display:flex; align-items:center; gap:6px;"><i class="ti ti-pencil"></i> Examiner Portal</strong><div style="font-size:13px; color:var(--color-text-secondary); margin-top:4px;">Create anti-cheat enabled assessments, manage live intakes, and use Smart Key Auto-grading.</div></div><div style="margin-bottom:15px; padding:12px; background:#fff; border-radius:8px; border:1px solid #e2e8f0;"><strong style="color:#854F0B; font-size:15px; display:flex; align-items:center; gap:6px;"><i class="ti ti-device-desktop"></i> Offline / Device-Only Mode</strong><div style="font-size:13px; color:var(--color-text-secondary); margin-top:4px;">A localized sandbox. Create and test exams without saving any data to the cloud.</div></div>`;
    }

    showModal(`<div style="padding:1.5rem; text-align:left;"><div style="display:flex; align-items:center; gap:12px; margin-bottom:1.5rem; padding-bottom:15px; border-bottom:1px solid var(--color-border-secondary);"><div style="width:48px; height:48px; border-radius:12px; background:${bgCol}; display:flex; align-items:center; justify-content:center;"><i class="ti ${icon}" style="font-size:28px; color:var(--color-text-primary);"></i></div><div><h2 style="margin:0; font-size:20px; font-weight:700; color:#0f172a;">${title}</h2><div style="font-size:13px; font-weight:500; color:var(--color-text-secondary);">Platform Operations Overview</div></div></div><div style="font-size:14px; color:var(--color-text-primary); line-height:1.6; margin-bottom:1.5rem;">${content}</div><button class="btn btn-primary" style="width:100%; padding:12px; font-weight:600; font-size:15px; justify-content:center;" onclick="hideModal()"><i class="ti ti-check"></i> Got it</button></div>`);
}
// GLOBAL LABELS FIX
window.tlabel = function(t){return{mcq:'Single Correct',msq:'Multi Correct',integer:'Integer Type',subjective:'Subjective'}[t]||t};
window.tbadge = function(t){return{mcq:'b-blue',msq:'b-green',integer:'b-amber',subjective:'b-purple'}[t]||'b-gray'};