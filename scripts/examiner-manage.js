// ==========================================
// EXAMINER: DASHBOARD & GRAPHICAL ANALYTICS
// ==========================================
// ==========================================
// 1. RENDER TEST LIST (ANTI-JUMP & SMOOTH TRANSITION FIX)
// ==========================================
function renderTestList() {
    var container = document.getElementById('test-list-area');
    if(!container) return;

    var cUid = null;
    var cEmail = null;
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        cUid = firebase.auth().currentUser.uid;
        cEmail = firebase.auth().currentUser.email;
    } else if (typeof currentUser !== 'undefined' && currentUser) {
        cUid = currentUser.uid || null;
        cEmail = currentUser.email || null;
    }

    var masterView = document.getElementById('tests-master-view');
    var detailView = document.getElementById('test-detail-view');
    
    // Check if detail view is currently open
    var isDetailOpen = detailView && detailView.style.display === 'block';
    
    if (!masterView || !detailView) {
        container.innerHTML = `
            <div id="tests-master-view" style="display:flex; flex-direction:column; gap:16px; animation: fadeIn 0.3s ease;"></div>
            <div id="test-detail-view" style="display:none; animation: fadeIn 0.3s ease;"></div>
        `;
        masterView = document.getElementById('tests-master-view');
        detailView = document.getElementById('test-detail-view');
    }

    let html = '';
    let renderedCount = 0; 

    tests.forEach((t, i) => {
        let isMine = false;
        let testString = JSON.stringify(t); 
        
        if (cUid && testString.includes(cUid)) isMine = true;
        if (cEmail && testString.includes(cEmail)) isMine = true;
        if (!isMine) return; 

        renderedCount++;
        
        let subCount = (t.submissions && Array.isArray(t.submissions)) ? t.submissions.length : (t.submissions ? Object.keys(t.submissions).length : 0);
        let isLive = t.isActive !== false; 
        
        let pulseHtml = isLive 
            ? `<div style="display:flex; align-items:center; gap:6px; background:#d1fae5; padding:4px 10px; border-radius:20px;"><span style="display:block; width:8px; height:8px; background:#10B981; border-radius:50%; box-shadow: 0 0 8px #10B981; animation: pulse 1.5s infinite;"></span><span style="color:#065f46; font-weight:700; font-size:12px; letter-spacing:0.5px; text-transform:uppercase;">Live</span></div>` 
            : `<div style="display:flex; align-items:center; gap:6px; background:#f1f5f9; padding:4px 10px; border-radius:20px;"><span style="display:block; width:8px; height:8px; background:#94a3b8; border-radius:50%;"></span><span style="color:#64748b; font-weight:600; font-size:12px; letter-spacing:0.5px; text-transform:uppercase;">Closed</span></div>`;

        html += `
        <div class="card" style="cursor:pointer; padding: 1.5rem; display:flex; justify-content:space-between; align-items:center; transition: all 0.2s ease; border-left: 4px solid ${isLive ? '#10B981' : '#cbd5e1'};" onclick="openTestDashboard(${i})" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.06)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 10px rgba(0,0,0,0.04)';">
            <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                    <h3 style="margin:0; color:#0f172a; font-size:18px; font-weight:700;">${t.title}</h3>
                    ${pulseHtml}
                </div>
                <div style="font-size:14px; color:#64748b; margin-bottom:12px; font-weight:500;">
                    <i class="ti ti-book"></i> ${t.subject || 'General'} &nbsp;&bull;&nbsp; <i class="ti ti-list-numbers"></i> ${t.questions.length} Qs &nbsp;&bull;&nbsp; <i class="ti ti-clock"></i> ${t.duration} Mins
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <span class="badge b-blue" style="font-family:monospace; font-size:14px; padding:6px 12px; background:#EEEDFE; color:#3C3489; border:1px solid #CECBF6;"><i class="ti ti-hash"></i> ${t.code}</span>
                    <span class="badge b-gray" style="padding:6px 12px;"><i class="ti ti-users"></i> ${subCount} Submissions</span>
                </div>
            </div>
            <div style="padding-left:20px; color:#185FA5;">
                <div style="width:40px; height:40px; border-radius:50%; background:#E6F1FB; display:flex; align-items:center; justify-content:center; transition:0.2s;">
                    <i class="ti ti-chevron-right" style="font-size:20px;"></i>
                </div>
            </div>
        </div>`;
    });
    
    if(renderedCount === 0) {
        masterView.innerHTML = `
        <div class="card" style="text-align:center; padding: 4rem 1rem; border:1px dashed #cbd5e1; background:transparent;">
            <i class="ti ti-folder-off" style="font-size:56px; color:#cbd5e1; margin-bottom:1rem; display:block;"></i>
            <h3 style="color:#475569; font-size:20px; margin-bottom:8px;">Vault is Empty</h3>
            <p style="color:#94a3b8; font-size:15px;">You haven't created any tests yet. Go to the 'Create' tab to build your first exam.</p>
        </div>`;
    } else {
        masterView.innerHTML = html; // List background me update ho jayegi
    }

    // 🔥 THE FIX: Smooth Return aur Anti-Jump Logic
    if (typeof window.pendingTestDashboard !== 'undefined' && window.pendingTestDashboard !== null) {
        let targetIdx = window.pendingTestDashboard;
        window.pendingTestDashboard = null; 
        
        masterView.style.display = 'none'; 
        
        setTimeout(() => {
            if(typeof openTestDashboard === 'function') {
                openTestDashboard(targetIdx);
                if(typeof switchTestTab === 'function') switchTestTab('subs');
            }
            
            // Background me page ready hone ke baad, loading screen ko smoothly fade out karo
            var loader = document.getElementById('transition-loader');
            if(loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.remove(), 300); // Fade effect delay
            }
        }, 100);
        
    } else {
        // 🔥 ANTI-JUMP FIX: Agar pehle se Dashboard andar se khula hai, toh Master list ko zabardasti screen par mat laao!
        if (!isDetailOpen) {
            masterView.style.display = 'flex'; 
        }
    }
}

// ==========================================
// 🎛️ TEST COMMAND CENTER LOGIC
// ==========================================

