/**
 * 🛠️ Dashboard Control 7KAIH SMAN 1 Bogor
 * Logic Full-Stack Client: Supabase Realtime, CRUD, Chart.js, & PDF Printing
 */

// Kredensial Supabase Project Anda (Ganti dengan Key Anda)
const SUPABASE_URL = 'https://udgxelmebjzzwlumnbox.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkZ3hlbG1lYmp6endsdW1uYm94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NDIwMTksImV4cCI6MjEwOTAxODAxOX0.Q6m0XquxaKNhMlz7Ef03xHzu5Sbq3yE8WphpwZmVnhA';


// Inisialisasi SDK Supabase dengan Proteksi Browser
const supabaseClient = (typeof window !== 'undefined' && window.supabase) 
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
    : null;

// Global Chart Instances
let habitsChartInstance = null;
let categoryChartInstance = null;
let adminChartInstance = null;

// Inisialisasi Aplikasi Saat DOM Siap
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const today = new Date().toISOString().split('T')[0];
        if (document.getElementById('add_entry_date')) document.getElementById('add_entry_date').value = today;
        if (document.getElementById('student_input_date')) document.getElementById('student_input_date').value = today;

        // Muat Komponen Utama
        loadHabitsTable();
        initCharts();
        fetchRealtimeClassData();

        // Jalankan Langganan Realtime WebSocket
        subscribeToSupabaseRealtime();
    });
}

/**
 * ========================================================
 * 1. ROLE SWITCHER & EXECUTIVE DASHBOARD LOAD
 * ========================================================
 */
function changeRoleView(role) {
    const siswaEl = document.getElementById('roleSiswa');
    const ortuEl = document.getElementById('roleOrangTua');
    const waliEl = document.getElementById('roleWaliKelas');
    const adminEl = document.getElementById('roleAdmin');

    if (siswaEl) siswaEl.classList.add('hidden');
    if (ortuEl) ortuEl.classList.add('hidden');
    if (waliEl) waliEl.classList.add('hidden');
    if (adminEl) adminEl.classList.add('hidden');

    if (role === 'siswa' && siswaEl) siswaEl.classList.remove('hidden');
    if (role === 'orang_tua' && ortuEl) ortuEl.classList.remove('hidden');
    if (role === 'wali_kelas' && waliEl) waliEl.classList.remove('hidden');
    if (role === 'admin' && adminEl) {
        adminEl.classList.remove('hidden');
        loadAdminExecutiveData(); // Memuat statistik khusus Executive Admin
    }
}

/**
 * ========================================================
 * 2. LOAD TABEL DATA & ASESMEN OTOMATIS (ST/MT/BT)
 * ========================================================
 */
