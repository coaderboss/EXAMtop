// ==========================================
// EXAMITOP: ADMIN PORTAL FULL CODE (GOD MODE)
// ==========================================

function switchAdminTab(tab, btnElement) {
    document.querySelectorAll('#page-admin .ftab').forEach(b => b.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');
    
    if(tab === 'stats') loadAdminStats();
    else if(tab === 'users') loadAdminUsers();
    else if(tab === 'tests') window.renderAdminDashboard(); 
}

function loadAdminStats() {
    var c = document.getElementById('admin-content-area');
    if(!c) return;
    
    if(typeof db !== 'undefined') {
        // MAGIC: Ab hum Users aur Platform Stats (Downloads) dono eksath database se mangwayenge
        Promise.all([
            db.ref('users').once('value'),
            db.ref('platform_stats/total_downloads').once('value')
        ]).then((snapshots) => {
            var usersData = snapshots[0].val() || {};
            var downloadsCount = snapshots[1].val() || 0; // Tumhara Live App Download Count
            
            var totalAuthUsers = Object.keys(usersData).length; 
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

            var ownerName = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.displayName : "System Administrator";
            var ownerEmail = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.email : "admin@system.io";
            
            c.innerHTML = `
            <div style="background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 12px; padding: 1.5rem; color: #fff; margin-bottom: 2rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.1); border: 2px solid #E24B4A; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #E24B4A;">
                        <i class="ti ti-crown" style="font-size: 26px;"></i>
                    </div>
                    <div>
                        <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 600;">Root System Owner</div>
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
                    <div class="stat-lbl"><i class="ti ti-brand-google" style="font-size:11px;"></i> Google Auth</div>
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
                <div class="card-title"><i class="ti ti-server"></i> System Health & Infrastructure</div>
                <p style="color:var(--color-text-secondary); margin-bottom:10px; font-size:15px;">Total Exam Submissions Processed: <strong style="color:#0f172a">${totalSubmissions}</strong></p>
                
                <p style="color:var(--color-text-secondary); margin-bottom:10px; font-size:15px;">App Installed on Devices (PWA): <strong style="color:#185FA5"><i class="ti ti-download"></i> ${downloadsCount} Installs</strong></p>
                
                <p style="color:var(--color-text-secondary); font-size:15px;">Real-time Database Status: <strong style="color:#3B6D11"><i class="ti ti-circle-check"></i> Online & Synced</strong></p>
            </div>
            `;
        });
    }
}

function loadAdminUsers() {
    var c = document.getElementById('admin-content-area');
    if(!c) return;
    c.innerHTML = `<div style="text-align:center; padding:2rem;"><i class="ti ti-loader" style="font-size:32px; color:#185FA5; margin-bottom:10px;"></i><br>Fetching Database...</div>`;
    
    if(typeof db !== 'undefined') {
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
}

function changeUserRole(uid, newRole) {
    if(!newRole) return;
    if(confirm(`WARNING: Are you sure you want to grant ${newRole.toUpperCase()} permissions to this user?`)) {
        if(typeof db !== 'undefined') {
            db.ref('users/' + uid).update({ role: newRole }).then(() => {
                if(typeof showToast === 'function') showToast('User Role Upgraded!', 'success');
                loadAdminUsers(); 
            }).catch(err => {
                if(typeof showToast === 'function') showToast(err.message, 'error');
            });
        }
    }
}

// ==========================================
// ADMIN DASHBOARD RENDER ENGINE
// ==========================================
window.renderAdminDashboard = function() {
    var container = document.getElementById('admin-content-area') || document.getElementById('admin-vault-area'); 
    if(!container) return;

    let html = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; flex-wrap:wrap; gap:10px;">
            <h2 style="color:#A32D2D; margin:0;"><i class="ti ti-crown"></i> Global Test Vault (God Mode)</h2>
            
            <div style="display:flex; gap:10px;">
                <button class="btn" style="background:#185FA5; color:#fff; font-weight:600; padding:8px 16px; border:none;" onclick="window.adminExportCSV()">
                    <i class="ti ti-file-spreadsheet"></i> Export Excel
                </button>
                <button class="btn btn-danger" style="font-weight:600; padding:8px 16px;" onclick="window.adminSmartPurge()">
                    <i class="ti ti-flame"></i> Smart Purge
                </button>
            </div>
        </div>
    `;

    if(!tests || tests.length === 0) {
        container.innerHTML = html + `<div style="text-align:center; padding:3rem; color:var(--color-text-secondary);"><i class="ti ti-database-off" style="font-size:48px; margin-bottom:10px;"></i><br>Database is currently empty. No tests found.</div>`;
        return;
    }

    html += `<div style="display:flex; flex-direction:column; gap:20px;">`;
    
    let reversedTests = [...tests].reverse();

    reversedTests.forEach((t) => {
        // NAYA FIX: Har jagah ab test ka CODE use hoga
        let uniqueCode = t.code; 
        
        let statusBadge = t.isActive !== false ? `<span class="badge b-green"><i class="ti ti-door-enter"></i> INTAKE OPEN</span>` : `<span class="badge b-red"><i class="ti ti-door-exit"></i> INTAKE CLOSED</span>`;
        let subCount = t.submissions ? t.submissions.length : 0;

        html += `
        <div class="card" style="border: 2px solid #e2e8f0; padding: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); margin-bottom: 0; background: #fff;">
            
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:15px; border-bottom:1px solid #e2e8f0; padding-bottom:15px;">
                <div>
                    <h3 style="margin:0 0 5px 0; font-size:18px; color:#185FA5;">${t.title || 'Untitled Test'} <span class="badge b-gray" style="font-size:12px; margin-left:8px;">Code: ${uniqueCode}</span></h3>
                    <div style="font-size:13px; color:var(--color-text-secondary);">
                        ${statusBadge} &bull; Total Submissions: <strong>${subCount}</strong> &bull; Total Marks: ${t.totalMarks || 0}
                    </div>
                </div>
                
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-sm" style="background:#f8fafc; border:1px solid #cbd5e1; color:#0f172a; font-weight:600;" onclick="window.adminToggleTestStatus('${uniqueCode}')">
                        <i class="ti ti-power"></i> Toggle Status
                    </button>
                    <button class="btn btn-danger btn-sm" style="font-weight:600;" onclick="window.adminDeleteTest('${uniqueCode}')">
                        <i class="ti ti-trash"></i> Nuke Test
                    </button>
                </div>
            </div>`;

        if(subCount > 0) {
            html += `
            <div style="background:#f1f5f9; padding:15px; border-radius:8px; border:1px solid #cbd5e1;">
                <h4 style="margin:0 0 10px 0; font-size:14px; color:#475569;"><i class="ti ti-users"></i> Student Submissions Data:</h4>
                <div style="display:flex; flex-direction:column; gap:8px;">`;
            
            t.submissions.forEach((sub, sIdx) => {
                let pct = t.totalMarks ? Math.round((sub.score / t.totalMarks) * 100) : 0;
                html += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:#fff; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.05); flex-wrap:wrap; gap:10px;">
                    <div style="font-size:14px; line-height:1.4;">
                        <strong style="color:#0f172a;">${sub.name || 'Unknown'}</strong> <span style="color:#64748b; font-size:12px;">(${sub.roll || 'Guest'})</span><br>
                        <span style="color:#185FA5; font-weight:600;">Score: ${sub.score || 0} / ${t.totalMarks || 0}</span> <span style="font-size:12px; color:gray;">(${pct}%)</span> &bull; <span style="font-size:11px; color:#94a3b8;">${sub.time || ''}</span>
                    </div>
                    
                    <button class="btn btn-sm" style="background:#FCEBEB; color:#A32D2D; border:1px solid #F7C1C1; padding:6px 10px;" onclick="window.adminDeleteSubmission('${uniqueCode}', ${sIdx})">
                        <i class="ti ti-trash-x"></i> Delete Entry
                    </button>
                </div>`;
            });
            html += `</div></div>`;
        } else {
            html += `<div style="font-size:13px; color:#94a3b8; font-style:italic;">No students have taken this test yet.</div>`;
        }
        
        html += `</div>`; 
    });
    
    html += `</div>`; 
    container.innerHTML = html;
};