window.openTestDashboard = function(idx) {
    // 🔥 FIX 1: Hide surrounding titles (e.g., "My Managed Tests") dynamically
    var container = document.getElementById('test-list-area');
    if(container && container.parentNode) {
        Array.from(container.parentNode.children).forEach(child => {
            if(child.id !== 'test-list-area') {
                child.setAttribute('data-old-display', child.style.display || '');
                child.style.display = 'none';
            }
        });
    }

    var t = tests[idx];
    var isLive = t.isActive !== false;
    var subCount = t.submissions ? Object.keys(t.submissions).length : 0;
    
    var statusIcon = isLive ? 'ti-lock' : 'ti-door-enter';
    var statusText = isLive ? 'Close Exam Intake' : 'Open Exam Intake';
    var statusBg = isLive ? '#FCEBEB' : '#EAF3DE';
    var statusColor = isLive ? '#A32D2D' : '#3B6D11';

    var currentUrl = window.location.href.split('#')[0];
    var shareLink = currentUrl + '#student?code=' + t.code;
    var shareText = `*${t.title}* is now live!\n\n🕒 *Time:* ${t.duration} Mins\n💯 *Marks:* ${t.totalMarks}\n🔑 *Test Code:* ${t.code}\n\nClick the link below to join directly:\n${shareLink}`;

    var expiryBadge = '';
    if (t.expiryDate) {
        var dateObj = new Date(t.expiryDate);
        var formattedDate = !isNaN(dateObj) ? dateObj.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : t.expiryDate;
        expiryBadge = `<div style="display:inline-flex; align-items:center; gap:6px; background:#fffbeb; color:#b45309; padding:4px 10px; border-radius:6px; font-size:13px; font-weight:600; border:1px solid #fde68a; margin-top:8px;"><i class="ti ti-alarm"></i> Deadline: ${formattedDate}</div>`;
    }

    var detailHtml = `
        <button class="btn btn-ghost" style="margin-bottom:1.25rem; padding:0; font-size:15px; color:#475569; font-weight:600;" onclick="closeTestDashboard()">
            <i class="ti ti-arrow-left"></i> Back to Vault
        </button>

        <div class="card" style="border-top: 4px solid #185FA5; padding: 1.5rem 2rem; margin-bottom: 1.5rem; background: linear-gradient(to right, #ffffff, #f8fafc);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:15px;">
                <div>
                    <h2 style="margin:0 0 8px 0; color:#0f172a; font-size:24px; font-weight:800;">${t.title}</h2>
                    <p style="margin:0; color:#475569; font-size:15px; font-weight:500;">
                        Code: <span style="background:#EEEDFE; color:#3C3489; padding:2px 8px; border-radius:4px; font-family:monospace; font-size:16px; font-weight:bold; letter-spacing:1px; border:1px solid #CECBF6;">${t.code}</span> &nbsp;&bull;&nbsp; ${t.duration} Mins &nbsp;&bull;&nbsp; ${t.totalMarks} Marks
                    </p>
                    ${expiryBadge}
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                    <div id="header-status-badge" style="display:flex; align-items:center; gap:8px; background:${isLive ? '#d1fae5' : '#f1f5f9'}; padding:8px 16px; border-radius:30px; font-size:14px; font-weight:700; color:${isLive ? '#065f46' : '#475569'}; border: 1px solid ${isLive ? '#34d399' : '#cbd5e1'};">
                        ${isLive ? '<span style="width:10px; height:10px; background:#10B981; border-radius:50%; box-shadow:0 0 8px #10B981; animation:pulse 1s infinite;"></span> Live Accepting' : '<span style="width:10px; height:10px; background:#94a3b8; border-radius:50%;"></span> Intake Locked'}
                    </div>
                </div>
            </div>
        </div>

        <div style="display:flex; gap:10px; margin-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; overflow-x: auto;">
            <button id="tab-btn-overview" class="btn btn-ghost active" style="font-size:15px; font-weight:600; color:#185FA5; background:#E6F1FB; border-radius:8px; padding:10px 20px;" onclick="switchTestTab('overview')"><i class="ti ti-dashboard"></i> Overview & Settings</button>
            <button id="tab-btn-subs" class="btn btn-ghost" style="font-size:15px; font-weight:600; color:#64748b; padding:10px 20px;" onclick="switchTestTab('subs')"><i class="ti ti-users"></i> Student Submissions <span class="badge b-gray" style="margin-left:8px; background:#cbd5e1; color:#0f172a;">${subCount}</span></button>
        </div>

        <div id="tab-content-overview">
            <div class="grid2">
                <div class="card" style="border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.03);">
                    <h3 style="font-size:16px; color:#0f172a; margin-bottom:1.25rem; display:flex; align-items:center; gap:8px;"><i class="ti ti-tool" style="color:#185FA5;"></i> Essential Tools</h3>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:2rem;">
                        <button class="btn" style="justify-content:center; padding:12px; font-weight:600; border-color:#cbd5e1;" onclick="autoJoinLocalTest('${t.code}')"><i class="ti ti-player-play text-blue"></i> Demo Test</button>
                        <button class="btn" style="justify-content:center; padding:12px; font-weight:600; border-color:#cbd5e1;" onclick="window.printTestPaper(${idx})"><i class="ti ti-printer"></i> Print Paper</button>
                        <button class="btn" style="justify-content:center; padding:12px; font-weight:600; background:#FAEEDA; color:#854F0B; border-color:#FAC775;" onclick="openEditKeyModal(${idx})"><i class="ti ti-key"></i> Edit Key</button>
                        <button class="btn" style="justify-content:center; padding:12px; font-weight:600; background:#EEEDFE; color:#3C3489; border-color:#CECBF6;" onclick="openAnalytics(${idx})"><i class="ti ti-chart-pie"></i> Analytics</button>
                    </div>

                    <h3 style="font-size:16px; color:#0f172a; margin-bottom:1.25rem; display:flex; align-items:center; gap:8px;"><i class="ti ti-share" style="color:#10B981;"></i> 1-Click Share & Invite</h3>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                        <button class="btn" style="justify-content:center; padding:12px; font-weight:600; background:#dcf8c6; color:#075e54; border:1px solid #25d366;" onclick="window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent('${shareText}'), '_blank')">
                            <i class="ti ti-brand-whatsapp" style="font-size:20px;"></i> WhatsApp
                        </button>
                        <button class="btn" style="justify-content:center; padding:12px; font-weight:600; background:#e0f2fe; color:#0284c7; border:1px solid #38bdf8;" onclick="window.open('https://t.me/share/url?url=&text=' + encodeURIComponent('${shareText}'), '_blank')">
                            <i class="ti ti-brand-telegram" style="font-size:20px;"></i> Telegram
                        </button>
                    </div>
                </div>

                <div class="card" style="border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.03);">
                    <h3 style="font-size:16px; color:#0f172a; margin-bottom:1.25rem; display:flex; align-items:center; gap:8px;"><i class="ti ti-settings" style="color:#64748b;"></i> Access Controls</h3>
                    <button id="btn-toggle-status" class="btn" style="width:100%; justify-content:center; padding:14px; font-size:15px; margin-bottom:12px; background:${statusBg}; color:${statusColor}; border:1px solid ${statusColor}; font-weight:700;" onclick="toggleTestStatus(${idx})">
                        <i class="ti ${statusIcon}"></i> ${statusText}
                    </button>
                    ${!t.released && t.resultVis==='manual' ? `<button class="btn btn-success" style="width:100%; justify-content:center; padding:12px; font-weight:600; margin-bottom:12px;" onclick="releaseRes(${idx})"><i class="ti ti-send"></i> Publish Results Manually</button>` : ''}
                    
                    <div style="margin-top:2.5rem; padding-top:1.5rem; border-top:1px dashed #F7C1C1;">
                        <h3 style="font-size:16px; color:#A32D2D; margin-bottom:8px; display:flex; align-items:center; gap:8px;"><i class="ti ti-alert-triangle"></i> Danger Zone</h3>
                        <p style="font-size:13px; color:#64748b; margin-bottom:15px; line-height:1.5;">Deleting a test is irreversible. All associated student submissions and analytics will be permanently erased.</p>
                        <button class="btn btn-danger" style="width:100%; justify-content:center; padding:12px; font-weight:600;" onclick="if(confirm('Are you absolutely sure?')){ executeDeleteTest(${idx}); closeTestDashboard(); }"><i class="ti ti-trash"></i> Delete Entire Test</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="tab-content-subs" style="display:none; animation: fadeIn 0.3s ease;">
            <div class="card" style="border-radius:12px; padding:2rem; box-shadow:0 4px 15px rgba(0,0,0,0.03);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:15px;">
                    <h3 style="margin:0; font-size:18px; color:#0f172a; font-weight:700;">Submissions Ledger</h3>
                    <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                        <button class="btn btn-success" style="padding:10px 16px; font-weight:600; border-radius:8px;" onclick="exportToCSV(${t.id})">
                            <i class="ti ti-file-spreadsheet"></i> Export CSV
                        </button>
                        <div style="position:relative; width:280px; max-width:100%;">
                            <i class="ti ti-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94a3b8; font-size:18px;"></i>
                            <input type="text" id="sub-search-input" placeholder="Search by Student Name or Roll No..." style="padding:10px 10px 10px 40px; width:100%; border-radius:8px; border:1px solid #cbd5e1; background:#f8fafc;" onkeyup="filterSubmissionsList()">
                        </div>
                    </div>
                </div>
                <div id="subs-dynamic-list" style="max-height: 500px; overflow-y: auto; padding-right:5px;"></div>
            </div>
        </div>
    `;

    document.getElementById('tests-master-view').style.display = 'none';
    var detailView = document.getElementById('test-detail-view');
    detailView.innerHTML = detailHtml;
    detailView.style.display = 'block';
    
    buildSmartSubmissionsList(t, idx);
};