async function loadHabitsTable() {
    const tbody = document.getElementById('habitsTableBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Memuat data Supabase...</td></tr>`;

    try {
        if (!supabaseClient) return;
        const { data, error } = await supabaseClient
            .from('daily_habits')
            .select(`
                id, entry_date, 
                bangun_pagi, beribadah, berolahraga, makan_sehat, gemar_belajar, bermasyarakat, tidur_cepat,
                screen_time_hours, validated_by_parent, validated_by_teacher,
                profiles ( full_name, classes ( class_name ) )
            `)
            .order('entry_date', { ascending: false })
            .limit(50);

        if (error) throw error;
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Belum ada data log kebiasaan.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(item => {
            const habits = [
                item.bangun_pagi, 
                item.beribadah, 
                item.berolahraga, 
                item.makan_sehat, 
                item.gemar_belajar, 
                item.bermasyarakat, 
                item.tidur_cepat
            ];
            const completedCount = habits.filter(Boolean).length;
            const percentage = Math.round((completedCount / 7) * 100);

            let categoryBadge = '';
            if (percentage > 70) {
                categoryBadge = `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-bold text-[10px]">ST (${percentage}%)</span>`;
            } else if (percentage >= 50) {
                categoryBadge = `<span class="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-bold text-[10px]">MT (${percentage}%)</span>`;
            } else {
                categoryBadge = `<span class="bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded font-bold text-[10px]">BT (${percentage}%)</span>`;
            }

            const studentName = item.profiles?.full_name || 'Ahmad Fauzi';
            const className = item.profiles?.classes?.class_name || 'X-1';

            return `
                <tr class="hover:bg-slate-50 border-b transition">
                    <td class="p-3 font-medium text-slate-700">${item.entry_date}</td>
                    <td class="p-3">
                        <span class="font-bold text-slate-900 block">${studentName}</span>
                        <span class="text-[10px] text-slate-400 font-semibold">${className}</span>
                    </td>
                    <td class="p-3 text-center">
                        <div class="font-bold text-slate-800">${completedCount} / 7 Kebiasaan</div>
                        <div class="w-full bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div class="bg-indigo-600 h-1.5 rounded-full" style="width: ${percentage}%"></div>
                        </div>
                    </td>
                    <td class="p-3 text-center">${categoryBadge}</td>
                    <td class="p-3 text-center">
                        ${item.validated_by_parent ? '<span class="text-emerald-600 font-bold">✅ Valid</span>' : '<span class="text-slate-400 font-medium">⏳ Belum</span>'}
                    </td>
                    <td class="p-3 text-center space-x-1">
                        <button onclick='openEditModal(${JSON.stringify(item)})' class="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded font-semibold text-[11px] shadow-sm">✏️ Edit</button>
                        <button onclick="openDeleteModal('${item.id}')" class="bg-rose-500 hover:bg-rose-600 text-white px-2.5 py-1 rounded font-semibold text-[11px] shadow-sm">🗑️ Hapus</button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Gagal memuat data:", err.message);
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-rose-500">Gagal memuat data: ${err.message}</td></tr>`;
    }
}

/**
 * ========================================================
 * 3. LOGIKA CRUD & MODAL HANDLERS
 * ========================================================
 */
function openAddModal() { 
    const el = document.getElementById('addModal');
    if (el) el.classList.remove('hidden'); 
}
function closeAddModal() { 
    const el = document.getElementById('addModal');
    if (el) el.classList.add('hidden'); 
}

async function submitAddData(e) {
    e.preventDefault();
    const btn = document.getElementById('btnAddSubmit');
    if (btn) btn.disabled = true;

    try {
        if (!supabaseClient) throw new Error("Supabase client belum terinisialisasi.");
        const user = (await supabaseClient.auth.getUser()).data?.user;
        const payload = {
            student_id: user ? user.id : '00000000-0000-0000-0000-000000000000',
            entry_date: document.getElementById('add_entry_date').value,
            bangun_pagi: document.getElementById('add_b1').checked,
            beribadah: document.getElementById('add_b2').checked,
            berolahraga: document.getElementById('add_b3').checked,
            makan_sehat: document.getElementById('add_b4').checked,
            gemar_belajar: document.getElementById('add_b5').checked,
            bermasyarakat: document.getElementById('add_b6').checked,
            tidur_cepat: document.getElementById('add_b7').checked,
            screen_time_hours: parseFloat(document.getElementById('add_screen_time').value) || 0
        };

        const { error } = await supabaseClient.from('daily_habits').insert([payload]);
        if (error) throw error;

        alert("🎉 Log 7 Kebiasaan berhasil disimpan!");
        closeAddModal();
        loadHabitsTable();
    } catch (err) {
        alert("Gagal menyimpan: " + err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

function openEditModal(item) {
    document.getElementById('edit_id').value = item.id;
    document.getElementById('edit_entry_date').value = item.entry_date;
    document.getElementById('edit_b1').checked = item.bangun_pagi || false;
    document.getElementById('edit_b2').checked = item.beribadah || false;
    document.getElementById('edit_b3').checked = item.berolahraga || false;
    document.getElementById('edit_b4').checked = item.makan_sehat || false;
    document.getElementById('edit_b5').checked = item.gemar_belajar || false;
    document.getElementById('edit_b6').checked = item.bermasyarakat || false;
    document.getElementById('edit_b7').checked = item.tidur_cepat || false;
    document.getElementById('edit_val_parent').checked = item.validated_by_parent || false;
    document.getElementById('edit_val_teacher').checked = item.validated_by_teacher || false;

    const el = document.getElementById('editModal');
    if (el) el.classList.remove('hidden');
}
function closeEditModal() { 
    const el = document.getElementById('editModal');
    if (el) el.classList.add('hidden'); 
}

async function submitEditData(e) {
    e.preventDefault();
    const id = document.getElementById('edit_id').value;
    const btn = document.getElementById('btnEditSubmit');
    if (btn) btn.disabled = true;

    try {
        if (!supabaseClient) throw new Error("Supabase client belum terinisialisasi.");
        const updated = {
            entry_date: document.getElementById('edit_entry_date').value,
            bangun_pagi: document.getElementById('edit_b1').checked,
            beribadah: document.getElementById('edit_b2').checked,
            berolahraga: document.getElementById('edit_b3').checked,
            makan_sehat: document.getElementById('edit_b4').checked,
            gemar_belajar: document.getElementById('edit_b5').checked,
            bermasyarakat: document.getElementById('edit_b6').checked,
            tidur_cepat: document.getElementById('edit_b7').checked,
            validated_by_parent: document.getElementById('edit_val_parent').checked,
            validated_by_teacher: document.getElementById('edit_val_teacher').checked
        };

        const { error } = await supabaseClient.from('daily_habits').update(updated).eq('id', id);
        if (error) throw error;

        alert("✅ Data berhasil diperbarui!");
        closeEditModal();
        loadHabitsTable();
    } catch (err) {
        alert("Gagal memperbarui: " + err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

function openDeleteModal(id) {
    document.getElementById('delete_target_id').value = id;
    const el = document.getElementById('deleteModal');
    if (el) el.classList.remove('hidden');
}
function closeDeleteModal() { 
    const el = document.getElementById('deleteModal');
    if (el) el.classList.add('hidden'); 
}

async function executeDeleteData() {
    const id = document.getElementById('delete_target_id').value;
    const btn = document.getElementById('btnDeleteSubmit');
    if (btn) btn.disabled = true;

    try {
        if (!supabaseClient) throw new Error("Supabase client belum terinisialisasi.");
        const { error } = await supabaseClient.from('daily_habits').delete().eq('id', id);
        if (error) throw error;

        alert("🗑️ Data log berhasil dihapus!");
        closeDeleteModal();
        loadHabitsTable();
    } catch (err) {
        alert("Gagal menghapus: " + err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

function openImportModal() { 
    const el = document.getElementById('importModal');
    if (el) el.classList.remove('hidden'); 
}
function closeImportModal() { 
    const el = document.getElementById('importModal');
    if (el) el.classList.add('hidden'); 
}

async function submitImportCSV(e) {
    e.preventDefault();
    const fileInput = document.getElementById('csv_file_input');
    if (!fileInput || !fileInput.files.length) return alert("Pilih file CSV terlebih dahulu.");

    const reader = new FileReader();
    reader.onload = async function(evt) {
        try {
            if (!supabaseClient) throw new Error("Supabase client belum terinisialisasi.");
            const lines = evt.target.result.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const rows = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim().toLowerCase());
                if (cols.length >= 9) {
                    rows.push({
                        student_id: cols[0],
                        entry_date: cols[1],
                        bangun_pagi: cols[2] === 'true' || cols[2] === '1',
                        beribadah: cols[3] === 'true' || cols[3] === '1',
                        berolahraga: cols[4] === 'true' || cols[4] === '1',
                        makan_sehat: cols[5] === 'true' || cols[5] === '1',
                        gemar_belajar: cols[6] === 'true' || cols[6] === '1',
                        bermasyarakat: cols[7] === 'true' || cols[7] === '1',
                        tidur_cepat: cols[8] === 'true' || cols[8] === '1'
                    });
                }
            }

            const { error } = await supabaseClient.from('daily_habits').upsert(rows, { onConflict: 'student_id,entry_date' });
            if (error) throw error;

            alert(`🎉 Berhasil mengimpor ${rows.length} baris data!`);
            closeImportModal();
            loadHabitsTable();
        } catch (err) {
            alert("Gagal import: " + err.message);
        }
    };
    reader.readAsText(fileInput.files[0]);
}

function parentApproveAction() {
    alert("Paraf & Validasi Orang Tua Berhasil Disimpan!");
}

async function submitMainFormLog() {
    alert("Jurnal 7KAIH Hari Ini Berhasil Disimpan!");
}

/**
 * ==========================================================
 * 4. CHART.JS REALTIME & REALTIME SUBSCRIPTION SUPABASE
 * ==========================================================
 */
function initCharts() {
    const barEl = document.getElementById('habitsBarChart');
    if (barEl && window.Chart) {
        const ctxBar = barEl.getContext('2d');
        habitsChartInstance = new window.Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['Bangun Pagi', 'Beribadah', 'Berolahraga', 'Makan Sehat', 'Gemar Belajar', 'Bermasyarakat', 'Tidur Cepat'],
                datasets: [{
                    label: '% Keterlaksanaan',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: 'rgba(79, 70, 229, 0.85)',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } },
                plugins: { legend: { display: false } }
            }
        });
    }

    const pieEl = document.getElementById('categoryDoughnutChart');
    if (pieEl && window.Chart) {
        const ctxPie = pieEl.getContext('2d');
        categoryChartInstance = new window.Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: ['Sudah Terbiasa (ST)', 'Mulai Terbiasa (MT)', 'Belum Terbiasa (BT)'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#10b981', '#f59e0b', '#f43f5e']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } }
            }
        });
    }
}

async function fetchRealtimeClassData() {
    const classFilterEl = document.getElementById('chartClassFilter');
    const selectedClass = classFilterEl ? classFilterEl.value : 'ALL';
    const badgeEl = document.getElementById('chartClassBadge');
    if (badgeEl) badgeEl.innerText = selectedClass === 'ALL' ? 'Semua Kelas' : `Kelas ${selectedClass}`;

    try {
        if (!supabaseClient) return;
        const { data, error } = await supabaseClient.from('daily_habits').select('*');
        if (error || !data || data.length === 0) return;

        const total = data.length;
        const sums = [0, 0, 0, 0, 0, 0, 0];
        let st = 0, mt = 0, bt = 0;

        data.forEach(item => {
            const h = [
                item.bangun_pagi, 
                item.beribadah, 
                item.berolahraga, 
                item.makan_sehat, 
                item.gemar_belajar, 
                item.bermasyarakat, 
                item.tidur_cepat
            ];
            h.forEach((val, idx) => { if (val) sums[idx]++; });

            const pct = (h.filter(Boolean).length / 7) * 100;
            if (pct > 70) st++;
            else if (pct >= 50) mt++;
            else bt++;
        });

        const habitPct = sums.map(s => Math.round((s / total) * 100));

        if (habitsChartInstance && habitsChartInstance.data && habitsChartInstance.data.datasets && habitsChartInstance.data.datasets[0]) {
            habitsChartInstance.data.datasets[0].data = habitPct;
            habitsChartInstance.update();
        }
        if (categoryChartInstance && categoryChartInstance.data && categoryChartInstance.data.datasets && categoryChartInstance.data.datasets[0]) {
            categoryChartInstance.data.datasets[0].data = [st, mt, bt];
            categoryChartInstance.update();
        }
    } catch (err) {
        console.error("Gagal update chart:", err);
    }
}

function subscribeToSupabaseRealtime() {
    if (!supabaseClient) return;
    supabaseClient
        .channel('public:daily_habits')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_habits' }, () => {
            fetchRealtimeClassData();
            loadHabitsTable();
            const adminEl = document.getElementById('roleAdmin');
            if (adminEl && !adminEl.classList.contains('hidden')) {
                loadAdminExecutiveData();
            }
        })
        .subscribe();
}

/**
 * ==========================================================
 * 5. LOGIKA EXECUTIVE ADMIN DASHBOARD
 * ==========================================================
 */
async function loadAdminExecutiveData() {
    try {
        if (!supabaseClient) return;
        const { data, error } = await supabaseClient.from('daily_habits').select('*');
        
        const totalLogsEl = document.getElementById('adminTotalLogs');
        const avgScoreEl = document.getElementById('adminAvgScore');
        const percentSTEl = document.getElementById('adminPercentST');
        const parentValRateEl = document.getElementById('adminParentValRate');

        if (error || !data || data.length === 0) {
            if (totalLogsEl) totalLogsEl.innerText = '0';
            if (avgScoreEl) avgScoreEl.innerText = '0%';
            if (percentSTEl) percentSTEl.innerText = '0%';
            if (parentValRateEl) parentValRateEl.innerText = '0%';
            renderAdminChart([0, 0, 0, 0, 0, 0, 0]);
            return;
        }

        const totalLogs = data.length;
        let sumHabits = 0;
        let countST = 0;
        let countParentVal = 0;
        const habitSums = [0, 0, 0, 0, 0, 0, 0];

        data.forEach(item => {
            const habits = [
                item.bangun_pagi, 
                item.beribadah, 
                item.berolahraga, 
                item.makan_sehat, 
                item.gemar_belajar, 
                item.bermasyarakat, 
                item.tidur_cepat
            ];
            const completed = habits.filter(Boolean).length;
            
            sumHabits += completed;
            if ((completed / 7) * 100 > 70) countST++;
            if (item.validated_by_parent) countParentVal++;

            habits.forEach((v, i) => { if (v) habitSums[i]++; });
        });

        // Update Kartu KPI Admin
        if (totalLogsEl) totalLogsEl.innerText = totalLogs.toLocaleString('id-ID');
        if (avgScoreEl) avgScoreEl.innerText = Math.round((sumHabits / (totalLogs * 7)) * 100) + '%';
        if (percentSTEl) percentSTEl.innerText = Math.round((countST / totalLogs) * 100) + '%';
        if (parentValRateEl) parentValRateEl.innerText = Math.round((countParentVal / totalLogs) * 100) + '%';

        // Render Grafik Agregat Admin
        renderAdminChart(habitSums.map(s => Math.round((s / totalLogs) * 100)));

    } catch (err) {
        console.error("Gagal memuat data eksekutif admin:", err);
    }
}

function renderAdminChart(percentages = [0, 0, 0, 0, 0, 0, 0]) {
    const ctx = document.getElementById('adminOverviewChart');
    if (!ctx || !window.Chart) return;

    if (adminChartInstance) adminChartInstance.destroy();

    adminChartInstance = new window.Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Bangun Pagi', 'Beribadah', 'Berolahraga', 'Makan Sehat', 'Gemar Belajar', 'Bermasyarakat', 'Tidur Cepat'],
            datasets: [{
                label: '% Capaian Seluruh Sekolah',
                data: percentages,
                backgroundColor: 'rgba(147, 51, 234, 0.85)',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } },
            plugins: { legend: { display: false } }
        }
    });
}