// ==========================================
// GOD MODE POWERS (DIRECT SYNC TO FIREBASE)
// ==========================================

window.forceFirebaseSync = function() {
    if (typeof database !== 'undefined') {
        database.ref('tests').set(tests)
        .then(() => {
            if(typeof showToast === 'function') showToast("Database Synced Successfully!", "success");
            window.renderAdminDashboard();
        })
        .catch(err => {
            alert("FIREBASE REJECTED WRITE:\n" + err.message + "\n\nCheck your Firebase Security Rules!");
        });
    } else if (typeof firebase !== 'undefined' && firebase.database) {
        firebase.database().ref('tests').set(tests)
        .then(() => {
            if(typeof showToast === 'function') showToast("Database Synced Successfully!", "success");
            window.renderAdminDashboard();
        })
        .catch(err => alert("FIREBASE REJECTED WRITE:\n" + err.message));
    } else {
        if(typeof updateDatabase === 'function') {
            updateDatabase();
            window.renderAdminDashboard();
        } else {
            alert("Error: No sync method found!");
        }
    }
};

window.adminDeleteSubmission = function(testCode, subIdx) {
    if(!confirm("⚠️ WARNING: Are you sure you want to delete this student's result permanently?")) return;
    
    // NAYA FIX: Ab ID ke bajaye sidha TEST CODE se match hoga
    var t = tests.find(x => x.code === testCode || x.id === testCode);
    if(t && t.submissions && t.submissions.length > subIdx) {
        t.submissions.splice(subIdx, 1);
        window.forceFirebaseSync(); 
    } else {
        alert("Error: Result not found! (Code: " + testCode + ")");
    }
};

