/* ═══════════════════════════════════════════════════════════════
   CONSTRUCTPRO — app.js
   Construction Workforce Management
   ─────────────────────────────────────────────────────────────
   Stack: Vanilla JS + Firebase (Auth + Firestore) — FREE FOREVER
   Deploy: GitHub Pages — zero build step
   Features: Nepali Date (Bikram Sambat), Calendar View, Missing Record Reminders
═══════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────
   1. FIREBASE CONFIG
   Replace ALL values below with your own
   from: console.firebase.google.com
────────────────────────────────────────── */
 const firebaseConfig = {
    apiKey: "AIzaSyABWhhkR420rV5xg2ADwj3_ugV8sRk-g2k",
    authDomain: "constructpro-974ff.firebaseapp.com",
    projectId: "constructpro-974ff",
    storageBucket: "constructpro-974ff.firebasestorage.app",
    messagingSenderId: "814618715485",
    appId: "1:814618715485:web:f3e5faad466beee407f4b4",
    measurementId: "G-NXH6V7LE25"
  };

/* ──────────────────────────────────────────
   SITE SETTINGS  (change if needed)
────────────────────────────────────────── */
const CURRENCY = "Rs.";   // Change to ₹, $, £, etc.

/* ──────────────────────────────────────────
   2. FIREBASE INIT
────────────────────────────────────────── */
firebase.initializeApp(firebaseConfig);
const auth     = firebase.auth();
const db       = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

/* ──────────────────────────────────────────
   3. APP STATE
────────────────────────────────────────── */
let currentUser          = null;
let workers              = [];          // cached worker list
let currentPage          = "dashboard";
let workerDetailId       = null;
let currentAttDate       = gregorianToNepaliStr(new Date());  // store as Nepali string YYYY-MM-DD (BS)
let currentReportMonth   = gregorianToNepaliStr(new Date()).slice(0, 7); // Nepali YYYY-MM
let attendanceState      = {};          // { wid: {attendance,advance,expense,notes} }
let modalSubmitHandler   = null;
let workerDetailMonth    = gregorianToNepaliStr(new Date()).slice(0, 7); // Nepali YYYY-MM

/* ══════════════════════════════════════════
   4. NEPALI DATE UTILITIES (Internal BS Converter)
   Based on a simple offset from a known reference:
   2000-01-01 AD = 2056-09-17 BS
══════════════════════════════════════════ */

// BS month days (non-leap year approximation)
const BS_DAYS_IN_MONTH = [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30];
const BS_MONTH_NAMES = ["बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज", "कार्तिक", "मंसिर", "पौष", "माघ", "फागुन", "चैत"];
const BS_MONTH_NAMES_EN = ["Baisakh", "Jestha", "Ashad", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];

// Reference: 2000-01-01 (Gregorian) = 2056-09-17 (Bikram Sambat)
const REF_GREG = new Date(2000, 0, 1);
const REF_BS_YEAR = 2056;
const REF_BS_MONTH = 9;   // Poush (0-indexed = 8)
const REF_BS_DAY = 17;

// Convert Gregorian Date to BS string "YYYY-MM-DD"
function gregorianToNepaliStr(date) {
  const greg = new Date(date);
  greg.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((greg - REF_GREG) / (1000 * 60 * 60 * 24));
  
  let bsYear = REF_BS_YEAR;
  let bsMonth = REF_BS_MONTH - 1; // 0-indexed
  let bsDay = REF_BS_DAY;
  
  let remaining = diffDays;
  if (remaining >= 0) {
    while (remaining > 0) {
      const daysInCurrentMonth = BS_DAYS_IN_MONTH[bsMonth];
      if (bsDay + remaining <= daysInCurrentMonth) {
        bsDay += remaining;
        remaining = 0;
      } else {
        remaining -= (daysInCurrentMonth - bsDay + 1);
        bsDay = 1;
        bsMonth++;
        if (bsMonth >= 12) {
          bsMonth = 0;
          bsYear++;
        }
      }
    }
  } else {
    // past dates (negative diff)
    remaining = -remaining;
    while (remaining > 0) {
      if (bsDay - remaining >= 1) {
        bsDay -= remaining;
        remaining = 0;
      } else {
        remaining -= bsDay;
        bsMonth--;
        if (bsMonth < 0) {
          bsMonth = 11;
          bsYear--;
        }
        bsDay = BS_DAYS_IN_MONTH[bsMonth];
      }
    }
  }
  
  return `${bsYear}-${String(bsMonth + 1).padStart(2, '0')}-${String(bsDay).padStart(2, '0')}`;
}

// Convert BS string "YYYY-MM-DD" to Gregorian Date object
function nepaliToGregorian(nepaliStr) {
  const [y, m, d] = nepaliStr.split('-').map(Number);
  let bsYear = REF_BS_YEAR;
  let bsMonth = REF_BS_MONTH - 1;
  let bsDay = REF_BS_DAY;
  let totalDays = 0;
  
  // Calculate days from reference to target BS date
  if (y > REF_BS_YEAR || (y === REF_BS_YEAR && (m > REF_BS_MONTH || (m === REF_BS_MONTH && d > REF_BS_DAY)))) {
    // forward
    while (bsYear < y || (bsYear === y && bsMonth < m - 1) || (bsYear === y && bsMonth === m - 1 && bsDay < d)) {
      totalDays++;
      bsDay++;
      if (bsDay > BS_DAYS_IN_MONTH[bsMonth]) {
        bsDay = 1;
        bsMonth++;
        if (bsMonth >= 12) {
          bsMonth = 0;
          bsYear++;
        }
      }
    }
    const result = new Date(REF_GREG);
    result.setDate(REF_GREG.getDate() + totalDays);
    return result;
  } else {
    // backward
    while (bsYear > y || (bsYear === y && bsMonth > m - 1) || (bsYear === y && bsMonth === m - 1 && bsDay > d)) {
      totalDays--;
      bsDay--;
      if (bsDay < 1) {
        bsMonth--;
        if (bsMonth < 0) {
          bsMonth = 11;
          bsYear--;
        }
        bsDay = BS_DAYS_IN_MONTH[bsMonth];
      }
    }
    const result = new Date(REF_GREG);
    result.setDate(REF_GREG.getDate() + totalDays);
    return result;
  }
}

