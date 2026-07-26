// --- Supabase Cloud Configuration ---
// Guard: hanya deklarasi jika belum ada, mencegah SyntaxError jika script dimuat ganda
if (typeof window.SUPABASE_CONFIG === 'undefined') {
  window.SUPABASE_CONFIG = {
    url: 'https://wedwjlkvnzbgrrybamqm.supabase.co',
    anonKey: 'sb_publishable_h4RSXPFlcFVIpArkD9PfhA_8M-R5fh0'
  };
}
const SUPABASE_CONFIG = window.SUPABASE_CONFIG;

let supabaseClient = null;

function initSupabase() {
  if (typeof supabase !== 'undefined' && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
    try {
      supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    } catch (e) {
      console.warn('Gagal inisialisasi Supabase:', e);
    }
  }
}

// --- App State ---
let state = {
  students: [],     // Array of { id, nama, nisn, kelas }
  attendance: [],   // Array of { id, student_id, tanggal, status, keterangan }
  lateLogs: [],     // Array of { id, student_id, tanggal, jam, keterangan }
  violations: [],   // Array of { id, student_id, tanggal, jam, keterangan }
  izinPulang: [],   // Array of { id, student_id, tanggal, jam, keterangan, guru_piket }
  jurnalGuru: [],   // Array of journal entries
  teachers: [],     // Array of { id, nama, mapel }
  kaihLogs: [],     // Array of 7 KAIH log entries
  accounts: [],     // Array of { id, username, password, nama, role }
  currentView: 'dashboard',
  theme: 'dark'
};

// --- Initializer ---
document.addEventListener('DOMContentLoaded', () => {

  // Load Theme
  initTheme();
  
  // Set Current Date Display
  updateDateDisplay();

  // Load Saved Settings and Data
  loadSettings();
  loadData();

  // Switch to initial view
  switchMenu('dashboard');

  // Check Auth Session
  checkAuthStatus();

  // Setup Drag and Drop
  setupDragAndDrop();
  setupDragAndDropGuru();

  // Trigger Lucide Icons rendering
  lucide.createIcons();

  // Handle outside clicks for searchable dropdowns
  document.addEventListener('click', (e) => {
    const lateContainer = document.querySelector('#view-terlambat .searchable-select-container');
    const lateDropdown = document.getElementById('terlambat-dropdown-list');
    if (lateContainer && !lateContainer.contains(e.target) && lateDropdown) {
      lateDropdown.style.display = 'none';
    }

    const violationContainer = document.querySelector('#view-pelanggaran .searchable-select-container');
    const violationDropdown = document.getElementById('pelanggaran-dropdown-list');
    if (violationContainer && !violationContainer.contains(e.target) && violationDropdown) {
      violationDropdown.style.display = 'none';
    }

    const izinPulangContainer = document.querySelector('#view-izin-pulang .searchable-select-container');
    const izinPulangDropdown = document.getElementById('izin-pulang-dropdown-list');
    if (izinPulangContainer && !izinPulangContainer.contains(e.target) && izinPulangDropdown) {
      izinPulangDropdown.style.display = 'none';
    }
  });
  // BUGFIX #5: Dihapus pemanggilan setupDragAndDrop() duplikat (sudah dipanggil baris 55)
});

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function checkUrlParamsForConfig() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const repo = urlParams.get('repo');
  const branch = urlParams.get('branch') || 'main';
  const path = urlParams.get('path') || 'database.json';

  if (token && repo) {
    // Save to github settings
    state.githubSettings = { token, repo, branch, path };
    state.storageMode = 'github';
    
    localStorage.setItem('storageMode', 'github');
    localStorage.setItem('githubSettings', JSON.stringify(state.githubSettings));
    
    // Clear parameters from URL address bar for security
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    
    // We will show a toast once DOM is loaded, let's defer it slightly
    setTimeout(() => {
      showToast('Konfigurasi GitHub berhasil dimuat otomatis dari tautan!', 'success');
      loadSettings();
      loadData();
    }, 800);
  }
}

// --- Theme Management ---
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  state.theme = savedTheme;
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    document.getElementById('theme-icon-light').style.display = 'none';
    document.getElementById('theme-icon-dark').style.display = 'block';
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    document.getElementById('theme-icon-light').style.display = 'block';
    document.getElementById('theme-icon-dark').style.display = 'none';
  }
}

function toggleTheme() {
  const newTheme = state.theme === 'dark' ? 'light' : 'dark';
  state.theme = newTheme;
  localStorage.setItem('theme', newTheme);
  initTheme();
  showToast(`Tema diganti ke ${newTheme === 'dark' ? 'Gelap' : 'Terang'}`, 'info');
  
  // Re-render charts to adapt to colors if needed
  if (state.currentView === 'dashboard') {
    renderDashboardCharts();
  }
}

function updateDateDisplay() {
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const todayStr = new Date().toLocaleDateString('id-ID', dateOptions);
  document.getElementById('current-date-display').textContent = todayStr;
  
  // Fill default dates for inputs
  const todayISO = new Date().toISOString().split('T')[0];
  const dateInputAbsensi = document.getElementById('absensi-tanggal');
  if (dateInputAbsensi) dateInputAbsensi.value = todayISO;
  
  const dateInputTerlambat = document.getElementById('terlambat-tanggal');
  if (dateInputTerlambat) dateInputTerlambat.value = todayISO;

  const dateInputPelanggaran = document.getElementById('pelanggaran-tanggal');
  if (dateInputPelanggaran) dateInputPelanggaran.value = todayISO;

  const dateInputIzinPulang = document.getElementById('izin-pulang-tanggal');
  if (dateInputIzinPulang) dateInputIzinPulang.value = todayISO;

  const dateInputJurnal = document.getElementById('jurnal-tanggal');
  if (dateInputJurnal) dateInputJurnal.value = todayISO;

  const dateInputKaih = document.getElementById('7kaih-tanggal');
  if (dateInputKaih) dateInputKaih.value = todayISO;

  // Set default hours for late log
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeInput = document.getElementById('terlambat-jam');
  if (timeInput) timeInput.value = `${hours}:${minutes}`;

  const timeInputPelanggaran = document.getElementById('pelanggaran-jam');
  if (timeInputPelanggaran) timeInputPelanggaran.value = `${hours}:${minutes}`;

  const timeInputIzinPulang = document.getElementById('izin-pulang-jam');
  if (timeInputIzinPulang) timeInputIzinPulang.value = `${hours}:${minutes}`;

  // Populate recap years
  const yearSelects = [
    document.getElementById('rekap-tahun'),
    document.getElementById('laporan-absen-tahun'),
    document.getElementById('laporan-terlambat-tahun'),
    document.getElementById('laporan-pelanggaran-tahun'),
    document.getElementById('laporan-izin-pulang-tahun')
  ];
  const currentYear = now.getFullYear();
  yearSelects.forEach(select => {
    if (select) {
      select.innerHTML = '';
      for (let y = currentYear - 2; y <= currentYear + 2; y++) {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y;
        if (y === currentYear) option.selected = true;
        select.appendChild(option);
      }
    }
  });

  // Populate recap months
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
  const monthSelects = [
    document.getElementById('rekap-bulan'),
    document.getElementById('laporan-absen-bulan'),
    document.getElementById('laporan-terlambat-bulan'),
    document.getElementById('laporan-pelanggaran-bulan'),
    document.getElementById('laporan-izin-pulang-bulan')
  ];
  monthSelects.forEach(select => {
    if (select) {
      select.value = currentMonthStr;
    }
  });
}

// --- Local Storage Settings & Data Loader ---
function loadSettings() {
  const savedMode = localStorage.getItem('storageMode') || 'local';
  state.storageMode = savedMode;

  // Set the segmented control state
  const activeBtn = document.getElementById(`btn-store-${savedMode}`);
  if (activeBtn) {
    document.querySelectorAll('#storage-mode-segmented .segment-button').forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');
  }

  // Toggle sections
  const localSec = document.getElementById('settings-local-section');
  const serverSec = document.getElementById('settings-server-section');
  const githubSec = document.getElementById('settings-github-section');
  const syncCard = document.getElementById('gh-sync-tools-card');

  if (localSec) localSec.style.display = savedMode === 'local' ? 'flex' : 'none';
  if (serverSec) serverSec.style.display = savedMode === 'server' ? 'flex' : 'none';
  if (githubSec) githubSec.style.display = savedMode === 'github' ? 'block' : 'none';
  if (syncCard) syncCard.style.display = savedMode === 'github' ? 'block' : 'none';
  
  const savedGhSettings = localStorage.getItem('githubSettings');
  if (savedGhSettings) {
    state.githubSettings = JSON.parse(savedGhSettings);
  }

  // Pre-fill github form
  const ghToken = document.getElementById('gh-token');
  const ghRepo = document.getElementById('gh-repo');
  const ghBranch = document.getElementById('gh-branch');
  const ghPath = document.getElementById('gh-path');

  if (ghToken) ghToken.value = state.githubSettings.token || '';
  if (ghRepo) ghRepo.value = state.githubSettings.repo || '';
  if (ghBranch) ghBranch.value = state.githubSettings.branch || 'main';
  if (ghPath) ghPath.value = state.githubSettings.path || 'database.json';

  updateSyncBadge();
}

// BUGFIX #4: Merge dengan resolusi konflik berbasis timestamp
// Cloud menang hanya jika updated_at-nya lebih baru dari data lokal
function mergeListById(localList = [], cloudList = [], idKey = 'id') {
  if (!cloudList || cloudList.length === 0) return localList || [];
  if (!localList || localList.length === 0) return cloudList || [];

  const map = new Map();
  localList.forEach(item => {
    if (!item) return;
    const key = String(item[idKey] !== undefined ? item[idKey] : (item.id || item.nisn || item.username)).trim();
    if (key) map.set(key, item);
  });

  cloudList.forEach(item => {
    if (!item) return;
    const key = String(item[idKey] !== undefined ? item[idKey] : (item.id || item.nisn || item.username)).trim();
    if (key) {
      const existing = map.get(key);
      if (!existing) {
        // Item baru dari cloud, langsung tambah
        map.set(key, item);
      } else {
        // BUGFIX #4: Resolusi konflik berbasis timestamp
        const localTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
        const cloudTime = item.updated_at ? new Date(item.updated_at).getTime() : 0;
        if (cloudTime >= localTime) {
          // Cloud lebih baru atau sama → cloud menang (dengan tetap pertahankan field lokal yang tidak ada di cloud)
          map.set(key, { ...existing, ...item });
        } else {
          // Lokal lebih baru → lokal menang (hanya tambah field cloud yang tidak ada di lokal)
          map.set(key, { ...item, ...existing });
        }
      }
    }
  });

  return Array.from(map.values());
}


function getDeletedStudentIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem('deletedStudentIds') || '[]'));
  } catch (e) {
    return new Set();
  }
}

function addDeletedStudentId(id) {
  if (!id) return;
  const set = getDeletedStudentIds();
  set.add(String(id).trim());
  localStorage.setItem('deletedStudentIds', JSON.stringify(Array.from(set)));
}

function clearDeletedStudentIds() {
  localStorage.removeItem('deletedStudentIds');
}

async function loadData() {
  initSupabase();

  // 1. Read LocalStorage baseline first so local data is never lost
  const localDb = localStorage.getItem('schoolDb');
  if (localDb) {
    try {
      const parsed = JSON.parse(localDb);
      if (Array.isArray(parsed.students)) state.students = parsed.students;
      if (Array.isArray(parsed.attendance)) state.attendance = parsed.attendance;
      if (Array.isArray(parsed.lateLogs)) state.lateLogs = parsed.lateLogs;
      if (Array.isArray(parsed.violations)) state.violations = parsed.violations;
      if (Array.isArray(parsed.izinPulang)) state.izinPulang = parsed.izinPulang;
      if (Array.isArray(parsed.jurnalGuru)) state.jurnalGuru = parsed.jurnalGuru;
      if (Array.isArray(parsed.teachers)) state.teachers = parsed.teachers;
      if (Array.isArray(parsed.kaihLogs)) state.kaihLogs = parsed.kaihLogs;
      if (Array.isArray(parsed.accounts) && parsed.accounts.length > 0) state.accounts = parsed.accounts;
    } catch (e) {
      console.error('Error parsing local DB', e);
    }
  }

  if (!state.accounts || state.accounts.length === 0) {
    state.accounts = getDefaultAccounts();
  }

  // 2. Pull and merge cloud data
  if (supabaseClient) {
    await syncPullFromSupabase(true);
    
    // FIX DATA GURU: Jangan push ulang data ke cloud jika baru saja dilakukan reset
    // Reset menyimpan timestamp di lastResetAt; jika < 10 detik lalu, skip push
    const lastResetAt = localStorage.getItem('lastResetAt');
    const justReset = lastResetAt && (Date.now() - new Date(lastResetAt).getTime()) < 10000;

    if (!justReset) {
      // Ensure local data is also synced up to cloud if cloud is missing entries
      const hasData = (state.students && state.students.length > 0) ||
                      (state.teachers && state.teachers.length > 0) ||
                      (state.jurnalGuru && state.jurnalGuru.length > 0);
      if (hasData) {
        syncPushToSupabase(true);
      }
    }
  }

  updateSyncBadge();
  refreshAllUI();
  checkAuthStatus();
}

// Auto-sync when user returns/focuses tab on any device
window.addEventListener('focus', () => {
  if (supabaseClient) {
    syncPullFromSupabase(true);
  }
});

function saveLocalState() {
  const dbData = {
    students: state.students,
    attendance: state.attendance,
    lateLogs: state.lateLogs,
    violations: state.violations,
    izinPulang: state.izinPulang,
    jurnalGuru: state.jurnalGuru,
    teachers: state.teachers,
    kaihLogs: state.kaihLogs,
    accounts: getAccountsList()
  };
  localStorage.setItem('schoolDb', JSON.stringify(dbData));
}

async function persistData() {
  saveLocalState();
  if (supabaseClient) {
    await syncPushToSupabase(true);
  }
}

// --- Supabase Cloud Sync Engine ---
let realtimeChannel = null;

function updateSyncBadge() {
  const indicator = document.getElementById('sync-status-indicator');
  const text = document.getElementById('sync-status-text');
  if (!indicator || !text) return;

  indicator.className = 'sync-status';
  if (supabaseClient) {
    indicator.classList.add('status-connected');
    text.textContent = 'Supabase Database (Aktif)';
    indicator.title = 'Klik untuk memperbarui & menarik data terbaru dari Supabase Cloud';
    indicator.style.cursor = 'pointer';
    indicator.onclick = () => syncPullFromSupabase(false);
  } else {
    indicator.classList.add('status-offline');
    text.textContent = 'Mode Lokal (Offline)';
    indicator.title = 'Penyimpanan lokal browser';
  }
}

function setupSupabaseRealtime() {
  if (!supabaseClient || realtimeChannel) return;
  try {
    realtimeChannel = supabaseClient
      .channel('public-schema-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        handleRealtimePayload(payload);
      })
      // BUGFIX #3: Dengarkan broadcast event 'reset' dari admin
      .on('broadcast', { event: 'reset' }, (payload) => {
        handleResetBroadcast(payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime Supabase Active');
        }
      });
  } catch (e) {
    console.warn('Gagal mengaktifkan Realtime Supabase:', e);
  }
}

// BUGFIX #3: Handler untuk event reset dari user lain
function handleResetBroadcast(payload) {
  // Tampilkan notifikasi banner yang tidak bisa diabaikan
  showResetAlert(payload.payload && payload.payload.resetBy ? payload.payload.resetBy : 'Admin');
  // Tunggu 3 detik agar user bisa membaca, lalu reload
  setTimeout(() => {
    state.students = [];
    state.teachers = [];
    state.attendance = [];
    state.lateLogs = [];
    state.violations = [];
    state.izinPulang = [];
    state.jurnalGuru = [];
    state.kaihLogs = [];
    clearDeletedStudentIds();
    localStorage.removeItem('schoolDb');
    saveLocalState();
    refreshAllUI();
    window.location.reload();
  }, 4000);
}

// BUGFIX #3: Tampilkan banner alert reset yang mencolok
function showResetAlert(resetBy) {
  // Hapus banner lama jika ada
  const oldBanner = document.getElementById('reset-alert-banner');
  if (oldBanner) oldBanner.remove();

  const banner = document.createElement('div');
  banner.id = 'reset-alert-banner';
  banner.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:100%', 'z-index:99999',
    'background:linear-gradient(90deg,#c0392b,#e74c3c)',
    'color:#fff', 'text-align:center', 'padding:18px 24px',
    'font-size:16px', 'font-weight:600', 'font-family:Outfit,sans-serif',
    'box-shadow:0 4px 24px rgba(0,0,0,0.5)', 'animation:pulse 1s infinite alternate'
  ].join(';');
  banner.innerHTML = `
    ⚠️ <strong>ADMIN (${resetBy}) MERESET SEMUA DATA!</strong>
    — Halaman akan dimuat ulang dalam 4 detik...
    <style>@keyframes pulse{from{opacity:1}to{opacity:0.7}}</style>
  `;
  document.body.prepend(banner);
}

function handleRealtimePayload(payload) {
  const { table, eventType, new: newRow, old: oldRow } = payload;
  if (!table) return;

  const tableToKey = {
    'students': 'students',
    'teachers': 'teachers',
    'attendance': 'attendance',
    'late_logs': 'lateLogs',
    'violations': 'violations',
    'izin_pulang': 'izinPulang',
    'jurnal_guru': 'jurnalGuru',
    'kaih_logs': 'kaihLogs',
    'accounts': 'accounts'
  };

  const key = tableToKey[table];
  if (!key) {
    // Legacy school_data or unknown table
    syncPullFromSupabase(true);
    return;
  }

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    if (!newRow || !newRow.id) return;
    const list = state[key] || [];
    const idx = list.findIndex(i => String(i.id) === String(newRow.id));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...newRow };
    } else {
      list.unshift(newRow);
    }
    state[key] = list;
  } else if (eventType === 'DELETE') {
    if (oldRow && oldRow.id) {
      state[key] = (state[key] || []).filter(i => String(i.id) !== String(oldRow.id));
    }
  }

  saveLocalState();
  refreshAllUI();
}

async function syncPullFromSupabase(silent = true) {
  if (!supabaseClient) return false;
  try {
    let pulledFromTables = false;
    try {
      const [
        resStudents,
        resTeachers,
        resAttendance,
        resLate,
        resViolations,
        resIzin,
        resJurnal,
        resKaih,
        resAccounts
      ] = await Promise.all([
        supabaseClient.from('students').select('*'),
        supabaseClient.from('teachers').select('*'),
        supabaseClient.from('attendance').select('*'),
        supabaseClient.from('late_logs').select('*'),
        supabaseClient.from('violations').select('*'),
        supabaseClient.from('izin_pulang').select('*'),
        supabaseClient.from('jurnal_guru').select('*'),
        supabaseClient.from('kaih_logs').select('*'),
        supabaseClient.from('accounts').select('*')
      ]);

      const hasPerTableData = (resStudents.data && resStudents.data.length > 0) ||
                              (resTeachers.data && resTeachers.data.length > 0) ||
                              (resJurnal.data && resJurnal.data.length > 0) ||
                              (resAttendance.data && resAttendance.data.length > 0);

      // FIX DATA GURU: Jangan merge data cloud jika baru saja reset (< 10 detik)
      const lastResetAt = localStorage.getItem('lastResetAt');
      const justReset = lastResetAt && (Date.now() - new Date(lastResetAt).getTime()) < 10000;

      if (!justReset && !resStudents.error && !resTeachers.error && !resAttendance.error && hasPerTableData) {
        state.students = mergeListById(state.students, resStudents.data || []);
        state.teachers = mergeListById(state.teachers, resTeachers.data || []);
        state.attendance = mergeListById(state.attendance, resAttendance.data || [], 'id');
        state.lateLogs = mergeListById(state.lateLogs, resLate.data || [], 'id');
        state.violations = mergeListById(state.violations, resViolations.data || [], 'id');
        state.izinPulang = mergeListById(state.izinPulang, resIzin.data || [], 'id');
        state.jurnalGuru = mergeListById(state.jurnalGuru, resJurnal.data || [], 'id');
        state.kaihLogs = mergeListById(state.kaihLogs, resKaih.data || [], 'id');
        if (resAccounts.data && resAccounts.data.length > 0) {
          state.accounts = mergeListById(state.accounts, resAccounts.data, 'username');
        }
      }
    } catch (e) {
      console.warn('Pull per-tabel notice in app.js:', e);
    }

    // Always merge with school_data (single-row JSON table) to guarantee data from external forms is never missed
    try {
      const { data, error } = await supabaseClient
        .from('school_data')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (!error && data) {
        const lastLocalReset = localStorage.getItem('lastResetAt') || '';
        if (data.resetAt && data.resetAt !== lastLocalReset) {
          console.log('Detected cloud reset event at', data.resetAt);
          localStorage.setItem('lastResetAt', data.resetAt);
          state.students = [];
          state.teachers = [];
          state.attendance = [];
          state.lateLogs = [];
          state.violations = [];
          state.izinPulang = [];
          state.jurnalGuru = [];
          state.kaihLogs = [];
          clearDeletedStudentIds();
          saveLocalState();
          refreshAllUI();
          return true;
        }

        const cloudStudents = data.students || [];
        const cloudAttendance = data.attendance || [];
        const cloudLate = data.latelogs || data.lateLogs || [];
        const cloudViolations = data.violations || [];
        const cloudIzin = data.izinpulang || data.izinPulang || [];
        const cloudJurnal = data.jurnalguru || data.jurnalGuru || [];
        const cloudTeachers = data.teachers || [];
        const cloudKaih = data.kaihlogs || data.kaihLogs || [];
        const cloudAccounts = data.accounts || [];

        const deletedIds = getDeletedStudentIds();
        if (Array.isArray(cloudStudents) && cloudStudents.length > 0) {
          const validCloudStudents = deletedIds.size > 0 
            ? cloudStudents.filter(s => s && !deletedIds.has(String(s.id).trim()) && !deletedIds.has(String(s.nisn || '').trim()))
            : cloudStudents;
          state.students = mergeListById(state.students, validCloudStudents);
        }
        if (deletedIds.size > 0) {
          state.students = state.students.filter(s => s && !deletedIds.has(String(s.id).trim()) && !deletedIds.has(String(s.nisn || '').trim()));
        }
        if (Array.isArray(cloudAttendance) && cloudAttendance.length > 0) {
          state.attendance = mergeListById(state.attendance, cloudAttendance, 'id');
        }
        if (Array.isArray(cloudLate) && cloudLate.length > 0) {
          state.lateLogs = mergeListById(state.lateLogs, cloudLate, 'id');
        }
        if (Array.isArray(cloudViolations) && cloudViolations.length > 0) {
          state.violations = mergeListById(state.violations, cloudViolations, 'id');
        }
        if (Array.isArray(cloudIzin) && cloudIzin.length > 0) {
          state.izinPulang = mergeListById(state.izinPulang, cloudIzin, 'id');
        }
        if (Array.isArray(cloudJurnal) && cloudJurnal.length > 0) {
          state.jurnalGuru = mergeListById(state.jurnalGuru, cloudJurnal, 'id');
        }
        if (Array.isArray(cloudTeachers) && cloudTeachers.length > 0) {
          state.teachers = mergeListById(state.teachers, cloudTeachers);
        }
        if (Array.isArray(cloudKaih) && cloudKaih.length > 0) {
          state.kaihLogs = mergeListById(state.kaihLogs, cloudKaih, 'id');
        }
        if (Array.isArray(cloudAccounts) && cloudAccounts.length > 0) {
          state.accounts = mergeListById(state.accounts, cloudAccounts, 'username');
        }
      }
    } catch (e) {
      console.warn('Pull school_data notice in app.js:', e);
    }

    saveLocalState();
    refreshAllUI();
    checkAuthStatus();
    setupSupabaseRealtime();

    if (!silent) showToast('Data terbaru berhasil dimuat dari Supabase Cloud!', 'success');
    return true;
  } catch (err) {
    if (!silent) console.error('Supabase Pull Exception:', err);
    return false;
  }
}

async function syncPushToSupabase(silent = true) {
  if (!supabaseClient) return;

  const indicator = document.getElementById('sync-status-indicator');
  const text = document.getElementById('sync-status-text');
  if (indicator) {
    indicator.className = 'sync-status status-syncing';
    text.textContent = 'Menyinkronkan...';
  }

  try {
    // 1. Try Upserting to individual tables
    try {
      const promises = [];
      if (state.students && state.students.length > 0) {
        promises.push(supabaseClient.from('students').upsert(state.students, { onConflict: 'id' }));
      }
      if (state.teachers && state.teachers.length > 0) {
        promises.push(supabaseClient.from('teachers').upsert(state.teachers, { onConflict: 'id' }));
      }
      if (state.attendance && state.attendance.length > 0) {
        promises.push(supabaseClient.from('attendance').upsert(state.attendance, { onConflict: 'id' }));
      }
      if (state.lateLogs && state.lateLogs.length > 0) {
        promises.push(supabaseClient.from('late_logs').upsert(state.lateLogs, { onConflict: 'id' }));
      }
      if (state.violations && state.violations.length > 0) {
        promises.push(supabaseClient.from('violations').upsert(state.violations, { onConflict: 'id' }));
      }
      if (state.izinPulang && state.izinPulang.length > 0) {
        promises.push(supabaseClient.from('izin_pulang').upsert(state.izinPulang, { onConflict: 'id' }));
      }
      if (state.jurnalGuru && state.jurnalGuru.length > 0) {
        promises.push(supabaseClient.from('jurnal_guru').upsert(state.jurnalGuru, { onConflict: 'id' }));
      }
      if (state.kaihLogs && state.kaihLogs.length > 0) {
        promises.push(supabaseClient.from('kaih_logs').upsert(state.kaihLogs, { onConflict: 'id' }));
      }
      if (state.accounts && state.accounts.length > 0) {
        promises.push(supabaseClient.from('accounts').upsert(getAccountsList(), { onConflict: 'id' }));
      }
      if (promises.length > 0) {
        await Promise.all(promises);
      }
    } catch (e) {
      console.warn('Sync per-tabel error:', e);
    }

    // 2. Also update single row school_data with state arrays
    const payload = {
      id: 1,
      students: state.students || [],
      attendance: state.attendance || [],
      latelogs: state.lateLogs || [],
      violations: state.violations || [],
      izinpulang: state.izinPulang || [],
      jurnalguru: state.jurnalGuru || [],
      teachers: state.teachers || [],
      kaihlogs: state.kaihLogs || [],
      accounts: getAccountsList(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseClient
      .from('school_data')
      .upsert(payload, { onConflict: 'id' });

    if (error && !silent) {
      showToast(`Gagal menyinkron ke Supabase: ${error.message}`, 'error');
    } else if (!silent) {
      showToast('Data berhasil disimpan ke Supabase Cloud!', 'success');
    }
  } catch (error) {
    if (!silent) showToast(`Gagal menyinkron ke Supabase: ${error.message}`, 'error');
  } finally {
    updateSyncBadge();
  }
}

// Global loader toggle
function toggleLoader(show, text = 'Memuat...') {
  const overlay = document.getElementById('loading-overlay');
  const textEl = document.getElementById('loading-text');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
    if (textEl) textEl.textContent = text;
  }
}

// --- Toast Notifications ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';
  if (type === 'warning') iconName = 'alert-circle';

  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${message}</span>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  // Slide-in auto removal
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse ease-out forwards';
    setTimeout(() => {
      toast.remove();
    }, 350);
  }, 3500);
}

// --- Menu Routing & UI Switching ---
function toggleLaporanSubmenu(e) {
  if (e) e.stopPropagation();
  const group = document.getElementById('submenu-laporan-group');
  const submenu = document.getElementById('sidebar-laporan-submenu');
  if (submenu) {
    const isHidden = submenu.style.display === 'none' || !submenu.style.display;
    submenu.style.display = isHidden ? 'flex' : 'none';
    if (group) {
      if (isHidden) group.classList.add('open');
      else group.classList.remove('open');
    }
  }
}