window.closeTestDashboard = function() {
    document.getElementById('test-detail-view').style.display = 'none';
    document.getElementById('test-detail-view').innerHTML = '';
    document.getElementById('tests-master-view').style.display = 'flex';
    
    // 🔥 FIX 2: Restore surrounding titles when returning to master list
    var container = document.getElementById('test-list-area');
    if(container && container.parentNode) {
        Array.from(container.parentNode.children).forEach(child => {
            if(child.id !== 'test-list-area') {
                child.style.display = child.getAttribute('data-old-display') || '';
            }
        });
    }
    
    renderTestList(); 
}

window.switchTestTab = function(tab) {
    document.getElementById('tab-btn-overview').style.background = 'transparent';
    document.getElementById('tab-btn-overview').style.color = '#64748b';
    document.getElementById('tab-btn-subs').style.background = 'transparent';
    document.getElementById('tab-btn-subs').style.color = '#64748b';
    
    document.getElementById('tab-content-overview').style.display = 'none';
    document.getElementById('tab-content-subs').style.display = 'none';
    
    document.getElementById('tab-btn-' + tab).style.background = '#E6F1FB';
    document.getElementById('tab-btn-' + tab).style.color = '#185FA5';
    document.getElementById('tab-content-' + tab).style.display = 'block';
}