// Format Nepali date for display (e.g., २०८० बैशाख १५)
function fmtNepaliDate(str) {
  if (!str) return "—";
  const [y, m, d] = str.split('-').map(Number);
  const monthName = BS_MONTH_NAMES[m - 1];
  // Convert numbers to Devanagari (optional)
  const devanagariDigits = ['०','१','२','३','४','५','६','७','८','९'];
  const toDevanagari = num => String(num).split('').map(ch => devanagariDigits[ch] || ch).join('');
  return `${toDevanagari(y)} ${monthName} ${toDevanagari(d)}`;
}

// Format Nepali month label (YYYY MMMM)
function fmtNepaliMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const devanagariDigits = ['०','१','२','३','४','५','६','७','८','९'];
  const toDevanagari = num => String(num).split('').map(ch => devanagariDigits[ch] || ch).join('');
  return `${toDevanagari(y)} ${BS_MONTH_NAMES[m-1]}`;
}

// Shift Nepali month by delta
function shiftNepaliMonth(ym, delta) {
  let [y, m] = ym.split('-').map(Number);
  m += delta;
  while (m > 12) { m -= 12; y++; }
  while (m < 1)  { m += 12; y--; }
  return `${y}-${String(m).padStart(2,'0')}`;
}

// Get Nepali month range (start and end Gregorian dates for Firestore queries)
function nepaliMonthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const startNepStr = `${y}-${String(m).padStart(2,'0')}-01`;
  const endDay = BS_DAYS_IN_MONTH[m-1];
  const endNepStr = `${y}-${String(m).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;
  const startGreg = nepaliToGregorian(startNepStr).toISOString().slice(0,10);
  const endGreg = nepaliToGregorian(endNepStr).toISOString().slice(0,10);
  return { start: startGreg, end: endGreg, y, m };
}

// Get today's Nepali date string
function todayNepaliStr() {
  return gregorianToNepaliStr(new Date());
}

// Get weekday of BS date (0 = Sunday, 1 = Monday, ...) using Gregorian conversion
function getBSWeekday(nepaliStr) {
  const greg = nepaliToGregorian(nepaliStr);
  return greg.getDay(); // 0 Sunday
}

/* ══════════════════════════════════════════
   5. LEGACY GREGORIAN UTILS (still used for storage queries)
══════════════════════════════════════════ */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(str) {
  // Display Nepali date for UI
  return fmtNepaliDate(gregorianToNepaliStr(new Date(str + "T00:00:00")));
}

function fmtMoney(n) {
  const v = Number(n) || 0;
  return CURRENCY + " " + v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  "#5b7cfa","#34d399","#fbbf24","#f87171",
  "#a78bfa","#38bdf8","#fb923c","#2dd4bf","#e879f9"
];

function avatarColor(name) {
  let h = 0;
  for (const c of (name || "")) h = (h * 31 + c.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function showToast(msg, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function setLoading(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="loading"><div class="spinner"></div><div>Loading…</div></div>`;
}

/* ══════════════════════════════════════════
   6. AUTH
══════════════════════════════════════════ */
document.getElementById("btn-google-login").addEventListener("click", async () => {
  try {
    await auth.signInWithPopup(provider);
  } catch (e) {
    showToast("Login failed: " + e.message, "error");
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  if (await confirm2("Sign out of ConstructPro?")) {
    await auth.signOut();
    workers = [];
  }
});

auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    document.getElementById("auth-screen").style.display  = "none";
    document.getElementById("app").style.display          = "flex";
    document.getElementById("user-name").textContent      = user.displayName || user.email;

    const photo = document.getElementById("user-photo");
    if (user.photoURL) {
      photo.src   = user.photoURL;
      photo.style.display = "";
    } else {
      photo.style.display = "none";
    }

    loadInitialData();
  } else {
    document.getElementById("auth-screen").style.display  = "flex";
    document.getElementById("app").style.display          = "none";
  }
});

/* ══════════════════════════════════════════
   7. NAVIGATION
══════════════════════════════════════════ */
document.querySelectorAll(".nav-link").forEach(el => {
  el.addEventListener("click", e => {
    e.preventDefault();
    navigateTo(el.dataset.page);
  });
});

document.getElementById("btn-menu").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

document.getElementById("content").addEventListener("click", () => {
  document.getElementById("sidebar").classList.remove("open");
});

const PAGE_TITLES = {
  dashboard:      "Dashboard",
  workers:        "Workers",
  "worker-detail":"Worker Profile",
  attendance:     "Attendance",
  reports:        "Reports"
};

function navigateTo(page, data = null) {
  document.querySelectorAll(".page").forEach(p => (p.style.display = "none"));
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));

  currentPage = page;

  const pageEl = document.getElementById("page-" + page);
  if (pageEl) pageEl.style.display = "";

  const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (navLink) navLink.classList.add("active");

  document.getElementById("page-title").textContent = PAGE_TITLES[page] || page;

  document.getElementById("sidebar").classList.remove("open");

  if (page === "dashboard") {
    renderDashboard();
  } else if (page === "workers") {
    renderWorkersPage();
  } else if (page === "worker-detail" && data) {
    workerDetailId    = data;
    workerDetailMonth = gregorianToNepaliStr(new Date()).slice(0, 7);
    renderWorkerDetail(data);
  } else if (page === "attendance") {
    renderAttendancePage();
  } else if (page === "reports") {
    renderReportsPage();
  }
}

/* ══════════════════════════════════════════
   8. DATA INIT
══════════════════════════════════════════ */
async function loadInitialData() {
  await loadWorkers();
  navigateTo("dashboard");
}

/* ══════════════════════════════════════════
   9. WORKERS — CRUD
══════════════════════════════════════════ */
function workersCol() {
  return db.collection("users").doc(currentUser.uid).collection("workers");
}

function recordsCol() {
  return db.collection("users").doc(currentUser.uid).collection("records");
}

