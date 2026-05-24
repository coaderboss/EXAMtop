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

// ==========================================
// DYNAMIC NAVBAR ENGINE
// ==========================================
function renderNavbar(role) {
    const wrapper = document.getElementById('dynamic-nav-wrapper');
    const tabs = document.getElementById('dynamic-nav-tabs');
    if(!wrapper || !tabs) return;

    if (role === 'examiner') {
        tabs.innerHTML = `
          <button class="nav-tab" onclick="nav('create')"><i class="ti ti-pencil"></i> Create Test</button>
          <button class="nav-tab active" onclick="nav('tests')"><i class="ti ti-list-check"></i> My Tests</button>
          <button class="nav-tab" onclick="nav('results')"><i class="ti ti-chart-bar"></i> Global Results</button>
        `;
        wrapper.classList.remove('hidden');
    } else if (role === 'student') {
        tabs.innerHTML = `
          <button class="nav-tab active" onclick="nav('student')"><i class="ti ti-school"></i> Join Test</button>
          <button class="nav-tab" onclick="nav('student-dashboard')"><i class="ti ti-chart-pie"></i> My Analytics</button>
          <button class="nav-tab" onclick="nav('student-results')"><i class="ti ti-history"></i> My Results</button>
        `;
        wrapper.classList.remove('hidden');
    } else if (role === 'guest') {
        tabs.innerHTML = `
          <button class="nav-tab active" onclick="nav('student')"><i class="ti ti-school"></i> Join Test</button>
        `;
        wrapper.classList.remove('hidden');
    }else if (role === 'admin') {
        // NAYA: Admin Navbar Tab
        tabs.innerHTML = `
          <button class="nav-tab active" onclick="nav('admin')" style="color:#A32D2D; font-weight:700;"><i class="ti ti-shield-lock"></i> God Mode</button>
        `;
        wrapper.classList.remove('hidden');
    }
     else {
        wrapper.classList.add('hidden');
        tabs.innerHTML = '';
    }
}

// ==========================================
// ROLE-BASED LOGIN & ROUTING ENGINE
// ==========================================
function loginWithRole(role) {
    localStorage.setItem('desired_role', role);
    
    if(auth.currentUser) {
        checkAndRouteUser(auth.currentUser);
    } else {
        auth.signInWithPopup(provider).catch(error => showToast(error.message, 'error'));
    }
}

function checkAndRouteUser(user) {
    db.ref('users/' + user.uid).once('value', (snapshot) => {
        var userData = snapshot.val();
        var desiredRole = localStorage.getItem('desired_role') || 'student';
        
        if (!userData) {
            if (desiredRole === 'admin') desiredRole = 'student'; 

            userData = {
                uid: user.uid,
                name: user.displayName,
                email: user.email,
                role: desiredRole,
                createdAt: new Date().toLocaleDateString('en-IN')
            };
            
            db.ref('users/' + user.uid).set(userData).then(() => {
                applyRolePermissions(userData.role);
            });
        } else {
            var actualRole = userData.role;

            if (actualRole === 'student' && desiredRole === 'examiner') {
                showModal(`<div style="text-align:center;padding:2rem">
                    <i class="ti ti-shield-x" style="font-size:56px;color:#A32D2D;display:block;margin-bottom:1rem"></i>
                    <h3 style="font-size:22px;color:#A32D2D;margin-bottom:0.5rem;font-weight:600">Unauthorized Access!</h3>
                    <p style="color:var(--color-text-secondary);margin-bottom:1.5rem;font-size:15px">This email is registered as a <strong>Student</strong>. You do not have Examiner privileges.</p>
                    <button class="btn btn-danger" style="padding:10px 24px;font-size:15px" onclick="hideModal(); logoutUser()">Understood</button>
                </div>`);
                return; 
            }

            if (actualRole === 'examiner' && desiredRole === 'student') {
                showModal(`<div style="text-align:center;padding:2rem">
                    <i class="ti ti-info-circle" style="font-size:56px;color:#185FA5;display:block;margin-bottom:1rem"></i>
                    <h3 style="font-size:22px;color:#185FA5;margin-bottom:0.5rem;font-weight:600">Examiner Account Detected</h3>
                    <p style="color:var(--color-text-secondary);margin-bottom:1.5rem;font-size:15px">You are an Examiner. Please login through the Examiner Portal. You can use the "Preview" button inside your dashboard to view tests as a student.</p>
                    <button class="btn btn-primary" style="padding:10px 24px;font-size:15px" onclick="hideModal(); logoutUser()">Go Back</button>
                </div>`);
                return; 
            }

            applyRolePermissions(actualRole);
        }
    });
}

function applyRolePermissions(role) {
    userRole = role;
    
    const loginBtn = document.getElementById('login-btn');
    if(loginBtn && auth.currentUser) {
        loginBtn.innerHTML = `<i class="ti ti-logout"></i> Logout (${role.toUpperCase()})`;
        loginBtn.style.background = "#FCEBEB";
        loginBtn.style.color = "#A32D2D";
        loginBtn.style.borderColor = "#F7C1C1";
    }

    if(document.getElementById('profile-btn')) document.getElementById('profile-btn').classList.remove('hidden');

    renderNavbar(role);

    if (role === 'student') {
        nav('student-dashboard'); 
    } else if (role === 'examiner') {
        nav('tests'); 
    } else if (role === 'admin') {
        nav('admin'); 
    }
}