// 👥 Submissions List Builder (Untouched Logic Trigger)
// 👥 Submissions List Builder (Array Corrected & Direct Evaluate Added)
window.buildSmartSubmissionsList = function(t, tIdx) {
    var container = document.getElementById('subs-dynamic-list');
    
    // Check array length properly
    if(!t.submissions || t.submissions.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:3rem 1rem;">
                <i class="ti ti-ghost" style="font-size:48px; color:#cbd5e1; margin-bottom:1rem; display:block;"></i>
                <h4 style="color:#475569; margin-bottom:5px;">No Submissions Yet</h4>
                <p style="color:#94a3b8; font-size:14px;">Students' copies will appear here once they start submitting.</p>
            </div>`;
        return;
    }
    
    let html = `<div style="display:flex; flex-direction:column; gap:10px;">`;
    
    // Array loop (sIdx ab accurately pass hoga)
    t.submissions.forEach((s, sIdx) => {
        let scoreText = (s.evaluated || t.resultVis === 'instant') 
            ? `<div style="text-align:right;"><div style="font-size:18px; font-weight:800; color:#185FA5;">${s.score} <span style="font-size:12px; font-weight:600; color:#94a3b8;">/ ${t.totalMarks}</span></div><div style="font-size:11px; color:#10B981; font-weight:600;">Evaluated</div></div>` 
            : `<div style="text-align:right;"><div style="font-size:15px; font-weight:700; color:#f59e0b; margin-bottom:2px;"><i class="ti ti-clock"></i> Pending</div><div style="font-size:11px; color:#94a3b8;">Needs Check</div></div>`;
        
        html += `
        <div class="sub-item" style="padding:15px; border-radius:10px; border:1px solid #e2e8f0; background:#fff; display:flex; justify-content:space-between; align-items:center; transition:0.2s;" data-name="${(s.name||'').toLowerCase()}" data-roll="${(s.roll||'').toLowerCase()}">
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="width:40px; height:40px; border-radius:50%; background:#f1f5f9; color:#475569; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:16px;">
                    ${(s.name||'A').charAt(0).toUpperCase()}
                </div>
                <div>
                    <div style="font-weight:700; color:#0f172a; font-size:15px; margin-bottom:2px;">${s.name}</div>
                    <div style="font-size:13px; color:#64748b; font-family:monospace;">Roll: ${s.roll || 'N/A'}</div>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:20px;">
                ${scoreText}
                <button class="btn btn-primary" style="padding:10px 16px; font-weight:600; border-radius:8px;" onclick="showResultPageAsExaminer(${tIdx}, ${sIdx})"><i class="ti ti-eye"></i> Evaluate</button>
            </div>
        </div>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
}

window.filterSubmissionsList = function() {
    var val = document.getElementById('sub-search-input').value.toLowerCase();
    var items = document.querySelectorAll('.sub-item');
    items.forEach(item => {
        if(item.getAttribute('data-name').includes(val) || item.getAttribute('data-roll').includes(val)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function openAnalytics(testIdx) {
    var t = tests[testIdx];
    if (!t.submissions || t.submissions.length === 0) { showToast('Not enough data! At least 1 student must submit the test to generate analytics.', 'error'); return; }

    var totalStudents = t.submissions.length;
    var totalMarks = t.totalMarks || 0;
    
    var scores = t.submissions.map(s => s.score);
    var maxScore = Math.max(...scores);
    var minScore = Math.min(...scores);
    var avgScore = (scores.reduce((a, b) => a + b, 0) / totalStudents).toFixed(2);
    
    var passCount = t.submissions.filter(s => (s.score / totalMarks) >= 0.33).length;
    var passPercentage = Math.round((passCount / totalStudents) * 100);

    var qStats = t.questions.map((q, i) => ({ qIndex: i, text: q.text, wrongCount: 0, correctCount: 0 }));
    t.submissions.forEach(sub => { sub.details.forEach((d, i) => { if (d.status === 'wrong') qStats[i].wrongCount++; else if (d.status === 'correct') qStats[i].correctCount++; }); });

    var toughestQs = [...qStats].sort((a, b) => b.wrongCount - a.wrongCount).slice(0, 3);
    var easiestQs = [...qStats].sort((a, b) => b.correctCount - a.correctCount).slice(0, 3);

    var html = `
    <div style="padding:1.5rem; text-align:left;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:1.5rem;">
            <h3 style="color:#185FA5; margin:0; display:flex; align-items:center; gap:8px;"><i class="ti ti-chart-bar" style="font-size:24px;"></i> Class Analytics</h3>
            <button class="btn btn-sm" onclick="hideModal()">Close</button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:1rem; margin-bottom:2rem;">
            <div class="stat-card" style="border-color:#185FA5; padding:1rem;"><div class="stat-val" style="color:#185FA5; font-size:24px;">${avgScore} <span style="font-size:14px;color:gray">/ ${totalMarks}</span></div><div class="stat-lbl">Average Score</div></div>
            <div class="stat-card" style="border-color:#3B6D11; padding:1rem;"><div class="stat-val" style="color:#3B6D11; font-size:24px;">${maxScore}</div><div class="stat-lbl">Highest Score</div></div>
            <div class="stat-card" style="border-color:#A32D2D; padding:1rem;"><div class="stat-val" style="color:#A32D2D; font-size:24px;">${minScore}</div><div class="stat-lbl">Lowest Score</div></div>
            <div class="stat-card" style="border-color:#854F0B; padding:1rem;"><div class="stat-val" style="color:#854F0B; font-size:24px;">${passPercentage}%</div><div class="stat-lbl">Class Pass Rate</div></div>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.5rem; margin-bottom:1.5rem;">
            
            <div style="background:var(--color-background-primary); border:1px solid var(--color-border-secondary); border-radius:12px; padding:1.5rem; display:flex; flex-direction:column;">
                <h4 style="margin-top:0; margin-bottom:15px; color:var(--color-text-primary);"><i class="ti ti-trending-up"></i> Score Distribution (Bell Curve)</h4>
                <div style="position:relative; width:100%; height:250px; min-height:250px; max-height:250px;">
                    <canvas id="scoreChart" style="max-height:250px;"></canvas>
                </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:1rem;">
                <div style="background:#FCEBEB; border:1px solid #F7C1C1; border-radius:12px; padding:1rem;">
                    <h4 style="margin-top:0; color:#A32D2D; font-size:14px; margin-bottom:8px;"><i class="ti ti-alert-triangle"></i> The Weakest Links (Max Mistakes)</h4>
                    <ul style="margin:0; padding-left:20px; font-size:13px; color:#791F1F;">
                        ${toughestQs.map(q => `<li style="margin-bottom:6px;"><strong>Q${q.qIndex + 1}:</strong> ${q.text.substring(0, 45)}... <br><span class="badge b-red" style="font-size:10px; margin-top:4px;">Failed by ${q.wrongCount} students</span></li>`).join('')}
                    </ul>
                </div>
                
                <div style="background:#EAF3DE; border:1px solid #C0DD97; border-radius:12px; padding:1rem;">
                    <h4 style="margin-top:0; color:#27500A; font-size:14px; margin-bottom:8px;"><i class="ti ti-award"></i> Strong Zones (Most Correct)</h4>
                    <ul style="margin:0; padding-left:20px; font-size:13px; color:#27500A;">
                        ${easiestQs.map(q => `<li style="margin-bottom:6px;"><strong>Q${q.qIndex + 1}:</strong> ${q.text.substring(0, 45)}... <br><span class="badge b-green" style="font-size:10px; margin-top:4px;">Solved by ${q.correctCount} students</span></li>`).join('')}
                    </ul>
                </div>
            </div>
            
        </div>
    </div>`;
    
    document.getElementById('modal-box').style.maxWidth = '900px'; 
    showModal(html);

    setTimeout(() => {
        let brackets = [0, 0, 0, 0]; 
        scores.forEach(s => {
            let pct = (s / totalMarks) * 100;
            if (pct <= 25) brackets[0]++;
            else if (pct <= 50) brackets[1]++;
            else if (pct <= 75) brackets[2]++;
            else brackets[3]++;
        });

        const ctx = document.getElementById('scoreChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['0-25% (Poor)', '26-50% (Avg)', '51-75% (Good)', '76-100% (Excellent)'],
                datasets: [{ label: 'Number of Students', data: brackets, backgroundColor: ['#FCEBEB', '#FAEEDA', '#E6F1FB', '#EAF3DE'], borderColor: ['#A32D2D', '#854F0B', '#185FA5', '#3B6D11'], borderWidth: 2, borderRadius: 6 }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }
        });
    }, 150);
}

// --- EXAMINER ACTIONS (UPGRADED WITH UI REFRESH & CUSTOM MODALS) ---

function autoJoinLocalTest(code) { 
    nav('student'); 
    document.getElementById('s-code').value = code; 
    setTimeout(() => { joinTest(); }, 500); 
}

function toggleTestStatus(idx) { 
    if (tests[idx].isActive === undefined) tests[idx].isActive = true; 
    
    tests[idx].isActive = !tests[idx].isActive; 
    tests[idx].status = tests[idx].isActive ? 'open' : 'closed';
    
    // UI update turant karo, bina delay ke
    if(typeof updateToggleUI === 'function') updateToggleUI(idx);
    
    // Background me database save hoga (Page redirect nahi marega)
    updateDatabase(); 
    
    var msg = tests[idx].isActive ? 'Test is now OPEN for new submissions.' : 'Test intake CLOSED. No new students can enter.'; 
    showToast(msg, tests[idx].isActive ? 'success' : 'error'); 
}

// NAYA FIX: Premium Delete Popup with Safety Warning
function delTest(i) { 
    showModal(`
        <div style="text-align:center; padding:1.5rem;">
            <i class="ti ti-alert-triangle" style="font-size:56px; color:#A32D2D; display:block; margin-bottom:1rem;"></i>
            <h3 style="font-size:22px; font-weight:600; margin-bottom:0.5rem; color:#0f172a;">Delete Test Permanently?</h3>
            <p style="color:var(--color-text-secondary); margin-bottom:1.5rem; font-size:15px;">Are you sure you want to delete this test? All student submissions and analytics will be wiped out. This cannot be undone.</p>
            <div style="display:flex; gap:12px; justify-content:center;">
                <button class="btn" style="flex:1; padding:10px; font-weight:600;" onclick="hideModal()">Cancel</button>
                <button class="btn btn-danger" style="flex:1; padding:10px; font-weight:600;" onclick="executeDeleteTest(${i})"><i class="ti ti-trash"></i> Yes, Delete</button>
            </div>
        </div>
    `);
}

// NAYA FIX: Asli Delete function jo modal confirm hone ke baad chalega
window.executeDeleteTest = function(i) {
    hideModal();
    tests.splice(i, 1); 
    updateDatabase(); 
    renderTestList(); // NAYA FIX: Delete hote hi screen se test gayab ho jayega
    showToast('Test deleted successfully.', 'success');
};

function releaseRes(i){ 
    tests[i].released = true; 
    updateDatabase(); 
    renderTestList(); // NAYA FIX: Button ka rang badalne ke liye
    showModal('<div style="text-align:center;padding:2rem"><i class="ti ti-send" style="font-size:42px;color:#3B6D11;display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:20px;margin-bottom:1rem">Results Published Successfully!</div><p style="color:var(--color-text-secondary);margin-bottom:1.5rem">Students can now view their checked papers.</p><button class="btn btn-primary" onclick="hideModal()">Done</button></div>'); 
}

function viewSubmissions(testIdx) {
  var t = tests[testIdx];
  if(!t.submissions || t.submissions.length === 0) { showModal('<div style="text-align:center;padding:2rem"><i class="ti ti-users" style="font-size:42px;color:var(--color-text-secondary);display:block;margin-bottom:1rem"></i><div style="font-weight:600;font-size:18px">No Submissions Yet.</div></div>'); return; }
  
  var html = `<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem">
        <div><h3 style="font-size:18px;font-weight:600">${t.title}</h3><p style="font-size:13px;color:var(--color-text-secondary)">Student Submissions</p></div>
        <button class="btn btn-success btn-sm" onclick="exportToCSV(${t.id})"><i class="ti ti-file-spreadsheet"></i> Export CSV</button>
    </div>`;
  
  html += `<div style="max-height:60vh;overflow-y:auto;padding-right:8px">` + t.submissions.map((s, sIdx) => `
      <div style="display:flex;justify-content:space-between;padding:12px;border:1px solid var(--color-border-secondary);border-radius:var(--border-radius-md);margin-bottom:8px;align-items:center;background:var(--color-background-tertiary)">
          <div><div style="font-weight:600">${s.name}</div><div style="font-size:12px;color:var(--color-text-secondary)">Roll: ${s.roll||'N/A'} &bull; Score: ${s.score}</div></div>
          <button class="btn btn-sm btn-primary" onclick="hideModal(); showResultPageAsExaminer(${testIdx}, ${sIdx})"><i class="ti ti-eye"></i> Evaluate</button>
      </div>`).join('') + `</div><div style="margin-top:1.5rem;text-align:right"><button class="btn" onclick="hideModal()">Close</button></div>`;
  showModal(html);
}

function showResultPageAsExaminer(testIdx, sIdx) {
    var sub = tests[testIdx].submissions[sIdx];
    var t = tests[testIdx];

    nav('student');

    let checkExist = setInterval(async function() {
        var homeEl = document.getElementById('student-home');
        var testEl = document.getElementById('student-test');
        var resultEl = document.getElementById('student-result');

        if (homeEl && resultEl) {
            clearInterval(checkExist); 

            homeEl.style.display = 'none';
            if(testEl) testEl.style.display = 'none';

            resultEl.style.display = 'block';
            resultEl.classList.remove('hidden');
            resultEl.innerHTML = `<div class="spinner-container"><div class="spinner"></div><div style="margin-top:10px; color:var(--color-text-primary);">Loading Checked Paper...</div></div>`;

            try {
                if (typeof _generateResultDOM !== 'function') {
                    await loadScript('scripts/student-dash.js');
                }

                setTimeout(() => {
                    _generateResultDOM(sub, t, true, testIdx, sIdx);
                    
                    document.getElementById('student-home').style.display = 'none';
                    var mainHeader = document.querySelector('.app-header');
                    if(mainHeader) mainHeader.style.display = '';

                    // 🔥 THE FIX: Position top: 110px kar diya hai (tum isko 120px ya 130px bhi kar sakte ho zaroorat padne par)
                    var simpleBackBtn = `
                        <button id="floating-eval-back-btn" onclick="returnToSubmissions(${testIdx})" style="position: fixed; top: 130px; left: 24px; z-index: 9999; background: #ffffff; border: 1px solid #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px; padding: 10px 16px; font-weight: 600; color: #475569; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s;">
                            <i class="ti ti-arrow-left"></i> Back
                        </button>
                    `;
                    resultEl.insertAdjacentHTML('afterbegin', simpleBackBtn);

                }, 100);

            } catch(err) {
                resultEl.innerHTML = `<div style="color:#A32D2D; padding:2rem; text-align:center;"><i class="ti ti-alert-triangle" style="font-size:48px;"></i><br><br>Error loading result engine.<br><small>${err.message}</small></div>`;
            }
        }
    }, 50);
}

function openEditKeyModal(idx) {
    var t = tests[idx];
    var html = `<div style="padding:1.5rem; text-align:left;">
        <h3 style="margin-bottom: 1rem; color: #185FA5; display:flex; align-items:center; gap:8px;"><i class="ti ti-key"></i> Smart Key Update</h3>
        <p style="font-size:13px; color:var(--color-text-secondary); margin-bottom:1.5rem; line-height:1.6;">Fix any wrong answers in your key below. When you save, all <strong>${t.submissions ? t.submissions.length : 0}</strong> existing student submissions will be automatically re-graded instantly.</p>
        <div style="max-height: 50vh; overflow-y: auto; padding-right:10px; margin-bottom:1.5rem;">`;

    t.questions.forEach((q, i) => {
        html += `<div style="margin-bottom:1.25rem; padding:12px; border:1px solid var(--color-border-secondary); border-radius:8px; background:var(--color-background-secondary);">
            <div style="font-weight:600; font-size:14px; margin-bottom:8px; color:#0f172a;">Q${i+1}: ${q.text.substring(0, 70)}...</div>`;
        if (q.type === 'mcq') {
            html += `<div style="display:flex; gap:12px; flex-wrap:wrap;">`;
            q.options.forEach((opt, j) => { let isChecked = q.correct.includes(j) ? 'checked' : ''; html += `<label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;"><input type="radio" name="rekey_${i}" value="${j}" ${isChecked} class="rekey-input-${i}" style="width:16px;height:16px;"> Opt ${String.fromCharCode(65+j)}</label>`; }); html += `</div>`;
        } else if (q.type === 'msq') {
            html += `<div style="display:flex; gap:12px; flex-wrap:wrap;">`;
            q.options.forEach((opt, j) => { let isChecked = q.correct.includes(j) ? 'checked' : ''; html += `<label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;"><input type="checkbox" value="${j}" ${isChecked} class="rekey-input-${i}" style="width:16px;height:16px;"> Opt ${String.fromCharCode(65+j)}</label>`; }); html += `</div>`;
        } else if (q.type === 'integer') { html += `<label style="font-size:13px; font-weight:500;">Correct Integer Key: <input type="number" value="${q.correctInt}" class="rekey-input-${i}" style="width:100px; padding:6px; font-size:14px; border:1px solid #cbd5e1; border-radius:4px; margin-left:8px;"></label>`; } else if (q.type === 'subjective') { html += `<div style="font-size:12px; color:#854F0B; font-weight:500;"><i class="ti ti-info-circle"></i> Subjective question (Requires manual evaluation).</div>`; }
        html += `</div>`;
    });

    html += `</div><div style="display:flex; gap:10px;"><button class="btn" style="flex:1; padding:12px; font-weight:600;" onclick="hideModal()">Cancel</button><button class="btn btn-primary" style="flex:2; background:#854F0B; border-color:#854F0B; padding:12px; font-weight:600;" onclick="saveNewKeyAndReevaluate(${idx})"><i class="ti ti-refresh"></i> Update & Auto-Grade All</button></div></div>`;
    showModal(html);
}

function saveNewKeyAndReevaluate(idx) {
    var t = tests[idx];
    t.questions.forEach((q, i) => {
        if (q.type === 'mcq') { let selected = document.querySelector(`.rekey-input-${i}:checked`); if(selected) q.correct = [parseInt(selected.value)]; } else if (q.type === 'msq') { let selected = document.querySelectorAll(`.rekey-input-${i}:checked`); q.correct = Array.from(selected).map(cb => parseInt(cb.value)); } else if (q.type === 'integer') { let input = document.querySelector(`.rekey-input-${i}`); if(input && input.value !== '') q.correctInt = parseFloat(input.value); }
    });

    if (t.submissions && t.submissions.length > 0) {
        var neg = t.negMarking || 0;
        t.submissions.forEach(sub => {
            let newScore = 0, newCorrect = 0, newWrong = 0, newSkipped = 0;
            sub.details.forEach((d, i) => {
                let q = t.questions[i]; d.q = q; let ans = d.ans;
                let hasVal = ans.val !== null && (!Array.isArray(ans.val) || ans.val.length > 0);
                if (!hasVal) { if(d.status === 'evaluated') { newScore += (d.earned || 0); newSkipped++; } else { d.status = 'skipped'; d.earned = 0; newSkipped++; } } else if (q.type === 'mcq') { if (ans.val === q.correct[0]) { newCorrect++; d.earned = q.marks; newScore += q.marks; d.status = 'correct'; } else { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; } } else if (q.type === 'msq') { var userSel = Array.isArray(ans.val) ? ans.val : []; var corrSel = q.correct; var hasWrongOption = userSel.some(x => !corrSel.includes(x)); var correctlySelected = userSel.filter(x => corrSel.includes(x)).length; if (hasWrongOption) { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; } else if (correctlySelected === corrSel.length) { newCorrect++; d.earned = q.marks; newScore += q.marks; d.status = 'correct'; } else if (correctlySelected > 0) { var partialMarks = (q.marks / corrSel.length) * correctlySelected; let earned = Math.round(partialMarks * 100) / 100; newScore += earned; newCorrect++; d.status = 'partial'; } else { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; } } else if (q.type === 'integer') { if (ans.val === q.correctInt) { newCorrect++; d.earned = q.marks; newScore += q.marks; d.status = 'correct'; } else { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; } } else { if(d.status === 'evaluated') { newScore += (d.earned || 0); if(d.earned > 0) newCorrect++; else newSkipped++; } else { d.status = 'submitted'; d.earned = 0; newSkipped++; } }
            });
            sub.score = Number(newScore.toFixed(2)); sub.correct = newCorrect; sub.wrong = newWrong; sub.skipped = newSkipped;
        });
    }

    updateDatabase(); hideModal(); showToast(`Answer Key Updated! Successfully re-graded ${t.submissions ? t.submissions.length : 0} student(s).`, 'success'); renderTestList();
}

function saveEvaluation(tIdx, sIdx) {
    var sub = tests[tIdx].submissions[sIdx];
    var test = tests[tIdx];
    var overrides = []; 
    var hasError = false;
    var inputs = document.querySelectorAll('.eval-input');
    
    for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i]; var qIdx = parseInt(inp.id.replace('mark_input_', '')); var awardedMarks = parseFloat(inp.value) || 0; var maxMarks = Number(sub.details[qIdx].q.marks); 
        if (awardedMarks > maxMarks) { showToast(`Error: Marks for Q${qIdx + 1} cannot exceed ${maxMarks}!`, 'error'); inp.style.borderColor = '#A32D2D'; inp.style.background = '#FCEBEB'; hasError = true; break; } 
        else { inp.style.borderColor = '#185FA5'; inp.style.background = '#fff'; if(sub.details[qIdx].q.type === 'subjective' || sub.details[qIdx].earned !== awardedMarks) { overrides.push({ qIdx: qIdx, awarded: awardedMarks }); } }
    }

    if (hasError) return; 
    if (overrides.length === 0) { showToast('No changes made to marks.', 'normal'); return; }
    window.tempEvalData = { tIdx, sIdx, overrides }; 
    showModal(`<div style="padding:1.5rem; text-align:left;"><div style="display:flex; align-items:center; gap:10px; margin-bottom:1rem; color:#854F0B;"><i class="ti ti-shield-check" style="font-size:28px;"></i><h3 style="margin:0; font-size:20px;">Evaluation Audit required</h3></div><p style="font-size:14px; color:var(--color-text-secondary); margin-bottom:1rem; line-height:1.5;">You are modifying the marks for <strong>${overrides.length} question(s)</strong>. To ensure transparency, please provide a justification. This will be recorded securely.</p><label style="font-size:13px; font-weight:600; margin-bottom:5px; display:block;">Reason for changing marks: <span style="color:#A32D2D">*</span></label><textarea id="audit-reason" class="input-block" placeholder="e.g., 'Partial marks for correct formula'" style="min-height:80px; margin-bottom:1.5rem; font-size:14px;"></textarea><div style="display:flex; gap:12px;"><button class="btn" style="flex:1" onclick="hideModal()">Cancel</button><button class="btn btn-primary" style="flex:1" onclick="confirmAndSaveEval()"><i class="ti ti-lock"></i> Confirm & Save</button></div></div>`);
}

function confirmAndSaveEval() {
    var reason = document.getElementById('audit-reason').value.trim();
    if (!reason) { showToast("You must provide a reason for the audit log!", "error"); return; }
    var { tIdx, sIdx, overrides } = window.tempEvalData; var sub = tests[tIdx].submissions[sIdx]; var test = tests[tIdx];

    overrides.forEach(ov => { sub.details[ov.qIdx].earned = ov.awarded; sub.details[ov.qIdx].status = 'evaluated'; if(!sub.details[ov.qIdx].auditLogs) sub.details[ov.qIdx].auditLogs = []; sub.details[ov.qIdx].auditLogs.push({ date: new Date().toLocaleString('en-IN'), examiner: currentUser ? (currentUser.displayName || currentUser.email || 'Examiner') : 'Examiner', reason: reason, awarded: ov.awarded }); });

    var newTotal = 0, newCorrect = 0, newWrong = 0, newSkipped = 0;
    sub.details.forEach(d => { newTotal += (d.earned || 0); if (d.status === 'skipped') newSkipped++; else if (d.earned > 0) newCorrect++; else if (d.earned < 0) newWrong++; else { if (d.q.type === 'subjective') newSkipped++; else newWrong++; } });

    sub.score = Number(newTotal.toFixed(2)); sub.correct = newCorrect; sub.wrong = newWrong; sub.skipped = newSkipped;
    updateDatabase(); hideModal(); 
    
    _generateResultDOM(sub, test, true, tIdx, sIdx); 
    
    setTimeout(() => {
        var resultEl = document.getElementById('student-result');
        if(resultEl) {
            // 🔥 THE FIX: Yahan bhi top: 110px aur left: 24px lagaya hai
            var simpleBackBtn = `
                <button id="floating-eval-back-btn" onclick="returnToSubmissions(${tIdx})" style="position: fixed; top: 130px; left: 24px; z-index: 9999; background: #ffffff; border: 1px solid #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px; padding: 10px 16px; font-weight: 600; color: #475569; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s;">
                    <i class="ti ti-arrow-left"></i> Back
                </button>
            `;
            resultEl.insertAdjacentHTML('afterbegin', simpleBackBtn);
        }
    }, 50);

    showToast('Marks Saved! Audit log securely recorded.', 'success'); window.tempEvalData = null; 
}

function renderAllResults(){
  var c = document.getElementById('results-area');
  if(!isOfflineMode && !currentUser) { c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-lock" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">Please Login using Google to view results.</div></div>`; return; }
  var myTests = isOfflineMode ? tests : tests.filter(t => t.creatorUid === currentUser.uid);
  var all = myTests.flatMap(t => t.submissions ? t.submissions.map(s => ({...s, testTitle: t.title, testCode: t.code})) : []);
  if(!all.length){ c.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--color-text-secondary)"><i class="ti ti-chart-off" style="font-size:48px;display:block;margin-bottom:1rem;opacity:0.5"></i><div style="font-size:16px;font-weight:500">No results available yet. Complete a test to see data here.</div></div>`; return; }
  
  c.innerHTML = all.map(s => `<div class="test-entry"><div class="te-meta"><div style="font-weight:600;font-size:16px">${s.name} ${s.roll?'<span style="font-weight:400;color:var(--color-text-secondary)">· '+s.roll+'</span>':''}</div><div style="font-size:13px;color:var(--color-text-secondary)">${s.testTitle} &bull; ${s.time}</div></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="badge b-blue" style="font-size:13px">Score: ${s.score}</span><span class="badge b-green">${s.correct} Correct</span><span class="badge b-red">${s.wrong} Wrong</span><span class="badge b-gray">${s.skipped} Skipped</span></div></div>`).join('');
}

window.printTestPaper = function(idx) {
    var t = tests[idx];
    
    // Create a clean HTML layout for printing
    var printHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #000;">
            <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px;">
                <h1 style="margin:0 0 10px 0; font-size:24px; text-transform:uppercase;">${t.title}</h1>
                <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold;">
                    <span>Subject: ${t.subject || 'General'}</span>
                    <span>Time: ${t.duration} Mins</span>
                    <span>Max Marks: ${t.totalMarks}</span>
                </div>
            </div>
            
            <div style="margin-bottom: 25px; display:flex; justify-content:space-between; font-size:15px;">
                <div><strong>Student Name:</strong> ______________________________</div>
                <div><strong>Roll No:</strong> ______________________</div>
            </div>
    `;

    t.questions.forEach((q, i) => {
        printHtml += `<div style="margin-bottom: 25px; page-break-inside: avoid;">`;
        printHtml += `<div style="font-weight:bold; margin-bottom:8px; font-size:15px;">Q${i+1}. ${q.text} <span style="float:right; font-weight:normal; font-size:13px;">[${q.marks} Marks]</span></div>`;
        
        if (q.imgUrl) {
            printHtml += `<img src="${q.imgUrl}" style="max-height:200px; display:block; margin:10px 0; border:1px solid #ccc;">`;
        }
        
        if (q.type === 'mcq' || q.type === 'msq') {
            q.options.forEach((opt, j) => {
                printHtml += `<div style="margin-bottom: 6px; margin-left: 25px; font-size:14px;">${String.fromCharCode(65+j)}) ${opt}</div>`;
            });
        } else if (q.type === 'integer') {
             printHtml += `<div style="margin-left:25px; margin-top:10px; font-size:14px;">Answer: ______________________</div>`;
        } else {
             printHtml += `<div style="margin-top:10px; height: 120px; border: 1px dotted #999; margin-left:25px;"></div>`;
        }
        printHtml += `</div>`;
    });

    printHtml += `
            <div style="text-align:center; margin-top:40px; font-size:12px; color:#666;">
                Generated by ExamiTop Platform &bull; Secure Proctoring Engine
            </div>
        </div>
    `;
    
    // Nayi hidden window me kholkar usko seedha print karne ka command do
    var printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Print: ' + t.title + '</title></head>');
    printWindow.document.write('<body onload="window.print(); setTimeout(function(){window.close();}, 500);">');
    printWindow.document.write(printHtml);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
};

// 🔥 NAYA: Direct DOM Updater jisse Blink nahi hoga
window.updateToggleUI = function(idx) {
    var t = tests[idx];
    var isLive = t.isActive !== false;
    
    var btn = document.getElementById('btn-toggle-status');
    if(btn) {
        btn.innerHTML = `<i class="ti ${isLive ? 'ti-lock' : 'ti-door-enter'}"></i> ${isLive ? 'Close Exam Intake' : 'Open Exam Intake'}`;
        btn.style.background = isLive ? '#FCEBEB' : '#EAF3DE';
        btn.style.color = isLive ? '#A32D2D' : '#3B6D11';
        btn.style.borderColor = isLive ? '#A32D2D' : '#3B6D11';
    }

    var badge = document.getElementById('header-status-badge');
    if(badge) {
        badge.innerHTML = isLive 
            ? '<span style="width:10px; height:10px; background:#10B981; border-radius:50%; box-shadow:0 0 8px #10B981; animation:pulse 1s infinite;"></span> Live Accepting' 
            : '<span style="width:10px; height:10px; background:#94a3b8; border-radius:50%;"></span> Intake Locked';
        badge.style.background = isLive ? '#d1fae5' : '#f1f5f9';
        badge.style.color = isLive ? '#065f46' : '#475569';
        badge.style.borderColor = isLive ? '#34d399' : '#cbd5e1';
    }
}

// 🔥 NAYA: Magic Return Function (With Memory Flag)
window.returnToSubmissions = function(testIdx) {
    // 🔥 NAYA FIX: Full Screen Loading Effect (Peeche ka kachra chupane ke liye)
    var loader = document.createElement('div');
    loader.id = 'transition-loader';
    loader.innerHTML = `
        <div class="spinner-container" style="transform: scale(1.2);">
            <div class="spinner"></div>
            <div style="margin-top:15px; font-weight:700; color:#185FA5; font-size:16px;">Opening Submissions...</div>
        </div>
    `;
    loader.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#f8fafc; z-index:999999; display:flex; align-items:center; justify-content:center; transition: opacity 0.3s ease;';
    document.body.appendChild(loader);

    // Clean up the floating button memory
    var floatBtn = document.getElementById('floating-eval-back-btn');
    if(floatBtn) floatBtn.remove();

    var resultEl = document.getElementById('student-result');
    if(resultEl) {
        resultEl.innerHTML = '';
        resultEl.style.display = 'none';
        resultEl.classList.add('hidden');
    }
    
    var homeEl = document.getElementById('student-home');
    if(homeEl) {
        homeEl.style.display = 'block'; 
    }
    
    // Set memory flag and change page (piche sab loading screen ke andar chup kar ho raha hai)
    window.pendingTestDashboard = testIdx;
    nav('tests');
};