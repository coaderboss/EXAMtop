// ==========================================
// ADMIN PORTAL (GOD MODE) ENGINE - ADVANCED V2
// ==========================================

function renderAdminDashboard() {
    // Admin ka main div jahan data dikhega (apne div ka ID check kar lena, mostly yahi hota hai)
    var container = document.getElementById('admin-content-area') || document.getElementById('admin-vault-area'); 
    if(!container) return;

    let html = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem;">
            <h2 style="color:#A32D2D; margin:0;"><i class="ti ti-crown"></i> Global Test Vault (God Mode)</h2>
            <div class="badge b-red" style="font-size:14px;">Admin Access</div>
        </div>
    `;

    if(tests.length === 0) {
        container.innerHTML = html + `<div style="text-align:center; padding:3rem; color:var(--color-text-secondary);"><i class="ti ti-database-off" style="font-size:48px; margin-bottom:10px;"></i><br>Database is currently empty. No tests found.</div>`;
        return;
    }

    html += `<div style="display:flex; flex-direction:column; gap:20px;">`;
    
    // Har test ke liye ek card banega
    tests.forEach((t, tIndex) => {
        let statusBadge = t.isActive ? `<span class="badge b-green"><i class="ti ti-door-enter"></i> INTAKE OPEN</span>` : `<span class="badge b-red"><i class="ti ti-door-exit"></i> INTAKE CLOSED</span>`;
        let subCount = t.submissions ? t.submissions.length : 0;

        html += `
        <div class="card" style="border: 2px solid #e2e8f0; padding: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
            
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:15px; border-bottom:1px solid #e2e8f0; padding-bottom:15px;">
                <div>
                    <h3 style="margin:0 0 5px 0; font-size:18px; color:#185FA5;">${t.title} <span class="badge b-gray" style="font-size:12px; margin-left:8px;">Code: ${t.code}</span></h3>
                    <div style="font-size:13px; color:var(--color-text-secondary);">
                        ${statusBadge} &bull; Total Submissions: <strong>${subCount}</strong> &bull; Total Marks: ${t.totalMarks}
                    </div>
                </div>
                
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-sm" style="background:#f8fafc; border:1px solid #cbd5e1; color:#0f172a; font-weight:600;" onclick="adminToggleTestStatus('${t.id}')">
                        <i class="ti ti-power"></i> Toggle Status
                    </button>
                    <button class="btn btn-danger btn-sm" style="font-weight:600;" onclick="adminDeleteTest('${t.id}')">
                        <i class="ti ti-trash"></i> Nuke Test
                    </button>
                </div>
            </div>`;

        // STUDENT SUBMISSIONS LIST & STUDENT LEVEL BUTTONS
        if(subCount > 0) {
            html += `
            <div style="background:#f1f5f9; padding:15px; border-radius:8px; border:1px solid #cbd5e1;">
                <h4 style="margin:0 0 10px 0; font-size:14px; color:#475569;"><i class="ti ti-users"></i> Student Submissions Data:</h4>
                <div style="display:flex; flex-direction:column; gap:8px;">`;
            
            t.submissions.forEach((sub, sIdx) => {
                let pct = Math.round((sub.score / t.totalMarks) * 100);
                html += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:#fff; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size:14px; line-height:1.4;">
                        <strong style="color:#0f172a;">${sub.name}</strong> <span style="color:#64748b; font-size:12px;">(${sub.roll || 'No Roll'})</span><br>
                        <span style="color:#185FA5; font-weight:600;">Score: ${sub.score} / ${t.totalMarks}</span> <span style="font-size:12px; color:gray;">(${pct}%)</span> &bull; <span style="font-size:11px; color:#94a3b8;">${sub.time}</span>
                    </div>
                    
                    <button class="btn btn-sm" style="background:#FCEBEB; color:#A32D2D; border:1px solid #F7C1C1; padding:6px 10px;" onclick="adminDeleteSubmission('${t.id}', ${sIdx})">
                        <i class="ti ti-trash-x"></i> Delete Entry
                    </button>
                </div>`;
            });
            html += `</div></div>`;
        } else {
            html += `<div style="font-size:13px; color:#94a3b8; font-style:italic;">No students have taken this test yet.</div>`;
        }
        
        html += `</div>`; // Close Card
    });
    
    html += `</div>`; // Close Wrapper
    container.innerHTML = html;
}