function logoutUser() {
    auth.signOut().then(() => {
        userRole = null;
        localStorage.removeItem('desired_role');
        
        const loginBtn = document.getElementById('login-btn');
        if(loginBtn) {
            loginBtn.innerHTML = `<i class="ti ti-brand-google"></i> Login`;
            loginBtn.style.background = "#185FA5";
            loginBtn.style.color = "#fff";
            loginBtn.style.borderColor = "#185FA5";
        }
        
        if(document.getElementById('profile-btn')) document.getElementById('profile-btn').classList.add('hidden');
        
        renderNavbar(null);
        nav('home'); 
    });
}

function toggleLogin() {
    if(auth.currentUser) {
        logoutUser();
    } else {
        loginWithRole('examiner');
    }
}

// ==========================================
// AUTHENTICATION STATE LISTENER
// ==========================================
auth.onAuthStateChanged(user => {
  currentUser = user;
  if(user) {
      checkAndRouteUser(user);
  } else {
      const loginBtn = document.getElementById('login-btn');
      if(loginBtn) {
          loginBtn.innerHTML = `<i class="ti ti-brand-google"></i> Login`;
          loginBtn.style.background = "#185FA5";
          loginBtn.style.color = "#fff";
          loginBtn.style.borderColor = "#185FA5";
      }
      renderNavbar(null); 
      if(window.location.hash !== '#home') {
          nav('home');
      }
  }
});

// ==========================================
// DATABASE LISTENER (Real-time Sync)
// ==========================================
db.ref('tests').on('value', (snapshot) => {
  var data = snapshot.val();
  
  if (!data) {
      tests = [];
  } else if (Array.isArray(data)) {
      tests = data;
  } else {
      tests = Object.values(data).filter(item => item !== null);
  }
  
  tests.forEach(t => {
      if (t.submissions && !Array.isArray(t.submissions)) {
          t.submissions = Object.values(t.submissions).filter(item => item !== null);
      } else if (!t.submissions) {
          t.submissions = [];
      }
  });

  if(document.getElementById('page-tests') && document.getElementById('page-tests').classList.contains('active')) {
      if(typeof renderTestList === 'function') renderTestList();
  }
  if(document.getElementById('page-results') && document.getElementById('page-results').classList.contains('active')) {
      if(typeof renderAllResults === 'function') renderAllResults();
  }
});

function updateDatabase() {
    db.ref('tests').set(tests).catch(error => {
        showToast("Error saving data to cloud: " + error.message, 'error');
    });
}

// ==========================================
// STUDENT GUEST MODE ENGINE
// ==========================================
function showStudentLoginChoice() {
    showModal(`
        <div style="padding:1.5rem; text-align:center;">
            <i class="ti ti-school" style="font-size:56px; color:#185FA5; margin-bottom:1rem; display:block;"></i>
            <h3 style="font-size:24px; font-weight:600; margin-bottom:0.5rem;">Welcome, Student!</h3>
            <p style="color:var(--color-text-secondary); margin-bottom:2rem; font-size:15px;">Choose how you want to access the exam portal.</p>
            
            <div style="display:flex; flex-direction:column; gap:12px;">
                <button class="btn btn-primary" style="padding:14px; font-size:16px; font-weight:600;" onclick="hideModal(); loginWithRole('student')">
                    <i class="ti ti-brand-google"></i> Login with Google (Recommended)
                </button>
                <div style="position: relative; text-align: center; margin: 10px 0;">
                    <span style="background: #fff; padding: 0 10px; color: var(--color-text-secondary); font-size: 13px; position: relative; z-index: 1;">OR</span>
                    <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: var(--color-border-secondary); z-index: 0;"></div>
                </div>
                <button class="btn" style="padding:14px; font-size:16px; font-weight:600; background:#f8fafc; color:#64748b; border:1px solid #e2e8f0;" onclick="showGuestWarning()">
                    Continue Without Login (Guest Mode)
                </button>
            </div>
        </div>
    `);
}