window.adminDeleteTest = function(testCode) {
    if(!confirm("☢️ NUCLEAR WARNING: This will delete the ENTIRE TEST and ALL its submissions. Are you absolutely sure?")) return;
    
    // NAYA FIX: Ab ID ke bajaye sidha TEST CODE se match hoga
    var tIndex = tests.findIndex(x => x.code === testCode || x.id === testCode);
    if(tIndex > -1) {
        tests.splice(tIndex, 1);
        window.forceFirebaseSync(); 
    } else {
        alert("Error: Test not found! (Code: " + testCode + ")");
    }
};

window.adminToggleTestStatus = function(testCode) {
    // NAYA FIX: Ab ID ke bajaye sidha TEST CODE se match hoga
    var t = tests.find(x => x.code === testCode || x.id === testCode);
    if(t) {
        if (typeof t.isActive === 'undefined') t.isActive = true; 
        t.isActive = !t.isActive; 
        window.forceFirebaseSync(); 
    } else {
        alert("Error: Test not found! (Code: " + testCode + ")");
    }
};

// ==========================================
// REAL GOD MODE POWERS (SMART PURGE & EXPORT)
// ==========================================

// Power 1: Smart Time-Aware Purge
window.adminSmartPurge = function() {
    let days = prompt("⏳ SMART PURGE\n\nEnter number of days (e.g., 7):\nSystem will ONLY delete tests that are OLDER than this AND have 0 submissions.", "7");
    
    if(!days || isNaN(days)) {
        showToast("Purge Cancelled.", "error");
        return;
    }

    // Calculate cutoff time in milliseconds
    let cutoffTime = Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000);
    let originalLength = tests.length;

    // Filter logic: Keep tests IF they have submissions OR they are newer than the cutoff
    let healthyTests = tests.filter(t => {
        let hasSubmissions = t.submissions && t.submissions.length > 0;
        
        // Assume t.id is a timestamp. If your ID is string, we check its numeric value.
        let isRecent = true;
        if (t.id && !isNaN(t.id)) {
            isRecent = Number(t.id) > cutoffTime;
        }

        return hasSubmissions || isRecent;
    });

    let deletedCount = originalLength - healthyTests.length;

    if(deletedCount > 0) {
        if(confirm(`🚨 System found ${deletedCount} junk tests older than ${days} days.\nAre you sure you want to permanently delete them?`)) {
            tests = healthyTests; // Update global array
            window.forceFirebaseSync(); // Sync to DB
            alert(`✅ Purge Complete! ${deletedCount} ghost tests wiped out.`);
        }
    } else {
        alert(`No empty tests older than ${days} days were found. Database is clean!`);
    }
};