function switchLaporanSubmenu(tabName) {
  switchMenu('laporan');
  switchLaporanTab(tabName);
}

function switchLaporanTab(tabName) {
  const tabs = document.querySelectorAll('#view-laporan .tab-button');
  tabs.forEach(t => t.classList.remove('active'));

  const activeTabBtn = document.getElementById(`tab-laporan-${tabName}`);
  if (activeTabBtn) activeTabBtn.classList.add('active');

  const contents = document.querySelectorAll('.laporan-tab-content');
  contents.forEach(c => c.classList.remove('active'));

  const activeContent = document.getElementById(`laporan-tab-${tabName}-content`);
  if (activeContent) activeContent.classList.add('active');

  const subItems = document.querySelectorAll('#sidebar-laporan-submenu .submenu-item');
  subItems.forEach(s => s.classList.remove('active'));
  const activeSubBtn = document.getElementById(`btn-submenu-laporan-${tabName}`);
  if (activeSubBtn) activeSubBtn.classList.add('active');
}

function toggleAkunSubmenu(e) {
  if (e) e.stopPropagation();
  const group = document.getElementById('submenu-akun-group');
  const submenu = document.getElementById('sidebar-akun-submenu');
  if (submenu) {
    const isHidden = submenu.style.display === 'none' || !submenu.style.display;
    submenu.style.display = isHidden ? 'flex' : 'none';
    if (group) {
      if (isHidden) group.classList.add('open');
      else group.classList.remove('open');
    }
  }
}

function switchAkunSubmenu(tabName) {
  switchMenu('akun');
  switchAkunTab(tabName);
}

function switchAkunTab(tabName) {
  const tabs = document.querySelectorAll('#view-akun .tab-button');
  tabs.forEach(t => t.classList.remove('active'));

  const activeTabBtn = document.getElementById(`tab-akun-${tabName}`);
  if (activeTabBtn) activeTabBtn.classList.add('active');

  const contents = document.querySelectorAll('.akun-tab-content');
  contents.forEach(c => {
    c.style.display = 'none';
    c.classList.remove('active');
  });

  const activeContent = document.getElementById(`akun-tab-${tabName}-content`);
  if (activeContent) {
    activeContent.style.display = 'block';
    activeContent.classList.add('active');
  }

  const subItems = document.querySelectorAll('#sidebar-akun-submenu .submenu-item');
  subItems.forEach(s => s.classList.remove('active'));
  const activeSubBtn = document.getElementById(`btn-submenu-akun-${tabName}`);
  if (activeSubBtn) activeSubBtn.classList.add('active');

  if (tabName === 'daftar') {
    renderAkunTable();
  }
  lucide.createIcons();
}

function init7KaihView() {
  populateClassSelect('7kaih-kelas');
  populateClassSelect('7kaih-filter-kelas');
  populateClassSelect('7kaih-lap-kelas');
  populateClassSelect('7kaih-rekap-kelas');

  const tglInput = document.getElementById('7kaih-tanggal');
  if (tglInput && !tglInput.value) {
    tglInput.value = new Date().toISOString().split('T')[0];
  }

  switch7KaihTab('form');
  render7KaihHistoryTable();
}

function switch7KaihTab(tabName) {
  const tabs = document.querySelectorAll('#view-7kaih .tab-button');
  tabs.forEach(t => t.classList.remove('active'));

  const activeTabBtn = document.getElementById(`tab-7kaih-${tabName}-btn`);
  if (activeTabBtn) activeTabBtn.classList.add('active');

  const contents = document.querySelectorAll('.7kaih-tab-content');
  contents.forEach(c => {
    c.style.display = 'none';
    c.classList.remove('active');
  });

  const activeContent = document.getElementById(`7kaih-tab-${tabName}-content`);
  if (activeContent) {
    activeContent.style.display = 'block';
    activeContent.classList.add('active');
  }

  if (tabName === 'laporan') {
    render7KaihLaporanTable();
  } else if (tabName === 'rekap') {
    render7KaihRekapTable();
  }
}

function switchMenu(menuName) {
  // Hide all views
  const views = document.querySelectorAll('.content-view');
  views.forEach(view => {
    view.classList.remove('active');
    view.style.display = '';
  });

  // Deactivate all sidebar items
  const menuButtons = document.querySelectorAll('.sidebar-menu .menu-item, .sidebar-footer .menu-item, .sidebar-submenu .submenu-item');
  menuButtons.forEach(btn => btn.classList.remove('active'));

  // Manage sidebar submenu state
  const submenuGroup = document.getElementById('submenu-laporan-group');
  const submenu = document.getElementById('sidebar-laporan-submenu');
  if (menuName !== 'laporan') {
    if (submenuGroup) submenuGroup.classList.remove('open');
    if (submenu) submenu.style.display = 'none';
  } else {
    if (submenuGroup) submenuGroup.classList.add('open');
    if (submenu) submenu.style.display = 'flex';
  }

  const akunSubmenuGroup = document.getElementById('submenu-akun-group');
  const akunSubmenu = document.getElementById('sidebar-akun-submenu');
  if (menuName !== 'akun') {
    if (akunSubmenuGroup) akunSubmenuGroup.classList.remove('open');
    if (akunSubmenu) akunSubmenu.style.display = 'none';
  } else {
    if (akunSubmenuGroup) akunSubmenuGroup.classList.add('open');
    if (akunSubmenu) akunSubmenu.style.display = 'flex';
  }

  // Show selected view
  const targetView = document.getElementById(`view-${menuName}`);
  if (targetView) {
    targetView.style.display = '';
    targetView.classList.add('active');
  }

  // Activate selected menu button
  const targetBtn = document.getElementById(`btn-menu-${menuName}`);
  if (targetBtn) targetBtn.classList.add('active');

  state.currentView = menuName;

  // Change Navbar Titles safely
  const titleEl = document.getElementById('page-title');
  const subtitleEl = document.getElementById('page-subtitle');
  
  const titleMap = {
    'dashboard': ['Dashboard Utama', 'Ringkasan data kehadiran dan siswa terlambat'],
    'upload': ['Upload Data Siswa', 'Impor daftar siswa menggunakan template berkas Excel'],
    'upload-guru': ['Upload Data Guru', 'Impor daftar guru dan mata pelajaran menggunakan template berkas Excel'],
    'absensi': ['Absensi Harian', 'Pencatatan daftar hadir siswa berdasarkan kelas'],
    'terlambat': ['Siswa Terlambat', 'Input pencatatan jam dan keterangan siswa datang terlambat'],
    'pelanggaran': ['Catatan Pelanggaran Siswa', 'Pencatatan rincian kejadian dan jenis pelanggaran aturan sekolah'],
    'izin-pulang': ['Siswa Izin Pulang', 'Pencatatan jam dan keterangan siswa izin pulang sekolah'],
    'rekap': ['Rekapitulasi Data', 'Rangkuman dan riwayat absensi & keterlambatan per bulan'],
    'jurnal-guru': ['Jurnal Guru', 'Dokumentasi pelaksanaan kegiatan pembelajaran harian'],
    'laporan': ['Unduh Laporan Bulanan', 'Ekspor hasil rekapitulasi data siswa ke berkas Microsoft Excel'],
    'github': ['Integrasi Awan GitHub', 'Konfigurasi akun dan repositori database online'],
    '7kaih': ['7 KAIH', 'Monitoring 7 Kebiasaan Anak Indonesia Hebat'],
    'akun': ['Manajemen Akun Pengguna', 'Kelola akun login untuk Admin, Guru Piket, dan OSIS']
  };

  if (titleMap[menuName]) {
    if (titleEl) titleEl.textContent = titleMap[menuName][0];
    if (subtitleEl) subtitleEl.textContent = titleMap[menuName][1];
  }

  try {
    if (menuName === 'dashboard') {
      renderDashboard();
    } else if (menuName === 'upload') {
      renderStudentListTable();
    } else if (menuName === 'upload-guru') {
      populateMapelSelect('filter-guru-mapel');
      renderTeacherListTable();
    } else if (menuName === 'absensi') {
      populateClassSelect('absensi-kelas');
      populateClassSelect('absensi-riwayat-kelas');
      loadAttendanceGrid();
      renderAttendanceHistoryTable();
    } else if (menuName === 'terlambat') {
      populateClassSelect('terlambat-kelas-select');
      renderLateLogsToday();
    } else if (menuName === 'pelanggaran') {
      populateClassSelect('pelanggaran-kelas-select');
      renderViolationsToday();
    } else if (menuName === 'izin-pulang') {
      populateClassSelect('izin-pulang-kelas-select');
      handleIzinPulangClassChange();
      renderIzinPulangToday();
    } else if (menuName === 'rekap') {
      populateClassSelect('rekap-kelas');
      loadRekapData();
    } else if (menuName === 'jurnal-guru') {
      initJurnalGuruForm();
      renderJurnalRiwayatTable();
    } else if (menuName === 'laporan') {
      switchLaporanTab('absensi');
    } else if (menuName === 'github') {
      updateStorageExplanation();
    } else if (menuName === '7kaih') {
      init7KaihView();
    } else if (menuName === 'akun') {
      switchAkunTab('daftar');
    }
  } catch (err) {
    console.error(`Error rendering view ${menuName}:`, err);
  }

  // Close modals or searchable dropdowns if any
  const lateDropdown = document.getElementById('terlambat-dropdown-list');
  if (lateDropdown) lateDropdown.style.display = 'none';
  const violationDropdown = document.getElementById('pelanggaran-dropdown-list');
  if (violationDropdown) violationDropdown.style.display = 'none';
  const izinPulangDropdown = document.getElementById('izin-pulang-dropdown-list');
  if (izinPulangDropdown) izinPulangDropdown.style.display = 'none';

  window.scrollTo(0, 0);
  lucide.createIcons();
}

// --- Data Refresh helper ---
function refreshAllUI() {
  if (state.currentView === 'dashboard') renderDashboard();
  if (state.currentView === 'upload') renderStudentListTable();
  if (state.currentView === 'upload-guru') renderTeacherListTable();
  if (state.currentView === 'absensi') { loadAttendanceGrid(); renderAttendanceHistoryTable(); }
  if (state.currentView === 'terlambat') renderLateLogsToday();
  if (state.currentView === 'pelanggaran') renderViolationsToday();
  if (state.currentView === 'izin-pulang') renderIzinPulangToday();
  if (state.currentView === 'rekap') loadRekapData();
  if (state.currentView === '7kaih') init7KaihView();
  if (state.currentView === 'akun') renderAkunTable();
}

// Populates dropdown lists with list of unique classes in students database
function populateClassSelect(elementId) {
  const select = document.getElementById(elementId);
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '';

  // Get distinct classes
  const classes = [...new Set(state.students.map(s => s.kelas))].sort();
  
  if (elementId === 'rekap-kelas' || elementId === 'filter-siswa-kelas' || elementId === 'absensi-riwayat-kelas') {
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = 'Semua Kelas';
    select.appendChild(optAll);
  } else {
    const optSelect = document.createElement('option');
    optSelect.value = '';
    optSelect.textContent = '-- Pilih Kelas --';
    select.appendChild(optSelect);
  }

  classes.forEach(cls => {
    const opt = document.createElement('option');
    opt.value = cls;
    opt.textContent = cls;
    select.appendChild(opt);
  });

  // Keep selected value if it still exists
  if (classes.includes(currentVal)) {
    select.value = currentVal;
  }
}

// ==========================================================================
// MENU 1: UPLOAD DATA SISWA
// ==========================================================================

function setupDragAndDrop() {
  const dropzone = document.getElementById('excel-dropzone');
  if (!dropzone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
      document.getElementById('excel-file-input').files = files;
      handleExcelUpload({ target: { files: files } });
    }
  }, false);
}

// Holds parsed temp students list before saving
let tempImportedStudents = [];

