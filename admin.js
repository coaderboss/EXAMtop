// ==========================================
// ADMIN PORTAL (GOD MODE) ENGINE - ADVANCED V2
// ==========================================

function renderAdminDashboard() {
    var c = document.getElementById('admin-content-area');
    // Double Security Check
    if(!currentUser || userRole !== 'admin') {
        c.innerHTML = `<div style="text-align:center;padding:4rem;color:#A32D2D"><i class="ti ti-shield-x" style="font-size:48px;display:block;margin-bottom:1rem"></i><div style="font-size:16px;font-weight:500">UNAUTHORIZED ACCESS. SEVERITY LEVEL 1.</div></div>`;
        return;
    }
    
    // Default load stats
    loadAdminStats();
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