function showGuestWarning() {
    showModal(`
        <div style="padding:1.5rem; text-align:left;">
            <h3 style="font-size:20px; font-weight:600; margin-bottom:1rem; color:#854F0B; display:flex; align-items:center; gap:8px;">
                <i class="ti ti-alert-triangle"></i> Guest Mode Limitations
            </h3>
            <p style="color:var(--color-text-secondary); font-size:14px; margin-bottom:1rem;">You are choosing to proceed without an account. Please note:</p>
            
            <div style="background:#FCEBEB; border:1px solid #F7C1C1; padding:12px; border-radius:8px; margin-bottom:1.25rem;">
                <div style="color:#A32D2D; font-size:14px; font-weight:600; margin-bottom:4px;"><i class="ti ti-chart-off"></i> No Analytics Dashboard</div>
                <div style="color:#791F1F; font-size:13px;">You will not get a centralized dashboard to track your overall performance and history.</div>
            </div>

            <div style="background:#FCEBEB; border:1px solid #F7C1C1; padding:12px; border-radius:8px; margin-bottom:1.5rem;">
                <div style="color:#A32D2D; font-size:14px; font-weight:600; margin-bottom:4px;"><i class="ti ti-file-search"></i> Manual Result Tracking</div>
                <div style="color:#791F1F; font-size:13px;">To view your result again in the future, you MUST remember and enter your exact Test Code, Name, and Roll Number.</div>
            </div>
            
            <div style="display:flex; gap:10px;">
                <button class="btn" style="flex:1; padding:12px; font-weight:600;" onclick="hideModal(); proceedAsGuest()">Proceed as Guest</button>
                <button class="btn btn-primary" style="flex:1; padding:12px; font-weight:600;" onclick="hideModal(); loginWithRole('student')">Login Now</button>
            </div>
        </div>
    `);
}

function proceedAsGuest() {
    userRole = 'guest'; 
    renderNavbar('guest');
    nav('student'); 
    showToast('Entered as Guest', 'normal');
}

// ==========================================
// USER PROFILE & ACCOUNT SETTINGS ENGINE
// ==========================================
function openProfileSettings() {
    if(!currentUser) return;
    
    db.ref('users/' + currentUser.uid).once('value').then(snapshot => {
        let data = snapshot.val() || {};
        
        let html = `
        <div style="padding: 1.5rem; text-align: left;">
            <h3 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px; color: #185FA5;">
                <i class="ti ti-user-edit" style="font-size: 24px;"></i> My Profile Settings
            </h3>
            
            <div style="display:flex; gap:10px; margin-bottom:1rem;">
                <div style="flex:1"><label>Name</label><input type="text" value="${currentUser.displayName || data.name || ''}" disabled style="background: #f1f5f9; cursor: not-allowed; color:#64748b;"></div>
                <div style="flex:1"><label>Role</label><input type="text" value="${(data.role || 'Unknown').toUpperCase()}" disabled style="background: #f1f5f9; cursor: not-allowed; color:#64748b;"></div>
            </div>
            
            <div style="margin-bottom: 1rem;"><label>Registered Email</label><input type="text" value="${currentUser.email}" disabled style="background: #f1f5f9; cursor: not-allowed; color:#64748b;"></div>
            
            <div style="margin-bottom: 1rem;">
                <label>Stream / Branch (Optional)</label>
                <input type="text" id="prof-stream" value="${data.stream || ''}" placeholder="e.g., B.Tech Computer Science">
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label>College / School Name (Optional)</label>
                <input type="text" id="prof-college" value="${data.college || ''}" placeholder="e.g., UIET CSJM University">
            </div>
            
            <button class="btn btn-primary" style="width: 100%; margin-bottom: 2rem; padding:12px; font-weight:600;" onclick="saveProfileDetails()">
                <i class="ti ti-device-floppy"></i> Save Details
            </button>
            
            <div style="border-top: 1px dashed #e2e8f0; padding-top: 1.5rem;">
                <h4 style="color: #A32D2D; margin-bottom: 10px; display:flex; align-items:center; gap:6px;">
                    <i class="ti ti-alert-triangle"></i> Danger Zone
                </h4>
                <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 1rem; line-height:1.5;">
                    Permanently delete your account and remove all personal data from the system. This action cannot be undone.
                </p>
                <button class="btn btn-danger" style="width: 100%; font-weight:600;" onclick="deleteMyAccount()">
                    <i class="ti ti-trash"></i> Delete My Account
                </button>
            </div>
        </div>`;
        
        showModal(html);
    });
}

function saveProfileDetails() {
    let stream = document.getElementById('prof-stream').value.trim();
    let college = document.getElementById('prof-college').value.trim();
    
    db.ref('users/' + currentUser.uid).update({
        stream: stream,
        college: college
    }).then(() => {
        showToast('Profile updated successfully!', 'success');
        hideModal();
    }).catch(error => {
        showToast('Error saving profile: ' + error.message, 'error');
    });
}

function deleteMyAccount() {
    let conf = prompt('ACCOUNT DELETION:\nTo confirm, please type the word "DELETE" in all caps:');
    
    if (conf === 'DELETE') {
        db.ref('users/' + currentUser.uid).remove().then(() => {
            currentUser.delete().then(() => {
                showToast('Your account has been deleted permanently.', 'success');
                hideModal();
                logoutUser();
            }).catch(err => {
                if (err.code === 'auth/requires-recent-login') {
                    alert("SECURITY CHECK: Please logout and login again before deleting your account.");
                    hideModal();
                } else {
                    alert(err.message);
                }
            });
        });
    } else if (conf !== null) {
        showToast('Deletion cancelled. Incorrect confirmation word.', 'normal');
    }
}