function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById('uploaded-file-name').textContent = `File terpilih: ${file.name}`;

  const reader = new FileReader();
  toggleLoader(true, 'Membaca file Excel...');
  
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);

      if (json.length === 0) {
        showToast('Berkas Excel kosong atau format tidak sesuai.', 'error');
        toggleLoader(false);
        return;
      }

      // Columns mapping: find appropriate keys (case insensitive check)
      const mappedStudents = [];
      const firstRow = json[0];
      
      const keyNama = Object.keys(firstRow).find(k => {
        const l = k.toLowerCase().trim();
        return l === 'nama' || l.includes('nama') || l.includes('siswa') || l.includes('name');
      });
      const keyNisn = Object.keys(firstRow).find(k => {
        const l = k.toLowerCase().trim();
        return l === 'nisn' || l.includes('nisn') || l.includes('nis') || l.includes('nomor') || l.includes('id');
      });
      const keyKelas = Object.keys(firstRow).find(k => {
        const l = k.toLowerCase().trim();
        return l === 'kelas' || l.includes('kelas') || l.includes('class') || l.includes('rombel');
      });

      if (!keyNama || !keyKelas) {
        showToast('Kolom "Nama" dan "Kelas" wajib ada di berkas Excel!', 'error');
        toggleLoader(false);
        return;
      }

      json.forEach((row, idx) => {
        const namaVal = row[keyNama] ? String(row[keyNama]).trim() : '';
        const nisnVal = keyNisn && row[keyNisn] ? String(row[keyNisn]).trim() : '';
        const kelasVal = row[keyKelas] ? String(row[keyKelas]).trim() : '';

        if (namaVal && kelasVal) {
          const finalNisn = nisnVal || `nisn_${Date.now()}_${idx}`;
          mappedStudents.push({
            id: finalNisn,
            nama: namaVal,
            nisn: finalNisn,
            kelas: kelasVal
          });
        }
      });

      if (mappedStudents.length === 0) {
        showToast('Tidak ada baris data siswa yang valid ditemukan.', 'warning');
        toggleLoader(false);
        return;
      }

      tempImportedStudents = mappedStudents;

      // Render Preview
      const previewBody = document.getElementById('import-preview-body');
      previewBody.innerHTML = '';
      mappedStudents.forEach((std, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td class="font-semibold">${std.nama}</td>
          <td>${std.nisn}</td>
          <td><span class="badge badge-success" style="background-color: var(--color-primary-glow); color: var(--color-primary);">${std.kelas}</span></td>
        `;
        previewBody.appendChild(tr);
      });

      document.getElementById('import-count').textContent = mappedStudents.length;
      document.getElementById('import-preview-section').style.display = 'block';
      showToast(`Berhasil membaca ${mappedStudents.length} siswa. Harap klik Simpan ke Database.`, 'info');

    } catch (error) {
      console.error(error);
      showToast('Gagal memproses file Excel.', 'error');
    } finally {
      toggleLoader(false);
    }
  };

  reader.readAsArrayBuffer(file);
}

function cancelImport() {
  tempImportedStudents = [];
  document.getElementById('import-preview-section').style.display = 'none';
  document.getElementById('excel-file-input').value = '';
  document.getElementById('uploaded-file-name').textContent = 'Belum ada file terpilih.';
  showToast('Impor data dibatalkan', 'info');
}

async function saveImportedStudents() {
  if (tempImportedStudents.length === 0) return;

  toggleLoader(true, 'Menyimpan data siswa...');
  try {
    let savedOnServer = false;
    if (state.storageMode === 'server') {
      try {
        const payload = tempImportedStudents.map(s => ({ nama: s.nama, nisn: s.nisn, kelas: s.kelas }));
        const res = await fetch('/api/siswa/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(r => r.json());
        
        if (!res.error) {
          savedOnServer = true;
          await loadData();
        }
      } catch (e) {
        console.warn('Gagal simpan ke server, fallback ke local/Supabase:', e);
      }
    }

    if (!savedOnServer) {
      clearDeletedStudentIds();
      const studentMap = new Map();
      (state.students || []).forEach(s => {
        const key = String(s.nisn || s.id).trim();
        studentMap.set(key, s);
      });

      tempImportedStudents.forEach(s => {
        const key = String(s.nisn || s.id).trim();
        studentMap.set(key, s);
      });

      state.students = Array.from(studentMap.values());
      await persistData();
    }

    // Clear and hide preview
    tempImportedStudents = [];
    document.getElementById('import-preview-section').style.display = 'none';
    const inputEl = document.getElementById('excel-file-input');
    if (inputEl) inputEl.value = '';
    const labelEl = document.getElementById('uploaded-file-name');
    if (labelEl) labelEl.textContent = 'Belum ada file terpilih.';

    populateClassSelect('filter-siswa-kelas');
    populateClassSelect('absensi-kelas');
    populateClassSelect('rekap-kelas');
    renderStudentListTable();
    showToast('Data siswa berhasil diimpor & disimpan!', 'success');
  } catch (error) {
    showToast(`Gagal menyimpan: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

function downloadExcelTemplate() {
  // Create workbook & sheet
  const wb = XLSX.utils.book_new();
  const data = [
    { Nama: 'Budi Santoso', NISN: '1023456789', Kelas: 'X RPL 1' },
    { Nama: 'Siti Rahma', NISN: '1098765432', Kelas: 'X RPL 1' },
    { Nama: 'Andi Wijaya', NISN: '1054321678', Kelas: 'XI TKJ 2' }
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');
  
  // Download file
  XLSX.writeFile(wb, 'Template_Data_Siswa.xlsx');
  showToast('Mengunduh file template...', 'info');
}

// Render registered students list in table below
function renderStudentListTable() {
  const body = document.getElementById('student-list-body');
  const searchName = (document.getElementById('search-siswa-nama')?.value || '').toLowerCase().trim();
  const filterClass = (document.getElementById('filter-siswa-kelas')?.value || '');

  body.innerHTML = '';

  let filtered = state.students;

  if (filterClass) {
    filtered = filtered.filter(s => s.kelas === filterClass);
  }

  if (searchName) {
    filtered = filtered.filter(s => s.nama.toLowerCase().includes(searchName) || s.nisn.includes(searchName));
  }

  // Populate filter class dropdown once if class list changes
  const clsSelect = document.getElementById('filter-siswa-kelas');
  if (clsSelect && clsSelect.options.length <= 1) {
    populateClassSelect('filter-siswa-kelas');
  }

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Tidak ada siswa yang sesuai filter.</td></tr>`;
    return;
  }

  filtered.forEach((std, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td class="font-semibold">${std.nama}</td>
      <td>${std.nisn}</td>
      <td><span class="badge badge-success" style="background-color: var(--color-primary-glow); color: var(--color-primary);">${std.kelas}</span></td>
      <td class="text-center">
        <button class="btn btn-secondary btn-sm" onclick="editStudent('${std.id}')" title="Edit Siswa"><i data-lucide="edit-3" style="width:14px;height:14px;"></i></button>
        <button class="btn btn-danger btn-sm ml-2" onclick="deleteStudent('${std.id}')" title="Hapus Siswa"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
      </td>
    `;
    body.appendChild(tr);
  });
  lucide.createIcons();
}

// Simple Student Add/Edit Modal control
function openStudentAddModal() {
  document.getElementById('student-modal-title').textContent = 'Tambah Siswa Baru';
  document.getElementById('student-modal-id').value = '';
  document.getElementById('student-modal-nama').value = '';
  document.getElementById('student-modal-nisn').value = '';
  document.getElementById('student-modal-kelas').value = '';
  document.getElementById('student-modal').style.display = 'flex';
}

function editStudent(id) {
  const std = state.students.find(s => s.id === id);
  if (!std) return;

  document.getElementById('student-modal-title').textContent = 'Edit Data Siswa';
  document.getElementById('student-modal-id').value = std.id;
  document.getElementById('student-modal-nama').value = std.nama;
  document.getElementById('student-modal-nisn').value = std.nisn;
  document.getElementById('student-modal-kelas').value = std.kelas;
  document.getElementById('student-modal').style.display = 'flex';
}

function closeStudentModal() {
  document.getElementById('student-modal').style.display = 'none';
}

async function handleStudentFormSubmit(event) {
  event.preventDefault();
  const id = (document.getElementById('student-modal-id')?.value || '');
  const nama = (document.getElementById('student-modal-nama')?.value || '').trim();
  const nisn = (document.getElementById('student-modal-nisn')?.value || '').trim();
  const kelas = (document.getElementById('student-modal-kelas')?.value || '').trim();

  if (!nama || !nisn || !kelas) {
    showToast('Harap isi semua kolom wajib!', 'warning');
    return;
  }

  toggleLoader(true, 'Menyimpan data siswa...');
  try {
    if (state.storageMode === 'server') {
      const payload = { id, nama, nisn, kelas };
      const res = await fetch('/api/siswa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());
      
      if (res.error) throw new Error(res.error);
      await loadData();
      closeStudentModal();
      renderStudentListTable();
      showToast('Data siswa berhasil disimpan!', 'success');
    } else {
      if (id) {
        // Edit mode
        const idx = state.students.findIndex(s => s.id === id);
        if (idx !== -1) {
          state.students[idx] = { id, nama, nisn, kelas };
        }
      } else {
        // Add mode
        // Check if NISN unique
        if (state.students.some(s => s.nisn === nisn)) {
          showToast('Siswa dengan NISN tersebut sudah terdaftar!', 'error');
          toggleLoader(false);
          return;
        }
        state.students.push({ id: nisn, nama, nisn, kelas });
      }

      await persistData();
      closeStudentModal();
      renderStudentListTable();
      showToast('Data siswa berhasil disimpan!', 'success');
    }
  } catch (error) {
    showToast(`Gagal menyimpan: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

async function deleteStudent(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus data siswa ini? Semua catatan absensi & keterlambatannya juga akan hilang.')) {
    return;
  }

  toggleLoader(true, 'Menghapus siswa...');
  try {
    if (state.storageMode === 'server') {
      const res = await fetch(`/api/siswa/${id}`, {
        method: 'DELETE'
      }).then(r => r.json());
      
      if (res.error) throw new Error(res.error);
      await loadData();
      renderStudentListTable();
      showToast('Data siswa berhasil dihapus!', 'success');
    } else {
      const targetId = String(id).trim();
      const std = state.students.find(s => String(s.id).trim() === targetId || String(s.nisn).trim() === targetId);
      const stdId = std ? String(std.id).trim() : targetId;
      const stdNisn = std ? String(std.nisn).trim() : targetId;

      // 1. Hapus dari state lokal
      state.students = state.students.filter(s => String(s.id).trim() !== stdId && String(s.nisn).trim() !== stdNisn);
      // 2. Cascade delete semua log terkait dari state lokal
      state.attendance = state.attendance.filter(a => String(a.student_id).trim() !== stdId && String(a.student_id).trim() !== stdNisn);
      state.lateLogs = state.lateLogs.filter(l => String(l.student_id).trim() !== stdId && String(l.student_id).trim() !== stdNisn);
      state.violations = state.violations.filter(v => String(v.student_id).trim() !== stdId && String(v.student_id).trim() !== stdNisn);
      state.izinPulang = state.izinPulang.filter(i => String(i.student_id).trim() !== stdId && String(i.student_id).trim() !== stdNisn);
      state.kaihLogs = state.kaihLogs.filter(k => String(k.student_id).trim() !== stdId && String(k.student_id).trim() !== stdNisn);

      // BUGFIX #2: Hapus LANGSUNG dari Supabase per-tabel (cascade delete di cloud)
      if (supabaseClient) {
        try {
          await Promise.allSettled([
            supabaseClient.from('students').delete().or(`id.eq.${stdId},nisn.eq.${stdNisn}`),
            supabaseClient.from('attendance').delete().or(`student_id.eq.${stdId},student_id.eq.${stdNisn}`),
            supabaseClient.from('late_logs').delete().or(`student_id.eq.${stdId},student_id.eq.${stdNisn}`),
            supabaseClient.from('violations').delete().or(`student_id.eq.${stdId},student_id.eq.${stdNisn}`),
            supabaseClient.from('izin_pulang').delete().or(`student_id.eq.${stdId},student_id.eq.${stdNisn}`),
            supabaseClient.from('kaih_logs').delete().or(`student_id.eq.${stdId},student_id.eq.${stdNisn}`)
          ]);
          // BUGFIX #2: Tidak lagi pakai localStorage deletedStudentIds — Supabase adalah sumber kebenaran
          // Hapus dari school_data (single-row JSON) juga
          const updatedPayload = {
            id: 1,
            students: state.students,
            attendance: state.attendance,
            latelogs: state.lateLogs,
            violations: state.violations,
            izinpulang: state.izinPulang,
            jurnalguru: state.jurnalGuru,
            teachers: state.teachers,
            kaihlogs: state.kaihLogs,
            accounts: getAccountsList(),
            updated_at: new Date().toISOString()
          };
          await supabaseClient.from('school_data').upsert(updatedPayload, { onConflict: 'id' });
        } catch (e) {
          console.warn('Per-table student delete notice:', e);
        }
      }

      // Simpan ke localStorage (tidak perlu track deletedStudentIds lagi)
      saveLocalState();
      renderStudentListTable();
      showToast('Data siswa beserta riwayatnya berhasil dihapus!', 'success');
    }
  } catch (error) {
    showToast(`Gagal menghapus: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

async function deleteAllStudents() {
  if (!confirm('Apakah Anda YAKIN ingin menghapus SELURUH data siswa?\n\nPERINGATAN: Seluruh data absensi, keterlambatan, pelanggaran, izin pulang, dan 7 KAIH juga akan IKUT TERHAPUS BERSIH! Data tidak dapat dikembalikan.')) {
    return;
  }

  toggleLoader(true, 'Menghapus seluruh data siswa dan riwayat log...');
  try {
    (state.students || []).forEach(s => {
      if (s.id) addDeletedStudentId(s.id);
      if (s.nisn) addDeletedStudentId(s.nisn);
    });

    state.students = [];
    state.attendance = [];
    state.lateLogs = [];
    state.violations = [];
    state.izinPulang = [];
    state.kaihLogs = [];

    await persistData();

    if (supabaseClient) {
      try {
        await Promise.all([
          supabaseClient.from('students').delete().neq('id', '___none___'),
          supabaseClient.from('attendance').delete().neq('id', '___none___'),
          supabaseClient.from('late_logs').delete().neq('id', '___none___'),
          supabaseClient.from('violations').delete().neq('id', '___none___'),
          supabaseClient.from('izin_pulang').delete().neq('id', '___none___'),
          supabaseClient.from('kaih_logs').delete().neq('id', '___none___')
        ]);
      } catch (e) {
        console.warn('Delete cloud tables error:', e);
      }
    }

    renderStudentListTable();
    refreshAllUI();
    showToast('Seluruh data siswa dan riwayat log berhasil dihapus bersih!', 'info');
  } catch (error) {
    showToast(`Gagal menghapus: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

// ==========================================================================
// MENU 1B: UPLOAD DATA GURU
// ==========================================================================

function setupDragAndDropGuru() {
  const dropzone = document.getElementById('excel-dropzone-guru');
  if (!dropzone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
      document.getElementById('excel-file-input-guru').files = files;
      handleExcelUploadGuru({ target: { files: files } });
    }
  }, false);
}

let tempImportedTeachers = [];

function handleExcelUploadGuru(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById('uploaded-file-name-guru').textContent = `File terpilih: ${file.name}`;

  const reader = new FileReader();
  toggleLoader(true, 'Membaca file Excel Data Guru...');
  
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);

      if (json.length === 0) {
        showToast('Berkas Excel kosong atau format tidak sesuai.', 'error');
        toggleLoader(false);
        return;
      }

      const mappedTeachers = [];
      const firstRow = json[0];
      
      const keyNip = Object.keys(firstRow).find(k => {
        const l = k.toLowerCase().trim();
        return l.includes('nip') || l.includes('nik') || l.includes('id');
      });
      const keyNama = Object.keys(firstRow).find(k => {
        const l = k.toLowerCase().trim();
        return l.includes('nama') || l.includes('guru');
      });
      const keyMapel = Object.keys(firstRow).find(k => {
        const l = k.toLowerCase().trim();
        return l.includes('mapel') || l.includes('pelajaran') || l.includes('mata');
      });

      if (!keyNama || !keyMapel) {
        showToast('Kolom "Nama Guru" dan "Mata Pelajaran" wajib ada di berkas Excel!', 'error');
        toggleLoader(false);
        return;
      }

      json.forEach((row, idx) => {
        const nipVal = keyNip && row[keyNip] ? String(row[keyNip]).trim() : '-';
        const namaVal = row[keyNama] ? String(row[keyNama]).trim() : '';
        const mapelVal = row[keyMapel] ? String(row[keyMapel]).trim() : '';
        if (namaVal && mapelVal) {
          mappedTeachers.push({
            id: 'guru_' + Date.now() + '_' + idx,
            nip: nipVal,
            nama: namaVal,
            mapel: mapelVal
          });
        }
      });

      if (mappedTeachers.length === 0) {
        showToast('Tidak ada baris data guru yang valid ditemukan.', 'warning');
        toggleLoader(false);
        return;
      }

      tempImportedTeachers = mappedTeachers;

      const previewBody = document.getElementById('import-preview-body-guru');
      previewBody.innerHTML = '';
      mappedTeachers.forEach((t, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td style="font-family: monospace; font-size: 13px;">${t.nip || '-'}</td>
          <td class="font-semibold">${t.nama}</td>
          <td><span class="badge badge-info" style="background-color: var(--color-primary-glow); color: var(--color-primary);">${t.mapel}</span></td>
        `;
        previewBody.appendChild(tr);
      });

      document.getElementById('import-count-guru').textContent = mappedTeachers.length;
      document.getElementById('import-preview-section-guru').style.display = 'block';
      showToast(`Berhasil membaca ${mappedTeachers.length} data guru. Klik Simpan ke Database.`, 'info');

    } catch (error) {
      console.error(error);
      showToast('Gagal memproses file Excel guru.', 'error');
    } finally {
      toggleLoader(false);
    }
  };

  reader.readAsArrayBuffer(file);
}

function cancelImportGuru() {
  tempImportedTeachers = [];
  document.getElementById('import-preview-section-guru').style.display = 'none';
  document.getElementById('excel-file-input-guru').value = '';
  document.getElementById('uploaded-file-name-guru').textContent = 'Belum ada file terpilih.';
  showToast('Impor data guru dibatalkan', 'info');
}

async function saveImportedTeachers() {
  if (tempImportedTeachers.length === 0) return;

  toggleLoader(true, 'Menyimpan data guru...');
  try {
    let savedOnServer = false;
    if (state.storageMode === 'server') {
      try {
        const payload = tempImportedTeachers.map(t => ({ nip: t.nip || '', nama: t.nama, mapel: t.mapel }));
        const res = await fetch('/api/guru/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(r => r.json());
        
        if (!res.error) {
          savedOnServer = true;
          await loadData();
        }
      } catch (e) {
        console.warn('Gagal simpan guru ke server, fallback ke local/Supabase:', e);
      }
    }

    if (!savedOnServer) {
      const teacherMap = new Map();
      (state.teachers || []).forEach(t => teacherMap.set(t.nama.toLowerCase(), t));
      tempImportedTeachers.forEach(t => {
        const key = t.nama.toLowerCase();
        if (teacherMap.has(key)) {
          const existing = teacherMap.get(key);
          existing.mapel = t.mapel;
          if (t.nip && t.nip !== '-') existing.nip = t.nip;
        } else {
          teacherMap.set(key, t);
        }
      });

      state.teachers = Array.from(teacherMap.values());
      await persistData();
    }

    tempImportedTeachers = [];
    document.getElementById('import-preview-section-guru').style.display = 'none';
    const inputEl = document.getElementById('excel-file-input-guru');
    if (inputEl) inputEl.value = '';
    const labelEl = document.getElementById('uploaded-file-name-guru');
    if (labelEl) labelEl.textContent = 'Belum ada file terpilih.';

    populateMapelSelect('filter-guru-mapel');
    renderTeacherListTable();
    showToast('Data guru berhasil diimpor & disimpan!', 'success');
  } catch (error) {
    showToast(`Gagal menyimpan: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

function downloadExcelTemplateGuru() {
  const wb = XLSX.utils.book_new();
  const data = [
    { "NIP": "198501152010011002", "Nama Guru": "Drs. H. Ahmad Dahlan", "Mata Pelajaran": "Matematika" },
    { "NIP": "199003202015022001", "Nama Guru": "Siti Aminah, S.Pd.", "Mata Pelajaran": "Bahasa Indonesia" },
    { "NIP": "197808122005011003", "Nama Guru": "Budi Prasetyo, M.Pd.", "Mata Pelajaran": "IPA Terpadu" },
    { "NIP": "199211052019031004", "Nama Guru": "Eka Saputra, S.Kom.", "Mata Pelajaran": "Informatika" },
    { "NIP": "198807182012022005", "Nama Guru": "Dra. Endang Lestari", "Mata Pelajaran": "Bahasa Inggris" }
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Template Guru');
  XLSX.writeFile(wb, 'Template_Data_Guru.xlsx');
  showToast('Mengunduh file template guru...', 'info');
}

function populateMapelSelect(elementId) {
  const select = document.getElementById(elementId);
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">Semua Mapel</option>';

  const mapels = [...new Set(state.teachers.map(t => t.mapel))].sort();
  mapels.forEach(m => {
    if (!m) return;
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    select.appendChild(opt);
  });

  if (mapels.includes(currentVal)) {
    select.value = currentVal;
  }
}

function renderTeacherListTable() {
  const body = document.getElementById('teacher-list-body');
  if (!body) return;

  const searchName = (document.getElementById('search-guru-nama')?.value || '').toLowerCase().trim();
  const filterMapel = document.getElementById('filter-guru-mapel')?.value || '';

  body.innerHTML = '';

  const filtered = state.teachers.filter(t => {
    const matchName = t.nama.toLowerCase().includes(searchName) || t.mapel.toLowerCase().includes(searchName) || (t.nip && t.nip.toLowerCase().includes(searchName));
    const matchMapel = !filterMapel || t.mapel === filterMapel;
    return matchName && matchMapel;
  });

  const mapelSelect = document.getElementById('filter-guru-mapel');
  if (mapelSelect && mapelSelect.options.length <= 1) {
    populateMapelSelect('filter-guru-mapel');
  }

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Belum ada data guru. Silakan impor dari Excel di atas atau tambah manual.</td></tr>`;
    return;
  }

  filtered.forEach((t, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td style="font-family: monospace; font-size: 13px;">${t.nip || '-'}</td>
      <td class="font-semibold">${t.nama}</td>
      <td><span class="badge badge-primary" style="background-color: rgba(99, 102, 241, 0.15); color: #818cf8;">${t.mapel}</span></td>
      <td class="text-center">
        <button class="btn btn-sm btn-icon btn-secondary mr-1" onclick="openTeacherModal('${t.id}')" title="Edit Data Guru">
          <i data-lucide="edit-3" style="width:14px;height:14px;"></i>
        </button>
        <button class="btn btn-sm btn-icon btn-danger" onclick="deleteTeacher('${t.id}')" title="Hapus Data Guru">
          <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
        </button>
      </td>
    `;
    body.appendChild(tr);
  });

  lucide.createIcons();
}

function openTeacherModal(id = null) {
  const modal = document.getElementById('teacher-modal');
  const title = document.getElementById('teacher-modal-title');
  const inputId = document.getElementById('teacher-modal-id');
  const inputNip = document.getElementById('teacher-modal-nip');
  const inputNama = document.getElementById('teacher-modal-nama');
  const inputMapel = document.getElementById('teacher-modal-mapel');

  if (!modal) return;

  if (id) {
    const t = state.teachers.find(item => item.id === String(id));
    if (t) {
      title.textContent = 'Edit Data Guru';
      inputId.value = t.id;
      if (inputNip) inputNip.value = t.nip || '';
      inputNama.value = t.nama;
      inputMapel.value = t.mapel;
    }
  } else {
    title.textContent = 'Tambah Guru Baru';
    inputId.value = '';
    if (inputNip) inputNip.value = '';
    inputNama.value = '';
    inputMapel.value = '';
  }

  modal.style.display = 'flex';
}

function closeTeacherModal() {
  const modal = document.getElementById('teacher-modal');
  if (modal) modal.style.display = 'none';
}

async function handleTeacherFormSubmit(e) {
  e.preventDefault();
  const id = (document.getElementById('teacher-modal-id')?.value || '');
  const nip = document.getElementById('teacher-modal-nip')?.value.trim() || '';
  const nama = (document.getElementById('teacher-modal-nama')?.value || '').trim();
  const mapel = (document.getElementById('teacher-modal-mapel')?.value || '').trim();

  if (!nama || !mapel) {
    showToast('Nama Guru dan Mapel wajib diisi!', 'warning');
    return;
  }

  toggleLoader(true, 'Menyimpan data guru...');
  try {
    if (state.storageMode === 'server') {
      if (id) {
        await fetch(`/api/guru/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nip, nama, mapel })
        });
      } else {
        await fetch('/api/guru', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nip, nama, mapel })
        });
      }
      await loadData();
    } else {
      if (id) {
        const idx = state.teachers.findIndex(t => t.id === id);
        if (idx !== -1) {
          state.teachers[idx].nip = nip;
          state.teachers[idx].nama = nama;
          state.teachers[idx].mapel = mapel;
        }
      } else {
        state.teachers.push({
          id: 'guru_' + Date.now(),
          nip,
          nama,
          mapel
        });
      }
      await persistData();
    }

    closeTeacherModal();
    populateMapelSelect('filter-guru-mapel');
    renderTeacherListTable();
    showToast('Data guru berhasil disimpan!', 'success');
  } catch (err) {
    showToast(`Gagal menyimpan data guru: ${err.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

async function deleteTeacher(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus data guru ini?')) return;

  toggleLoader(true, 'Menghapus data guru...');
  try {
    if (state.storageMode === 'server') {
      await fetch(`/api/guru/${id}`, { method: 'DELETE' });
      await loadData();
    } else {
      state.teachers = state.teachers.filter(t => String(t.id).trim() !== String(id).trim() && String(t.nip || '').trim() !== String(id).trim());
      if (supabaseClient) {
        try {
          await supabaseClient.from('teachers').delete().or(`id.eq.${id},nip.eq.${id}`);
        } catch (e) {}
      }
      await persistData();
    }

    populateMapelSelect('filter-guru-mapel');
    renderTeacherListTable();
    showToast('Data guru berhasil dihapus!', 'success');
  } catch (err) {
    showToast(`Gagal menghapus: ${err.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

// ==========================================================================
// MENU 2: ABSENSI SISWA
// ==========================================================================

function renderAttendanceHistoryTable() {
  const tbody = document.getElementById('attendance-history-table-body');
  const classSelect = document.getElementById('absensi-riwayat-kelas');
  const monthSelect = document.getElementById('absensi-riwayat-bulan');
  
  if (classSelect && classSelect.options.length <= 1) {
    populateClassSelect('absensi-riwayat-kelas');
  }

  const classFilter = classSelect ? classSelect.value : '';
  const monthFilter = monthSelect ? monthSelect.value : '';

  if (!tbody) return;
  tbody.innerHTML = '';

  state.attendance = state.attendance || [];
  let list = [...state.attendance];

  if (classFilter) {
    list = list.filter(a => {
      const student = state.students.find(s => String(s.id) === String(a.student_id) || String(s.nisn) === String(a.student_id));
      return student && student.kelas === classFilter;
    });
  }

  if (monthFilter) {
    list = list.filter(a => {
      if (!a.tanggal) return false;
      const parts = a.tanggal.split('-'); // YYYY-MM-DD
      return parts.length >= 2 && parts[1] === monthFilter;
    });
  }

  list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Belum ada riwayat log absensi sesuai filter.</td></tr>`;
    return;
  }

  list.forEach((log, idx) => {
    const student = state.students.find(s => String(s.id) === String(log.student_id) || String(s.nisn) === String(log.student_id)) || { nama: 'Siswa Terhapus', kelas: '-' };
    let badgeClass = 'badge-success';
    if (log.status === 'sakit') badgeClass = 'badge-warning';
    if (log.status === 'izin') badgeClass = 'badge-info';
    if (log.status === 'alpha') badgeClass = 'badge-danger';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-center">${idx + 1}</td>
      <td><strong>${log.tanggal || '-'}</strong></td>
      <td class="font-semibold">${student.nama}</td>
      <td><span class="badge badge-success" style="background-color: var(--color-primary-glow); color: var(--color-primary);">${student.kelas}</span></td>
      <td class="text-center"><span class="badge ${badgeClass}">${(log.status || 'hadir').toUpperCase()}</span></td>
      <td>${log.keterangan || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
  lucide.createIcons();
}

function loadAttendanceGrid() {
  const selectKelas = document.getElementById('absensi-kelas');
  const dateInput = document.getElementById('absensi-tanggal');
  
  if (selectKelas.options.length <= 1) {
    populateClassSelect('absensi-kelas');
  }

  const kelas = selectKelas.value;
  const tanggal = dateInput.value;

  const panel = document.getElementById('attendance-panel');
  const emptyState = document.getElementById('attendance-empty-state');
  
  if (!kelas || !tanggal) {
    panel.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  // Hide empty state, show grid
  emptyState.style.display = 'none';
  panel.style.display = 'block';
  
  document.getElementById('attendance-panel-subtitle').textContent = `Kelas: ${kelas} | Tanggal: ${formatLocalDate(tanggal)}`;

  // Filter students of selected class
  const classStudents = state.students.filter(s => s.kelas === kelas);
  const body = document.getElementById('attendance-grid-body');
  body.innerHTML = '';

  if (classStudents.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Belum ada data siswa di kelas ini. Silakan tambahkan/unggah data siswa kelas ${kelas} di menu Upload.</td></tr>`;
    return;
  }

  // Load existing attendance for this class & date
  const existingRecordsMap = new Map();
  state.attendance
    .filter(a => a.tanggal === tanggal)
    .forEach(a => existingRecordsMap.set(a.student_id, a));

  classStudents.forEach((std, idx) => {
    const record = existingRecordsMap.get(std.id) || null;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td class="font-semibold">${std.nama}</td>
      <td>${std.nisn}</td>
      <td>
        <div class="attendance-options">
          <input type="radio" name="att-${std.id}" id="hadir-${std.id}" value="hadir" class="attendance-radio-input input-hadir" ${record && record.status === 'hadir' ? 'checked' : ''}>
          <label for="hadir-${std.id}" class="attendance-radio-label">HADIR</label>

          <input type="radio" name="att-${std.id}" id="sakit-${std.id}" value="sakit" class="attendance-radio-input input-sakit" ${record && record.status === 'sakit' ? 'checked' : ''}>
          <label for="sakit-${std.id}" class="attendance-radio-label">SAKIT</label>

          <input type="radio" name="att-${std.id}" id="izin-${std.id}" value="izin" class="attendance-radio-input input-izin" ${record && record.status === 'izin' ? 'checked' : ''}>
          <label for="izin-${std.id}" class="attendance-radio-label">IZIN</label>

          <input type="radio" name="att-${std.id}" id="alpha-${std.id}" value="alpha" class="attendance-radio-input input-alpha" ${record && record.status === 'alpha' ? 'checked' : ''}>
          <label for="alpha-${std.id}" class="attendance-radio-label">ALPHA</label>
        </div>
      </td>
      <td>
        <input type="text" id="ket-${std.id}" class="form-input form-input-sm" value="${record ? (record.keterangan || '') : ''}" placeholder="Keterangan (opsional)">
      </td>
    `;
    body.appendChild(tr);
  });
}

function bulkSetAttendance(status) {
  const selectKelas = (document.getElementById('absensi-kelas')?.value || '');
  const classStudents = state.students.filter(s => s.kelas === selectKelas);
  classStudents.forEach(std => {
    const radio = document.getElementById(`${status}-${std.id}`);
    if (radio) radio.checked = true;
  });
  showToast(`Semua siswa di-set ${status.toUpperCase()}`, 'info');
}

async function saveAttendance() {
  const selectKelas = (document.getElementById('absensi-kelas')?.value || '');
  const tanggal = (document.getElementById('absensi-tanggal')?.value || '');
  
  if (!selectKelas || !tanggal) return;

  const classStudents = state.students.filter(s => s.kelas === selectKelas);
  if (classStudents.length === 0) return;

  toggleLoader(true, 'Menyimpan data absensi...');
  
  try {
    if (state.storageMode === 'server') {
      const payload = classStudents.filter(std => document.querySelector(`input[name="att-${std.id}"]:checked`)).map(std => {
        const selectedRadio = document.querySelector(`input[name="att-${std.id}"]:checked`);
        const status = selectedRadio.value;
        const keterangan = (document.getElementById(`ket-${std.id}`)?.value || '').trim();
        return {
          siswa_id: std.id,
          tanggal,
          status,
          keterangan
        };
      });

      const res = await fetch('/api/absensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());
      
      if (res.error) throw new Error(res.error);
      await loadData();
      showToast('Data absensi kelas berhasil disimpan!', 'success');
    } else {
      // Remove old attendance records of this class on this date to replace
      const studentIdsSet = new Set(classStudents.map(s => s.id));
      state.attendance = state.attendance.filter(a => !(a.tanggal === tanggal && studentIdsSet.has(a.student_id)));

      // Read new records from UI
      classStudents.forEach(std => {
        const selectedRadio = document.querySelector(`input[name="att-${std.id}"]:checked`);
        if (!selectedRadio) return;
        const status = selectedRadio.value;
        const keterangan = (document.getElementById(`ket-${std.id}`)?.value || '').trim();
        
        state.attendance.push({
          id: `${tanggal}_${std.id}`,
          student_id: std.id,
          tanggal,
          status,
          keterangan
        });
      });

      await persistData();
      showToast('Data absensi kelas berhasil disimpan!', 'success');
    }
  } catch (error) {
    showToast(`Gagal menyimpan absensi: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

// ==========================================================================
// MENU 3: SISWA TERLAMBAT
// ==========================================================================

function handleLateClassChange() {
  const classSelect = document.getElementById('terlambat-kelas-select');
  const studentSelect = document.getElementById('terlambat-siswa-select');
  const hiddenId = document.getElementById('terlambat-siswa-id');
  const selectedClass = classSelect ? classSelect.value : '';

  if (!studentSelect) return;
  studentSelect.innerHTML = '';
  if (hiddenId) hiddenId.value = '';

  if (!selectedClass) {
    studentSelect.innerHTML = '<option value="">-- Pilih Kelas Terlebih Dahulu --</option>';
    studentSelect.disabled = true;
    return;
  }

  const classStudents = state.students.filter(s => s.kelas === selectedClass);
  if (classStudents.length === 0) {
    studentSelect.innerHTML = '<option value="">-- Tidak ada siswa di kelas ini --</option>';
    studentSelect.disabled = true;
    return;
  }

  studentSelect.innerHTML = '<option value="">-- Pilih Siswa --</option>';
  classStudents.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.nama} (${s.nisn})`;
    studentSelect.appendChild(opt);
  });

  studentSelect.disabled = false;
}

function handleLateStudentChange() {
  const studentSelect = document.getElementById('terlambat-siswa-select');
  const hiddenId = document.getElementById('terlambat-siswa-id');
  if (studentSelect && hiddenId) {
    hiddenId.value = studentSelect.value;
  }
}

async function handleLateSubmit(event) {
  event.preventDefault();

  const studentId = (document.getElementById('terlambat-siswa-id')?.value || '');
  const tanggal = (document.getElementById('terlambat-tanggal')?.value || '');
  const jam = (document.getElementById('terlambat-jam')?.value || '');
  const keterangan = (document.getElementById('terlambat-keterangan')?.value || '').trim();

  if (!studentId || !tanggal || !jam) {
    showToast('Harap pilih siswa, tanggal, dan jam terlambat!', 'warning');
    return;
  }

  toggleLoader(true, 'Mencatat keterlambatan...');
  try {
    if (state.storageMode === 'server') {
      const payload = {
        siswa_id: studentId,
        tanggal,
        jam,
        keterangan
      };

      const res = await fetch('/api/terlambat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());
      
      if (res.error) throw new Error(res.error);
      
      // Reset Form except date
      document.getElementById('terlambat-siswa-id').value = '';
      document.getElementById('terlambat-kelas-select').value = '';
      handleLateClassChange();
      document.getElementById('terlambat-keterangan').value = '';
      
      await loadData();
      showToast('Data keterlambatan berhasil dicatat!', 'success');
    } else {
      const newLog = {
        id: `late_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        student_id: studentId,
        tanggal,
        jam,
        keterangan
      };

      state.lateLogs.push(newLog);
      await persistData();

      // Reset Form except date
      document.getElementById('terlambat-siswa-id').value = '';
      document.getElementById('terlambat-kelas-select').value = '';
      handleLateClassChange();
      document.getElementById('terlambat-keterangan').value = '';
      
      // Refresh list
      renderLateLogsToday();
      showToast('Data keterlambatan berhasil dicatat!', 'success');
    }
  } catch (error) {
    showToast(`Gagal mencatat: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

function renderLateLogsToday() {
  const tanggal = (document.getElementById('terlambat-tanggal')?.value || '');
  const body = document.getElementById('late-today-table-body');
  const badge = document.getElementById('late-today-badge');

  body.innerHTML = '';
  
  if (!tanggal) return;

  const todayLates = state.lateLogs.filter(l => l.tanggal === tanggal);
  badge.textContent = `${todayLates.length} Siswa`;

  if (todayLates.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Belum ada siswa terlambat dicatat pada tanggal ini.</td></tr>`;
    return;
  }

  todayLates.forEach((log) => {
    const student = state.students.find(s => s.id === log.student_id) || { nama: 'Siswa Terhapus', kelas: '-', nisn: '-' };
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-semibold">${student.nama}</td>
      <td><span class="badge badge-success" style="background-color: var(--color-primary-glow); color: var(--color-primary);">${student.kelas}</span></td>
      <td class="text-warning font-semibold"><i data-lucide="clock" class="v-middle mr-1" style="width:14px;height:14px;"></i>${log.jam}</td>
      <td>${log.keterangan || '<span class="text-muted">-</span>'}</td>
      <td class="text-center">
        <button class="btn btn-danger btn-sm" onclick="deleteLateLog('${log.id}')" title="Hapus Catatan"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
      </td>
    `;
    body.appendChild(tr);
  });
  lucide.createIcons();
}

async function deleteLateLog(logId) {
  if (!confirm('Hapus catatan keterlambatan ini?')) return;

  toggleLoader(true, 'Menghapus catatan...');
  try {
    if (state.storageMode === 'server') {
      const res = await fetch(`/api/terlambat/${logId}`, {
        method: 'DELETE'
      }).then(r => r.json());
      
      if (res.error) throw new Error(res.error);
      await loadData();
      showToast('Catatan keterlambatan dihapus.', 'success');
    } else {
      state.lateLogs = state.lateLogs.filter(l => l.id !== logId);
      await persistData();
      renderLateLogsToday();
      showToast('Catatan keterlambatan dihapus.', 'success');
    }
  } catch (error) {
    showToast(`Gagal menghapus: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

// ==========================================================================
// MENU: CATATAN PELANGGARAN SISWA
// ==========================================================================

function handleViolationClassChange() {
  const classSelect = document.getElementById('pelanggaran-kelas-select');
  const studentSelect = document.getElementById('pelanggaran-siswa-select');
  const hiddenId = document.getElementById('pelanggaran-siswa-id');
  const selectedClass = classSelect ? classSelect.value : '';

  if (!studentSelect) return;
  studentSelect.innerHTML = '';
  if (hiddenId) hiddenId.value = '';

  if (!selectedClass) {
    studentSelect.innerHTML = '<option value="">-- Pilih Kelas Terlebih Dahulu --</option>';
    studentSelect.disabled = true;
    return;
  }

  const classStudents = state.students.filter(s => s.kelas === selectedClass);
  if (classStudents.length === 0) {
    studentSelect.innerHTML = '<option value="">-- Tidak ada siswa di kelas ini --</option>';
    studentSelect.disabled = true;
    return;
  }

  studentSelect.innerHTML = '<option value="">-- Pilih Siswa --</option>';
  classStudents.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.nama} (${s.nisn})`;
    studentSelect.appendChild(opt);
  });

  studentSelect.disabled = false;
}

function handleViolationStudentChange() {
  const studentSelect = document.getElementById('pelanggaran-siswa-select');
  const hiddenId = document.getElementById('pelanggaran-siswa-id');
  if (studentSelect && hiddenId) {
    hiddenId.value = studentSelect.value;
  }
}

async function handleViolationSubmit(event) {
  event.preventDefault();

  const studentId = (document.getElementById('pelanggaran-siswa-id')?.value || '');
  const tanggal = (document.getElementById('pelanggaran-tanggal')?.value || '');
  const jam = (document.getElementById('pelanggaran-jam')?.value || '');
  const keterangan = (document.getElementById('pelanggaran-keterangan')?.value || '').trim();

  if (!studentId || !tanggal || !jam || !keterangan) {
    showToast('Harap pilih siswa, tanggal, jam, dan isi keterangan pelanggaran!', 'warning');
    return;
  }

  toggleLoader(true, 'Mencatat pelanggaran...');
  try {
    if (state.storageMode === 'server') {
      const payload = {
        siswa_id: studentId,
        tanggal,
        jam,
        keterangan
      };

      const res = await fetch('/api/pelanggaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());
      
      if (res.error) throw new Error(res.error);
      
      // Reset Form except date
      const elId = document.getElementById('pelanggaran-siswa-id');
      const elClass = document.getElementById('pelanggaran-kelas-select');
      const elKet = document.getElementById('pelanggaran-keterangan');
      if (elId) elId.value = '';
      if (elClass) elClass.value = '';
      handleViolationClassChange();
      if (elKet) elKet.value = '';
      
      await loadData();
      showToast('Pelanggaran berhasil dicatat!', 'success');
    } else {
      const newViolation = {
        id: `violation_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        student_id: studentId,
        tanggal,
        jam,
        keterangan
      };

      state.violations = state.violations || [];
      state.violations.push(newViolation);
      await persistData();

      // Reset Form except date
      const elId = document.getElementById('pelanggaran-siswa-id');
      const elClass = document.getElementById('pelanggaran-kelas-select');
      const elKet = document.getElementById('pelanggaran-keterangan');
      if (elId) elId.value = '';
      if (elClass) elClass.value = '';
      handleViolationClassChange();
      if (elKet) elKet.value = '';
      
      // Refresh list
      renderViolationsToday();
      showToast('Pelanggaran berhasil dicatat!', 'success');
    }
  } catch (error) {
    showToast(`Gagal mencatat: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

function renderViolationsToday() {
  const tanggal = (document.getElementById('pelanggaran-tanggal')?.value || '');
  const body = document.getElementById('pelanggaran-today-table-body');
  const badge = document.getElementById('pelanggaran-today-badge');

  body.innerHTML = '';
  
  if (!tanggal) return;

  state.violations = state.violations || [];
  const todayViolations = state.violations.filter(v => v.tanggal === tanggal);
  badge.textContent = `${todayViolations.length} Kasus`;

  if (todayViolations.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Belum ada pelanggaran dicatat pada tanggal ini.</td></tr>`;
    return;
  }

  todayViolations.forEach((log) => {
    const student = state.students.find(s => s.id === log.student_id) || { nama: 'Siswa Terhapus', kelas: '-', nisn: '-' };
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-semibold">${student.nama}</td>
      <td><span class="badge badge-success" style="background-color: var(--color-primary-glow); color: var(--color-primary);">${student.kelas}</span></td>
      <td class="text-danger font-semibold"><i data-lucide="clock" class="v-middle mr-1" style="width:14px;height:14px;"></i>${log.jam}</td>
      <td>${log.keterangan}</td>
      <td class="text-center">
        <button class="btn btn-danger btn-sm" onclick="deleteViolationLog('${log.id}')" title="Hapus Catatan"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
      </td>
    `;
    body.appendChild(tr);
  });
  lucide.createIcons();
}

async function deleteViolationLog(logId) {
  if (!confirm('Hapus catatan pelanggaran ini?')) return;

  toggleLoader(true, 'Menghapus catatan...');
  try {
    if (state.storageMode === 'server') {
      const res = await fetch(`/api/pelanggaran/${logId}`, {
        method: 'DELETE'
      }).then(r => r.json());
      
      if (res.error) throw new Error(res.error);
      await loadData();
      showToast('Catatan pelanggaran dihapus.', 'success');
    } else {
      state.violations = state.violations.filter(v => v.id !== logId);
      await persistData();
      renderViolationsToday();
      showToast('Catatan pelanggaran dihapus.', 'success');
    }
  } catch (error) {
    showToast(`Gagal menghapus: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

// ==========================================================================
// MENU: SISWA IZIN PULANG
// ==========================================================================

function handleIzinPulangClassChange() {
  const classSelect = document.getElementById('izin-pulang-kelas-select');
  const studentSelect = document.getElementById('izin-pulang-siswa-select');
  const hiddenId = document.getElementById('izin-pulang-siswa-id');
  const selectedClass = classSelect ? classSelect.value : '';

  if (!studentSelect) return;
  studentSelect.innerHTML = '';
  if (hiddenId) hiddenId.value = '';

  if (!selectedClass) {
    studentSelect.innerHTML = '<option value="">-- Pilih Kelas Terlebih Dahulu --</option>';
    studentSelect.disabled = true;
    return;
  }

  const classStudents = state.students.filter(s => s.kelas === selectedClass);
  if (classStudents.length === 0) {
    studentSelect.innerHTML = '<option value="">-- Tidak ada siswa di kelas ini --</option>';
    studentSelect.disabled = true;
    return;
  }

  studentSelect.innerHTML = '<option value="">-- Pilih Siswa --</option>';
  classStudents.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.nama} (${s.nisn})`;
    studentSelect.appendChild(opt);
  });

  studentSelect.disabled = false;
}

function handleIzinPulangStudentChange() {
  const studentSelect = document.getElementById('izin-pulang-siswa-select');
  const hiddenId = document.getElementById('izin-pulang-siswa-id');
  if (studentSelect && hiddenId) {
    hiddenId.value = studentSelect.value;
  }
}

async function handleIzinPulangSubmit(event) {
  event.preventDefault();

  const studentId = (document.getElementById('izin-pulang-siswa-id')?.value || '');
  const tanggal = (document.getElementById('izin-pulang-tanggal')?.value || '');
  const jam = (document.getElementById('izin-pulang-jam')?.value || '');
  const keterangan = (document.getElementById('izin-pulang-keterangan')?.value || '').trim();
  const guruPiket = (document.getElementById('izin-pulang-guru-piket')?.value || '').trim();

  if (!studentId || !tanggal || !jam || !keterangan || !guruPiket) {
    showToast('Harap isi semua kolom wajib untuk izin pulang!', 'warning');
    return;
  }

  toggleLoader(true, 'Mencatat izin pulang...');
  try {
    if (state.storageMode === 'server') {
      const payload = {
        siswa_id: studentId,
        tanggal,
        jam,
        keterangan,
        guru_piket: guruPiket
      };

      const res = await fetch('/api/izin-pulang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());
      
      if (res.error) throw new Error(res.error);
      
      // Reset Form except date
      const elId = document.getElementById('izin-pulang-siswa-id');
      const elClass = document.getElementById('izin-pulang-kelas-select');
      const elKet = document.getElementById('izin-pulang-keterangan');
      const elGuru = document.getElementById('izin-pulang-guru-piket');
      if (elId) elId.value = '';
      if (elClass) elClass.value = '';
      handleIzinPulangClassChange();
      if (elKet) elKet.value = '';
      if (elGuru) elGuru.value = '';
      
      await loadData();
      showToast('Izin pulang berhasil dicatat!', 'success');
    } else {
      const newIzin = {
        id: `izin_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        student_id: studentId,
        tanggal,
        jam,
        keterangan,
        guru_piket: guruPiket
      };

      state.izinPulang = state.izinPulang || [];
      state.izinPulang.push(newIzin);
      await persistData();

      // Reset Form except date
      const elId = document.getElementById('izin-pulang-siswa-id');
      const elClass = document.getElementById('izin-pulang-kelas-select');
      const elKet = document.getElementById('izin-pulang-keterangan');
      const elGuru = document.getElementById('izin-pulang-guru-piket');
      if (elId) elId.value = '';
      if (elClass) elClass.value = '';
      handleIzinPulangClassChange();
      if (elKet) elKet.value = '';
      if (elGuru) elGuru.value = '';
      
      // Refresh list
      renderIzinPulangToday();
      showToast('Izin pulang berhasil dicatat!', 'success');
    }
  } catch (error) {
    showToast(`Gagal mencatat: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

function renderIzinPulangToday() {
  const tanggal = (document.getElementById('izin-pulang-tanggal')?.value || '');
  const body = document.getElementById('izin-pulang-today-table-body');
  const badge = document.getElementById('izin-pulang-today-badge');

  if (!body) return;

  body.innerHTML = '';
  
  if (!tanggal) return;

  state.izinPulang = state.izinPulang || [];
  const todayIzin = state.izinPulang.filter(ip => ip.tanggal === tanggal);
  if (badge) badge.textContent = `${todayIzin.length} Siswa`;

  if (todayIzin.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Belum ada siswa izin pulang dicatat pada tanggal ini.</td></tr>`;
    return;
  }

  todayIzin.forEach((log) => {
    const student = state.students.find(s => s.id === log.student_id) || { nama: 'Siswa Terhapus', kelas: '-', nisn: '-' };
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-semibold">${student.nama}</td>
      <td><span class="badge badge-success" style="background-color: rgba(14,165,233,0.15); color: #38bdf8;">${student.kelas}</span></td>
      <td class="text-info font-semibold"><i data-lucide="clock" class="v-middle mr-1" style="width:14px;height:14px;"></i>${log.jam}</td>
      <td>${log.keterangan}</td>
      <td class="font-semibold">${log.guru_piket}</td>
      <td class="text-center">
        <button class="btn btn-danger btn-sm" onclick="deleteIzinPulangLog('${log.id}')" title="Hapus Catatan"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
      </td>
    `;
    body.appendChild(tr);
  });
  lucide.createIcons();
}

async function deleteIzinPulangLog(logId) {
  if (!confirm('Hapus catatan izin pulang ini?')) return;

  toggleLoader(true, 'Menghapus catatan...');
  try {
    if (state.storageMode === 'server') {
      const res = await fetch(`/api/izin-pulang/${logId}`, {
        method: 'DELETE'
      }).then(r => r.json());
      
      if (res.error) throw new Error(res.error);
      await loadData();
      showToast('Catatan izin pulang dihapus.', 'success');
    } else {
      state.izinPulang = state.izinPulang.filter(ip => ip.id !== logId);
      await persistData();
      renderIzinPulangToday();
      showToast('Catatan izin pulang dihapus.', 'success');
    }
  } catch (error) {
    showToast(`Gagal menghapus: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

// ==========================================================================
// MENU 4: REKAP DATA SISWA
// ==========================================================================

let activeRekapTab = 'absensi';

function switchRekapTab(tabName) {
  activeRekapTab = tabName;
  
  const buttons = document.querySelectorAll('.tab-button');
  buttons.forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tab-rekap-${tabName}`).classList.add('active');

  const contents = document.querySelectorAll('.rekap-tab-content');
  contents.forEach(c => c.style.display = 'none');
  document.getElementById(`rekap-tab-${tabName}-content`).style.display = 'block';

  loadRekapData();
}

function loadRekapData() {
  const periodType = (document.getElementById('rekap-period-type')?.value || '');
  const semester = (document.getElementById('rekap-semester')?.value || '');
  const bulan = (document.getElementById('rekap-bulan')?.value || '');
  const tahun = (document.getElementById('rekap-tahun')?.value || '');
  const kelas = (document.getElementById('rekap-kelas')?.value || '');
  const search = (document.getElementById('rekap-search')?.value || '').toLowerCase().trim();
  
  // Update subtitle text to reflect period
  updateRekapSubtitle(periodType, bulan, semester, tahun, kelas);
  
  if (activeRekapTab === 'absensi') {
    renderRekapAbsensi(periodType, bulan, semester, tahun, kelas, search);
  } else if (activeRekapTab === 'terlambat') {
    renderRekapTerlambat(periodType, bulan, semester, tahun, kelas, search);
  } else if (activeRekapTab === 'pelanggaran') {
    renderRekapPelanggaran(periodType, bulan, semester, tahun, kelas, search);
  } else if (activeRekapTab === 'izin-pulang') {
    renderRekapIzinPulang(periodType, bulan, semester, tahun, kelas, search);
  }
}

function updateRekapSubtitle(periodType, bulan, semester, tahun, kelas) {
  const labelKelas = kelas ? `Kelas: ${kelas}` : 'Kelas: Semua Kelas';
  let labelPeriode = '';
  
  if (periodType === 'bulanan') {
    const monthSelect = document.getElementById('rekap-bulan');
    const monthName = monthSelect.options[monthSelect.selectedIndex].text;
    labelPeriode = `Bulan: ${monthName} ${tahun}`;
  } else if (periodType === 'semester') {
    labelPeriode = `Semester: Semester ${semester === 'genap' ? 'Genap (Jan - Jun)' : 'Ganjil (Jul - Des)'} ${tahun}`;
  } else if (periodType === 'tahunan') {
    labelPeriode = `Tahun: ${tahun}`;
  }
  
  const subtitleAbsensi = document.getElementById('rekap-absensi-subtitle');
  if (subtitleAbsensi) subtitleAbsensi.textContent = `${labelPeriode} | ${labelKelas}`;
  
  const subtitleTerlambat = document.getElementById('rekap-terlambat-subtitle');
  if (subtitleTerlambat) subtitleTerlambat.textContent = `${labelPeriode} | ${labelKelas}`;
  
  const subtitlePelanggaran = document.getElementById('rekap-pelanggaran-subtitle');
  if (subtitlePelanggaran) subtitlePelanggaran.textContent = `${labelPeriode} | ${labelKelas}`;

  const subtitleIzinPulang = document.getElementById('rekap-izin-pulang-subtitle');
  if (subtitleIzinPulang) subtitleIzinPulang.textContent = `${labelPeriode} | ${labelKelas}`;
}

function handleRekapPeriodTypeChange() {
  const type = (document.getElementById('rekap-period-type')?.value || '');
  const bulanContainer = document.getElementById('rekap-bulan-container');
  const semesterContainer = document.getElementById('rekap-semester-container');
  
  if (type === 'bulanan') {
    if (bulanContainer) bulanContainer.style.display = 'block';
    if (semesterContainer) semesterContainer.style.display = 'none';
  } else if (type === 'semester') {
    if (bulanContainer) bulanContainer.style.display = 'none';
    if (semesterContainer) semesterContainer.style.display = 'block';
  } else if (type === 'tahunan') {
    if (bulanContainer) bulanContainer.style.display = 'none';
    if (semesterContainer) semesterContainer.style.display = 'none';
  }
  
  loadRekapData();
}

function handleLaporanPeriodTypeChange(reportType) {
  const type = document.getElementById(`laporan-${reportType}-period-type`).value;
  const bulanContainer = document.getElementById(`laporan-${reportType}-bulan-container`);
  const semesterContainer = document.getElementById(`laporan-${reportType}-semester-container`);
  
  if (type === 'bulanan') {
    if (bulanContainer) bulanContainer.style.display = 'block';
    if (semesterContainer) semesterContainer.style.display = 'none';
  } else if (type === 'semester') {
    if (bulanContainer) bulanContainer.style.display = 'none';
    if (semesterContainer) semesterContainer.style.display = 'block';
  } else if (type === 'tahunan') {
    if (bulanContainer) bulanContainer.style.display = 'none';
    if (semesterContainer) semesterContainer.style.display = 'none';
  }
}

function filterDataByPeriod(dataArray, periodType, year, month, semester) {
  return (dataArray || []).filter(item => {
    if (!item.tanggal) return false;
    const [y, m, d] = item.tanggal.split('-');
    if (y !== year) return false;
    
    if (periodType === 'bulanan') {
      return m === month;
    } else if (periodType === 'semester') {
      const mNum = parseInt(m, 10);
      if (semester === 'genap') {
        return mNum >= 1 && mNum <= 6;
      } else {
        return mNum >= 7 && mNum <= 12;
      }
    } else if (periodType === 'tahunan') {
      return true;
    }
    return false;
  });
}

function renderRekapAbsensi(periodType, bulan, semester, tahun, kelas, search) {
  const body = document.getElementById('rekap-absensi-table-body');
  body.innerHTML = '';

  let filteredStudents = state.students;
  if (kelas) {
    filteredStudents = filteredStudents.filter(s => s.kelas === kelas);
  }
  if (search) {
    filteredStudents = filteredStudents.filter(s => s.nama.toLowerCase().includes(search) || s.nisn.includes(search));
  }

  if (filteredStudents.length === 0) {
    body.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">Tidak ada data siswa sesuai filter.</td></tr>`;
    return;
  }

  // Filter attendance of selected period
  const periodAtt = filterDataByPeriod(state.attendance, periodType, tahun, bulan, semester);

  filteredStudents.forEach((std, idx) => {
    const studentAtt = periodAtt.filter(a => a.student_id === std.id);
    
    let hadir = 0, sakit = 0, izin = 0, alpha = 0;
    studentAtt.forEach(a => {
      if (a.status === 'hadir') hadir++;
      else if (a.status === 'sakit') sakit++;
      else if (a.status === 'izin') izin++;
      else if (a.status === 'alpha') alpha++;
    });

    const totalMarked = hadir + sakit + izin + alpha;
    const persentase = totalMarked > 0 ? Math.round((hadir / totalMarked) * 100) : 100;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td class="text-left font-semibold">${std.nama}</td>
      <td>${std.kelas}</td>
      <td>${std.nisn}</td>
      <td class="text-success font-semibold">${hadir}</td>
      <td class="text-warning font-semibold">${sakit}</td>
      <td class="text-info font-semibold">${izin}</td>
      <td class="text-danger font-semibold">${alpha}</td>
      <td>
        <div class="d-flex align-center justify-center gap-2">
          <span class="font-semibold text-primary">${persentase}%</span>
          <div style="width: 50px; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
            <div style="width: ${persentase}%; height: 100%; background: linear-gradient(to right, var(--color-primary), var(--color-success));"></div>
          </div>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
}

function renderRekapTerlambat(periodType, bulan, semester, tahun, kelas, search) {
  const body = document.getElementById('rekap-terlambat-table-body');
  body.innerHTML = '';

  let filteredStudents = state.students;
  if (kelas) {
    filteredStudents = filteredStudents.filter(s => s.kelas === kelas);
  }
  if (search) {
    filteredStudents = filteredStudents.filter(s => s.nama.toLowerCase().includes(search) || s.nisn.includes(search));
  }

  if (filteredStudents.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Tidak ada data siswa sesuai filter.</td></tr>`;
    return;
  }

  // Filter late logs of selected period
  const periodLates = filterDataByPeriod(state.lateLogs, periodType, tahun, bulan, semester);

  let hasData = false;

  filteredStudents.forEach((std) => {
    const studentLates = periodLates.filter(l => l.student_id === std.id).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    if (studentLates.length === 0 && search === '') {
      return;
    }

    hasData = true;

    // Build details string
    let detailsHtml = '<span class="text-muted">Tidak terlambat</span>';
    if (studentLates.length > 0) {
      detailsHtml = studentLates.map(l => 
        `<span class="badge badge-warning" style="margin: 2px;" title="${l.keterangan || 'Tanpa keterangan'}">${formatLocalDate(l.tanggal)} (${l.jam})</span>`
      ).join(' ');
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${body.children.length + 1}</td>
      <td class="text-left font-semibold">${std.nama}</td>
      <td>${std.kelas}</td>
      <td>${std.nisn}</td>
      <td class="text-warning font-semibold text-center">${studentLates.length}x</td>
      <td class="text-left">${detailsHtml}</td>
    `;
    body.appendChild(tr);
  });

  if (!hasData) {
    body.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Tidak ada data keterlambatan periode ini.</td></tr>`;
  }
}

function renderRekapPelanggaran(periodType, bulan, semester, tahun, kelas, search) {
  const body = document.getElementById('rekap-pelanggaran-table-body');
  body.innerHTML = '';

  let filteredStudents = state.students;
  if (kelas) {
    filteredStudents = filteredStudents.filter(s => s.kelas === kelas);
  }
  if (search) {
    filteredStudents = filteredStudents.filter(s => s.nama.toLowerCase().includes(search) || s.nisn.includes(search));
  }

  if (filteredStudents.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Tidak ada data siswa sesuai filter.</td></tr>`;
    return;
  }

  // Filter violation logs of selected period
  state.violations = state.violations || [];
  const periodViolations = filterDataByPeriod(state.violations, periodType, tahun, bulan, semester);

  let hasData = false;

  filteredStudents.forEach((std) => {
    const studentViolations = periodViolations.filter(v => v.student_id === std.id).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    if (studentViolations.length === 0 && search === '') {
      return;
    }

    hasData = true;

    // Build details string
    let detailsHtml = '<span class="text-muted">Tidak ada pelanggaran</span>';
    if (studentViolations.length > 0) {
      detailsHtml = studentViolations.map(v => 
        `<span class="badge badge-danger" style="margin: 2px;" title="${v.keterangan}">${formatLocalDate(v.tanggal)} (${v.jam}): ${v.keterangan}</span>`
      ).join(' ');
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${body.children.length + 1}</td>
      <td class="text-left font-semibold">${std.nama}</td>
      <td>${std.kelas}</td>
      <td>${std.nisn}</td>
      <td class="text-danger font-semibold text-center">${studentViolations.length}x</td>
      <td class="text-left">${detailsHtml}</td>
    `;
    body.appendChild(tr);
  });

  if (!hasData) {
    body.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Tidak ada data pelanggaran periode ini.</td></tr>`;
  }
}

function renderRekapIzinPulang(periodType, bulan, semester, tahun, kelas, search) {
  const body = document.getElementById('rekap-izin-pulang-table-body');
  if (!body) return;
  body.innerHTML = '';

  let filteredStudents = state.students;
  if (kelas) {
    filteredStudents = filteredStudents.filter(s => s.kelas === kelas);
  }
  if (search) {
    filteredStudents = filteredStudents.filter(s => s.nama.toLowerCase().includes(search) || s.nisn.includes(search));
  }

  if (filteredStudents.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Tidak ada data siswa sesuai filter.</td></tr>`;
    return;
  }

  // Filter izin pulang logs of selected period
  state.izinPulang = state.izinPulang || [];
  const periodIzin = filterDataByPeriod(state.izinPulang, periodType, tahun, bulan, semester);

  let hasData = false;

  filteredStudents.forEach((std) => {
    const studentIzin = periodIzin.filter(ip => ip.student_id === std.id).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    if (studentIzin.length === 0 && search === '') {
      return;
    }

    hasData = true;

    // Build details string
    let detailsHtml = '<span class="text-muted">Tidak ada izin pulang</span>';
    if (studentIzin.length > 0) {
      detailsHtml = studentIzin.map(ip => 
        `<span class="badge badge-success" style="background-color: rgba(14,165,233,0.15); color: #38bdf8; margin: 2px;" title="Piket: ${ip.guru_piket} | Alasan: ${ip.keterangan}">${formatLocalDate(ip.tanggal)} (${ip.jam}): ${ip.keterangan} (Piket: ${ip.guru_piket})</span>`
      ).join(' ');
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${body.children.length + 1}</td>
      <td class="text-left font-semibold">${std.nama}</td>
      <td>${std.kelas}</td>
      <td>${std.nisn}</td>
      <td class="text-info font-semibold text-center">${studentIzin.length}x</td>
      <td class="text-left">${detailsHtml}</td>
    `;
    body.appendChild(tr);
  });

  if (!hasData) {
    body.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Tidak ada data izin pulang periode ini.</td></tr>`;
  }
}

// ==========================================================================
// MENU 5: UNDUH LAPORAN
// ==========================================================================

// ==========================================================================
// SUBMENU: UNDUH LAPORAN LOGIC & SINKRONISASI
// ==========================================================================

let activeLaporanTab = 'absensi';

function toggleLaporanSubmenu(event) {
  if (event) event.stopPropagation();
  
  const submenuGroup = document.getElementById('submenu-laporan-group');
  const submenu = document.getElementById('sidebar-laporan-submenu');
  
  const isCurrentlyOpen = submenuGroup.classList.contains('open');
  
  if (isCurrentlyOpen) {
    submenuGroup.classList.remove('open');
    if (submenu) submenu.style.display = 'none';
  } else {
    submenuGroup.classList.add('open');
    if (submenu) submenu.style.display = 'flex';
    switchMenu('laporan');
  }
}

function switchLaporanSubmenu(tabName) {
  switchMenu('laporan');
  switchLaporanTab(tabName);
  
  document.querySelectorAll('.sidebar-submenu .submenu-item').forEach(el => el.classList.remove('active'));
  const activeSubmenuBtn = document.getElementById(`btn-submenu-laporan-${tabName}`);
  if (activeSubmenuBtn) activeSubmenuBtn.classList.add('active');
}

function switchLaporanTab(tabName) {
  activeLaporanTab = tabName;
  const buttons = document.querySelectorAll('#view-laporan .tab-button');
  buttons.forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`tab-laporan-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');

  const contents = document.querySelectorAll('.laporan-tab-content');
  contents.forEach(c => c.style.display = 'none');
  const activeContent = document.getElementById(`laporan-tab-${tabName}-content`);
  if (activeContent) activeContent.style.display = 'block';

  // Highlight the correct submenu-item in the sidebar
  document.querySelectorAll('.sidebar-submenu .submenu-item').forEach(el => el.classList.remove('active'));
  const activeSubmenuBtn = document.getElementById(`btn-submenu-laporan-${tabName}`);
  if (activeSubmenuBtn) activeSubmenuBtn.classList.add('active');

  // Handle defaults
  handleLaporanScopeChange(tabName === 'absensi' ? 'absen' : tabName);
  
  // Set default period type to bulanan on switch
  const pTypeSelect = document.getElementById(`laporan-${tabName === 'absensi' ? 'absen' : tabName}-period-type`);
  if (pTypeSelect) {
    pTypeSelect.value = 'bulanan';
    handleLaporanPeriodTypeChange(tabName === 'absensi' ? 'absen' : tabName);
  }

  lucide.createIcons();
}

function handleLaporanScopeChange(reportType) {
  const scopeSelect = document.getElementById(`laporan-${reportType}-scope`);
  if (!scopeSelect) return;
  const scope = scopeSelect.value;
  
  const classContainer = document.getElementById(`laporan-${reportType}-kelas-container`);
  const studentContainer = document.getElementById(`laporan-${reportType}-siswa-container`);

  if (scope === 'semua') {
    if (classContainer) classContainer.style.display = 'none';
    if (studentContainer) studentContainer.style.display = 'none';
  } else if (scope === 'kelas') {
    if (classContainer) {
      classContainer.style.display = 'block';
      if (reportType === 'absen') populateClassSelect('laporan-absen-kelas');
      else if (reportType === 'terlambat') populateClassSelect('laporan-terlambat-kelas');
      else if (reportType === 'pelanggaran') populateClassSelect('laporan-pelanggaran-kelas');
      else if (reportType === 'izin-pulang') populateClassSelect('laporan-izin-pulang-kelas');
    }
    if (studentContainer) studentContainer.style.display = 'none';
  } else if (scope === 'siswa') {
    if (classContainer) classContainer.style.display = 'none';
    if (studentContainer) {
      studentContainer.style.display = 'block';
      // Reset search inputs
      document.getElementById(`laporan-${reportType}-siswa-search`).value = '';
      document.getElementById(`laporan-${reportType}-siswa-id`).value = '';
      
      const resultsWrapper = document.getElementById(`laporan-${reportType}-siswa-results-wrapper`);
      if (resultsWrapper) resultsWrapper.style.display = 'none';
    }
  }
}

function setLaporanScope(reportType, scope) {
  const scopeInput = document.getElementById(`laporan-${reportType}-scope`);
  if (scopeInput) scopeInput.value = scope;

  const segmentContainer = document.getElementById(`laporan-${reportType}-scope-segmented`);
  if (segmentContainer) {
    segmentContainer.querySelectorAll('.segment-button').forEach(btn => btn.classList.remove('active'));
    
    let activeBtnId = `btn-seg-${reportType}-${scope}`;
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) activeBtn.classList.add('active');
  }

  handleLaporanScopeChange(reportType);
  
  if (scope === 'siswa') {
    searchStudentForLaporan(reportType);
  }
}

function searchStudentForLaporan(reportType) {
  const searchInput = document.getElementById(`laporan-${reportType}-siswa-search`);
  const resultsWrapper = document.getElementById(`laporan-${reportType}-siswa-results-wrapper`);
  const resultsBody = document.getElementById(`laporan-${reportType}-siswa-results-body`);
  
  if (!searchInput || !resultsBody || !resultsWrapper) return;
  
  const query = searchInput.value.toLowerCase().trim();
  
  let filtered = state.students;
  if (query) {
    filtered = state.students.filter(s => 
      s.nama.toLowerCase().includes(query) || 
      s.nisn.includes(query) || 
      s.kelas.toLowerCase().includes(query)
    );
  } else {
    filtered = state.students.slice(0, 5);
  }
  
  resultsBody.innerHTML = '';
  
  if (filtered.length === 0) {
    resultsBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Siswa tidak ditemukan. Silakan masukkan nama/NISN yang tepat.</td></tr>`;
    resultsWrapper.style.display = 'block';
    return;
  }
  
  resultsWrapper.style.display = 'block';
  
  const selectedStudentId = document.getElementById(`laporan-${reportType}-siswa-id`).value;
  
  filtered.forEach(std => {
    const tr = document.createElement('tr');
    tr.id = `row-${reportType}-std-${std.id}`;
    if (std.id === selectedStudentId) {
      tr.className = 'selected-row';
    }
    
    tr.style.cursor = 'pointer';
    tr.onclick = (e) => {
      if (e.target.closest('button') || e.target.closest('i')) return;
      
      document.getElementById(`laporan-${reportType}-siswa-id`).value = std.id;
      document.getElementById(`laporan-${reportType}-siswa-search`).value = std.nama;
      
      resultsBody.querySelectorAll('tr').forEach(r => r.classList.remove('selected-row'));
      tr.classList.add('selected-row');
      
      showToast(`Terpilih: ${std.nama} (${std.kelas})`, 'success');
    };
    
    tr.innerHTML = `
      <td class="font-semibold text-left">${std.nama}</td>
      <td><span class="badge badge-success" style="background-color: var(--color-primary-glow); color: var(--color-primary);">${std.kelas}</span></td>
      <td>${std.nisn}</td>
      <td class="text-center">
        <button type="button" class="btn btn-success btn-icon-only btn-sm" onclick="downloadSingleStudentLaporan('${reportType}', '${std.id}', '${std.nama}')" title="Unduh Excel Instan">
          <i data-lucide="file-spreadsheet"></i>
        </button>
      </td>
    `;
    resultsBody.appendChild(tr);
  });
  
  lucide.createIcons();
}

function downloadSingleStudentLaporan(reportType, studentId, studentName) {
  const origScope = document.getElementById(`laporan-${reportType}-scope`).value;
  const origStudentId = document.getElementById(`laporan-${reportType}-siswa-id`).value;
  const origSearch = document.getElementById(`laporan-${reportType}-siswa-search`).value;
  
  document.getElementById(`laporan-${reportType}-scope`).value = 'siswa';
  document.getElementById(`laporan-${reportType}-siswa-id`).value = studentId;
  document.getElementById(`laporan-${reportType}-siswa-search`).value = studentName;
  
  if (reportType === 'absen') {
    downloadLaporanAbsensi();
  } else if (reportType === 'terlambat') {
    downloadLaporanTerlambat();
  } else if (reportType === 'pelanggaran') {
    downloadLaporanPelanggaran();
  } else if (reportType === 'izin-pulang') {
    downloadLaporanIzinPulang();
  }
  
  document.getElementById(`laporan-${reportType}-scope`).value = origScope;
  document.getElementById(`laporan-${reportType}-siswa-id`).value = origStudentId;
  document.getElementById(`laporan-${reportType}-siswa-search`).value = origSearch;
}

function downloadLaporanAbsensi() {
  const periodType = (document.getElementById('laporan-absen-period-type')?.value || '');
  const bulan = (document.getElementById('laporan-absen-bulan')?.value || '');
  const semester = (document.getElementById('laporan-absen-semester')?.value || '');
  const tahun = (document.getElementById('laporan-absen-tahun')?.value || '');
  const scope = (document.getElementById('laporan-absen-scope')?.value || '');

  let labelPeriode = '';
  let filenameSuffix = '';

  if (periodType === 'bulanan') {
    const labelBulan = document.getElementById('laporan-absen-bulan').options[document.getElementById('laporan-absen-bulan').selectedIndex].text;
    labelPeriode = `Bulan ${labelBulan} ${tahun}`;
    filenameSuffix = `${labelBulan}_${tahun}`;
  } else if (periodType === 'semester') {
    const semName = semester === 'genap' ? 'Genap' : 'Ganjil';
    labelPeriode = `Semester ${semName} ${tahun}`;
    filenameSuffix = `Semester_${semName}_${tahun}`;
  } else if (periodType === 'tahunan') {
    labelPeriode = `Tahun ${tahun}`;
    filenameSuffix = `Tahunan_${tahun}`;
  }

  let filteredStudents = state.students;
  let titleSuffix = 'Semua_Siswa_Dan_Kelas';

  if (scope === 'kelas') {
    const kelas = (document.getElementById('laporan-absen-kelas')?.value || '');
    if (!kelas) {
      showToast('Harap pilih kelas terlebih dahulu!', 'warning');
      return;
    }
    filteredStudents = filteredStudents.filter(s => s.kelas === kelas);
    titleSuffix = `Kelas_${kelas.replace(/\s+/g, '_')}`;
  } else if (scope === 'siswa') {
    const studentId = (document.getElementById('laporan-absen-siswa-id')?.value || '');
    const searchInput = (document.getElementById('laporan-absen-siswa-search')?.value || '').trim();
    if (!studentId) {
      showToast('Harap pilih siswa terlebih dahulu!', 'warning');
      return;
    }
    filteredStudents = filteredStudents.filter(s => s.id === studentId);
    titleSuffix = `Siswa_${searchInput.replace(/\s+/g, '_')}`;
  }

  if (filteredStudents.length === 0) {
    showToast('Data siswa kosong. Tidak ada data untuk diekspor.', 'warning');
    return;
  }

  toggleLoader(true, 'Menyusun laporan absensi...');

  try {
    const studentIds = new Set(filteredStudents.map(s => s.id));
    const periodAtt = filterDataByPeriod(state.attendance, periodType, tahun, bulan, semester)
      .filter(a => studentIds.has(a.student_id));

    // 1. Sheet 1: Rekapitulasi Akumulasi Bulanan/Semester/Tahunan
    const rekapData = filteredStudents.map((std, idx) => {
      const studentAtt = periodAtt.filter(a => a.student_id === std.id);
      let hadir = 0, sakit = 0, izin = 0, alpha = 0;
      studentAtt.forEach(a => {
        if (a.status === 'hadir') hadir++;
        else if (a.status === 'sakit') sakit++;
        else if (a.status === 'izin') izin++;
        else if (a.status === 'alpha') alpha++;
      });
      const totalMarked = hadir + sakit + izin + alpha;
      const persentase = totalMarked > 0 ? `${Math.round((hadir / totalMarked) * 100)}%` : '100%';

      return {
        'No': idx + 1,
        'Nama Siswa': std.nama,
        'Kelas': std.kelas,
        'NISN': std.nisn,
        'Hadir': hadir,
        'Sakit': sakit,
        'Izin': izin,
        'Alpha': alpha,
        'Persentase Kehadiran': persentase
      };
    });

    // 2. Sheet 2: Log Rincian Transaksi
    const logData = periodAtt.map((att, idx) => {
      const std = state.students.find(s => s.id === att.student_id) || { nama: 'Siswa Terhapus', kelas: '-', nisn: '-' };
      return {
        'No': idx + 1,
        'Tanggal': formatLocalDate(att.tanggal),
        'Nama Siswa': std.nama,
        'Kelas': std.kelas,
        'NISN': std.nisn,
        'Status': att.status.toUpperCase(),
        'Keterangan': att.keterangan || '-'
      };
    }).sort((a, b) => a.Tanggal.localeCompare(b.Tanggal));

    // Create Excel Workbook
    const wb = XLSX.utils.book_new();
    
    const wsRekap = XLSX.utils.json_to_sheet(rekapData);
    XLSX.utils.book_append_sheet(wb, wsRekap, `Rekap Absensi ${periodType === 'bulanan' ? 'Bulanan' : periodType === 'semester' ? 'Semester' : 'Tahunan'}`);
    
    if (logData.length > 0) {
      const wsLog = XLSX.utils.json_to_sheet(logData);
      XLSX.utils.book_append_sheet(wb, wsLog, 'Rincian Absensi Harian');
    }

    XLSX.writeFile(wb, `Laporan_Absensi_${titleSuffix}_${filenameSuffix}.xlsx`);
    showToast('Laporan absensi berhasil diunduh!', 'success');
  } catch (error) {
    showToast(`Gagal mengekspor laporan: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

function downloadLaporanTerlambat() {
  const periodType = (document.getElementById('laporan-terlambat-period-type')?.value || '');
  const bulan = (document.getElementById('laporan-terlambat-bulan')?.value || '');
  const semester = (document.getElementById('laporan-terlambat-semester')?.value || '');
  const tahun = (document.getElementById('laporan-terlambat-tahun')?.value || '');
  const scope = (document.getElementById('laporan-terlambat-scope')?.value || '');

  let labelPeriode = '';
  let filenameSuffix = '';

  if (periodType === 'bulanan') {
    const labelBulan = document.getElementById('laporan-terlambat-bulan').options[document.getElementById('laporan-terlambat-bulan').selectedIndex].text;
    labelPeriode = `Bulan ${labelBulan} ${tahun}`;
    filenameSuffix = `${labelBulan}_${tahun}`;
  } else if (periodType === 'semester') {
    const semName = semester === 'genap' ? 'Genap' : 'Ganjil';
    labelPeriode = `Semester ${semName} ${tahun}`;
    filenameSuffix = `Semester_${semName}_${tahun}`;
  } else if (periodType === 'tahunan') {
    labelPeriode = `Tahun ${tahun}`;
    filenameSuffix = `Tahunan_${tahun}`;
  }

  let filteredStudents = state.students;
  let titleSuffix = 'Semua_Siswa_Dan_Kelas';

  if (scope === 'kelas') {
    const kelas = (document.getElementById('laporan-terlambat-kelas')?.value || '');
    if (!kelas) {
      showToast('Harap pilih kelas terlebih dahulu!', 'warning');
      return;
    }
    filteredStudents = filteredStudents.filter(s => s.kelas === kelas);
    titleSuffix = `Kelas_${kelas.replace(/\s+/g, '_')}`;
  } else if (scope === 'siswa') {
    const studentId = (document.getElementById('laporan-terlambat-siswa-id')?.value || '');
    const searchInput = (document.getElementById('laporan-terlambat-siswa-search')?.value || '').trim();
    if (!studentId) {
      showToast('Harap pilih siswa terlebih dahulu!', 'warning');
      return;
    }
    filteredStudents = filteredStudents.filter(s => s.id === studentId);
    titleSuffix = `Siswa_${searchInput.replace(/\s+/g, '_')}`;
  }

  if (filteredStudents.length === 0) {
    showToast('Data siswa kosong. Tidak ada data untuk diekspor.', 'warning');
    return;
  }

  toggleLoader(true, 'Menyusun laporan keterlambatan...');

  try {
    const studentIds = new Set(filteredStudents.map(s => s.id));
    const periodLates = filterDataByPeriod(state.lateLogs, periodType, tahun, bulan, semester)
      .filter(l => studentIds.has(l.student_id));

    // 1. Sheet 1: Rincian Log Keterlambatan
    const logData = periodLates.map((log, idx) => {
      const std = state.students.find(s => s.id === log.student_id) || { nama: 'Siswa Terhapus', kelas: '-', nisn: '-' };
      return {
        'No': idx + 1,
        'Tanggal': formatLocalDate(log.tanggal),
        'Nama Siswa': std.nama,
        'Kelas': std.kelas,
        'NISN': std.nisn,
        'Jam': log.jam,
        'Keterangan': log.keterangan || '-'
      };
    }).sort((a, b) => a.Tanggal.localeCompare(b.Tanggal));

    // 2. Sheet 2: Rekap Frekuensi Terlambat
    const rekapData = filteredStudents.map((std, idx) => {
      const freq = periodLates.filter(l => l.student_id === std.id).length;
      return {
        'No': idx + 1,
        'Nama Siswa': std.nama,
        'Kelas': std.kelas,
        'NISN': std.nisn,
        'Frekuensi Terlambat (Kali)': freq
      };
    }).filter(row => row['Frekuensi Terlambat (Kali)'] > 0);

    if (logData.length === 0 && rekapData.length === 0) {
      showToast(`Tidak ada catatan siswa terlambat untuk filter terpilih pada ${labelPeriode}.`, 'warning');
      toggleLoader(false);
      return;
    }

    const wb = XLSX.utils.book_new();
    
    if (logData.length > 0) {
      const wsLog = XLSX.utils.json_to_sheet(logData);
      XLSX.utils.book_append_sheet(wb, wsLog, 'Rincian Siswa Terlambat');
    }

    if (rekapData.length > 0) {
      const wsRekap = XLSX.utils.json_to_sheet(rekapData);
      XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap Frekuensi Terlambat');
    }

    XLSX.writeFile(wb, `Laporan_Keterlambatan_${titleSuffix}_${filenameSuffix}.xlsx`);
    showToast('Laporan keterlambatan berhasil diunduh!', 'success');
  } catch (error) {
    showToast(`Gagal mengekspor laporan: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

function downloadLaporanPelanggaran() {
  const periodType = (document.getElementById('laporan-pelanggaran-period-type')?.value || '');
  const bulan = (document.getElementById('laporan-pelanggaran-bulan')?.value || '');
  const semester = (document.getElementById('laporan-pelanggaran-semester')?.value || '');
  const tahun = (document.getElementById('laporan-pelanggaran-tahun')?.value || '');
  const scope = (document.getElementById('laporan-pelanggaran-scope')?.value || '');

  let labelPeriode = '';
  let filenameSuffix = '';

  if (periodType === 'bulanan') {
    const labelBulan = document.getElementById('laporan-pelanggaran-bulan').options[document.getElementById('laporan-pelanggaran-bulan').selectedIndex].text;
    labelPeriode = `Bulan ${labelBulan} ${tahun}`;
    filenameSuffix = `${labelBulan}_${tahun}`;
  } else if (periodType === 'semester') {
    const semName = semester === 'genap' ? 'Genap' : 'Ganjil';
    labelPeriode = `Semester ${semName} ${tahun}`;
    filenameSuffix = `Semester_${semName}_${tahun}`;
  } else if (periodType === 'tahunan') {
    labelPeriode = `Tahun ${tahun}`;
    filenameSuffix = `Tahunan_${tahun}`;
  }

  let filteredStudents = state.students;
  let titleSuffix = 'Semua_Siswa_Dan_Kelas';

  if (scope === 'kelas') {
    const kelas = (document.getElementById('laporan-pelanggaran-kelas')?.value || '');
    if (!kelas) {
      showToast('Harap pilih kelas terlebih dahulu!', 'warning');
      return;
    }
    filteredStudents = filteredStudents.filter(s => s.kelas === kelas);
    titleSuffix = `Kelas_${kelas.replace(/\s+/g, '_')}`;
  } else if (scope === 'siswa') {
    const studentId = (document.getElementById('laporan-pelanggaran-siswa-id')?.value || '');
    const searchInput = (document.getElementById('laporan-pelanggaran-siswa-search')?.value || '').trim();
    if (!studentId) {
      showToast('Harap pilih siswa terlebih dahulu!', 'warning');
      return;
    }
    filteredStudents = filteredStudents.filter(s => s.id === studentId);
    titleSuffix = `Siswa_${searchInput.replace(/\s+/g, '_')}`;
  }

  if (filteredStudents.length === 0) {
    showToast('Data siswa kosong. Tidak ada data untuk diekspor.', 'warning');
    return;
  }

  toggleLoader(true, 'Menyusun laporan pelanggaran...');

  try {
    state.violations = state.violations || [];
    const studentIds = new Set(filteredStudents.map(s => s.id));
    const periodViolations = filterDataByPeriod(state.violations, periodType, tahun, bulan, semester)
      .filter(v => studentIds.has(v.student_id));

    // 1. Sheet 1: Rincian Log Pelanggaran
    const logData = periodViolations.map((log, idx) => {
      const std = state.students.find(s => s.id === log.student_id) || { nama: 'Siswa Terhapus', kelas: '-', nisn: '-' };
      return {
        'No': idx + 1,
        'Tanggal': formatLocalDate(log.tanggal),
        'Nama Siswa': std.nama,
        'Kelas': std.kelas,
        'NISN': std.nisn,
        'Jam': log.jam,
        'Keterangan Pelanggaran': log.keterangan || '-'
      };
    }).sort((a, b) => a.Tanggal.localeCompare(b.Tanggal));

    // 2. Sheet 2: Rekap Frekuensi Pelanggaran
    const rekapData = filteredStudents.map((std, idx) => {
      const freq = periodViolations.filter(v => v.student_id === std.id).length;
      return {
        'No': idx + 1,
        'Nama Siswa': std.nama,
        'Kelas': std.kelas,
        'NISN': std.nisn,
        'Jumlah Pelanggaran': freq
      };
    }).filter(row => row['Jumlah Pelanggaran'] > 0);

    if (logData.length === 0 && rekapData.length === 0) {
      showToast(`Tidak ada catatan pelanggaran siswa untuk filter terpilih pada ${labelPeriode}.`, 'warning');
      toggleLoader(false);
      return;
    }

    const wb = XLSX.utils.book_new();
    
    if (logData.length > 0) {
      const wsLog = XLSX.utils.json_to_sheet(logData);
      XLSX.utils.book_append_sheet(wb, wsLog, 'Rincian Pelanggaran');
    }

    if (rekapData.length > 0) {
      const wsRekap = XLSX.utils.json_to_sheet(rekapData);
      XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap Frekuensi Pelanggaran');
    }

    XLSX.writeFile(wb, `Laporan_Pelanggaran_${titleSuffix}_${filenameSuffix}.xlsx`);
    showToast('Laporan pelanggaran berhasil diunduh!', 'success');
  } catch (error) {
    showToast(`Gagal mengekspor laporan: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

function downloadLaporanIzinPulang() {
  const periodType = (document.getElementById('laporan-izin-pulang-period-type')?.value || '');
  const bulan = (document.getElementById('laporan-izin-pulang-bulan')?.value || '');
  const semester = (document.getElementById('laporan-izin-pulang-semester')?.value || '');
  const tahun = (document.getElementById('laporan-izin-pulang-tahun')?.value || '');
  const scope = (document.getElementById('laporan-izin-pulang-scope')?.value || '');

  let labelPeriode = '';
  let filenameSuffix = '';

  if (periodType === 'bulanan') {
    const labelBulan = document.getElementById('laporan-izin-pulang-bulan').options[document.getElementById('laporan-izin-pulang-bulan').selectedIndex].text;
    labelPeriode = `Bulan ${labelBulan} ${tahun}`;
    filenameSuffix = `${labelBulan}_${tahun}`;
  } else if (periodType === 'semester') {
    const semName = semester === 'genap' ? 'Genap' : 'Ganjil';
    labelPeriode = `Semester ${semName} ${tahun}`;
    filenameSuffix = `Semester_${semName}_${tahun}`;
  } else if (periodType === 'tahunan') {
    labelPeriode = `Tahun ${tahun}`;
    filenameSuffix = `Tahunan_${tahun}`;
  }

  let filteredStudents = state.students;
  let titleSuffix = 'Semua_Siswa_Dan_Kelas';

  if (scope === 'kelas') {
    const kelas = (document.getElementById('laporan-izin-pulang-kelas')?.value || '');
    if (!kelas) {
      showToast('Harap pilih kelas terlebih dahulu!', 'warning');
      return;
    }
    filteredStudents = filteredStudents.filter(s => s.kelas === kelas);
    titleSuffix = `Kelas_${kelas.replace(/\s+/g, '_')}`;
  } else if (scope === 'siswa') {
    const studentId = (document.getElementById('laporan-izin-pulang-siswa-id')?.value || '');
    const searchInput = (document.getElementById('laporan-izin-pulang-siswa-search')?.value || '').trim();
    if (!studentId) {
      showToast('Harap pilih siswa terlebih dahulu!', 'warning');
      return;
    }
    filteredStudents = filteredStudents.filter(s => s.id === studentId);
    titleSuffix = `Siswa_${searchInput.replace(/\s+/g, '_')}`;
  }

  if (filteredStudents.length === 0) {
    showToast('Data siswa kosong. Tidak ada data untuk diekspor.', 'warning');
    return;
  }

  toggleLoader(true, 'Menyusun laporan izin pulang...');

  try {
    state.izinPulang = state.izinPulang || [];
    const studentIds = new Set(filteredStudents.map(s => s.id));
    const periodIzin = filterDataByPeriod(state.izinPulang, periodType, tahun, bulan, semester)
      .filter(ip => studentIds.has(ip.student_id));

    // 1. Sheet 1: Rincian Log Izin Pulang
    const logData = periodIzin.map((log, idx) => {
      const std = state.students.find(s => s.id === log.student_id) || { nama: 'Siswa Terhapus', kelas: '-', nisn: '-' };
      return {
        'No': idx + 1,
        'Tanggal': formatLocalDate(log.tanggal),
        'Nama Siswa': std.nama,
        'Kelas': std.kelas,
        'NISN': std.nisn,
        'Jam': log.jam,
        'Alasan/Keterangan': log.keterangan || '-',
        'Guru Piket': log.guru_piket || '-'
      };
    }).sort((a, b) => a.Tanggal.localeCompare(b.Tanggal));

    // 2. Sheet 2: Rekap Frekuensi Izin Pulang
    const rekapData = filteredStudents.map((std, idx) => {
      const freq = periodIzin.filter(ip => ip.student_id === std.id).length;
      return {
        'No': idx + 1,
        'Nama Siswa': std.nama,
        'Kelas': std.kelas,
        'NISN': std.nisn,
        'Jumlah Izin Pulang': freq
      };
    }).filter(row => row['Jumlah Izin Pulang'] > 0);

    if (logData.length === 0 && rekapData.length === 0) {
      showToast(`Tidak ada catatan izin pulang siswa untuk filter terpilih pada ${labelPeriode}.`, 'warning');
      toggleLoader(false);
      return;
    }

    const wb = XLSX.utils.book_new();
    
    if (logData.length > 0) {
      const wsLog = XLSX.utils.json_to_sheet(logData);
      XLSX.utils.book_append_sheet(wb, wsLog, 'Rincian Izin Pulang');
    }

    if (rekapData.length > 0) {
      const wsRekap = XLSX.utils.json_to_sheet(rekapData);
      XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap Frekuensi Izin Pulang');
    }

    XLSX.writeFile(wb, `Laporan_Izin_Pulang_${titleSuffix}_${filenameSuffix}.xlsx`);
    showToast('Laporan izin pulang berhasil diunduh!', 'success');
  } catch (error) {
    showToast(`Gagal mengekspor laporan: ${error.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}


// ==========================================================================
// DASHBOARD VIEW CORE RENDER
// ==========================================================================

function renderDashboard() {
  const todayISO = new Date().toISOString().split('T')[0];
  
  // Total registered students
  document.getElementById('dash-total-siswa').textContent = state.students.length;

  // Filter today's attendance
  const todayAtt = state.attendance.filter(a => a.tanggal === todayISO);
  let hadir = 0, sakit = 0, izin = 0, alpha = 0;
  todayAtt.forEach(a => {
    if (a.status === 'hadir') hadir++;
    else if (a.status === 'sakit') sakit++;
    else if (a.status === 'izin') izin++;
    else if (a.status === 'alpha') alpha++;
  });

  const totalTodayMarked = hadir + sakit + izin + alpha;
  const attendanceRate = totalTodayMarked > 0 ? Math.round((hadir / totalTodayMarked) * 100) : 0;
  
  document.getElementById('dash-kehadiran-percent').textContent = `${attendanceRate}%`;
  document.getElementById('dash-kehadiran-subtext').textContent = totalTodayMarked > 0 
    ? `Kehadiran dari ${totalTodayMarked} siswa diabsen`
    : 'Belum ada absensi kelas hari ini';

  document.getElementById('dash-total-absen').textContent = sakit + izin + alpha;
  document.getElementById('dash-absen-details').textContent = `Sakit: ${sakit} | Izin: ${izin} | Alfa: ${alpha}`;

  // Today's lates
  const todayLates = state.lateLogs.filter(l => l.tanggal === todayISO);
  document.getElementById('dash-total-terlambat').textContent = todayLates.length;
  document.getElementById('dash-terlambat-subtext').textContent = `${todayLates.length} siswa terlambat hari ini`;

  // Today's violations
  const todayViolations = state.violations ? state.violations.filter(v => v.tanggal === todayISO) : [];
  const totalViolationsEl = document.getElementById('dash-total-pelanggaran');
  if (totalViolationsEl) totalViolationsEl.textContent = todayViolations.length;
  const subViolationsEl = document.getElementById('dash-pelanggaran-subtext');
  if (subViolationsEl) subViolationsEl.textContent = `${todayViolations.length} kasus pelanggaran hari ini`;

  // Render Charts
  renderDashboardCharts(hadir, sakit, izin, alpha);

  // Render Top Sering Terlambat (This month)
  renderTopLateStudentsThisMonth();

  // Render Recent Late Activities
  renderRecentLateActivities(todayISO);
}

function renderDashboardCharts(hadir = 0, sakit = 0, izin = 0, alpha = 0) {
  // 1. Render Attendance Donut Chart (SVG)
  const donutContainer = document.getElementById('attendance-donut-chart');
  const legendContainer = document.getElementById('attendance-legend');
  
  donutContainer.innerHTML = '';
  legendContainer.innerHTML = '';

  const total = hadir + sakit + izin + alpha;
  
  if (total === 0) {
    donutContainer.innerHTML = `
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="20" />
        <text x="100" y="105" text-anchor="middle" fill="var(--text-muted)" font-size="12" font-weight="500">TIDAK ADA DATA</text>
      </svg>
    `;
    legendContainer.innerHTML = `
      <div class="legend-item"><span class="legend-color" style="background:#64748b"></span><span>Belum Diabsen (0)</span></div>
    `;
  } else {
    // Math logic for SVG Donut segments
    const radius = 70;
    const circumference = 2 * Math.PI * radius; // ~439.8
    
    const parts = [
      { name: 'Hadir', count: hadir, color: 'var(--color-success)' },
      { name: 'Sakit', count: sakit, color: 'var(--color-warning)' },
      { name: 'Izin', count: izin, color: 'var(--color-info)' },
      { name: 'Alpha', count: alpha, color: 'var(--color-danger)' }
    ].filter(p => p.count > 0);

    let svgInner = '';
    let currentOffset = 0;

    parts.forEach(part => {
      const percentage = part.count / total;
      const strokeDashArray = `${percentage * circumference} ${circumference}`;
      const strokeDashOffset = -currentOffset;
      
      svgInner += `
        <circle cx="100" cy="100" r="${radius}" 
          fill="none" 
          stroke="${part.color}" 
          stroke-width="20" 
          stroke-dasharray="${strokeDashArray}" 
          stroke-dashoffset="${strokeDashOffset}"
          transform="rotate(-90 100 100)"
          style="transition: stroke-dashoffset 0.5s ease" />
      `;
      currentOffset += percentage * circumference;
    });

    // Inner center text
    const pctHadir = Math.round((hadir / total) * 100);
    svgInner += `
      <circle cx="100" cy="100" r="58" fill="var(--bg-app)" />
      <text x="100" y="98" text-anchor="middle" fill="var(--text-main)" font-size="24" font-weight="800" font-family="var(--font-heading)">${pctHadir}%</text>
      <text x="100" y="118" text-anchor="middle" fill="var(--text-muted)" font-size="11" font-weight="600" letter-spacing="0.5">HADIR</text>
    `;

    donutContainer.innerHTML = `<svg width="200" height="200" viewBox="0 0 200 200">${svgInner}</svg>`;

    // Legend
    parts.forEach(part => {
      const pct = Math.round((part.count / total) * 100);
      legendContainer.innerHTML += `
        <div class="legend-item">
          <span class="legend-color" style="background:${part.color}"></span>
          <span>${part.name}: <strong>${part.count}</strong> (${pct}%)</span>
        </div>
      `;
    });
  }

  // 2. Render Late Monthly Trend Chart (SVG)
  const trendContainer = document.getElementById('late-trend-chart');
  trendContainer.innerHTML = '';

  // Get recent 6 months
  const now = new Date();
  const monthsData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'short' });
    monthsData.push({ yMonth, label, count: 0 });
  }

  // Populate data counts
  monthsData.forEach(m => {
    m.count = state.lateLogs.filter(l => l.tanggal && l.tanggal.startsWith(m.yMonth)).length;
  });

  const allZero = monthsData.every(m => m.count === 0);

  // FIX: Jika semua 0, tampilkan pesan kosong bukan grafik dengan nilai minimum 5
  if (allZero) {
    trendContainer.innerHTML = `
      <svg width="100%" height="180" viewBox="0 0 350 180" style="overflow:visible;">
        <text x="175" y="85" text-anchor="middle" fill="var(--text-muted)" font-size="13" font-weight="500">Belum ada data keterlambatan</text>
        <text x="175" y="105" text-anchor="middle" fill="var(--text-muted)" font-size="11">Data grafik akan muncul setelah ada pencatatan</text>
      </svg>
    `;
  } else {
    // FIX: Gunakan nilai max real tanpa minimum dummy 5
    const maxCount = Math.max(...monthsData.map(m => m.count), 1);
    
    // Create beautiful SVG Bar Chart
    const svgWidth = 350;
    const svgHeight = 180;
    const padding = 30;
    const graphWidth = svgWidth - padding * 2;
    const graphHeight = svgHeight - padding * 2;
    const barWidth = 24;
    const colSpacing = graphWidth / monthsData.length;

    let barElements = '';
    let gridLines = '';
    let labels = '';

    // Horizontal Gridlines (3 lines)
    for (let idx = 0; idx <= 3; idx++) {
      const yVal = padding + (graphHeight / 3) * idx;
      const gridLabel = Math.round(maxCount - (maxCount / 3) * idx);
      gridLines += `
        <line x1="${padding}" y1="${yVal}" x2="${svgWidth - padding}" y2="${yVal}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="3,3" />
        <text x="${padding - 8}" y="${yVal + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">${gridLabel}</text>
      `;
    }

    // Draw Bars
    monthsData.forEach((m, idx) => {
      // FIX: Jika count 0, tampilkan batang sangat kecil (2px) hanya sebagai indikator
      const barHeight = m.count > 0 ? (m.count / maxCount) * graphHeight : 2;
      const xPos = padding + colSpacing * idx + (colSpacing - barWidth) / 2;
      const yPos = padding + graphHeight - barHeight;

      barElements += `
        <rect x="${xPos}" y="${yPos}" width="${barWidth}" height="${barHeight}" 
          fill="${m.count > 0 ? 'url(#lateGrad)' : 'rgba(255,255,255,0.06)'}" rx="4"
          style="transition: all 0.5s ease" />
        <text x="${xPos + barWidth/2}" y="${yPos - 6}" text-anchor="middle" fill="${m.count > 0 ? 'var(--color-warning)' : 'var(--text-muted)'}" font-size="9" font-weight="700">${m.count}</text>
      `;

      labels += `
        <text x="${xPos + barWidth/2}" y="${padding + graphHeight + 16}" text-anchor="middle" fill="var(--text-muted)" font-size="11" font-weight="500">${m.label}</text>
      `;
    });

    trendContainer.innerHTML = `
      <svg width="100%" height="180" viewBox="0 0 ${svgWidth} ${svgHeight}" style="overflow:visible;">
        <defs>
          <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fbbf24" />
            <stop offset="100%" stop-color="#f59e0b" />
          </linearGradient>
        </defs>
        ${gridLines}
        ${barElements}
        ${labels}
      </svg>
    `;
  }
}

function renderTopLateStudentsThisMonth() {
  const body = document.getElementById('dash-top-late-body');
  body.innerHTML = '';

  const today = new Date();
  const currentMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-`;

  // Filter logs of this month
  const thisMonthLates = state.lateLogs.filter(l => l.tanggal.startsWith(currentMonthPrefix));

  // Count per student
  const countMap = new Map();
  thisMonthLates.forEach(log => {
    countMap.set(log.student_id, (countMap.get(log.student_id) || 0) + 1);
  });

  const sortedTop = Array.from(countMap.entries())
    .map(([studentId, count]) => {
      const student = state.students.find(s => s.id === studentId) || { nama: 'Siswa Terhapus', kelas: '-' };
      return { student, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // top 5

  if (sortedTop.length === 0) {
    body.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-muted">Belum ada siswa terlambat bulan ini.</td></tr>`;
    return;
  }

  sortedTop.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-semibold">${item.student.nama}</td>
      <td><span class="badge badge-success" style="background-color: var(--color-primary-glow); color: var(--color-primary);">${item.student.kelas}</span></td>
      <td class="text-center font-bold text-warning">${item.count}x</td>
    `;
    body.appendChild(tr);
  });
}

function renderRecentLateActivities(todayISO) {
  const container = document.getElementById('dash-recent-activities');
  container.innerHTML = '';

  const todayLates = state.lateLogs
    .filter(l => l.tanggal === todayISO)
    .sort((a, b) => b.jam.localeCompare(a.jam))
    .slice(0, 5); // recent 5 of today

  if (todayLates.length === 0) {
    container.innerHTML = `<div class="timeline-empty text-muted text-center py-4">Belum ada aktivitas keterlambatan hari ini.</div>`;
    return;
  }

  todayLates.forEach(log => {
    const student = state.students.find(s => s.id === log.student_id) || { nama: 'Siswa Terhapus', kelas: '-' };
    
    const div = document.createElement('div');
    div.className = 'timeline-item';
    div.innerHTML = `
      <div class="timeline-dot"></div>
      <div class="timeline-header">
        <span class="font-semibold">${student.nama} (${student.kelas})</span>
        <span class="timeline-time">${log.jam}</span>
      </div>
      <div class="timeline-desc text-muted">${log.keterangan || 'Tanpa keterangan'}</div>
    `;
    container.appendChild(div);
  });
}

// --- Helper Date Formatter ---
function formatLocalDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (!d) return dateStr;
  
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ==========================================================================
// JURNAL GURU
// ==========================================================================

function switchJurnalTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.jurnal-tab-content').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });
  // Deactivate tab buttons
  document.querySelectorAll('#view-jurnal-guru .tab-button').forEach(btn => btn.classList.remove('active'));

  const targetContent = document.getElementById(`jurnal-tab-${tabName}-content`);
  if (targetContent) {
    targetContent.style.display = 'block';
    targetContent.classList.add('active');
  }
  const targetBtn = document.getElementById(`tab-jurnal-${tabName}`);
  if (targetBtn) targetBtn.classList.add('active');

  if (tabName === 'riwayat') renderJurnalRiwayat();
}

function initJurnalGuruForm() {
  // Set today date if empty
  const todayISO = new Date().toISOString().split('T')[0];
  const tgl = document.getElementById('jurnal-tanggal');
  if (tgl && !tgl.value) tgl.value = todayISO;
  
  // Ensure form tab is shown
  switchJurnalTab('form');
}

function updateJurnalTotal() {
  const hadir = parseInt((document.getElementById('jurnal-hadir')?.value || '')) || 0;
  const sakit = parseInt((document.getElementById('jurnal-sakit')?.value || '')) || 0;
  const izin  = parseInt((document.getElementById('jurnal-izin')?.value || '')) || 0;
  const alpha = parseInt((document.getElementById('jurnal-alpha')?.value || '')) || 0;
  const total = hadir + sakit + izin + alpha;

  const summaryEl = document.getElementById('jurnal-kehadiran-summary');
  if (summaryEl) {
    summaryEl.style.display = total > 0 ? 'block' : 'none';
    document.getElementById('sum-hadir').textContent = hadir;
    document.getElementById('sum-sakit').textContent = sakit;
    document.getElementById('sum-izin').textContent  = izin;
    document.getElementById('sum-alpha').textContent = alpha;
    document.getElementById('sum-total').textContent = total;
  }
}

async function handleJurnalSubmit(event) {
  event.preventDefault();

  const entry = {
    id: 'j_' + Date.now(),
    tanggal: (document.getElementById('jurnal-tanggal')?.value || ''),
    namaGuru: (document.getElementById('jurnal-nama-guru')?.value || '').trim(),
    mataPelajaran: (document.getElementById('jurnal-mata-pelajaran')?.value || '').trim(),
    kelas: (document.getElementById('jurnal-kelas')?.value || '').trim(),
    jamKe: (document.getElementById('jurnal-jam-ke')?.value || '').trim(),
    materi: (document.getElementById('jurnal-materi')?.value || '').trim(),
    tujuan: (document.getElementById('jurnal-tujuan')?.value || '').trim(),
    aktivitas: (document.getElementById('jurnal-aktivitas')?.value || '').trim(),
    metode: (document.getElementById('jurnal-metode')?.value || '').trim(),
    media: (document.getElementById('jurnal-media')?.value || '').trim(),
    hadir: parseInt((document.getElementById('jurnal-hadir')?.value || '')) || 0,
    sakit: parseInt((document.getElementById('jurnal-sakit')?.value || '')) || 0,
    izin: parseInt((document.getElementById('jurnal-izin')?.value || '')) || 0,
    alpha: parseInt((document.getElementById('jurnal-alpha')?.value || '')) || 0,
    kendala: (document.getElementById('jurnal-kendala')?.value || '').trim(),
    solusi: (document.getElementById('jurnal-solusi')?.value || '').trim(),
    catatan: (document.getElementById('jurnal-catatan')?.value || '').trim(),
    lampiran: (document.getElementById('jurnal-lampiran')?.value || '').trim(),
    createdAt: new Date().toISOString()
  };

  state.jurnalGuru.push(entry);
  await persistData();

  showToast('Jurnal berhasil disimpan!', 'success');
  resetJurnalForm();
  renderJurnalRiwayat();
}

function resetJurnalForm() {
  document.getElementById('form-jurnal-guru')?.reset();
  const todayISO = new Date().toISOString().split('T')[0];
  const tgl = document.getElementById('jurnal-tanggal');
  if (tgl) tgl.value = todayISO;
  const summaryEl = document.getElementById('jurnal-kehadiran-summary');
  if (summaryEl) summaryEl.style.display = 'none';
}

function renderJurnalRiwayat() {
  const tbody = document.getElementById('jurnal-riwayat-body');
  if (!tbody) return;

  const searchTerm = (document.getElementById('jurnal-riwayat-search')?.value || '').toLowerCase();

  let entries = [...state.jurnalGuru].sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  if (searchTerm) {
    entries = entries.filter(j =>
      j.namaGuru.toLowerCase().includes(searchTerm) ||
      j.mataPelajaran.toLowerCase().includes(searchTerm) ||
      j.kelas.toLowerCase().includes(searchTerm) ||
      j.materi.toLowerCase().includes(searchTerm) ||
      j.tanggal.includes(searchTerm)
    );
  }

  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">${searchTerm ? 'Tidak ditemukan jurnal yang cocok.' : 'Belum ada jurnal yang tersimpan.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  entries.forEach((j, idx) => {
    const totalHadir = j.hadir + j.sakit + j.izin + j.alpha;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${formatLocalDate(j.tanggal)}</td>
      <td class="font-semibold">${j.namaGuru}</td>
      <td>${j.mataPelajaran}</td>
      <td><span class="badge badge-success" style="background:var(--color-primary-glow);color:var(--color-primary);">${j.kelas}</span></td>
      <td class="text-center">${j.jamKe}</td>
      <td class="text-muted" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${j.materi}">${j.materi}</td>
      <td class="text-center" style="font-size:0.8rem;line-height:1.6;">
        <span style="color:#10b981;">H:${j.hadir}</span> &nbsp;
        <span style="color:#f59e0b;">S:${j.sakit}</span> &nbsp;
        <span style="color:#3b82f6;">I:${j.izin}</span> &nbsp;
        <span style="color:#ef4444;">A:${j.alpha}</span>
      </td>
      <td class="text-center">
        <button class="btn btn-secondary btn-sm" title="Lihat Detail" onclick="viewJurnalDetail('${j.id}')"><i data-lucide="eye" style="width:14px;height:14px;"></i></button>
        <button class="btn btn-danger btn-sm ml-2" title="Hapus Jurnal" onclick="deleteJurnal('${j.id}')"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  lucide.createIcons();
}

function viewJurnalDetail(id) {
  const j = state.jurnalGuru.find(x => x.id === id);
  if (!j) return;

  const modal = document.getElementById('jurnal-detail-modal');
  const body = document.getElementById('jurnal-modal-body');
  document.getElementById('jurnal-modal-title').textContent = `Jurnal - ${j.mataPelajaran} | ${formatLocalDate(j.tanggal)}`;

  body.innerHTML = `
    <div style="display:grid;gap:16px;padding:16px 0;">
      
      <!-- Identitas -->
      <div style="background:var(--card-bg-2,rgba(255,255,255,0.04));border-radius:10px;padding:16px;border:1px solid var(--border-color);">
        <h4 style="margin:0 0 12px;color:var(--color-primary);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;display:flex;align-items:center;gap:6px;">
          <i data-lucide="user-circle" style="width:14px;height:14px;"></i> Identitas
        </h4>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          ${jDetail('Tanggal', formatLocalDate(j.tanggal))}
          ${jDetail('Nama Guru', j.namaGuru)}
          ${jDetail('Mata Pelajaran', j.mataPelajaran)}
          ${jDetail('Kelas', j.kelas)}
          ${jDetail('Jam Ke', j.jamKe)}
        </div>
      </div>

      <!-- Pembelajaran -->
      <div style="background:var(--card-bg-2,rgba(255,255,255,0.04));border-radius:10px;padding:16px;border:1px solid var(--border-color);">
        <h4 style="margin:0 0 12px;color:#0ea5e9;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;display:flex;align-items:center;gap:6px;">
          <i data-lucide="book-open" style="width:14px;height:14px;"></i> Kegiatan Pembelajaran
        </h4>
        ${jDetailFull('Materi Pembelajaran', j.materi)}
        ${jDetailFull('Tujuan Pembelajaran', j.tujuan)}
        ${jDetailFull('Aktivitas Pembelajaran', j.aktivitas)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px;">
          ${jDetail('Metode Pembelajaran', j.metode)}
          ${jDetail('Media Pembelajaran', j.media || '-')}
        </div>
      </div>

      <!-- Kehadiran -->
      <div style="background:var(--card-bg-2,rgba(255,255,255,0.04));border-radius:10px;padding:16px;border:1px solid var(--border-color);">
        <h4 style="margin:0 0 12px;color:#10b981;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;display:flex;align-items:center;gap:6px;">
          <i data-lucide="users" style="width:14px;height:14px;"></i> Kehadiran Siswa
        </h4>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;">
          <div style="text-align:center;padding:12px;border-radius:8px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);">
            <div style="font-size:1.5rem;font-weight:700;color:#10b981;">${j.hadir}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">Hadir</div>
          </div>
          <div style="text-align:center;padding:12px;border-radius:8px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);">
            <div style="font-size:1.5rem;font-weight:700;color:#f59e0b;">${j.sakit}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">Sakit</div>
          </div>
          <div style="text-align:center;padding:12px;border-radius:8px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);">
            <div style="font-size:1.5rem;font-weight:700;color:#3b82f6;">${j.izin}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">Izin</div>
          </div>
          <div style="text-align:center;padding:12px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);">
            <div style="font-size:1.5rem;font-weight:700;color:#ef4444;">${j.alpha}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">Alpha</div>
          </div>
        </div>
      </div>

      <!-- Refleksi -->
      <div style="background:var(--card-bg-2,rgba(255,255,255,0.04));border-radius:10px;padding:16px;border:1px solid var(--border-color);">
        <h4 style="margin:0 0 12px;color:#f59e0b;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;display:flex;align-items:center;gap:6px;">
          <i data-lucide="lightbulb" style="width:14px;height:14px;"></i> Refleksi Guru
        </h4>
        ${jDetailFull('Kendala Pembelajaran', j.kendala || '-')}
        ${jDetailFull('Solusi', j.solusi || '-')}
        ${jDetailFull('Catatan Tambahan', j.catatan || '-')}
        ${j.lampiran ? jDetailFull('Lampiran', j.lampiran) : ''}
      </div>
    </div>
  `;

  modal.style.display = 'flex';
  lucide.createIcons();
}

function jDetail(label, value) {
  return `<div>
    <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:2px;">${label}</div>
    <div style="font-weight:500;color:var(--text-primary);">${value || '-'}</div>
  </div>`;
}

function jDetailFull(label, value) {
  return `<div style="margin-bottom:10px;">
    <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">${label}</div>
    <div style="font-weight:400;color:var(--text-primary);white-space:pre-wrap;line-height:1.6;">${value || '-'}</div>
  </div>`;
}

function closeJurnalDetailModal() {
  const modal = document.getElementById('jurnal-detail-modal');
  if (modal) modal.style.display = 'none';
}

async function deleteJurnal(id) {
  if (!confirm('Yakin ingin menghapus jurnal ini?')) return;
  state.jurnalGuru = state.jurnalGuru.filter(j => j.id !== id);
  await persistData();
  renderJurnalRiwayat();
  showToast('Jurnal berhasil dihapus.', 'info');
}

function exportAllJurnalExcel() {
  let entries = state.jurnalGuru || [];

  if (!entries || entries.length === 0) {
    showToast('Belum ada data jurnal guru yang tersimpan untuk diekspor.', 'warning');
    return;
  }

  // Apply active filters if selected in UI
  const filterGuru = document.getElementById('filter-jurnal-guru')?.value || '';
  const filterMapel = document.getElementById('filter-jurnal-mapel')?.value || '';
  const filterKelas = document.getElementById('filter-jurnal-kelas')?.value || '';

  if (filterGuru) entries = entries.filter(j => j.guru === filterGuru);
  if (filterMapel) entries = entries.filter(j => j.mapel === filterMapel);
  if (filterKelas) entries = entries.filter(j => j.kelas === filterKelas);

  if (entries.length === 0) {
    showToast('Tidak ada data jurnal yang sesuai dengan filter saat ini.', 'warning');
    return;
  }

  // Sort by date descending
  entries.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

  const rows = entries.map((j, idx) => ({
    'No': idx + 1,
    'Hari': j.hari || '-',
    'Tanggal': formatLocalDate(j.tanggal) || j.tanggal,
    'Kelas': j.kelas || '-',
    'Guru Pengampu': j.guru || '-',
    'Mata Pelajaran': j.mapel || '-',
    'Batas Materi / Uraian Kegiatan': j.materi || '-',
    'Hadir': j.hadir || 0,
    'Sakit': j.sakit || 0,
    'Izin': j.izin || 0,
    'Alpha': j.alpha || 0,
    'Siswa Sakit': j.namaSakit || 'Tidak ada',
    'Siswa Izin': j.namaIzin || 'Tidak ada',
    'Siswa Alpha': j.namaAlpha || 'Tidak ada',
    'Keterangan Lain': j.keteranganLain || '-'
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  
  // Column width settings for neat Excel layout
  ws['!cols'] = [
    { wch: 5 },   // No
    { wch: 10 },  // Hari
    { wch: 16 },  // Tanggal
    { wch: 10 },  // Kelas
    { wch: 25 },  // Guru Pengampu
    { wch: 20 },  // Mata Pelajaran
    { wch: 40 },  // Batas Materi / Uraian Kegiatan
    { wch: 8 },   // Hadir
    { wch: 8 },   // Sakit
    { wch: 8 },   // Izin
    { wch: 8 },   // Alpha
    { wch: 25 },  // Siswa Sakit
    { wch: 25 },  // Siswa Izin
    { wch: 25 },  // Siswa Alpha
    { wch: 30 }   // Keterangan Lain
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Jurnal Guru');
  XLSX.writeFile(wb, `Riwayat_Jurnal_Guru_${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast(`Berhasil mengekspor ${entries.length} data jurnal guru ke Excel!`, 'success');
}

function exportJurnalToPDF() {
  // Collect form values to build a print preview
  const tanggal = (document.getElementById('jurnal-tanggal')?.value || '');
  const namaGuru = (document.getElementById('jurnal-nama-guru')?.value || '').trim();
  const mapel = (document.getElementById('jurnal-mata-pelajaran')?.value || '').trim();
  const kelas = (document.getElementById('jurnal-kelas')?.value || '').trim();
  const jamKe = (document.getElementById('jurnal-jam-ke')?.value || '').trim();
  const materi = (document.getElementById('jurnal-materi')?.value || '').trim();
  const tujuan = (document.getElementById('jurnal-tujuan')?.value || '').trim();
  const aktivitas = (document.getElementById('jurnal-aktivitas')?.value || '').trim();
  const metode = (document.getElementById('jurnal-metode')?.value || '').trim();
  const media = (document.getElementById('jurnal-media')?.value || '').trim();
  const hadir = (document.getElementById('jurnal-hadir')?.value || '') || '0';
  const sakit = (document.getElementById('jurnal-sakit')?.value || '') || '0';
  const izin = (document.getElementById('jurnal-izin')?.value || '') || '0';
  const alpha = (document.getElementById('jurnal-alpha')?.value || '') || '0';
  const kendala = (document.getElementById('jurnal-kendala')?.value || '').trim();
  const solusi = (document.getElementById('jurnal-solusi')?.value || '').trim();
  const catatan = (document.getElementById('jurnal-catatan')?.value || '').trim();
  const lampiran = (document.getElementById('jurnal-lampiran')?.value || '').trim();

  if (!namaGuru || !mapel || !kelas) {
    showToast('Isi minimal Nama Guru, Mata Pelajaran, dan Kelas sebelum ekspor.', 'warning');
    return;
  }

  const printWin = window.open('', '_blank', 'width=900,height=700');
  printWin.document.write(`<!DOCTYPE html><html lang="id"><head>
    <meta charset="UTF-8">
    <title>Jurnal Guru - ${mapel} - ${formatLocalDate(tanggal)}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 13px; color: #222; padding: 24px; }
      h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
      .subtitle { text-align: center; color: #555; margin-bottom: 20px; font-size: 12px; }
      .section { border: 1px solid #ccc; border-radius: 6px; margin-bottom: 14px; overflow: hidden; }
      .section-title { background: #f0f0f0; padding: 7px 14px; font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #ccc; }
      .section-body { padding: 12px 14px; }
      .row { display: flex; gap: 16px; margin-bottom: 8px; }
      .col { flex: 1; }
      .label { font-size: 11px; color: #666; margin-bottom: 2px; }
      .value { font-weight: 500; }
      .kehadiran-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
      .kehadiran-box { border: 1px solid #ccc; border-radius: 6px; text-align: center; padding: 8px; }
      .kehadiran-num { font-size: 22px; font-weight: 700; }
      .kehadiran-label { font-size: 11px; color: #666; }
      textarea-val { white-space: pre-wrap; }
      @media print { body { padding: 10px; } }
    </style>
  </head><body>
    <h1>JURNAL GURU</h1>
    <div class="subtitle">SMPN 3 Batam</div>
    
    <div class="section">
      <div class="section-title">Identitas</div>
      <div class="section-body">
        <div class="row">
          <div class="col"><div class="label">Tanggal</div><div class="value">${formatLocalDate(tanggal)}</div></div>
          <div class="col"><div class="label">Nama Guru</div><div class="value">${namaGuru}</div></div>
          <div class="col"><div class="label">Mata Pelajaran</div><div class="value">${mapel}</div></div>
        </div>
        <div class="row">
          <div class="col"><div class="label">Kelas</div><div class="value">${kelas}</div></div>
          <div class="col"><div class="label">Jam Ke</div><div class="value">${jamKe}</div></div>
          <div class="col"></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Kegiatan Pembelajaran</div>
      <div class="section-body">
        <div class="label">Materi Pembelajaran</div><div class="value" style="margin-bottom:8px;white-space:pre-wrap;">${materi}</div>
        <div class="label">Tujuan Pembelajaran</div><div class="value" style="margin-bottom:8px;white-space:pre-wrap;">${tujuan}</div>
        <div class="label">Aktivitas Pembelajaran</div><div class="value" style="margin-bottom:8px;white-space:pre-wrap;">${aktivitas}</div>
        <div class="row">
          <div class="col"><div class="label">Metode Pembelajaran</div><div class="value">${metode}</div></div>
          <div class="col"><div class="label">Media Pembelajaran</div><div class="value">${media || '-'}</div></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Kehadiran Siswa</div>
      <div class="section-body">
        <div class="kehadiran-grid">
          <div class="kehadiran-box"><div class="kehadiran-num" style="color:#16a34a;">${hadir}</div><div class="kehadiran-label">Hadir</div></div>
          <div class="kehadiran-box"><div class="kehadiran-num" style="color:#d97706;">${sakit}</div><div class="kehadiran-label">Sakit</div></div>
          <div class="kehadiran-box"><div class="kehadiran-num" style="color:#2563eb;">${izin}</div><div class="kehadiran-label">Izin</div></div>
          <div class="kehadiran-box"><div class="kehadiran-num" style="color:#dc2626;">${alpha}</div><div class="kehadiran-label">Alpha</div></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Refleksi Guru</div>
      <div class="section-body">
        <div class="label">Kendala Pembelajaran</div><div class="value" style="margin-bottom:8px;white-space:pre-wrap;">${kendala || '-'}</div>
        <div class="label">Solusi</div><div class="value" style="margin-bottom:8px;white-space:pre-wrap;">${solusi || '-'}</div>
        <div class="label">Catatan Tambahan</div><div class="value" style="margin-bottom:8px;white-space:pre-wrap;">${catatan || '-'}</div>
        ${lampiran ? `<div class="label">Lampiran</div><div class="value">${lampiran}</div>` : ''}
      </div>
    </div>

    <div style="margin-top:28px;display:flex;justify-content:flex-end;">
      <div style="text-align:center;width:220px;">
        <div style="font-size:12px;margin-bottom:64px;">Batam, ${formatLocalDate(tanggal)}</div>
        <div style="border-top:1px solid #333;padding-top:4px;font-size:12px;">${namaGuru}</div>
        <div style="font-size:11px;color:#555;">Guru ${mapel}</div>
      </div>
    </div>

    <script>window.onload = function() { window.print(); }</script>
  </body></html>`);
  printWin.document.close();
  showToast('Membuka jendela cetak / simpan PDF...', 'info');
}

// ==========================================================================
// MENU: JURNAL GURU (SISTEM LENGKAP & OTOMATIS)
// ==========================================================================

const HARI_INDONESIA = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function getTeacherSubjects(guruNama) {
  if (!guruNama) return [];
  const teacherRows = (state.teachers || []).filter(t => t.nama === guruNama);
  const mapelSet = new Set();
  
  teacherRows.forEach(t => {
    if (t.mapel) {
      t.mapel.split(/[,;\/]/).forEach(m => {
        const trimmed = m.trim();
        if (trimmed) mapelSet.add(trimmed);
      });
    }
  });

  return Array.from(mapelSet);
}

function initJurnalGuruForm() {
  populateClassSelect('jurnal-kelas');
  populateJurnalFilterOptions();

  const guruSelect = document.getElementById('jurnal-guru-select');
  const mapelSelect = document.getElementById('jurnal-mapel-select');

  if (guruSelect) {
    guruSelect.innerHTML = '<option value="">-- Pilih Guru --</option>';
    const uniqueGurus = new Set();
    (state.teachers || []).forEach(t => {
      if (t.nama) uniqueGurus.add(t.nama);
    });

    Array.from(uniqueGurus).sort().forEach(nama => {
      const opt = document.createElement('option');
      opt.value = nama;
      const subjects = getTeacherSubjects(nama);
      const mapelStr = subjects.join(', ');
      opt.textContent = mapelStr ? `${nama} (${mapelStr})` : nama;
      guruSelect.appendChild(opt);
    });
  }

  if (mapelSelect) {
    mapelSelect.innerHTML = '<option value="">-- Pilih Guru Terlebih Dahulu --</option>';
    mapelSelect.disabled = true;
  }

  const tanggalInput = document.getElementById('jurnal-tanggal');
  if (tanggalInput && !tanggalInput.value) {
    tanggalInput.value = new Date().toISOString().split('T')[0];
  }
  handleJurnalDateChange();
}

function populateJurnalFilterOptions() {
  populateClassSelect('filter-jurnal-kelas');

  // Populate Filter Guru
  const filterGuru = document.getElementById('filter-jurnal-guru');
  if (filterGuru) {
    const curVal = filterGuru.value;
    filterGuru.innerHTML = '<option value="">Semua Guru</option>';
    const gurus = new Set();
    (state.teachers || []).forEach(t => gurus.add(t.nama));
    (state.jurnalGuru || []).forEach(j => { if (j.guru) gurus.add(j.guru); });
    Array.from(gurus).sort().forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      filterGuru.appendChild(opt);
    });
    if (gurus.has(curVal)) filterGuru.value = curVal;
  }

  // Populate Filter Mapel
  const filterMapel = document.getElementById('filter-jurnal-mapel');
  if (filterMapel) {
    const curVal = filterMapel.value;
    filterMapel.innerHTML = '<option value="">Semua Mapel</option>';
    const mapels = new Set();
    (state.teachers || []).forEach(t => mapels.add(t.mapel));
    (state.jurnalGuru || []).forEach(j => { if (j.mapel) mapels.add(j.mapel); });
    Array.from(mapels).sort().forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      filterMapel.appendChild(opt);
    });
    if (mapels.has(curVal)) filterMapel.value = curVal;
  }
}

function handleJurnalDateChange() {
  const tanggalInput = document.getElementById('jurnal-tanggal');
  const hariInput = document.getElementById('jurnal-hari');
  if (!tanggalInput || !hariInput) return;

  if (tanggalInput.value) {
    const d = new Date(tanggalInput.value + 'T00:00:00');
    const dayName = HARI_INDONESIA[d.getDay()] || '';
    hariInput.value = dayName;
  } else {
    hariInput.value = '';
  }

  updateJurnalAttendanceStats();
}

function handleJurnalGuruSelectChange() {
  const guruSelect = document.getElementById('jurnal-guru-select');
  const mapelSelect = document.getElementById('jurnal-mapel-select');
  if (!guruSelect || !mapelSelect) return;

  const selectedGuru = guruSelect.value;
  mapelSelect.innerHTML = '';

  if (!selectedGuru) {
    mapelSelect.innerHTML = '<option value="">-- Pilih Guru Terlebih Dahulu --</option>';
    mapelSelect.disabled = true;
    return;
  }

  const subjects = getTeacherSubjects(selectedGuru);

  if (subjects.length === 0) {
    mapelSelect.innerHTML = '<option value="">-- Tidak Ada Mapel Terdaftar --</option>';
    mapelSelect.disabled = true;
    return;
  }

  if (subjects.length === 1) {
    mapelSelect.innerHTML = `<option value="${subjects[0]}" selected>${subjects[0]}</option>`;
    mapelSelect.disabled = false;
  } else {
    mapelSelect.innerHTML = `<option value="">-- Pilih Mapel (${subjects.length} Mapel) --</option>`;
    subjects.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      mapelSelect.appendChild(opt);
    });
    mapelSelect.disabled = false;
  }
}

function updateJurnalAttendanceStats() {
  const kelas = document.getElementById('jurnal-kelas')?.value || '';
  const tanggal = document.getElementById('jurnal-tanggal')?.value || '';

  const statHadir = document.getElementById('jurnal-stat-hadir');
  const statSakit = document.getElementById('jurnal-stat-sakit');
  const statIzin = document.getElementById('jurnal-stat-izin');
  const statAlpha = document.getElementById('jurnal-stat-alpha');

  const namesSakit = document.getElementById('jurnal-names-sakit');
  const namesIzin = document.getElementById('jurnal-names-izin');
  const namesAlpha = document.getElementById('jurnal-names-alpha');

  if (!statHadir) return;

  if (!kelas || !tanggal) {
    statHadir.textContent = '0';
    statSakit.textContent = '0';
    statIzin.textContent = '0';
    statAlpha.textContent = '0';
    if (namesSakit) namesSakit.textContent = 'Tidak ada';
    if (namesIzin) namesIzin.textContent = 'Tidak ada';
    if (namesAlpha) namesAlpha.textContent = 'Tidak ada';
    return;
  }

  const classStudents = state.students.filter(s => s.kelas === kelas);
  const studentIdsSet = new Set(classStudents.map(s => s.id));

  const dayAttendance = state.attendance.filter(a => a.tanggal === tanggal && studentIdsSet.has(a.student_id));

  let countHadir = 0;
  let countSakit = 0;
  let countIzin = 0;
  let countAlpha = 0;

  const listSakit = [];
  const listIzin = [];
  const listAlpha = [];

  classStudents.forEach(std => {
    const rec = dayAttendance.find(a => String(a.student_id) === String(std.id));
    const status = rec ? rec.status : null;

    if (status === 'hadir') countHadir++;
    else if (status === 'sakit') { countSakit++; listSakit.push(std.nama); }
    else if (status === 'izin') { countIzin++; listIzin.push(std.nama); }
    else if (status === 'alpha') { countAlpha++; listAlpha.push(std.nama); }
  });

  statHadir.textContent = countHadir;
  statSakit.textContent = countSakit;
  statIzin.textContent = countIzin;
  statAlpha.textContent = countAlpha;

  if (namesSakit) namesSakit.textContent = listSakit.length > 0 ? listSakit.join(', ') : 'Tidak ada';
  if (namesIzin) namesIzin.textContent = listIzin.length > 0 ? listIzin.join(', ') : 'Tidak ada';
  if (namesAlpha) namesAlpha.textContent = listAlpha.length > 0 ? listAlpha.join(', ') : 'Tidak ada';
}

async function handleJurnalSubmit(e) {
  e.preventDefault();

  const id = (document.getElementById('jurnal-id')?.value || '');
  const kelas = (document.getElementById('jurnal-kelas')?.value || '');
  const tanggal = (document.getElementById('jurnal-tanggal')?.value || '');
  const hari = (document.getElementById('jurnal-hari')?.value || '');
  const jam = document.getElementById('jurnal-jam')?.value.trim() || '';
  const guru = (document.getElementById('jurnal-guru-select')?.value || '');
  const mapelSelect = document.getElementById('jurnal-mapel-select');
  const mapel = mapelSelect ? mapelSelect.value.trim() : '';
  const materi = (document.getElementById('jurnal-materi')?.value || '').trim();
  const keteranganLain = (document.getElementById('jurnal-keterangan-lain')?.value || '').trim();

  const hadir = parseInt((document.getElementById('jurnal-stat-hadir')?.textContent || '')) || 0;
  const sakit = parseInt((document.getElementById('jurnal-stat-sakit')?.textContent || '')) || 0;
  const izin = parseInt((document.getElementById('jurnal-stat-izin')?.textContent || '')) || 0;
  const alpha = parseInt((document.getElementById('jurnal-stat-alpha')?.textContent || '')) || 0;

  const namaSakit = (document.getElementById('jurnal-names-sakit')?.textContent || '');
  const namaIzin = (document.getElementById('jurnal-names-izin')?.textContent || '');
  const namaAlpha = (document.getElementById('jurnal-names-alpha')?.textContent || '');

  if (!kelas || !tanggal || !jam || !guru || !mapel || !materi) {
    showToast('Harap lengkapi seluruh kolom wajib jurnal!', 'warning');
    return;
  }

  toggleLoader(true, 'Menyimpan Jurnal Guru...');

  try {
    const payload = {
      id: id || `jurnal_${Date.now()}`,
      tanggal,
      hari,
      jam,
      kelas,
      guru,
      mapel,
      materi,
      hadir,
      sakit,
      izin,
      alpha,
      namaSakit,
      namaIzin,
      namaAlpha,
      keteranganLain
    };

    if (state.storageMode === 'server') {
      const res = await fetch('/api/jurnal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());

      if (res.error) throw new Error(res.error);
      await loadData();
    } else {
      if (id) {
        const idx = state.jurnalGuru.findIndex(j => j.id === id);
        if (idx !== -1) state.jurnalGuru[idx] = payload;
      } else {
        state.jurnalGuru.push(payload);
      }
      await persistData();
    }

    document.getElementById('jurnal-id').value = '';
    if (document.getElementById('jurnal-jam')) document.getElementById('jurnal-jam').value = '';
    document.getElementById('jurnal-materi').value = '';
    document.getElementById('jurnal-keterangan-lain').value = '';
    if (mapelSelect) {
      mapelSelect.value = '';
      mapelSelect.disabled = true;
    }
    document.getElementById('jurnal-guru-select').value = '';

    populateJurnalFilterOptions();
    renderJurnalRiwayatTable();
    showToast('Jurnal Guru berhasil disimpan!', 'success');
  } catch (err) {
    showToast(`Gagal menyimpan jurnal: ${err.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

function renderJurnalRiwayatTable() {
  const body = document.getElementById('jurnal-riwayat-table-body');
  if (!body) return;

  const filterGuru = document.getElementById('filter-jurnal-guru')?.value || '';
  const filterMapel = document.getElementById('filter-jurnal-mapel')?.value || '';
  const filterKelas = document.getElementById('filter-jurnal-kelas')?.value || '';

  body.innerHTML = '';

  let entries = state.jurnalGuru || [];
  if (filterGuru) {
    entries = entries.filter(j => j.guru === filterGuru);
  }
  if (filterMapel) {
    entries = entries.filter(j => j.mapel === filterMapel);
  }
  if (filterKelas) {
    entries = entries.filter(j => j.kelas === filterKelas);
  }

  if (entries.length === 0) {
    body.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Belum ada riwayat jurnal guru.</td></tr>`;
    return;
  }

  entries.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

  entries.forEach((j, idx) => {
    const tr = document.createElement('tr');
    const totalAtt = (j.hadir || 0) + (j.sakit || 0) + (j.izin || 0) + (j.alpha || 0);
    const hasAttendanceData = totalAtt > 0;

    let attendanceHtml = '';
    if (hasAttendanceData) {
      attendanceHtml = `
        <div class="d-flex gap-1 text-xs">
          <span class="badge badge-success" style="font-size:10px;">H: ${j.hadir}</span>
          <span class="badge badge-warning" style="font-size:10px;">S: ${j.sakit}</span>
          <span class="badge badge-info" style="font-size:10px;">I: ${j.izin}</span>
          <span class="badge badge-danger" style="font-size:10px;">A: ${j.alpha}</span>
        </div>
        ${j.namaSakit && j.namaSakit !== 'Tidak ada' ? `<div class="text-xs text-warning mt-1">Sakit: ${j.namaSakit}</div>` : ''}
        ${j.namaIzin && j.namaIzin !== 'Tidak ada' ? `<div class="text-xs text-info mt-1">Izin: ${j.namaIzin}</div>` : ''}
        ${j.namaAlpha && j.namaAlpha !== 'Tidak ada' ? `<div class="text-xs text-danger mt-1">Alpha: ${j.namaAlpha}</div>` : ''}
      `;
    } else {
      attendanceHtml = `
        <div class="mt-1">
          <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 11px;">
            <i data-lucide="alert-circle" class="v-middle mr-1" style="width:12px;height:12px;"></i>Belum ada data absensi siswa
          </span>
        </div>
      `;
    }

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>
        <div class="font-semibold">${j.hari || '-'}, ${formatLocalDate(j.tanggal)}</div>
      </td>
      <td>
        <span class="badge badge-info" style="background-color: var(--color-primary-glow); color: var(--color-primary); font-size: 11px; font-weight: 600;">${j.jam || '-'}</span>
      </td>
      <td>
        <span class="badge badge-primary mb-1">${j.kelas}</span>
        <div class="text-sm font-semibold">${j.mapel}</div>
      </td>
      <td><span class="font-semibold">${j.guru}</span></td>
      <td>
        <div class="text-sm mb-1" style="max-width: 280px; white-space: normal;"><strong>Materi:</strong> ${j.materi}</div>
        ${attendanceHtml}
      </td>
      <td style="max-width: 200px; white-space: normal;">
        ${j.keteranganLain
          ? `<div class="text-sm" style="color: var(--color-text-secondary); font-style: italic;">${j.keteranganLain}</div>`
          : `<span class="text-muted" style="font-size: 12px;">-</span>`
        }
      </td>
      <td class="text-center">
        <button class="btn btn-sm btn-icon btn-danger" onclick="deleteJurnalEntry('${j.id}')" title="Hapus Jurnal">
          <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
        </button>
      </td>
    `;
    body.appendChild(tr);
  });

  lucide.createIcons();
}

async function deleteJurnalEntry(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus entri jurnal ini?')) return;

  toggleLoader(true, 'Menghapus jurnal...');
  try {
    if (state.storageMode === 'server') {
      await fetch(`/api/jurnal/${id}`, { method: 'DELETE' });
      await loadData();
    } else {
      state.jurnalGuru = state.jurnalGuru.filter(j => j.id !== String(id));
      await persistData();
    }

    renderJurnalRiwayatTable();
    showToast('Jurnal Guru berhasil dihapus.', 'success');
  } catch (err) {
    showToast(`Gagal menghapus: ${err.message}`, 'error');
  } finally {
    toggleLoader(false);
  }
}

// ==========================================================================
// FEATURE: FITUR QR CODE JURNAL GURU (SCAN & PRINT)
// ==========================================================================

function toggle7KaihSubmenu(event) {
  if (event) event.stopPropagation();
  const submenu = document.getElementById('sidebar-7kaih-submenu');
  const chevron = document.getElementById('7kaih-chevron');
  if (submenu) {
    const isHidden = submenu.style.display === 'none' || !submenu.style.display;
    submenu.style.display = isHidden ? 'flex' : 'none';
    if (chevron) {
      chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  }
}

function switch7KaihRoute(routePath) {
  switchMenu('7kaih');
  const iframe = document.getElementById('iframe-7kaih');
  if (iframe) {
    const baseUrl = '7kaih/dist/index.html';
    iframe.src = `${baseUrl}#${routePath}`;
  }

  document.querySelectorAll('#sidebar-7kaih-submenu .submenu-item').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.sidebar-menu > .menu-item').forEach(btn => btn.classList.remove('active'));

  if (routePath === '/7kaih') {
    const btn = document.getElementById('btn-menu-input-7kaih');
    if (btn) btn.classList.add('active');
  } else if (routePath === '/parent-report') {
    const btn = document.getElementById('btn-menu-parent-7kaih');
    if (btn) btn.classList.add('active');
  } else {
    const mainBtn = document.getElementById('btn-menu-7kaih');
    if (mainBtn) mainBtn.classList.add('active');
    if (routePath === '/admin/dashboard') {
      const subBtn = document.getElementById('btn-submenu-7kaih-dashboard');
      if (subBtn) subBtn.classList.add('active');
    } else if (routePath === '/admin/reports') {
      const subBtn = document.getElementById('btn-submenu-7kaih-reports');
      if (subBtn) subBtn.classList.add('active');
    }
  }
}

// Auto-check URL query parameters on startup
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reqMenu = urlParams.get('menu');
    const reqKelas = urlParams.get('kelas');
    const reqKaihRoute = urlParams.get('kaihRoute');

    if (reqKaihRoute) {
      switch7KaihRoute(reqKaihRoute);
    } else if (reqMenu === 'jurnal-guru' || reqKelas) {
      if (typeof switchMenu === 'function' && document.getElementById('view-jurnal-guru')) {
        switchMenu('jurnal-guru');
      }

      if (reqKelas) {
        const kelasSelect = document.getElementById('jurnal-kelas');
        if (kelasSelect) {
          kelasSelect.value = reqKelas;
          updateJurnalAttendanceStats();
        }
      }
    }
  }, 600);
});

// ==========================================================================
// FEATURE: 7 KAIH (MONITORING 7 KEBIASAAN ANAK INDONESIA HEBAT)
// ==========================================================================

let kaihRekapTimeframe = 'hari-ini';

function switch7KaihTab(tabName) {
  const formContent = document.getElementById('7kaih-tab-form-content');
  const laporanContent = document.getElementById('7kaih-tab-laporan-content');
  const rekapContent = document.getElementById('7kaih-tab-rekap-content');

  const btnForm = document.getElementById('tab-7kaih-form-btn');
  const btnLaporan = document.getElementById('tab-7kaih-laporan-btn');
  const btnRekap = document.getElementById('tab-7kaih-rekap-btn');

  if (btnForm) btnForm.classList.remove('active');
  if (btnLaporan) btnLaporan.classList.remove('active');
  if (btnRekap) btnRekap.classList.remove('active');

  if (formContent) formContent.style.display = 'none';
  if (laporanContent) laporanContent.style.display = 'none';
  if (rekapContent) rekapContent.style.display = 'none';

  if (tabName === 'form') {
    if (btnForm) btnForm.classList.add('active');
    if (formContent) formContent.style.display = 'block';
  } else if (tabName === 'laporan') {
    if (btnLaporan) btnLaporan.classList.add('active');
    if (laporanContent) laporanContent.style.display = 'block';
    render7KaihLaporanTable();
  } else if (tabName === 'rekap') {
    if (btnRekap) btnRekap.classList.add('active');
    if (rekapContent) rekapContent.style.display = 'block';
    render7KaihRekapTable();
  }

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function init7KaihView() {
  populateClassSelect('7kaih-kelas');
  populateClassSelect('7kaih-filter-kelas');
  populateClassSelect('7kaih-lap-kelas');
  populateClassSelect('7kaih-rekap-kelas');
  
  // Set default filter options
  ['7kaih-filter-kelas', '7kaih-lap-kelas', '7kaih-rekap-kelas'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) {
      let hasEmpty = false;
      for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === '') { hasEmpty = true; break; }
      }
      if (!hasEmpty) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = id === '7kaih-rekap-kelas' ? 'Kosongkan untuk semua kelas' : 'Semua Kelas';
        sel.insertBefore(opt, sel.firstChild);
      }
    }
  });

  on7KaihFilterKelasChange();
  on7KaihLaporanKelasChange();
  on7KaihKelasChange();
  render7KaihHistoryTable();
  render7KaihLaporanTable();
  render7KaihRekapTable();
}

function on7KaihKelasChange() {
  const kelasSelect = document.getElementById('7kaih-kelas');
  const siswaSelect = document.getElementById('7kaih-siswa');
  if (!kelasSelect || !siswaSelect) return;

  const selectedKelas = kelasSelect.value;
  siswaSelect.innerHTML = '<option value="">-- Pilih Murid --</option>';

  if (!selectedKelas) return;

  const filteredStudents = (state.students || [])
    .filter(s => s.kelas === selectedKelas)
    .sort((a, b) => a.nama.localeCompare(b.nama));

  filteredStudents.forEach(student => {
    const opt = document.createElement('option');
    opt.value = student.id;
    opt.textContent = `${student.nama} (${student.nisn || 'NISN -'})`;
    siswaSelect.appendChild(opt);
  });
}

function on7KaihFilterKelasChange() {
  const filterKelasSelect = document.getElementById('7kaih-filter-kelas');
  const filterSiswaSelect = document.getElementById('7kaih-filter-siswa');
  if (!filterKelasSelect || !filterSiswaSelect) return;

  const selectedKelas = filterKelasSelect.value;
  filterSiswaSelect.innerHTML = '<option value="">-- Semua Murid --</option>';

  let filteredStudents = state.students || [];
  if (selectedKelas) {
    filteredStudents = filteredStudents.filter(s => s.kelas === selectedKelas);
  }
  filteredStudents.sort((a, b) => a.nama.localeCompare(b.nama));

  filteredStudents.forEach(student => {
    const opt = document.createElement('option');
    opt.value = student.id;
    opt.textContent = `${student.nama} (${student.kelas})`;
    filterSiswaSelect.appendChild(opt);
  });

  filter7KaihHistory();
}

function on7KaihLaporanKelasChange() {
  const kelasSelect = document.getElementById('7kaih-lap-kelas');
  const siswaSelect = document.getElementById('7kaih-lap-siswa');
  if (!kelasSelect || !siswaSelect) return;

  const selectedKelas = kelasSelect.value;
  siswaSelect.innerHTML = '<option value="">-- Semua Murid --</option>';

  let filteredStudents = state.students || [];
  if (selectedKelas) {
    filteredStudents = filteredStudents.filter(s => s.kelas === selectedKelas);
  }
  filteredStudents.sort((a, b) => a.nama.localeCompare(b.nama));

  filteredStudents.forEach(student => {
    const opt = document.createElement('option');
    opt.value = student.id;
    opt.textContent = `${student.nama} (${student.kelas})`;
    siswaSelect.appendChild(opt);
  });

  render7KaihLaporanTable();
}

function save7KaihEntry() {
  const tanggal = document.getElementById('7kaih-tanggal')?.value;
  const semester = document.getElementById('7kaih-semester')?.value || 'Ganjil';
  const kelas = document.getElementById('7kaih-kelas')?.value;
  const studentId = document.getElementById('7kaih-siswa')?.value;

  if (!tanggal) {
    showToast('Harap pilih tanggal pengisian.', 'warning');
    return;
  }
  if (!kelas) {
    showToast('Harap pilih kelas terlebih dahulu.', 'warning');
    return;
  }
  if (!studentId) {
    showToast('Harap pilih nama murid terlebih dahulu.', 'warning');
    return;
  }

  const student = state.students.find(s => String(s.id) === String(studentId));
  if (!student) {
    showToast('Data murid tidak ditemukan.', 'error');
    return;
  }

  const items = [
    { key: 'bangunPagi', label: 'Bangun Pagi', chkId: 'kaih-chk-1', ketId: 'kaih-ket-1' },
    { key: 'beribadah', label: 'Beribadah', chkId: 'kaih-chk-2', ketId: 'kaih-ket-2' },
    { key: 'berolahraga', label: 'Berolahraga', chkId: 'kaih-chk-3', ketId: 'kaih-ket-3' },
    { key: 'makanSehat', label: 'Makan Sehat', chkId: 'kaih-chk-4', ketId: 'kaih-ket-4' },
    { key: 'gemarBelajar', label: 'Gemar Belajar', chkId: 'kaih-chk-5', ketId: 'kaih-ket-5' },
    { key: 'bermasyarakat', label: 'Bermasyarakat', chkId: 'kaih-chk-6', ketId: 'kaih-ket-6' },
    { key: 'tidurCepat', label: 'Tidur Cepat', chkId: 'kaih-chk-7', ketId: 'kaih-ket-7' }
  ];

  const logData = {
    id: 'kaih-' + Date.now(),
    student_id: String(student.id),
    nama: student.nama,
    kelas: student.kelas,
    tanggal: tanggal,
    semester: semester,
    habits: {}
  };

  items.forEach(item => {
    const chk = document.getElementById(item.chkId);
    const ket = document.getElementById(item.ketId);
    logData.habits[item.key] = {
      checked: chk ? chk.checked : false,
      keterangan: ket ? ket.value.trim() : ''
    };
  });

  if (!state.kaihLogs) state.kaihLogs = [];
  state.kaihLogs.unshift(logData);

  persistData();
  showToast(`Berhasil menyimpan data 7 KAIH untuk ${student.nama}`, 'success');

  // Reset form inputs
  items.forEach(item => {
    const chk = document.getElementById(item.chkId);
    const ket = document.getElementById(item.ketId);
    if (chk) chk.checked = false;
    if (ket) ket.value = '';
  });

  render7KaihHistoryTable();
  render7KaihLaporanTable();
  render7KaihRekapTable();
}

function filter7KaihHistory() {
  render7KaihHistoryTable();
}

function render7KaihHistoryTable() {
  const tbody = document.getElementById('7kaih-history-body');
  if (!tbody) return;

  const filterKelas = document.getElementById('7kaih-filter-kelas')?.value || '';
  const filterSiswa = document.getElementById('7kaih-filter-siswa')?.value || '';

  let logs = state.kaihLogs || [];

  if (filterKelas) {
    logs = logs.filter(l => l.kelas === filterKelas);
  }
  if (filterSiswa) {
    const student = (state.students || []).find(s => String(s.id) === String(filterSiswa));
    const sNisn = student ? String(student.nisn || '').trim() : '';
    const sNama = student ? String(student.nama || '').trim().toLowerCase() : '';

    logs = logs.filter(l => {
      const lId = String(l.student_id || '').trim();
      const lNisn = String(l.nisn || '').trim();
      const lNama = String(l.nama || '').trim().toLowerCase();
      return lId === String(filterSiswa) || 
             (sNisn && (lId === sNisn || lNisn === sNisn)) ||
             (sNama && lNama === sNama);
    });
  }

  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="text-center text-muted py-4">
          Belum ada riwayat pengisian 7 KAIH.
        </td>
      </tr>
    `;
    return;
  }

  const habitKeys = [
    'bangunPagi', 'beribadah', 'berolahraga', 'makanSehat', 'gemarBelajar', 'bermasyarakat', 'tidurCepat'
  ];

  tbody.innerHTML = logs.map(log => {
    const habitCols = habitKeys.map(key => {
      const h = log.habits ? log.habits[key] : null;
      const checked = h ? h.checked : false;
      const ket = h && h.keterangan ? h.keterangan : '';

      if (checked) {
        return `
          <td class="text-center">
            <span class="badge badge-success" style="padding: 2px 6px; font-size: 11px;" title="${ket || 'ok'}">
              ✓ ${ket ? ket : 'ok'}
            </span>
          </td>
        `;
      } else {
        return `
          <td class="text-center text-muted" style="font-size: 12px;" title="${ket}">
            -
          </td>
        `;
      }
    }).join('');

    return `
      <tr>
        <td style="font-weight: 500;">${log.tanggal}</td>
        <td style="font-weight: 600;">${log.nama}</td>
        <td><span class="badge badge-info">${log.kelas}</span></td>
        <td>${log.semester}</td>
        ${habitCols}
        <td class="text-center">
          <button class="btn btn-icon btn-danger btn-xs" onclick="delete7KaihLog('${log.id}')" title="Hapus Data">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function delete7KaihLog(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus catatan 7 KAIH ini?')) return;
  state.kaihLogs = (state.kaihLogs || []).filter(l => l.id !== id);
  persistData();
  showToast('Catatan 7 KAIH berhasil dihapus.', 'info');
  render7KaihHistoryTable();
  render7KaihLaporanTable();
  render7KaihRekapTable();
}

function render7KaihLaporanTable() {
  const tbody = document.getElementById('7kaih-laporan-tbody');
  if (!tbody) return;

  const searchNama = document.getElementById('7kaih-lap-nama')?.value.toLowerCase().trim() || '';
  const filterKelas = document.getElementById('7kaih-lap-kelas')?.value || '';
  const filterSiswa = document.getElementById('7kaih-lap-siswa')?.value || '';
  const filterRentang = document.getElementById('7kaih-lap-rentang')?.value || 'semua';
  const filterSemester = document.getElementById('7kaih-lap-semester')?.value || '';

  let logs = state.kaihLogs || [];

  if (filterKelas) {
    logs = logs.filter(l => l.kelas === filterKelas);
  }
  if (filterSiswa) {
    logs = logs.filter(l => String(l.student_id) === String(filterSiswa) || (l.nama && l.nama.toLowerCase().includes(filterSiswa.toLowerCase())));
  }
  if (searchNama) {
    logs = logs.filter(l => (l.nama || '').toLowerCase().includes(searchNama));
  }
  if (filterSemester) {
    logs = logs.filter(l => l.semester === filterSemester);
  }

  const now = new Date();
  if (filterRentang === 'minggu') {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    logs = logs.filter(l => new Date(l.tanggal) >= sevenDaysAgo);
  } else if (filterRentang === 'bulan') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    logs = logs.filter(l => new Date(l.tanggal) >= startOfMonth);
  }

  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center text-muted py-4">
          Tidak ada data laporan 7 KAIH yang sesuai dengan filter.
        </td>
      </tr>
    `;
    return;
  }

  const habitKeys = ['bangunPagi', 'beribadah', 'berolahraga', 'gemarBelajar', 'makanSehat', 'bermasyarakat', 'tidurCepat'];

  tbody.innerHTML = logs.map(log => {
    const habitCols = habitKeys.map(key => {
      const h = log.habits ? log.habits[key] : null;
      const checked = h ? h.checked : false;
      const ket = h && h.keterangan ? h.keterangan : '';

      if (checked) {
        return `
          <td class="text-center">
            <span class="badge badge-success" style="padding: 2px 6px; font-size: 11px;" title="${ket || 'ok'}">
              ✓ ${ket ? ket : 'ok'}
            </span>
          </td>
        `;
      } else {
        return `<td class="text-center text-muted" style="font-size: 12px;">-</td>`;
      }
    }).join('');

    return `
      <tr>
        <td style="font-weight: 500;">${log.tanggal}</td>
        <td style="font-weight: 600;">${log.nama}</td>
        <td><span class="badge badge-info">${log.kelas}</span></td>
        ${habitCols}
      </tr>
    `;
  }).join('');

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function export7KaihLaporanExcel() {
  let logs = state.kaihLogs || [];
  if (logs.length === 0) {
    showToast('Tidak ada data 7 KAIH untuk diekspor.', 'warning');
    return;
  }

  const exportData = logs.map((log, index) => ({
    No: index + 1,
    Tanggal: log.tanggal,
    Semester: log.semester,
    'Nama Murid': log.nama,
    Kelas: log.kelas,
    'Bangun Pagi': log.habits?.bangunPagi?.checked ? (log.habits.bangunPagi.keterangan || 'Ya') : 'Tidak',
    Beribadah: log.habits?.beribadah?.checked ? (log.habits.beribadah.keterangan || 'Ya') : 'Tidak',
    Berolahraga: log.habits?.berolahraga?.checked ? (log.habits.berolahraga.keterangan || 'Ya') : 'Tidak',
    'Makan Sehat': log.habits?.makanSehat?.checked ? (log.habits.makanSehat.keterangan || 'Ya') : 'Tidak',
    'Gemar Belajar': log.habits?.gemarBelajar?.checked ? (log.habits.gemarBelajar.keterangan || 'Ya') : 'Tidak',
    Bermasyarakat: log.habits?.bermasyarakat?.checked ? (log.habits.bermasyarakat.keterangan || 'Ya') : 'Tidak',
    'Tidur Cepat': log.habits?.tidurCepat?.checked ? (log.habits.tidurCepat.keterangan || 'Ya') : 'Tidak'
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Laporan 7 KAIH");
  XLSX.writeFile(wb, `Laporan_7_KAIH_${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Berhasil mengekspor Laporan 7 KAIH ke Excel!', 'success');
}

function set7KaihRekapTimeframe(tf, btnElement) {
  kaihRekapTimeframe = tf;
  const pills = document.querySelectorAll('.kaih-tf-pill');
  pills.forEach(p => {
    p.classList.remove('active', 'btn-primary');
    p.classList.add('btn-outline');
  });
  if (btnElement) {
    btnElement.classList.remove('btn-outline');
    btnElement.classList.add('active', 'btn-primary');
  }
  render7KaihRekapTable();
}

function getDatesInRange(startDate, endDate) {
  const dates = [];
  const curr = new Date(startDate.getTime());
  curr.setHours(0, 0, 0, 0);
  const end = new Date(endDate.getTime());
  end.setHours(0, 0, 0, 0);

  while (curr <= end) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

function render7KaihRekapTable() {
  const tbody = document.getElementById('7kaih-rekap-tbody');
  const statCountEl = document.getElementById('7kaih-stat-count');
  if (!tbody) return;

  const selectedKelas = document.getElementById('7kaih-rekap-kelas')?.value || '';
  const students = state.students || [];
  const logs = state.kaihLogs || [];

  let targetStudents = students;
  if (selectedKelas) {
    targetStudents = targetStudents.filter(s => (s.kelas || '').toLowerCase() === selectedKelas.toLowerCase());
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let startDate = new Date(now.getTime());

  if (kaihRekapTimeframe === 'hari-ini') {
    startDate = new Date(now.getTime());
  } else if (kaihRekapTimeframe === '7-hari') {
    startDate = new Date(now.getTime());
    startDate.setDate(now.getDate() - 6);
  } else if (kaihRekapTimeframe === 'bulan') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (kaihRekapTimeframe === 'semester') {
    startDate = new Date(now.getTime());
    startDate.setDate(now.getDate() - 89);
  }

  const periodDates = getDatesInRange(startDate, now);

  const resultList = [];

  targetStudents.forEach(student => {
    const studentLogs = logs.filter(l => String(l.student_id) === String(student.id));
    const loggedDates = new Set(studentLogs.map(l => l.tanggal));

    // Determine dates in this period that student did not fill out
    const missingDates = periodDates.filter(d => !loggedDates.has(d));

    if (missingDates.length > 0) {
      resultList.push({
        student: student,
        missingDays: missingDates.length,
        missingDates: missingDates
      });
    }
  });

  if (statCountEl) {
    statCountEl.textContent = resultList.length;
  }

  if (resultList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">
          Semua siswa telah mengisi laporan 7 KAIH pada rentang waktu ini.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = resultList.map((item, index) => {
    const s = item.student;
    const allDatesStr = item.missingDates.join(', ');
    let displayDatesText = '';

    if (item.missingDates.length <= 5) {
      displayDatesText = `Belum mengisi pada tanggal: <strong style="color: var(--text-main);">${allDatesStr}</strong>`;
    } else {
      const firstFew = item.missingDates.slice(0, 4).join(', ');
      const extraCount = item.missingDates.length - 4;
      displayDatesText = `Belum mengisi pada tanggal: <strong style="color: var(--text-main);">${firstFew}</strong>, dan <strong style="color: var(--color-danger);">${extraCount} tanggal lainnya</strong>`;
    }

    return `
      <tr>
        <td style="font-weight: 500;">${index + 1}</td>
        <td>${s.nisn || s.nis || s.id}</td>
        <td style="font-weight: 600;">${s.nama}</td>
        <td><span class="badge badge-info">${s.kelas}</span></td>
        <td class="text-center">
          <span class="badge badge-danger" style="background: #ef4444; color: white; padding: 4px 10px; border-radius: 12px; font-weight: 600;">
            ${item.missingDays} Hari
          </span>
        </td>
        <td class="text-muted" title="${allDatesStr}">
          ${displayDatesText}
        </td>
      </tr>
    `;
  }).join('');
}

function reset7KaihRekapFilter() {
  const selectKelas = document.getElementById('7kaih-rekap-kelas');
  if (selectKelas) selectKelas.value = '';
  
  const pills = document.querySelectorAll('.kaih-tf-pill');
  if (pills && pills.length > 0) {
    set7KaihRekapTimeframe('hari-ini', pills[0]);
  } else {
    render7KaihRekapTable();
  }
}

function export7KaihBelumMengisiExcel() {
  const selectedKelas = document.getElementById('7kaih-rekap-kelas')?.value || '';
  const students = state.students || [];
  const logs = state.kaihLogs || [];

  let targetStudents = students;
  if (selectedKelas) {
    targetStudents = targetStudents.filter(s => (s.kelas || '').toLowerCase() === selectedKelas.toLowerCase());
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let startDate = new Date(now.getTime());

  if (kaihRekapTimeframe === 'hari-ini') {
    startDate = new Date(now.getTime());
  } else if (kaihRekapTimeframe === '7-hari') {
    startDate = new Date(now.getTime());
    startDate.setDate(now.getDate() - 6);
  } else if (kaihRekapTimeframe === 'bulan') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (kaihRekapTimeframe === 'semester') {
    startDate = new Date(now.getTime());
    startDate.setDate(now.getDate() - 89);
  }

  const periodDates = getDatesInRange(startDate, now);
  const resultList = [];

  targetStudents.forEach(student => {
    const studentLogs = logs.filter(l => String(l.student_id) === String(student.id));
    const loggedDates = new Set(studentLogs.map(l => l.tanggal));
    const missingDates = periodDates.filter(d => !loggedDates.has(d));

    if (missingDates.length > 0) {
      resultList.push({
        student: student,
        missingDays: missingDates.length,
        missingDates: missingDates
      });
    }
  });

  if (resultList.length === 0) {
    showToast('Tidak ada siswa yang belum mengisi untuk diekspor.', 'info');
    return;
  }

  const exportData = resultList.map((item, idx) => ({
    No: idx + 1,
    NIS: item.student.nisn || item.student.nis || item.student.id,
    'Nama Murid': item.student.nama,
    Kelas: item.student.kelas,
    'Jumlah Bolos (Hari)': `${item.missingDays} Hari`,
    'Tanggal Belum Mengisi': item.missingDates.join(', '),
    Keterangan: `Belum mengisi pada tanggal: ${item.missingDates.join(', ')} (${item.missingDays} hari)`
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Belum Mengisi");
  XLSX.writeFile(wb, `Rekap_Belum_Mengisi_7KAIH_${todayStr}.xlsx`);
  showToast('Berhasil mengekspor Rekapitulasi Belum Mengisi ke Excel!', 'success');
}

// ==========================================================================
// FEATURE: QR CODE AKSES inputjurnalguru.html
// ==========================================================================

let _jurnalGuruQRInstance = null;

function showJurnalGuruQR() {
  const modal = document.getElementById('modal-qr-jurnal');
  if (!modal) return;

  // Build the URL dynamically from current origin
  const url = `${window.location.origin}/inputjurnalguru.html`;

  // Show URL text
  const urlText = document.getElementById('qr-jurnal-url-text');
  if (urlText) urlText.textContent = url;

  // Clear old QR and generate new one
  const canvas = document.getElementById('qr-jurnal-canvas');
  if (canvas) {
    canvas.innerHTML = '';
    _jurnalGuruQRInstance = null;

    if (typeof QRCode !== 'undefined') {
      _jurnalGuruQRInstance = new QRCode(canvas, {
        text: url,
        width: 220,
        height: 220,
        colorDark: '#1e1b4b',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    } else {
      canvas.innerHTML = `<p style="color:#ef4444; font-size:13px;">Library QR Code tidak tersedia.<br>Pastikan terhubung ke internet.</p>`;
    }
  }

  // Show modal
  modal.style.display = 'flex';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '9999';
  modal.style.background = 'rgba(0,0,0,0.65)';
  modal.style.backdropFilter = 'blur(4px)';

  // Refresh icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeJurnalGuruQR() {
  const modal = document.getElementById('modal-qr-jurnal');
  if (modal) modal.style.display = 'none';
}

function printJurnalGuruQR() {
  const url = document.getElementById('qr-jurnal-url-text')?.textContent || '';
  const canvas = document.getElementById('qr-jurnal-canvas');
  const img = canvas ? canvas.querySelector('img') : null;
  const imgSrc = img ? img.src : '';

  const printWin = window.open('', '_blank');
  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>QR Code - Input Jurnal Guru</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fff; }
        .qr-print-card { text-align: center; padding: 32px; border: 2px solid #6366f1; border-radius: 20px; max-width: 380px; }
        .school-name { font-size: 15px; font-weight: 700; color: #1e1b4b; margin-bottom: 4px; }
        .title { font-size: 18px; font-weight: 800; color: #6366f1; margin: 8px 0 4px; }
        .subtitle { font-size: 12px; color: #6b7280; margin-bottom: 20px; }
        .qr-box { display: inline-block; padding: 12px; border: 3px solid #6366f1; border-radius: 12px; background: white; margin-bottom: 16px; }
        .qr-box img { display: block; width: 200px; height: 200px; }
        .url-box { background: #f5f3ff; border-radius: 8px; padding: 8px 12px; font-size: 11px; color: #6366f1; word-break: break-all; font-weight: 600; margin-bottom: 12px; }
        .info { font-size: 11px; color: #6b7280; }
        .badge { display: inline-block; background: #e0e7ff; color: #6366f1; border-radius: 20px; padding: 3px 12px; font-size: 11px; font-weight: 600; margin: 4px; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div class="qr-print-card">
        <div class="school-name">SMP Negeri 3 Batam</div>
        <div class="title">📖 Input Jurnal Pembelajaran Guru</div>
        <div class="subtitle">Scan QR Code ini untuk mengisi jurnal harian</div>
        <div class="qr-box">
          ${imgSrc ? `<img src="${imgSrc}" alt="QR Code">` : '<p style="color:#ef4444;">QR tidak tersedia</p>'}
        </div>
        <div class="url-box">${url}</div>
        <div>
          <span class="badge">🔐 Login dengan NIP</span>
          <span class="badge">📱 Gunakan kamera HP</span>
        </div>
        <div class="info" style="margin-top: 12px;">Hubungi admin sekolah jika mengalami kendala akses.</div>
      </div>
    </body>
    </html>
  `);
  printWin.document.close();
  setTimeout(() => printWin.print(), 600);
}

function downloadJurnalGuruQR() {
  const canvas = document.getElementById('qr-jurnal-canvas');
  const img = canvas ? canvas.querySelector('img') : null;
  if (!img) {
    showToast('QR Code belum siap, coba lagi.', 'warning');
    return;
  }

  // Convert to canvas and download
  const tempCanvas = document.createElement('canvas');
  const size = 260;
  tempCanvas.width = size;
  tempCanvas.height = size;
  const ctx = tempCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const qrImg = new Image();
  qrImg.crossOrigin = 'anonymous';
  qrImg.onload = function () {
    ctx.drawImage(qrImg, 20, 20, size - 40, size - 40);
    const link = document.createElement('a');
    link.download = 'QR_Jurnal_Guru.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
    showToast('QR Code berhasil diunduh!', 'success');
  };
  qrImg.onerror = function () {
    // Fallback: direct img src download
    const link = document.createElement('a');
    link.download = 'QR_Jurnal_Guru.png';
    link.href = img.src;
    link.click();
    showToast('QR Code berhasil diunduh!', 'success');
  };
  qrImg.src = img.src;
}

// Close modal on overlay click
document.addEventListener('click', function(e) {
  const modal = document.getElementById('modal-qr-jurnal');
  if (modal && e.target === modal) closeJurnalGuruQR();
});

/* ==========================================================================
   AUTHENTICATION & MANAJEMEN AKUN LOGIC
   ========================================================================== */

function getDefaultAccounts() {
  return [
    { id: '1', username: 'admin', password: '123', nama: 'Administrator', role: 'admin' },
    { id: '2', username: 'piket', password: '123', nama: 'Guru Piket', role: 'guru-piket' },
    { id: '3', username: 'osis', password: '123', nama: 'Pengurus OSIS', role: 'osis' }
  ];
}

function getAccountsList() {
  if (state.accounts && state.accounts.length > 0) {
    return state.accounts;
  }
  return getDefaultAccounts();
}

function doLogin(e) {
  if (e) e.preventDefault();
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const errorMsg = document.getElementById('login-error-msg');
  const errorText = document.getElementById('login-error-text');

  if (!usernameInput || !passwordInput) return;

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  const accounts = getAccountsList();
  const foundUser = accounts.find(acc => acc.username.toLowerCase() === username.toLowerCase() && acc.password === password);

  if (foundUser) {
    if (errorMsg) errorMsg.style.display = 'none';

    const sessionUser = {
      id: foundUser.id,
      username: foundUser.username,
      nama: foundUser.nama,
      role: foundUser.role
    };
    sessionStorage.setItem('currentUser', JSON.stringify(sessionUser));

    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.display = 'none';

    updateSidebarUser(sessionUser);
    applyRolePermissions(sessionUser);

    showToast(`Selamat datang, ${sessionUser.nama}!`, 'success');
  } else {
    if (errorMsg && errorText) {
      errorText.textContent = 'Username atau password salah.';
      errorMsg.style.display = 'flex';
    }
  }
}

function toggleLoginPassword() {
  const pwdInput = document.getElementById('login-password');
  const eyeOpen = document.getElementById('login-eye-open');
  const eyeClosed = document.getElementById('login-eye-closed');
  if (!pwdInput) return;

  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    if (eyeOpen) eyeOpen.style.display = 'none';
    if (eyeClosed) eyeClosed.style.display = 'inline-block';
  } else {
    pwdInput.type = 'password';
    if (eyeOpen) eyeOpen.style.display = 'inline-block';
    if (eyeClosed) eyeClosed.style.display = 'none';
  }
}

function doLogout() {
  sessionStorage.removeItem('currentUser');

  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  if (usernameInput) usernameInput.value = '';
  if (passwordInput) passwordInput.value = '';

  const errorMsg = document.getElementById('login-error-msg');
  if (errorMsg) errorMsg.style.display = 'none';

  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'flex';

  showToast('Anda telah keluar dari sistem.', 'info');
}

function checkAuthStatus() {
  const sessionData = sessionStorage.getItem('currentUser');
  const overlay = document.getElementById('login-overlay');

  if (sessionData) {
    try {
      const user = JSON.parse(sessionData);
      if (overlay) overlay.style.display = 'none';
      updateSidebarUser(user);
      applyRolePermissions(user);
      return user;
    } catch (e) {
      console.error('Invalid session data', e);
    }
  }

  if (overlay) overlay.style.display = 'flex';
  return null;
}

function updateSidebarUser(user) {
  const nameEl = document.getElementById('sidebar-user-name');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  const roleEl = document.getElementById('sidebar-user-role');

  if (nameEl) nameEl.textContent = user.nama || user.username;
  if (avatarEl) avatarEl.textContent = (user.nama || user.username).charAt(0).toUpperCase();

  if (roleEl) {
    let roleText = 'Admin';
    let roleClass = 'role-badge-admin';
    if (user.role === 'guru-piket') {
      roleText = 'Guru Piket';
      roleClass = 'role-badge-guru-piket';
    } else if (user.role === 'osis') {
      roleText = 'OSIS';
      roleClass = 'role-badge-osis';
    }
    roleEl.textContent = roleText;
    roleEl.className = `sidebar-user-role ${roleClass}`;
  }
}

function applyRolePermissions(user) {
  const userRole = user ? user.role : '';
  const elements = document.querySelectorAll('[data-roles]');

  elements.forEach(el => {
    const rolesStr = el.getAttribute('data-roles') || '';
    const roles = rolesStr.split(',').map(r => r.trim());

    if (userRole === 'admin' || roles.includes(userRole)) {
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });

  if (userRole && userRole !== 'admin') {
    const activeBtn = document.querySelector(`.menu-item[onclick*="${state.currentView}"]`);
    if (activeBtn) {
      const btnRoles = (activeBtn.getAttribute('data-roles') || '').split(',').map(r => r.trim());
      if (!btnRoles.includes(userRole)) {
        if (userRole === 'osis') {
          switchMenu('terlambat');
        } else if (userRole === 'guru-piket') {
          switchMenu('dashboard');
        }
      }
    }
  }
}

function renderAkunTable() {
  const tbody = document.getElementById('akun-table-body');
  if (!tbody) return;

  const accounts = getAccountsList();
  if (accounts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Belum ada akun terdaftar.</td></tr>`;
    return;
  }

  tbody.innerHTML = accounts.map((acc, index) => {
    let roleBadge = '';
    if (acc.role === 'admin') {
      roleBadge = '<span class="role-pill role-pill-admin">Admin</span>';
    } else if (acc.role === 'guru-piket') {
      roleBadge = '<span class="role-pill role-pill-guru-piket">Guru Piket</span>';
    } else if (acc.role === 'osis') {
      roleBadge = '<span class="role-pill role-pill-osis">OSIS</span>';
    } else {
      roleBadge = `<span class="role-pill">${acc.role}</span>`;
    }

    const isDefaultAdmin = acc.username === 'admin';

    return `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(acc.nama)}</strong></td>
        <td><code>${escapeHtml(acc.username)}</code></td>
        <td>${roleBadge}</td>
        <td class="text-center">
          <button class="btn-action edit" onclick="openAkunModal('${acc.id}')" title="Edit Akun">
            <i data-lucide="edit-3" style="width:14px;height:14px;"></i>
          </button>
          ${isDefaultAdmin ? '' : `
            <button class="btn-action delete" onclick="deleteAkun('${acc.id}')" title="Hapus Akun">
              <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

function openAkunModal(id = null) {
  const modal = document.getElementById('akun-modal');
  const title = document.getElementById('akun-modal-title');
  const form = document.getElementById('form-akun-detail');
  if (!modal || !form) return;

  form.reset();

  if (id) {
    const accounts = getAccountsList();
    const acc = accounts.find(a => String(a.id) === String(id));
    if (acc) {
      if (title) title.textContent = 'Edit Akun Pengguna';
      document.getElementById('akun-modal-id').value = acc.id;
      document.getElementById('akun-modal-nama').value = acc.nama;
      document.getElementById('akun-modal-username').value = acc.username;
      document.getElementById('akun-modal-password').value = acc.password;
      document.getElementById('akun-modal-role').value = acc.role;
    }
  } else {
    if (title) title.textContent = 'Tambah Akun Pengguna Baru';
    document.getElementById('akun-modal-id').value = '';
  }

  modal.style.display = 'flex';
}

function closeAkunModal() {
  const modal = document.getElementById('akun-modal');
  if (modal) modal.style.display = 'none';
}

async function handleAkunFormSubmit(e) {
  e.preventDefault();
  const id = (document.getElementById('akun-modal-id')?.value || '');
  const nama = (document.getElementById('akun-modal-nama')?.value || '').trim();
  const username = (document.getElementById('akun-modal-username')?.value || '').trim();
  const password = (document.getElementById('akun-modal-password')?.value || '').trim();
  const role = (document.getElementById('akun-modal-role')?.value || '');

  if (!nama || !username || !password || !role) {
    showToast('Harap isi semua kolom wajib!', 'error');
    return;
  }

  let accounts = getAccountsList();

  const existing = accounts.find(a => a.username.toLowerCase() === username.toLowerCase() && String(a.id) !== String(id));
  if (existing) {
    showToast(`Username "${username}" sudah digunakan!`, 'error');
    return;
  }

  if (id) {
    accounts = accounts.map(a => String(a.id) === String(id) ? { id: String(id), nama, username, password, role } : a);
  } else {
    const newId = String(Date.now());
    accounts.push({ id: newId, nama, username, password, role });
  }

  // Ensure a corresponding entry in state.teachers if user is a teacher/guru
  if (!state.teachers) state.teachers = [];
  const existingTeacher = state.teachers.find(t => (t.nip && t.nip === username) || t.nama.toLowerCase() === nama.toLowerCase());
  if (!existingTeacher) {
    state.teachers.push({
      id: 'guru_' + Date.now(),
      nip: username,
      nama: nama,
      mapel: role === 'guru-piket' ? 'Guru Piket' : 'Guru'
    });
  }

  state.accounts = accounts;
  await persistData();
  renderAkunTable();
  closeAkunModal();
  showToast(id ? 'Akun berhasil diperbarui!' : 'Akun baru berhasil ditambahkan!', 'success');
}

async function deleteAkun(id) {
  let accounts = getAccountsList();
  const acc = accounts.find(a => String(a.id) === String(id));
  if (!acc) return;

  if (acc.username === 'admin') {
    showToast('Akun admin utama tidak dapat dihapus.', 'error');
    return;
  }

  if (confirm(`Apakah Anda yakin ingin menghapus akun "${acc.nama}" (${acc.username})?`)) {
    state.accounts = accounts.filter(a => String(a.id) !== String(id));
    await persistData();
    renderAkunTable();
    showToast('Akun berhasil dihapus.', 'info');
  }
}

async function handleInlineAkunSubmit(e) {
  e.preventDefault();
  const nama = (document.getElementById('inline-akun-nama')?.value || '').trim();
  const username = (document.getElementById('inline-akun-username')?.value || '').trim();
  const password = (document.getElementById('inline-akun-password')?.value || '').trim();
  const role = (document.getElementById('inline-akun-role')?.value || '');

  if (!nama || !username || !password || !role) {
    showToast('Harap isi semua kolom wajib!', 'error');
    return;
  }

  let accounts = getAccountsList();

  const existing = accounts.find(a => a.username.toLowerCase() === username.toLowerCase());
  if (existing) {
    showToast(`Username "${username}" sudah digunakan!`, 'error');
    return;
  }

  const newId = String(Date.now());
  accounts.push({ id: newId, nama, username, password, role });

  // Ensure a corresponding entry in state.teachers if user is a teacher/guru
  if (!state.teachers) state.teachers = [];
  const existingTeacher = state.teachers.find(t => (t.nip && t.nip === username) || t.nama.toLowerCase() === nama.toLowerCase());
  if (!existingTeacher) {
    state.teachers.push({
      id: 'guru_' + Date.now(),
      nip: username,
      nama: nama,
      mapel: role === 'guru-piket' ? 'Guru Piket' : 'Guru'
    });
  }

  state.accounts = accounts;
  await persistData();

  document.getElementById('form-inline-tambah-akun')?.reset();
  showToast('Akun baru berhasil ditambahkan!', 'success');
  switchAkunTab('daftar');
}

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
  } else {
    input.type = 'password';
  }
}

async function confirmResetAllData() {
  const confirmed1 = confirm(
    "⚠️ PERINGATAN KERAS / WARNING ⚠️\n\n" +
    "Apakah Anda YAKIN ingin MERESET SELURUH DATA di dalam aplikasi?\n\n" +
    "Tindakan ini akan MENGHAPUS PERMANEN:\n" +
    "1. Seluruh Data Siswa & Data Guru\n" +
    "2. Seluruh Catatan Absensi, Keterlambatan, Pelanggaran & Izin Pulang\n" +
    "3. Seluruh Jurnal Guru & Catatan 7 KAIH Siswa\n" +
    "4. Seluruh Data di Local Storage & Server Cloud Supabase\n\n" +
    "Klik OK jika Anda benar-benar yakin."
  );
  if (!confirmed1) return;

  const confirmText = prompt("Ketik kata 'RESET' (huruf besar) untuk konfirmasi:");
  if (confirmText !== 'RESET') {
    showToast('Reset dibatalkan. Kata konfirmasi tidak sesuai.', 'info');
    return;
  }
  
  toggleLoader(true, 'Hard Reset berjalan... jangan tutup halaman ini.');

  try {
    const resetTime = new Date().toISOString();
    const currentUser = state.currentUser
      ? (state.currentUser.nama || state.currentUser.username || 'Admin')
      : 'Admin';

    // ===========================================================
    // LANGKAH 1: KOSONGKAN STATE & RENDER UI KE 0 SEKETIKA
    // ===========================================================
    state.students   = [];
    state.teachers   = [];
    state.attendance = [];
    state.lateLogs   = [];
    state.violations = [];
    state.izinPulang = [];
    state.jurnalGuru = [];
    state.kaihLogs   = [];

    state.currentView = 'dashboard';
    renderDashboard(); // tampilkan 0 langsung

    // ===========================================================
    // LANGKAH 2: BERSIHKAN SEMUA LOCALSTORAGE
    // ===========================================================
    const keysToKeep = ['theme', 'storageMode', 'githubSettings'];
    Object.keys(localStorage).forEach(key => {
      if (!keysToKeep.includes(key)) localStorage.removeItem(key);
    });
    localStorage.setItem('lastResetAt', resetTime); // guard 60 detik
    saveLocalState(); // simpan state kosong

    // ===========================================================
    // LANGKAH 3: HAPUS SUPABASE BERURUTAN + VERIFIKASI PER-BARIS
    // ===========================================================
    if (supabaseClient) {
      const emptyPayload = {
        id: 1, resetAt: resetTime, isReset: true,
        students: [], attendance: [], latelogs: [], violations: [],
        izinpulang: [], jurnalguru: [], teachers: [], kaihlogs: [],
        accounts: getAccountsList(), updated_at: resetTime
      };

      // 3a. Update school_data ke kosong (sinyal reset)
      try { await supabaseClient.from('school_data').upsert(emptyPayload, { onConflict: 'id' }); }
      catch (e) { console.warn('school_data clear:', e); }

      // 3b. Hapus tabel satu per satu BERURUTAN dengan verifikasi
      const tablesToClear = [
        'students', 'teachers', 'attendance',
        'late_logs', 'violations', 'izin_pulang',
        'jurnal_guru', 'kaih_logs'
      ];

      for (const tbl of tablesToClear) {
        toggleLoader(true, `Menghapus ${tbl}...`);
        try {
          await supabaseClient.from(tbl).delete().not('id', 'is', null);
          // Verifikasi — jika masih ada, hapus per baris
          const check = await supabaseClient.from(tbl).select('id').limit(1);
          if (check.data && check.data.length > 0) {
            const allRows = await supabaseClient.from(tbl).select('id');
            if (allRows.data) {
              for (const row of allRows.data) {
                try { await supabaseClient.from(tbl).delete().eq('id', row.id); }
                catch (_) {}
              }
            }
          }
        } catch (e) { console.warn(`Hapus ${tbl}:`, e); }
      }

      // 3c. Update school_data kosong sekali lagi (konfirmasi akhir)
      try { await supabaseClient.from('school_data').upsert(emptyPayload, { onConflict: 'id' }); }
      catch (e) {}

      // 3d. Broadcast reset ke semua user aktif
      try {
        if (realtimeChannel) {
          await realtimeChannel.send({
            type: 'broadcast', event: 'reset',
            payload: { resetBy: currentUser, resetAt: resetTime }
          });
        }
      } catch (e) {}
    }

    // ===========================================================
    // LANGKAH 4: RENDER ULANG & RELOAD
    // ===========================================================
    refreshAllUI();
    toggleLoader(false);
    showToast('\u2705 Hard Reset selesai! Semua data berhasil dihapus.', 'success');
    setTimeout(() => window.location.reload(), 2000);

  } catch (error) {
    toggleLoader(false);
    showToast(`Gagal Hard Reset: ${error.message}`, 'error');
  }
}