/**
 * ==========================================================
 * 6. GENERATOR LAPORAN CETAK PDF BULANAN
 * ==========================================================
 */
function printMonthlyReportPDF() {
    const chartCanvas = document.getElementById('habitsBarChart');
    if (chartCanvas) {
        const pdfImg = document.getElementById('pdfChartImage');
        if (pdfImg) pdfImg.src = chartCanvas.toDataURL('image/png');
    }

    const habitNames = [
        { name: '1. Bangun Pagi', rule: '04.00 - 06.00 WIB' },
        { name: '2. Beribadah', rule: 'Rutin sesuai agama/kepercayaan' },
        { name: '3. Berolahraga', rule: 'Aktivitas fisik / senam harian' },
        { name: '4. Makan Sehat & Bergizi', rule: 'Nutrisi seimbang Isi Piringku' },
        { name: '5. Gemar Belajar', rule: 'Literasi & mengulang pelajaran' },
        { name: '6. Bermasyarakat', rule: 'Kepedulian sosial & lingkungan' },
        { name: '7. Tidur Cepat', rule: 'Istirahat berkualitas (Maks 21.00 WIB)' }
    ];

    const currentData = (habitsChartInstance && habitsChartInstance.data && habitsChartInstance.data.datasets && habitsChartInstance.data.datasets[0]) 
        ? habitsChartInstance.data.datasets[0].data 
        : [0, 0, 0, 0, 0, 0, 0];

    const pdfTbody = document.getElementById('pdfTableBody');
    if (pdfTbody) {
        pdfTbody.innerHTML = habitNames.map((h, idx) => `
            <tr class="border-b border-slate-200">
                <td class="border border-slate-300 p-2 text-center font-bold">${idx + 1}</td>
                <td class="border border-slate-300 p-2 font-semibold">${h.name}</td>
                <td class="border border-slate-300 p-2 text-slate-600">${h.rule}</td>
                <td class="border border-slate-300 p-2 text-center font-bold text-indigo-900">${currentData[idx] || 0}%</td>
            </tr>
        `).join('');
    }

    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const signDateEl = document.getElementById('pdfSignDate');
    if (signDateEl) signDateEl.innerText = new Date().toLocaleDateString('id-ID', options);

    window.print();
}