// Power 2: Download Entire Database as Excel (CSV)
window.adminExportCSV = function() {
    if(!tests || tests.length === 0) {
        alert("Database is empty. Nothing to export!");
        return;
    }

    // Create CSV Headers
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Test Title,Test Code,Creator UID,Total Marks,Student Name,Roll Number,Score,Percentage,Attempt Time\n";

    // Loop through all tests and submissions to create rows
    tests.forEach(t => {
        let tTitle = t.title ? t.title.replace(/,/g, "") : "Untitled"; // Remove commas to prevent CSV breakage
        let tCode = t.code || "N/A";
        let tCreator = t.creatorUid || "Unknown";
        let tMarks = t.totalMarks || 0;

        if (t.submissions && t.submissions.length > 0) {
            t.submissions.forEach(sub => {
                let sName = sub.name ? sub.name.replace(/,/g, "") : "Guest";
                let sRoll = sub.roll || "N/A";
                let sScore = sub.score || 0;
                let sPct = tMarks > 0 ? Math.round((sScore / tMarks) * 100) + "%" : "0%";
                let sTime = sub.time || "N/A";

                // Add row
                csvContent += `${tTitle},${tCode},${tCreator},${tMarks},${sName},${sRoll},${sScore},${sPct},${sTime}\n`;
            });
        } else {
            // Include tests even if they have no submissions
            csvContent += `${tTitle},${tCode},${tCreator},${tMarks},No Submissions,-,-,-,-\n`;
        }
    });

    // Magic code to force browser to download the file
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ExamiTop_Global_Report_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link); // Required for FF
    
    link.click(); 
    document.body.removeChild(link); // Clean up
    
    showToast("Excel Export Generated!", "success");
};
// ==========================================
// ADMIN TAB BUTTONS COLOR FIX (UNIVERSAL)
// ==========================================
document.addEventListener('click', function(e) {
    // Check karte hain ki kya click hone wali cheez button hai aur uske andar koi tab open karne ka text/icon hai
    let clickedBtn = e.target.closest('button');
    
    // Agar click admin page ke andar wale buttons par hua hai
    if (clickedBtn && window.location.hash.includes('admin') && clickedBtn.closest('.page-header, .filter-tabs, .admin-controls')) {
        
        // Agar us button par pehle se 'btn-primary' nahi hai (yani wo active nahi hai)
        if (!clickedBtn.classList.contains('btn-primary')) {
            
            // 1. Uske aas-paas ke (siblings) saare buttons dhoondho
            let allSiblingButtons = clickedBtn.parentElement.querySelectorAll('button');
            
            // 2. Sabme se 'btn-primary' (Blue color) hata kar normal ('btn' ya 'btn-ghost') kar do
            allSiblingButtons.forEach(btn => {
                btn.classList.remove('btn-primary');
                // Agar button outline wala tha, toh uski default class add kar do
                btn.classList.add('btn-ghost'); 
            });
            
            // 3. Ab SIRF us button par Blue color lagao jispar abhi click hua hai
            clickedBtn.classList.remove('btn-ghost');
            clickedBtn.classList.add('btn-primary');
        }
    }
});