function switchAdminTab(tab, btnElement) {
    document.querySelectorAll('#page-admin .ftab').forEach(b => b.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');
    
    if(tab === 'stats') loadAdminStats();
    else if(tab === 'users') loadAdminUsers();
    else if(tab === 'tests') loadAdminTests();
}

function loadAdminStats() {
    var c = document.getElementById('admin-content-area');
    
    // Fetch Global Users Node from Database
    db.ref('users').once('value').then(snapshot => {
        var usersData = snapshot.val() || {};
        var totalAuthUsers = Object.keys(usersData).length; // Total Google Authenticated IDs
        var totalStudents = 0, totalExaminers = 0;
        
        Object.values(usersData).forEach(u => {
            if(u.role === 'student' || u.role === 'guest') totalStudents++;
            if(u.role === 'examiner') totalExaminers++;
        });
        
        var totalTests = tests.length;
        var totalSubmissions = 0;
        tests.forEach(t => {
            if(t.submissions) totalSubmissions += t.submissions.length;
        });

        // Dynamic Owner Details from Firebase Auth State
        var ownerName = currentUser.displayName || "System Administrator";
        var ownerEmail = currentUser.email || "admin@system.io";
        
        c.innerHTML = `
        <div style="background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 12px; padding: 1.5rem; color: #fff; margin-bottom: 2rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.1); border: 2px solid #E24B4A; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #E24B4A;">
                    <i class="ti ti-crown" style="font-size: 26px;"></i>
                </div>
                <div>
                    <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 600;">Root Root System Owner</div>
                    <div style="font-size: 18px; font-weight: 700; margin-top: 2px;">${ownerName}</div>
                    <div style="font-size: 13px; color: #cbd5e1; margin-top: 1px;"><i class="ti ti-mail" style="font-size:12px;"></i> ${ownerEmail}</div>
                </div>
            </div>
            <div style="background: rgba(226, 75, 74, 0.15); border: 1px solid rgba(226, 75, 74, 0.3); padding: 6px 14px; border-radius: 20px; color: #fca5a5; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">
                <i class="ti ti-shield-check"></i> Session Verified
            </div>
        </div>

        <div class="grid4" style="margin-bottom:2rem">
            <div class="stat-card" style="border-color:#185FA5; background: #fff;">
                <div class="stat-val" style="color:#185FA5">${totalAuthUsers}</div>
                <div class="stat-lbl"><i class="ti ti-brand-google" style="font-size:11px;"></i> Google Authentications</div>
            </div>
            <div class="stat-card" style="border-color:#3B6D11; background: #fff;">
                <div class="stat-val" style="color:#3B6D11">${totalStudents}</div>
                <div class="stat-lbl">Active Students</div>
            </div>
            <div class="stat-card" style="border-color:#854F0B; background: #fff;">
                <div class="stat-val" style="color:#854F0B">${totalExaminers}</div>
                <div class="stat-lbl">Active Examiners</div>
            </div>
            <div class="stat-card" style="border-color:#534AB7; background: #fff;">
                <div class="stat-val" style="color:#534AB7">${totalTests}</div>
                <div class="stat-lbl">Total Tests Vault</div>
            </div>
        </div>

        <div class="card">
            <div class="card-title"><i class="ti ti-server"></i> System Health & Infrastructure Metrics</div>
            <p style="color:var(--color-text-secondary); margin-bottom:10px; font-size:15px;">Total Exam Submissions Processed: <strong style="color:#0f172a">${totalSubmissions}</strong></p>
            <p style="color:var(--color-text-secondary); font-size:15px;">Real-time Database Status: <strong style="color:#3B6D11"><i class="ti ti-circle-check"></i> Online & Synced</strong></p>
        </div>
        `;
    });
}

function loadAdminUsers() {
    var c = document.getElementById('admin-content-area');
    c.innerHTML = `<div style="text-align:center; padding:2rem;"><i class="ti ti-loader" style="font-size:32px; color:#185FA5; margin-bottom:10px;"></i><br>Fetching Database...</div>`;
    
    db.ref('users').once('value').then(snapshot => {
        var usersData = snapshot.val() || {};
        var usersList = Object.values(usersData);
        
        if(usersList.length === 0) {
            c.innerHTML = `<p>No users found.</p>`;
            return;
        }
        
        var html = `
        <div style="width:100%; overflow-x:auto; background:#fff; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.05); border:1px solid var(--color-border-secondary);">
            <table style="width:100%; border-collapse: collapse; min-width: 600px;">
                <tr style="background:var(--color-background-secondary); border-bottom:1px solid var(--color-border-secondary); text-align:left;">
                    <th style="padding:12px 15px; font-weight:600; font-size:14px; color:var(--color-text-secondary);">Name</th>
                    <th style="padding:12px 15px; font-weight:600; font-size:14px; color:var(--color-text-secondary);">Email</th>
                    <th style="padding:12px 15px; font-weight:600; font-size:14px; color:var(--color-text-secondary);">Role</th>
                    <th style="padding:12px 15px; font-weight:600; font-size:14px; color:var(--color-text-secondary);">Actions</th>
                </tr>`;
            
        usersList.forEach(u => {
            var roleBadge = u.role === 'admin' ? 'b-red' : u.role === 'examiner' ? 'b-green' : 'b-blue';
            html += `
            <tr style="border-bottom:1px solid var(--color-border-tertiary);">
                <td style="padding:12px 15px; font-size:14px; font-weight:600; color:#0f172a;">${u.name}</td>
                <td style="padding:12px 15px; font-size:14px; color:var(--color-text-secondary);">${u.email}</td>
                <td style="padding:12px 15px;"><span class="badge ${roleBadge}" style="text-transform:uppercase; font-size:11px;">${u.role}</span></td>
                <td style="padding:12px 15px;">
                    ${u.role !== 'admin' ? `
                    <select onchange="changeUserRole('${u.uid}', this.value)" style="padding:6px; font-size:13px; font-weight:500; border-radius:6px; border:1px solid #cbd5e1; cursor:pointer;">
                        <option value="">Change Role...</option>
                        <option value="student">Make Student</option>
                        <option value="examiner">Make Examiner</option>
                    </select>
                    ` : '<span style="font-size:12px; color:#A32D2D; font-weight:800; letter-spacing:1px;"><i class="ti ti-crown"></i> OWNER</span>'}
                </td>
            </tr>`;
        });
        
        html += `</table></div>`;
        c.innerHTML = html;
    });
}

function changeUserRole(uid, newRole) {
    if(!newRole) return;
    if(confirm(`WARNING: Are you sure you want to grant ${newRole.toUpperCase()} permissions to this user?`)) {
        db.ref('users/' + uid).update({ role: newRole }).then(() => {
            showToast('User Role Upgraded!', 'success');
            loadAdminUsers(); 
        }).catch(err => showToast(err.message, 'error'));
    }
}

function loadAdminTests() {
    var c = document.getElementById('admin-content-area');
    if(tests.length === 0) {
        c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-folder-off" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">No tests in the vault.</div></div>`;
        return;
    }
    
    var html = `<div style="display:flex; flex-direction:column; gap:12px;">`;
    tests.forEach((t, i) => {
        html += `
        <div class="test-entry" style="align-items:center; padding:1.25rem 1.5rem; border-left:4px solid #534AB7; background:#fff; flex-wrap:wrap;">
            <div class="te-meta" style="flex:1; min-width:200px;">
                <div style="font-weight:600;font-size:16px;">${t.title} <span class="badge b-gray" style="font-size:11px; margin-left:8px;">Code: ${t.code}</span></div>
                <div style="font-size:13px;color:var(--color-text-secondary); margin-top:6px;">Creator UID: ${t.creatorUid}</div>
                <div style="font-size:13px;color:#185FA5; font-weight:600; margin-top:4px;">${t.questions.length} Questions &bull; ${t.submissions ? t.submissions.length : 0} Submissions</div>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px;">
                <button class="btn btn-sm btn-blue" style="font-weight:600; padding:8px 16px;" onclick="inspectAdminTest(${i})">
                    <i class="ti ti-search"></i> Inspect
                </button>
                <button class="btn btn-sm btn-danger" style="font-weight:600; padding:8px 16px;" onclick="adminDeleteTest(${i})">
                    <i class="ti ti-trash"></i> Delete
                </button>
            </div>
        </div>`;
    });
    html += `</div>`;
    c.innerHTML = html;
}

function inspectAdminTest(idx) {
    var t = tests[idx];
    var subs = t.submissions || [];
    
    var subHtml = subs.length === 0 
        ? '<div style="padding:1rem; text-align:center; color:var(--color-text-secondary); background:var(--color-background-tertiary); border-radius:8px;">No submissions yet.</div>'
        : subs.map(s => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--color-border-secondary);">
                <div>
                    <div style="font-weight:600; font-size:14px; color:#0f172a;">${s.name} <span style="font-size:12px; font-weight:normal; color:#64748b;">(${s.roll || 'Guest'})</span></div>
                    <div style="font-size:12px; color:var(--color-text-secondary); margin-top:4px;">${s.time}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:bold; color:#185FA5; font-size:16px;">${s.score} <span style="font-size:12px; color:#64748b; font-weight:normal;">/ ${t.totalMarks}</span></div>
                </div>
            </div>
        `).join('');

    showModal(`
        <div style="padding:1.5rem; text-align:left;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">
                <div>
                    <h3 style="margin:0 0 6px 0; color:#534AB7; font-size:20px; display:flex; align-items:center; gap:8px;">
                        <i class="ti ti-search"></i> Deep Inspection
                    </h3>
                    <div style="font-size:14px; font-weight:600; color:var(--color-text-primary);">${t.title}</div>
                </div>
                <span class="badge b-blue" style="font-size:14px; letter-spacing:2px; padding:6px 10px;">${t.code}</span>
            </div>
            
            <div style="margin-bottom:1.5rem;">
                <h4 style="font-size:15px; font-weight:600; margin-bottom:10px; color:#0f172a; display:flex; align-items:center; gap:6px;">
                    <i class="ti ti-settings"></i> Test Configuration
                </h4>
                <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; font-size:13px; color:#475569; display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div><strong style="color:#0f172a;">Duration:</strong> ${t.duration} mins</div>
                    <div><strong style="color:#0f172a;">Total Marks:</strong> ${t.totalMarks}</div>
                    <div><strong style="color:#0f172a;">Neg. Marking:</strong> -${t.negMarking || 0}</div>
                    <div><strong style="color:#0f172a;">Result Vis:</strong> <span style="text-transform:capitalize;">${t.resultVis}</span></div>
                    <div><strong style="color:#A32D2D;">Anti-Cheat Tab Lock:</strong> ${t.antiCheat ? 'ON' : 'OFF'}</div>
                    <div><strong style="color:#185FA5;">Full Screen Lock:</strong> ${t.fullScreenMode ? 'ON' : 'OFF'}</div>
                </div>
            </div>

            <div style="margin-bottom:1.5rem;">
                <h4 style="font-size:15px; font-weight:600; margin-bottom:10px; color:#0f172a; display:flex; align-items:center; gap:6px;">
                    <i class="ti ti-users"></i> Submissions Log (${subs.length})
                </h4>
                <div style="max-height:220px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; background:#fff;">
                    ${subHtml}
                </div>
            </div>
            
            <button class="btn btn-primary" style="width:100%; font-weight:600; padding:12px;" onclick="hideModal()">
                Close Inspection
            </button>
        </div>
    `);
}

function adminDeleteTest(idx) {
    var code = tests[idx].code;
    var conf = prompt(`CRITICAL ACTION: You are about to globally delete this test.\nType the exact test code "${code}" to confirm:`);
    if(conf === code) {
        tests.splice(idx, 1);
        updateDatabase();
        showToast('Test permanently deleted from global vault.', 'success');
        loadAdminTests();
    } else if (conf !== null) {
        showToast('Incorrect code. Deletion cancelled.', 'error');
    }
}

// ==========================================
// ADMIN GOD MODE POWERS (BULLETPROOF DIRECT SYNC)
// ==========================================

// Helper function to force sync data directly to Firebase with error logging
function forceFirebaseSync() {
    // Agar tumhaara Firebase instance 'database' naam se hai
    if (typeof database !== 'undefined') {
        database.ref('tests').set(tests)
        .then(() => {
            showToast("Database Synced Successfully!", "success");
            renderAdminDashboard();
        })
        .catch(err => {
            // Agar Firebase rules block karenge toh ye alert aayega
            alert("FIREBASE REJECTED WRITE:\n" + err.message + "\n\nCheck your Firebase Security Rules or Console!");
        });
    } 
    // Agar tumhaara Firebase instance 'firebase.database()' use karta hai
    else if (typeof firebase !== 'undefined' && firebase.database) {
        firebase.database().ref('tests').set(tests)
        .then(() => {
            showToast("Database Synced Successfully!", "success");
            renderAdminDashboard();
        })
        .catch(err => {
            alert("FIREBASE REJECTED WRITE:\n" + err.message);
        });
    } 
    // Fallback agar koi aur method ho
    else {
        if(typeof updateDatabase === 'function') {
            updateDatabase();
            renderAdminDashboard();
        } else {
            alert("Error: Database sync function not found globally.");
        }
    }
}

// Power 1: Delete a specific student's result
function adminDeleteSubmission(testId, subIdx) {
    if(!confirm("⚠️ WARNING: Are you sure you want to delete this student's result permanently? This cannot be undone.")) return;
    
    var t = tests.find(x => x.id === testId);
    if(t && t.submissions && t.submissions.length > subIdx) {
        t.submissions.splice(subIdx, 1); // Local delete
        forceFirebaseSync(); // Direct Firebase sync
    }
}

// Power 2: Nuke Entire Test (Complete Wipeout)
function adminDeleteTest(testId) {
    if(!confirm("☢️ NUCLEAR WARNING: This will delete the ENTIRE TEST and ALL its submissions. Are you absolutely sure?")) return;
    
    var tIndex = tests.findIndex(x => x.id === testId);
    if(tIndex > -1) {
        tests.splice(tIndex, 1); // Local delete
        forceFirebaseSync(); // Direct Firebase sync
    }
}

// Power 3: Emergency Test Toggle (Open/Close Intake)
function adminToggleTestStatus(testId) {
    var t = tests.find(x => x.id === testId);
    if(t) {
        if (typeof t.isActive === 'undefined') t.isActive = true; 
        t.isActive = !t.isActive; // Local toggle
        forceFirebaseSync(); // Direct Firebase sync
    }
}