async function loadWorkers() {
  const snap = await workersCol().orderBy("name").get();
  workers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function upsertWorker(data, id = null) {
  if (id) {
    await workersCol().doc(id).update(data);
    const i = workers.findIndex(w => w.id === id);
    if (i >= 0) workers[i] = { ...workers[i], ...data };
  } else {
    const ref = await workersCol().add({
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    workers.push({ id: ref.id, ...data });
    workers.sort((a, b) => a.name.localeCompare(b.name));
  }
}

async function removeWorker(id) {
  await workersCol().doc(id).delete();
  const recs = await recordsCol().where("workerId", "==", id).get();
  const BATCH = 400;
  for (let i = 0; i < recs.docs.length; i += BATCH) {
    const batch = db.batch();
    recs.docs.slice(i, i + BATCH).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  workers = workers.filter(w => w.id !== id);
}

/* ══════════════════════════════════════════
   10. RECORDS — CRUD
══════════════════════════════════════════ */
async function getRecords(workerId = null, startDate = null, endDate = null) {
  let q = recordsCol();
  if (workerId)  q = q.where("workerId", "==", workerId);
  if (startDate) q = q.where("date", ">=", startDate);
  if (endDate)   q = q.where("date", "<=", endDate);
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function upsertRecord(data) {
  const docId = `${data.date}_${data.workerId}`;
  await recordsCol().doc(docId).set(data, { merge: true });
}

/* ══════════════════════════════════════════
   11. CALCULATIONS
══════════════════════════════════════════ */
function calcSummary(records, wageRate) {
  let daysWorked = 0, advance = 0, expense = 0, leaveDays = 0, absentDays = 0;
  for (const r of records) {
    if      (r.attendance === "P") daysWorked += 1;
    else if (r.attendance === "H") daysWorked += 0.5;
    else if (r.attendance === "A") absentDays += 1;
    else if (r.attendance === "L") leaveDays  += 1;
    advance += Number(r.advance)  || 0;
    expense += Number(r.expense)  || 0;
  }
  const rate       = Number(wageRate) || 0;
  const grossWages = daysWorked * rate;
  const netPayable = grossWages - advance;
  return { daysWorked, absentDays, leaveDays, advance, expense, grossWages, netPayable };
}

/* ══════════════════════════════════════════
   12. DASHBOARD (with missing record reminders)
══════════════════════════════════════════ */
async function renderDashboard() {
  const el = document.getElementById("page-dashboard");
  setLoading("page-dashboard");

  const todayNep = todayNepaliStr();
  const todayGreg = nepaliToGregorian(todayNep).toISOString().slice(0, 10);
  const ymNep = todayNep.slice(0, 7);
  const { start: startGreg } = nepaliMonthRange(ymNep);

  // Get records for today and this month
  const [todayRecs, monthRecs] = await Promise.all([
    getRecords(null, todayGreg, todayGreg),
    getRecords(null, startGreg, todayGreg)
  ]);

  const activeWorkers = workers.filter(w => w.status !== "inactive");

  const presentToday = todayRecs.filter(r => r.attendance === "P" || r.attendance === "H").length;
  const absentToday  = todayRecs.filter(r => r.attendance === "A").length;

  let monthAdvance = 0, monthExpense = 0, totalPayable = 0;
  for (const r of monthRecs) {
    monthAdvance += Number(r.advance) || 0;
    monthExpense += Number(r.expense) || 0;
  }
  for (const w of activeWorkers) {
    const wRecs = monthRecs.filter(r => r.workerId === w.id);
    totalPayable += calcSummary(wRecs, w.wageRate).netPayable;
  }

  // Missing records reminder (last 7 days)
  const sevenDaysAgoGreg = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentRecs = await getRecords(null, sevenDaysAgoGreg, todayGreg);
  const missingDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const gregDate = d.toISOString().slice(0, 10);
    const nepDateStr = gregorianToNepaliStr(d);
    const dayRecs = recentRecs.filter(r => r.date === gregDate);
    if (dayRecs.length < activeWorkers.length) {
      missingDays.push({ gregDate, nepDateStr, missingCount: activeWorkers.length - dayRecs.length });
    }
  }

  const attMap = {
    P: ["Present",  "green"], H: ["Half Day", "yellow"],
    A: ["Absent",   "red"],   L: ["On Leave", "blue"]
  };

  el.innerHTML = `
    <div class="page-header">
      <h2>Overview</h2>
      <span style="color:var(--muted2);font-size:12px">${fmtNepaliDate(todayNep)}</span>
    </div>

    <!-- Missing Records Reminder -->
    ${missingDays.length > 0 ? `
      <div class="reminder-card">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:20px;">⚠️</span>
          <div style="flex:1">
            <div style="font-weight:700; margin-bottom:4px;">Missing Attendance Records</div>
            <div style="color:var(--muted2); font-size:12px;">You have ${missingDays.reduce((a,b)=>a+b.missingCount,0)} missing entries in the last 7 days.</div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="fillMissingRecords()">📋 Fill Now</button>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
          ${missingDays.map(d => `
            <span class="badge badge-yellow" style="cursor:pointer;" onclick="navigateToAttendanceDate('${d.gregDate}')">
              ${fmtNepaliDate(d.nepDateStr)} (${d.missingCount})
            </span>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Total Workers</div><div class="stat-value blue">${activeWorkers.length}</div></div>
      <div class="stat-card"><div class="stat-label">Present Today</div><div class="stat-value green">${presentToday}</div></div>
      <div class="stat-card"><div class="stat-label">Absent Today</div><div class="stat-value red">${absentToday}</div></div>
      <div class="stat-card"><div class="stat-label">Month Advances</div><div class="stat-value yellow">${fmtMoney(monthAdvance)}</div></div>
      <div class="stat-card"><div class="stat-label">Month Expenses</div><div class="stat-value">${fmtMoney(monthExpense)}</div></div>
      <div class="stat-card"><div class="stat-label">Net Payable (Month)</div><div class="stat-value blue">${fmtMoney(totalPayable)}</div></div>
    </div>

    <div class="section-title">Today's Attendance — ${fmtNepaliDate(todayNep)}</div>

    ${activeWorkers.length === 0
      ? `<div class="empty-state">
           <span class="empty-icon">👷</span>
           <p>No workers added yet.<br>Go to <b>Workers</b> to add your first worker.</p>
         </div>`
      : `<div class="table-wrap">
           <table>
             <thead><tr>
               <th>Worker</th><th>Role</th><th>Status</th><th>Advance</th><th>Expense</th>
             </tr></thead>
             <tbody>
               ${activeWorkers.map(w => {
                  const rec = todayRecs.find(r => r.workerId === w.id);
                  const att = rec?.attendance || "—";
                  const [label, color] = attMap[att] || ["Not Set", "gray"];
                  return `<tr>
                    <td><b>${w.name}</b></td>
                    <td style="color:var(--muted2)">${w.role || "—"}</td>
                    <td><span class="badge badge-${color}">${label}</span></td>
                    <td>${rec?.advance ? fmtMoney(rec.advance) : "—"}</td>
                    <td>${rec?.expense ? fmtMoney(rec.expense) : "—"}</td>
                  </tr>`;
               }).join("")}
             </tbody>
           </table>
         </div>`}

    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="navigateTo('attendance')">📋 Enter Attendance</button>
      <button class="btn btn-secondary" onclick="navigateTo('workers')">👷 Manage Workers</button>
      <button class="btn btn-secondary" onclick="navigateTo('reports')">📈 Monthly Report</button>
    </div>
  `;
}

// Helper function to navigate to attendance for a specific Gregorian date
function navigateToAttendanceDate(gregDate) {
  currentAttDate = gregorianToNepaliStr(new Date(gregDate + "T00:00:00"));
  navigateTo('attendance');
}

// Fill missing records: open attendance page with first missing day
async function fillMissingRecords() {
  const todayGreg = todayStr();
  const sevenDaysAgoGreg = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentRecs = await getRecords(null, sevenDaysAgoGreg, todayGreg);
  const activeWorkers = workers.filter(w => w.status !== "inactive");
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const gregDate = d.toISOString().slice(0, 10);
    const dayRecs = recentRecs.filter(r => r.date === gregDate);
    if (dayRecs.length < activeWorkers.length) {
      currentAttDate = gregorianToNepaliStr(d);
      navigateTo('attendance');
      return;
    }
  }
  showToast("All recent days have attendance records!", "success");
}

/* ══════════════════════════════════════════
   13. WORKERS PAGE
══════════════════════════════════════════ */
function renderWorkersPage() {
  document.getElementById("page-workers").innerHTML = `
    <div class="page-header">
      <h2>Workers</h2>
      <button class="btn btn-primary" onclick="openWorkerModal()">+ Add Worker</button>
    </div>
    <input
      id="worker-search"
      class="search-bar"
      type="text"
      placeholder="🔍  Search by name, role, phone, address (any language)…"
      oninput="filterWorkers(this.value)">
    <div id="workers-grid" class="workers-grid"></div>
  `;
  renderWorkersGrid(workers);
}

function filterWorkers(q) {
  const lq = q.toLowerCase();
  const filtered = lq
    ? workers.filter(w =>
        (w.name    || "").toLowerCase().includes(lq) ||
        (w.role    || "").toLowerCase().includes(lq) ||
        (w.phone   || "").includes(lq) ||
        (w.address || "").toLowerCase().includes(lq) ||
        (w.nid     || "").includes(lq)
      )
    : workers;
  renderWorkersGrid(filtered);
}

function renderWorkersGrid(list) {
  const el = document.getElementById("workers-grid");
  if (!el) return;

  if (!list.length) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <span class="empty-icon">👷</span>
      <p>No workers found.</p>
    </div>`;
    return;
  }

  el.innerHTML = list.map(w => `
    <div class="worker-card" onclick="navigateTo('worker-detail','${w.id}')">
      <div class="worker-card-top">
        <div class="worker-avatar" style="background:${avatarColor(w.name)}">${getInitials(w.name)}</div>
        <div style="flex:1;min-width:0">
          <div class="worker-name">${w.name}</div>
          <div class="worker-role">${w.role || "No role set"}</div>
        </div>
        <span class="badge ${w.status === "inactive" ? "badge-red" : "badge-green"}">${w.status === "inactive" ? "Inactive" : "Active"}</span>
      </div>
      <div class="worker-meta">
        <span>📞 ${w.phone || "N/A"}</span>
        <span>💰 ${fmtMoney(w.wageRate)}/day</span>
        <span>📅 ${fmtDate(w.joinDate)}</span>
      </div>
    </div>
  `).join("");
}

/* ══════════════════════════════════════════
   14. WORKER MODAL (Simplified with custom roles)
══════════════════════════════════════════ */
function openWorkerModal(worker = null) {
  const isEdit = !!worker;
  document.getElementById("modal-title").textContent = isEdit ? "Edit Worker" : "Add New Worker";

  const roles = ["Head mistiri", "mistiri", "helper"];

  document.getElementById("modal-body").innerHTML = `
    <div class="form-group">
      <label class="form-label">Full Name *</label>
      <input class="form-input" id="f-name" placeholder="Worker's full name" value="${esc(worker?.name)}">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Job Role</label>
        <select class="form-select" id="f-role">
          ${roles.map(r => `<option value="${r}"${worker?.role === r ? " selected" : ""}>${r}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Phone (optional)</label>
        <input class="form-input" id="f-phone" type="tel" placeholder="98XXXXXXXX" value="${esc(worker?.phone)}">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Wage Rate (per day)</label>
        <input class="form-input" id="f-wageRate" type="number" min="0" placeholder="e.g. 800" value="${worker?.wageRate || ""}">
      </div>
      <div class="form-group">
        <label class="form-label">Join Date</label>
        <input class="form-input" id="f-joinDate" type="date" value="${worker?.joinDate || todayStr()}">
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Status</label>
      <select class="form-select" id="f-status">
        <option value="active"  ${worker?.status !== "inactive" ? "selected" : ""}>Active</option>
        <option value="inactive"${worker?.status === "inactive" ? "selected" : ""}>Inactive</option>
      </select>
    </div>
  `;

  modalSubmitHandler = async () => {
    const name = document.getElementById("f-name").value.trim();
    if (!name) { showToast("Name is required", "error"); return; }

    const data = {
      name,
      role:       document.getElementById("f-role").value,
      phone:      document.getElementById("f-phone").value.trim(),
      wageRate:   Number(document.getElementById("f-wageRate").value) || 0,
      joinDate:   document.getElementById("f-joinDate").value,
      status:     document.getElementById("f-status").value,
    };

    try {
      document.getElementById("modal-submit").disabled = true;
      document.getElementById("modal-submit").textContent = "Saving…";
      await upsertWorker(data, worker?.id);
      closeModal();
      showToast(isEdit ? "Worker updated!" : "Worker added successfully!");
      renderWorkersPage();
    } catch (e) {
      showToast("Error: " + e.message, "error");
    } finally {
      document.getElementById("modal-submit").disabled = false;
      document.getElementById("modal-submit").textContent = "Save";
    }
  };

  openModal();
}

/* ══════════════════════════════════════════
   15. MODAL HELPERS
══════════════════════════════════════════ */
function openModal() {
  document.getElementById("modal-overlay").style.display = "flex";
  setTimeout(() => {
    const first = document.querySelector("#modal-body input");
    if (first) first.focus();
  }, 80);
}

function closeModal() {
  document.getElementById("modal-overlay").style.display = "none";
  modalSubmitHandler = null;
}

document.getElementById("modal-close") .addEventListener("click", closeModal);
document.getElementById("modal-cancel").addEventListener("click", closeModal);
document.getElementById("modal-submit").addEventListener("click", () => {
  if (modalSubmitHandler) modalSubmitHandler();
});
document.getElementById("modal-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
});

/* ══════════════════════════════════════════
   16. WORKER DETAIL PAGE (with Calendar View)
══════════════════════════════════════════ */
async function renderWorkerDetail(workerId) {
  const el = document.getElementById("page-worker-detail");
  setLoading("page-worker-detail");

  const worker = workers.find(w => w.id === workerId);
  if (!worker) { navigateTo("workers"); return; }

  await renderWorkerDetailContent(worker, workerDetailMonth);
}

async function renderWorkerDetailContent(worker, ym) {
  workerDetailMonth = ym;
  const el   = document.getElementById("page-worker-detail");
  const { start: startGreg, end: endGreg, y, m } = nepaliMonthRange(ym);
  const records = await getRecords(worker.id, startGreg, endGreg);
  const summary = calcSummary(records, worker.wageRate);
  const prevYM  = shiftNepaliMonth(ym, -1);
  const nextYM  = shiftNepaliMonth(ym,  1);
  const isNow   = ym === gregorianToNepaliStr(new Date()).slice(0, 7);

  const attMap = {
    P: ["Present","green"], H: ["Half Day","yellow"],
    A: ["Absent", "red"],   L: ["On Leave","blue"]
  };

  // Build calendar data using internal converter
  const daysInMonth = BS_DAYS_IN_MONTH[m-1];
  const firstDayStr = `${y}-${String(m).padStart(2,'0')}-01`;
  const firstDayWeekday = getBSWeekday(firstDayStr);
  const calendarDays = [];
  // Fill empty cells before first day
  for (let i = 0; i < firstDayWeekday; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const nepDateStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const gregDate = nepaliToGregorian(nepDateStr).toISOString().slice(0,10);
    const rec = records.find(r => r.date === gregDate);
    calendarDays.push({ day: d, nepDateStr, gregDate, attendance: rec?.attendance || null });
  }

  el.innerHTML = `
    <button class="back-btn" onclick="navigateTo('workers')">← Back to Workers</button>

    <!-- PROFILE HEADER -->
    <div class="profile-header">
      <div class="profile-avatar" style="background:${avatarColor(worker.name)}">${getInitials(worker.name)}</div>
      <div class="profile-info">
        <h2>
          ${worker.name}
          <span class="badge ${worker.status === "inactive" ? "badge-red" : "badge-green"}">${worker.status === "inactive" ? "Inactive" : "Active"}</span>
        </h2>
        <p>${worker.role || "No role"} &nbsp;•&nbsp; ${fmtMoney(worker.wageRate)}/day &nbsp;•&nbsp; Joined ${fmtDate(worker.joinDate)}</p>
      </div>
      <div class="profile-actions">
        <button class="btn btn-secondary btn-sm" id="edit-worker-btn">✏️ Edit</button>
        <button class="btn btn-danger btn-sm"    id="del-worker-btn">🗑️ Delete</button>
      </div>
    </div>

    <!-- WORKER INFO -->
    <div class="section-title">Worker Information</div>
    <div class="card" style="margin-bottom:22px">
      <div class="info-grid">
        <div class="info-item"><label>Phone</label>          <span>${worker.phone           || "—"}</span></div>
        <div class="info-item"><label>NID / Citizenship</label><span>${worker.nid          || "—"}</span></div>
        <div class="info-item"><label>Address</label>        <span>${worker.address         || "—"}</span></div>
        <div class="info-item"><label>Blood Group</label>    <span>${worker.bloodGroup !== "—" && worker.bloodGroup ? worker.bloodGroup : "—"}</span></div>
        <div class="info-item"><label>Emergency Contact</label><span>${worker.emergencyName|| "—"}</span></div>
        <div class="info-item"><label>Emergency Phone</label><span>${worker.emergencyPhone  || "—"}</span></div>
        <div class="info-item"><label>Relation</label>       <span>${worker.emergencyRelation||"—"}</span></div>
        <div class="info-item"><label>Notes</label>          <span>${worker.notes           || "—"}</span></div>
      </div>
    </div>

    <!-- MONTH NAVIGATOR -->
    <div class="month-nav">
      <button class="date-nav" id="wd-prev">◀ Prev</button>
      <span class="month-label">${fmtNepaliMonth(ym)}</span>
      <button class="date-nav" id="wd-next" ${isNow ? 'disabled' : ''}>Next ▶</button>
    </div>

    <!-- CALENDAR VIEW -->
    <div class="section-title">Attendance Calendar — ${fmtNepaliMonth(ym)}</div>
    <div class="calendar-wrap">
      <div class="calendar-weekdays">
        <span>आइत</span><span>सोम</span><span>मङ्गल</span><span>बुध</span><span>बिहि</span><span>शुक्र</span><span>शनि</span>
      </div>
      <div class="calendar-grid">
        ${calendarDays.map((item, idx) => {
          if (item === null) return '<div class="calendar-cell empty"></div>';
          const att = item.attendance;
          let badge = '';
          let bg = '';
          if (att === 'P') { badge = '✓'; bg = 'var(--green)'; }
          else if (att === 'H') { badge = '½'; bg = 'var(--yellow)'; }
          else if (att === 'A') { badge = '✗'; bg = 'var(--red)'; }
          else if (att === 'L') { badge = 'L'; bg = 'var(--blue)'; }
          else { badge = '·'; bg = 'var(--muted)'; }
          return `
            <div class="calendar-cell" style="background:${bg}20; border-left:3px solid ${bg};" onclick="quickFillAttendance('${worker.id}','${item.gregDate}')">
              <span class="cell-day">${item.day}</span>
              <span class="cell-badge" style="color:${bg}">${badge}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- MONTH SUMMARY STATS -->
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Days Worked</div>     <div class="stat-value green">${summary.daysWorked}</div></div>
      <div class="stat-card"><div class="stat-label">Days Absent</div>     <div class="stat-value red">${summary.absentDays}</div></div>
      <div class="stat-card"><div class="stat-label">Leave Days</div>      <div class="stat-value yellow">${summary.leaveDays}</div></div>
      <div class="stat-card"><div class="stat-label">Gross Wages</div>     <div class="stat-value blue">${fmtMoney(summary.grossWages)}</div></div>
      <div class="stat-card"><div class="stat-label">Advances Given</div>  <div class="stat-value red">${fmtMoney(summary.advance)}</div></div>
      <div class="stat-card"><div class="stat-label">Expenses Recorded</div><div class="stat-value yellow">${fmtMoney(summary.expense)}</div></div>
      <div class="stat-card"><div class="stat-label">Net Payable</div>
        <div class="stat-value ${summary.netPayable >= 0 ? "green" : "red"}">${fmtMoney(summary.netPayable)}</div>
      </div>
    </div>

    <!-- DAILY RECORDS TABLE -->
    <div class="section-title">Daily Records — ${fmtNepaliMonth(ym)}</div>

    ${records.length === 0
      ? `<div class="empty-state">
           <span class="empty-icon">📋</span>
           <p>No records for this month.<br>Use the <b>Attendance</b> page to add records.</p>
         </div>`
      : `<div class="table-wrap">
           <table>
             <thead><tr>
               <th>Date</th><th>Attendance</th><th>Advance</th><th>Expense</th><th>Notes</th>
             </tr></thead>
             <tbody>
               ${records
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(r => {
                    const [label, color] = attMap[r.attendance] || ["Unknown","gray"];
                    const nepDate = gregorianToNepaliStr(new Date(r.date + "T00:00:00"));
                    return `<tr>
                      <td>${fmtNepaliDate(nepDate)}</td>
                      <td><span class="badge badge-${color}">${label}</span>${r.leaveType && r.leaveType !== "null" ? ` <span style="color:var(--muted2);font-size:11px">(${r.leaveType})</span>` : ""}</td>
                      <td>${r.advance ? fmtMoney(r.advance) : "—"}</td>
                      <td>${r.expense ? fmtMoney(r.expense) : "—"}</td>
                      <td style="color:var(--muted2)">${r.notes || "—"}</td>
                    </tr>`;
                  }).join("")}
             </tbody>
           </table>
         </div>`}

    <!-- ADD RECORD FOR TODAY shortcut -->
    <div style="margin-top:16px">
      <button class="btn btn-primary" onclick="navigateTo('attendance')">📋 Enter Today's Attendance</button>
    </div>
  `;

  // Wire up buttons
  document.getElementById("edit-worker-btn").addEventListener("click", () => openWorkerModal(worker));
  document.getElementById("del-worker-btn").addEventListener("click",  () => confirmDeleteWorker(worker));
  document.getElementById("wd-prev").addEventListener("click", () => renderWorkerDetailContent(worker, prevYM));
  if (!isNow) document.getElementById("wd-next").addEventListener("click", () => renderWorkerDetailContent(worker, nextYM));
}

// Quick fill attendance for a specific date (opens attendance page for that date)
function quickFillAttendance(workerId, gregDate) {
  currentAttDate = gregorianToNepaliStr(new Date(gregDate + "T00:00:00"));
  navigateTo('attendance');
}

async function confirmDeleteWorker(worker) {
  const ok = await confirm2(`Delete worker "${worker.name}"?\n\nThis will permanently delete all their attendance and records. This cannot be undone.`);
  if (!ok) return;
  try {
    await removeWorker(worker.id);
    showToast(`${worker.name} deleted.`);
    navigateTo("workers");
  } catch (e) {
    showToast("Error: " + e.message, "error");
  }
}

/* ══════════════════════════════════════════
   17. ATTENDANCE PAGE (Nepali Date Navigation)
══════════════════════════════════════════ */
async function renderAttendancePage() {
  const el = document.getElementById("page-attendance");
  const todayNep = todayNepaliStr();
  const isToday = currentAttDate === todayNep;
  el.innerHTML = `
    <div class="page-header"><h2>Daily Attendance Entry</h2></div>

    <div class="date-section">
      <button class="date-nav" id="att-prev">◀</button>
      <span class="date-input" id="att-date-display">${fmtNepaliDate(currentAttDate)}</span>
      <button class="date-nav" id="att-next" ${isToday ? "disabled" : ""}>▶</button>
      <button class="btn btn-secondary btn-sm" id="att-today">Today</button>
    </div>

    <div id="att-content"></div>

    <div class="save-bar" id="att-save-bar" style="display:none">
      <button class="btn btn-success" id="att-save-btn">💾 Save All Records</button>
      <span class="save-status" id="att-save-status"></span>
    </div>
  `;

  document.getElementById("att-prev").addEventListener("click", () => shiftAttDate(-1));
  document.getElementById("att-next").addEventListener("click", () => shiftAttDate(+1));
  document.getElementById("att-today").addEventListener("click", () => {
    currentAttDate = todayNepaliStr();
    renderAttendancePage(); // re-render
  });

  await loadAttendanceForDate();
}

function shiftAttDate(delta) {
  const [y, m, d] = currentAttDate.split('-').map(Number);
  let newDay = d + delta;
  let newMonth = m;
  let newYear = y;
  const daysInMonth = BS_DAYS_IN_MONTH[m-1];
  
  if (newDay > daysInMonth) {
    newDay = 1;
    newMonth++;
    if (newMonth > 12) { newMonth = 1; newYear++; }
  } else if (newDay < 1) {
    newMonth--;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    newDay = BS_DAYS_IN_MONTH[newMonth-1];
  }
  
  const newNepStr = `${newYear}-${String(newMonth).padStart(2,'0')}-${String(newDay).padStart(2,'0')}`;
  const todayNep = todayNepaliStr();
  if (newNepStr > todayNep) return; // cannot go to future
  currentAttDate = newNepStr;
  renderAttendancePage();
}

async function loadAttendanceForDate() {
  const el = document.getElementById("att-content");
  if (!el) return;

  const activeWorkers = workers.filter(w => w.status !== "inactive");

  if (!activeWorkers.length) {
    el.innerHTML = `<div class="empty-state">
      <span class="empty-icon">👷</span>
      <p>No active workers.<br>Add workers in the <b>Workers</b> section first.</p>
    </div>`;
    document.getElementById("att-save-bar").style.display = "none";
    return;
  }

  setLoading("att-content");

  const gregDate = nepaliToGregorian(currentAttDate).toISOString().slice(0,10);
  const recs = await getRecords(null, gregDate, gregDate);
  attendanceState = {};
  for (const w of activeWorkers) {
    const rec = recs.find(r => r.workerId === w.id);
    attendanceState[w.id] = {
      attendance: rec?.attendance || "",
      advance:    Number(rec?.advance)  || 0,
      expense:    Number(rec?.expense)  || 0,
      notes:      rec?.notes            || "",
      leaveType:  rec?.leaveType        || "unpaid"
    };
  }

  el.innerHTML = `
    <div class="att-table-wrap">
      <table class="att-table">
        <thead>
          <tr>
            <th style="min-width:160px">Worker</th>
            <th style="min-width:300px">Attendance</th>
            <th style="min-width:110px">Advance (${CURRENCY})</th>
            <th style="min-width:110px">Expense (${CURRENCY})</th>
            <th style="min-width:140px">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${activeWorkers.map(w => {
            const s = attendanceState[w.id];
            const btnDefs = [
              ["P", "✓ Present"],
              ["H", "½ Half Day"],
              ["A", "✗ Absent"],
              ["L", "🏖 Leave"]
            ];
            return `
              <tr>
                <td>
                  <b>${w.name}</b><br>
                  <span style="color:var(--muted2);font-size:11px">${w.role || ""}</span>
                </td>
                <td>
                  <div class="att-btns" id="att-btns-${w.id}">
                    ${btnDefs.map(([val, label]) => `
                      <button
                        class="att-btn${s.attendance === val ? " sel-" + val : ""}"
                        data-wid="${w.id}"
                        data-val="${val}">
                        ${label}
                      </button>
                    `).join("")}
                  </div>
                </td>
                <td>
                  <input
                    class="mini-input"
                    type="number" min="0"
                    id="adv-${w.id}"
                    value="${s.advance || ""}"
                    placeholder="0"
                    oninput="attendanceState['${w.id}'].advance = Number(this.value)||0">
                </td>
                <td>
                  <input
                    class="mini-input"
                    type="number" min="0"
                    id="exp-${w.id}"
                    value="${s.expense || ""}"
                    placeholder="0"
                    oninput="attendanceState['${w.id}'].expense = Number(this.value)||0">
                </td>
                <td>
                  <input
                    class="mini-input"
                    type="text"
                    id="note-${w.id}"
                    value="${esc(s.notes)}"
                    placeholder="Optional note…"
                    oninput="attendanceState['${w.id}'].notes = this.value">
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  el.querySelectorAll(".att-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const wid = btn.dataset.wid;
      const val = btn.dataset.val;
      attendanceState[wid].attendance = val;
      document.querySelectorAll(`#att-btns-${wid} .att-btn`).forEach(b => {
        b.className = "att-btn" + (b.dataset.val === val ? " sel-" + val : "");
      });
    });
  });

  document.getElementById("att-save-bar").style.display = "flex";
  document.getElementById("att-save-status").textContent = "";
}

async function saveAttendance() {
  const statusEl = document.getElementById("att-save-status");
  const saveBtn  = document.getElementById("att-save-btn");
  statusEl.className = "save-status";
  statusEl.textContent = "Saving…";
  saveBtn.disabled = true;

  const gregDate = nepaliToGregorian(currentAttDate).toISOString().slice(0,10);
  try {
    const promises = [];
    for (const [workerId, s] of Object.entries(attendanceState)) {
      if (s.attendance) {
        promises.push(upsertRecord({
          workerId,
          date:       gregDate,
          attendance: s.attendance,
          advance:    s.advance || 0,
          expense:    s.expense || 0,
          notes:      s.notes   || "",
          leaveType:  s.attendance === "L" ? s.leaveType : null
        }));
      }
    }
    await Promise.all(promises);

    statusEl.textContent = `✓ ${promises.length} record(s) saved`;
    statusEl.className = "save-status saved";
    showToast("Attendance saved!");
    setTimeout(() => { if (statusEl) { statusEl.textContent = ""; statusEl.className = "save-status"; } }, 4000);
  } catch (e) {
    statusEl.textContent = "Error saving!";
    statusEl.className = "save-status error";
    showToast("Error: " + e.message, "error");
  } finally {
    saveBtn.disabled = false;
  }
}

/* ══════════════════════════════════════════
   18. REPORTS PAGE (Nepali Month)
══════════════════════════════════════════ */
async function renderReportsPage() {
  const el = document.getElementById("page-reports");
  const todayNep = todayNepaliStr();
  if (!currentReportMonth) currentReportMonth = todayNep.slice(0,7);
  const isNow = currentReportMonth === todayNep.slice(0,7);
  el.innerHTML = `
    <div class="page-header"><h2>Monthly Report</h2></div>
    <div class="month-nav">
      <button class="date-nav" id="rpt-prev">◀ Prev</button>
      <span class="month-label" id="rpt-label">${fmtNepaliMonth(currentReportMonth)}</span>
      <button class="date-nav" id="rpt-next" ${isNow ? "disabled" : ""}>Next ▶</button>
    </div>
    <div id="rpt-content"></div>
  `;

  document.getElementById("rpt-prev").addEventListener("click", () => {
    currentReportMonth = shiftNepaliMonth(currentReportMonth, -1);
    renderReportsPage();
  });
  document.getElementById("rpt-next").addEventListener("click", () => {
    currentReportMonth = shiftNepaliMonth(currentReportMonth, +1);
    renderReportsPage();
  });

  await loadReportData();
}

async function loadReportData() {
  setLoading("rpt-content");
  const el = document.getElementById("rpt-content");
  if (!el) return;

  const { start: startGreg, end: endGreg } = nepaliMonthRange(currentReportMonth);
  const allRecs = await getRecords(null, startGreg, endGreg);

  if (!workers.length) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">📊</span><p>No workers yet.</p></div>`;
    return;
  }

  let totDays = 0, totGross = 0, totAdv = 0, totExp = 0, totNet = 0;

  const rows = workers.map(w => {
    const wRecs = allRecs.filter(r => r.workerId === w.id);
    const s = calcSummary(wRecs, w.wageRate);
    totDays  += s.daysWorked;
    totGross += s.grossWages;
    totAdv   += s.advance;
    totExp   += s.expense;
    totNet   += s.netPayable;
    return { w, s };
  });

  el.innerHTML = `
    <div class="stats-grid" style="margin-bottom:22px">
      <div class="stat-card"><div class="stat-label">Total Days</div>       <div class="stat-value green">${totDays}</div></div>
      <div class="stat-card"><div class="stat-label">Gross Wages</div>      <div class="stat-value blue">${fmtMoney(totGross)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Advances</div>   <div class="stat-value red">${fmtMoney(totAdv)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Expenses</div>   <div class="stat-value yellow">${fmtMoney(totExp)}</div></div>
      <div class="stat-card"><div class="stat-label">Net Payable</div>      <div class="stat-value ${totNet >= 0 ? "green" : "red"}">${fmtMoney(totNet)}</div></div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Worker</th><th>Role</th><th>Days</th><th>Absent</th><th>Leaves</th>
            <th>Gross Wages</th><th>Advances</th><th>Expenses</th><th>Net Payable</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(({ w, s }) => `
            <tr>
              <td><b>${w.name}</b></td>
              <td style="color:var(--muted2)">${w.role || "—"}</td>
              <td style="color:var(--green);font-weight:700">${s.daysWorked}</td>
              <td style="color:var(--red)">${s.absentDays}</td>
              <td style="color:var(--yellow)">${s.leaveDays}</td>
              <td>${fmtMoney(s.grossWages)}</td>
              <td style="color:var(--red)">${fmtMoney(s.advance)}</td>
              <td style="color:var(--yellow)">${fmtMoney(s.expense)}</td>
              <td style="color:${s.netPayable >= 0 ? "var(--green)" : "var(--red)"};font-weight:700">${fmtMoney(s.netPayable)}</td>
              <td><button class="btn btn-secondary btn-sm" onclick="navigateTo('worker-detail','${w.id}')">View</button></td>
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2"><b>TOTAL</b></td>
            <td style="color:var(--green)"><b>${totDays}</b></td>
            <td></td><td></td>
            <td><b>${fmtMoney(totGross)}</b></td>
            <td style="color:var(--red)"><b>${fmtMoney(totAdv)}</b></td>
            <td style="color:var(--yellow)"><b>${fmtMoney(totExp)}</b></td>
            <td style="color:${totNet >= 0 ? "var(--green)" : "var(--red)"}"><b>${fmtMoney(totNet)}</b></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="export-bar">
      <button class="btn btn-secondary" onclick="exportCSV()">📥 Export CSV</button>
      <span style="font-size:12px;color:var(--muted2)">CSV can be opened in Excel / Google Sheets</span>
    </div>
  `;
}

async function exportCSV() {
  const { start: startGreg, end: endGreg } = nepaliMonthRange(currentReportMonth);
  const allRecs = await getRecords(null, startGreg, endGreg);

  const header = "Name,Role,Wage/Day,Days Worked,Absent,Leaves,Gross Wages,Advances,Expenses,Net Payable\n";
  const rows = workers.map(w => {
    const s = calcSummary(allRecs.filter(r => r.workerId === w.id), w.wageRate);
    return [
      `"${w.name}"`, `"${w.role || ""}"`, w.wageRate,
      s.daysWorked, s.absentDays, s.leaveDays,
      s.grossWages, s.advance, s.expense, s.netPayable
    ].join(",");
  }).join("\n");

  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `constructpro_${currentReportMonth}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV downloaded!");
}

/* ══════════════════════════════════════════
   19. CUSTOM CONFIRM DIALOG
══════════════════════════════════════════ */
function confirm2(msg) {
  return new Promise(resolve => {
    document.getElementById("confirm-msg").textContent = msg;
    document.getElementById("confirm-overlay").style.display = "flex";

    const yes = document.getElementById("confirm-yes");
    const no  = document.getElementById("confirm-no");

    function cleanup(val) {
      document.getElementById("confirm-overlay").style.display = "none";
      yes.removeEventListener("click", yesH);
      no.removeEventListener("click", noH);
      resolve(val);
    }
    const yesH = () => cleanup(true);
    const noH  = () => cleanup(false);

    yes.addEventListener("click", yesH);
    no.addEventListener("click",  noH);
  });
}

/* ══════════════════════════════════════════
   20. ESCAPE HELPER (XSS prevention)
══════════════════════════════════════════ */
function esc(str) {
  if (!str && str !== 0) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
