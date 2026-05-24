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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth(); 
const provider = new firebase.auth.GoogleAuthProvider();

// ==========================================
// GLOBAL STATE VARIABLES
// ==========================================
var tests = [], qList = [], activeTest = null, activeState = null, timerIv = null;
var currentUser = null; 

// ==========================================
// AUTHENTICATION LISTENER (Login Check)
// ==========================================
auth.onAuthStateChanged(user => {
  currentUser = user;
  const loginBtn = document.getElementById('login-btn');
  
  if(user) {
      // Login hone par UI update
      if(loginBtn) {
          loginBtn.innerHTML = `<i class="ti ti-logout"></i> Logout <span class="hide-on-mobile">(${user.displayName.split(' ')[0]})</span>`;
          loginBtn.style.background = "#FCEBEB";
          loginBtn.style.color = "#A32D2D";
          loginBtn.style.borderColor = "#F7C1C1";
      }
  } else {
      // Logout hone par UI update
      if(loginBtn) {
          loginBtn.innerHTML = `<i class="ti ti-brand-google"></i> <span class="hide-on-mobile">Examiner </span>Login`;   
          loginBtn.style.background = "#185FA5";
          loginBtn.style.color = "#fff";
          loginBtn.style.borderColor = "#185FA5";
      }
  }
  
  // UI refresh karo login state change hone par (Agar functions exist karte hain)
  if(document.getElementById('page-tests') && document.getElementById('page-tests').classList.contains('active')) {
      if(typeof renderTestList === 'function') renderTestList();
  }
  if(document.getElementById('page-results') && document.getElementById('page-results').classList.contains('active')) {
      if(typeof renderAllResults === 'function') renderAllResults();
  }
});

// Login/Logout Button Trigger Function
function toggleLogin() {
    if(currentUser) {
        auth.signOut();
    } else {
        auth.signInWithPopup(provider).catch(error => alert(error.message));
    }
}

// ==========================================
// DATABASE LISTENER (Real-time Sync)
// ==========================================
db.ref('tests').on('value', (snapshot) => {
  var data = snapshot.val();
  
  // SAFE ARRAY CONVERSION
  if (!data) {
      tests = [];
  } else if (Array.isArray(data)) {
      tests = data;
  } else {
      tests = Object.values(data).filter(item => item !== null);
  }
  
  // Submissions ko bhi safe array me rakho
  tests.forEach(t => {
      if (t.submissions && !Array.isArray(t.submissions)) {
          t.submissions = Object.values(t.submissions).filter(item => item !== null);
      } else if (!t.submissions) {
          t.submissions = [];
      }
  });

  // Data aate hi UI refresh karo
  if(document.getElementById('page-tests') && document.getElementById('page-tests').classList.contains('active')) {
      if(typeof renderTestList === 'function') renderTestList();
  }
  if(document.getElementById('page-results') && document.getElementById('page-results').classList.contains('active')) {
      if(typeof renderAllResults === 'function') renderAllResults();
  }
});

function updateDatabase() {
    db.ref('tests').set(tests).catch(error => {
        alert("Error saving data to cloud: " + error.message);
    });
}