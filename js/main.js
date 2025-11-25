import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { auth, db, APP_ID } from "./firebase-config.js";
import { onAuthStateChanged, getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getUserProfile, logoutUser, loginUser, registerUser } from "./auth.js";

const state = { cars: [], drivers: [], customers: [], trips: [], userProfile: null, users: [] };
const currencyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const getColRef = (colName) => collection(db, "apps", APP_ID, colName);

// --- INIT ---
async function initApp() {
    onAuthStateChanged(auth, async (user) => {
        const loading = document.getElementById('loading-overlay');
        if (user) {
            loading.style.display = 'flex';
            try {
                const profileData = await getUserProfile(user.uid);
                if (!profileData) {
                    alert("⚠️ TÀI KHOẢN LỖI: Chưa có thông tin.\nHệ thống sẽ tự động đăng xuất.");
                    await logoutUser(); window.location.reload(); return;
                }
                const profile = { ...profileData, uid: user.uid };
                state.userProfile = profile;
                document.getElementById('landing-page').classList.add('hidden');
                document.getElementById('auth-modal').classList.add('hidden');
                document.getElementById('dashboard-app').classList.remove('hidden');
                setupDashboard(profile);
            } catch (error) {
                console.error(error); await logoutUser(); window.location.reload();
            } finally { loading.style.display = 'none'; }
        } else {
            state.userProfile = null;
            document.getElementById('landing-page').classList.remove('hidden');
            document.getElementById('dashboard-app').classList.add('hidden');
            loading.style.display = 'none';
        }
    });
    setupAuthEvents();
}

// --- AUTH UI ---
function setupAuthEvents() {
    const modal = document.getElementById('auth-modal');
    const loginForm = document.getElementById('login-form-container');
    const signupForm = document.getElementById('signup-form-container');

    const openLogin = () => { modal.classList.remove('hidden'); loginForm.classList.remove('hidden'); signupForm.classList.add('hidden'); };
    const openSignup = () => { modal.classList.remove('hidden'); loginForm.classList.add('hidden'); signupForm.classList.remove('hidden'); };

    document.querySelectorAll('.btn-open-login').forEach(btn => btn.addEventListener('click', openLogin));
    document.querySelectorAll('.btn-open-signup').forEach(btn => btn.addEventListener('click', openSignup));
    document.getElementById('btn-close-auth').addEventListener('click', () => modal.classList.add('hidden'));

    document.getElementById('link-to-signup').addEventListener('click', (e) => { e.preventDefault(); openSignup(); });
    document.getElementById('link-to-login').addEventListener('click', (e) => { e.preventDefault(); openLogin(); });

    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('button'); const txt = btn.innerText;
        try { btn.innerText = "Đang xử lý..."; btn.disabled = true; await loginUser(document.getElementById('login-email').value, document.getElementById('login-pass').value); }
        catch (err) { alert("Lỗi: " + err.message); btn.innerText = txt; btn.disabled = false; }
    });

    document.getElementById('form-signup').addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('button'); const txt = btn.innerText;
        try {
            btn.innerText = "Đang tạo..."; btn.disabled = true;
            await registerUser(document.getElementById('reg-email').value, document.getElementById('reg-pass').value, document.getElementById('reg-name').value, document.getElementById('reg-role').value, document.getElementById('reg-phone').value);
            alert("Đăng ký thành công!");
        } catch (err) { alert("Lỗi: " + err.message); btn.innerText = txt; btn.disabled = false; }
    });
    document.getElementById('btn-logout').addEventListener('click', async () => { await logoutUser(); window.location.reload(); });
}

// --- DASHBOARD ---
function setupDashboard(profile) {
    document.getElementById('user-info-display').innerHTML = `<div class="text-right"><div class="font-bold text-gray-800">${profile.name}</div><div class="text-xs text-gray-500">${translateRole(profile.role)}</div></div>`;

    const role = profile.role;
    ['nav-add-trip', 'nav-list-trip', 'nav-report', 'nav-debt', 'nav-users', 'nav-config'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
    
    document.getElementById('standard-trip-fields').classList.remove('hidden');
    document.getElementById('partner-trip-fields').classList.add('hidden');
    document.getElementById('finance-trip-fields').classList.remove('hidden');
    document.getElementById('paid-checkbox-div').classList.remove('hidden');
    document.getElementById('driver-field').classList.remove('hidden');
    document.getElementById('customer-field').classList.remove('hidden');
    document.getElementById('config-driver-section').classList.remove('hidden');
    document.getElementById('config-customer-section').classList.remove('hidden');

    if (role === 'driver') {
        ['nav-report', 'nav-debt', 'nav-users', 'nav-config'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    } 
    else if (role === 'partner') {
        ['nav-report', 'nav-users', 'nav-debt'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('config-driver-section').classList.add('hidden');

        // Ẩn/hiện các trường cho CTV
        document.getElementById('standard-trip-fields').classList.remove('hidden'); // Hiện các trường cơ bản (Ngày, Giờ, KM)
        document.getElementById('partner-trip-fields').classList.remove('hidden'); // Hiện ô "Nội dung"
        document.getElementById('pickup-location').parentElement.classList.add('hidden'); // Ẩn "Điểm đón"
        document.getElementById('dropoff-location').parentElement.classList.add('hidden'); // Ẩn "Điểm trả"
        document.getElementById('fuel-cost').parentElement.classList.add('hidden'); // Ẩn "Tiền xăng"
        document.getElementById('trip-fare').parentElement.classList.add('hidden'); // Ẩn "Doanh thu"

        document.getElementById('paid-checkbox-div').classList.add('hidden');
        document.getElementById('driver-field').classList.add('hidden');
        
    }

    setupRealtimeListeners(role, profile.uid);
    setupAppEventListeners(role, profile.uid);
    document.getElementById('nav-add-trip').click();
    setDefaultDate();
}

function translateRole(role) {
    const map = { 'admin': 'Chủ xe', 'driver': 'Tài xế', 'partner': 'Cộng tác viên' };
    return map[role] || 'Khách';
}

// --- DATA ---
function setupRealtimeListeners(role, uid) {
    onSnapshot(getColRef('cars'), (snap) => {
        let allCars = snap.docs.map(d => ({id: d.id, ...d.data()}));
        if (role === 'partner') state.cars = allCars.filter(c => c.createdBy === uid);
        else state.cars = allCars;
        populateSelects(); renderConfigList('car-list', state.cars, 'cars');
    });

    onSnapshot(getColRef('drivers'), (snap) => {
        state.drivers = snap.docs.map(d => ({id: d.id, ...d.data()}));
        populateSelects(); renderConfigList('driver-list', state.drivers, 'drivers');
    });
    
    onSnapshot(getColRef('customers'), (snap) => {
        state.customers = snap.docs.map(d => ({id: d.id, ...d.data()}));
        populateSelects(); renderConfigList('customer-list', state.customers, 'customers');
    });

    onSnapshot(getColRef('trips'), (snap) => {
        let trips = snap.docs.map(d => ({id: d.id, ...d.data()}));
        if (role === 'partner') trips = trips.filter(t => t.referrerId === uid);
        state.trips = trips;
        state.trips.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        renderTrips();
        if (!document.getElementById('customer-debt-page').classList.contains('hidden')) renderDebts();
    });

    if (role === 'admin') {
        onSnapshot(getColRef('users'), (snap) => {
            state.users = snap.docs.map(d => ({id: d.id, ...d.data()}));
            renderUsersList();
            populateSelects();
        });
    }
}

// --- RENDER ---
function renderTrips() {
    const list = document.getElementById('trips-list'); if(!list) return;
    let displayTrips = [...state.trips];
    const fMonth = document.getElementById('list-filter-month')?.value;
    const fCar = document.getElementById('list-filter-car')?.value;
    const fPartner = document.getElementById('list-filter-partner')?.value;

    if (fMonth) {
        const [y, m] = fMonth.split('-').map(Number);
        displayTrips = displayTrips.filter(t => { const d = new Date(t.startDate); return d.getFullYear()===y && d.getMonth()+1===m; });
    }
    if (fCar) displayTrips = displayTrips.filter(t => t.carId === fCar);
    if (fPartner) displayTrips = displayTrips.filter(t => t.referrerId === fPartner);

    if(displayTrips.length === 0) { list.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500 italic">Chưa có dữ liệu</td></tr>'; return; }
    
    list.innerHTML = displayTrips.map(trip => {
        const d1 = new Date(trip.startDate); const d2 = new Date(trip.endDate);
        const dateStr = `${d1.getDate()}/${d1.getMonth()+1} - ${d2.getDate()}/${d2.getMonth()+1}`;
        
        let contentHtml = '';
        if (trip.tripContent) contentHtml = `<div class="font-medium text-indigo-700">${trip.tripContent}</div>`;
        else contentHtml = `<div>${trip.pickupLocation} ➔ ${trip.dropoffLocation}</div>`;
        
        contentHtml += `<div class="text-xs text-gray-500 mt-1">`;
        if(trip.carName) contentHtml += `Xe: <b>${trip.carName}</b> `;
        if(trip.driverName) contentHtml += `| Tài: ${trip.driverName} `;
        if(trip.customerName) contentHtml += `| Khách: <b>${trip.customerName}</b>`;
        contentHtml += `</div>`;

        if (trip.referrerName) contentHtml += `<div class="text-xs text-purple-600 font-bold mt-1">CTV: ${trip.referrerName}</div>`;

        let statusHtml = '';
        let actionBtns = `<button class="text-blue-600 font-medium btn-view-trip" data-id="${trip.id}">Xem</button>`;
        
        if (state.userProfile.role === 'admin') {
            if (!trip.tripFare || trip.tripFare == 0) {
                statusHtml = `<button class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold btn-update-fare" data-id="${trip.id}">⚠️ Nhập Doanh Thu</button>`;
            } else {
                statusHtml = trip.isPaid 
                    ? `<span class="text-green-700 bg-green-100 px-2 py-1 rounded text-xs font-bold">Đã trả</span>` 
                    : `<span class="text-red-700 bg-red-100 px-2 py-1 rounded text-xs font-bold">Nợ: ${currencyFormatter.format(trip.tripFare)}</span>`;
            }
            actionBtns += `<button class="text-red-600 font-medium ml-2 btn-delete-trip" data-id="${trip.id}">Xóa</button>`;
        } else {
            if (!trip.tripFare) statusHtml = `<span class="text-gray-500 text-xs">Chờ duyệt giá</span>`;
            else statusHtml = `<span class="text-green-600 text-xs font-bold">Đã duyệt: ${currencyFormatter.format(trip.tripFare)}</span>`;
        }

        return `<tr><td class="align-top p-3">${dateStr}</td><td class="align-top p-3">${contentHtml}</td><td class="align-top p-3">${statusHtml}</td><td class="align-top p-3">${actionBtns}</td></tr>`;
    }).join('');
}

// --- EVENTS ---
function setupAppEventListeners(role, uid) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true); btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            document.querySelectorAll('.page-view').forEach(p => p.classList.add('hidden'));
            document.getElementById(newBtn.dataset.page).classList.remove('hidden');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            newBtn.classList.add('active');
            if(newBtn.id === 'nav-debt') renderDebts();
        });
    });

    // List Filters
    document.getElementById('list-filter-month')?.addEventListener('change', renderTrips);
    document.getElementById('list-filter-car')?.addEventListener('change', renderTrips);
    document.getElementById('list-filter-partner')?.addEventListener('change', renderTrips);
    document.getElementById('btn-reset-filter')?.addEventListener('click', () => {
        document.getElementById('list-filter-month').value = ''; document.getElementById('list-filter-car').value = ''; document.getElementById('list-filter-partner').value = '';
        renderTrips();
    });

    // Config Forms
    const setupForm = (formId, col) => {
        const form = document.getElementById(formId); if(!form) return;
        const newForm = form.cloneNode(true); form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault(); const input = e.target.querySelector('input');
            if(input.value.trim()) {
                try {
                    if(!uid) throw new Error("UID missing");
                    await addDoc(getColRef(col), { name: input.value.trim(), createdAt: new Date().toISOString(), createdBy: uid });
                    input.value = '';
                } catch (err) { console.error(err); alert("Lỗi: " + err.message); }
            }
        });
    };
    setupForm('add-car-form', 'cars'); setupForm('add-customer-form', 'customers'); 

    if (role === 'admin') {
        setupForm('add-driver-form', 'drivers');
        document.getElementById('btn-add-user').onclick = () => { document.getElementById('user-modal').classList.remove('hidden'); };
        document.getElementById('close-user-modal').onclick = () => document.getElementById('user-modal').classList.add('hidden');
        document.getElementById('user-form').addEventListener('submit', async (e) => {
            e.preventDefault(); const btn = document.getElementById('btn-save-user'); btn.innerText = "Đang lưu..."; btn.disabled = true;
            const idEdit = document.getElementById('user-id-edit').value;
            try {
                if (idEdit) {
                    await updateDoc(doc(db, "apps", APP_ID, "users", idEdit), { name: document.getElementById('u-name').value, phone: document.getElementById('u-phone').value, role: document.getElementById('u-role').value }); alert("Đã cập nhật!");
                } else {
                    await handleAddUser(document.getElementById('u-name').value, document.getElementById('u-email').value, document.getElementById('u-password').value, document.getElementById('u-phone').value, document.getElementById('u-role').value);
                    alert("Đã thêm nhân sự!");
                }
                document.getElementById('user-modal').classList.add('hidden');
            } catch (err) { alert("Lỗi: " + err.message); } finally { btn.innerText = "Lưu"; btn.disabled = false; }
        });
    }

    // Trip Form
    const tripForm = document.getElementById('trip-form');
    const newTripForm = tripForm.cloneNode(true); tripForm.parentNode.replaceChild(newTripForm, tripForm);
    newTripForm.addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = e.target.querySelector('button'); const txt = btn.textContent;
        btn.disabled = true; btn.textContent = 'Đang lưu...';
        try {
            const getTxt = (id) => { const sel = document.getElementById(id); return sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : ''; };
            const trip = {
                startDate: document.getElementById('trip-start-date').value + 'T' + document.getElementById('trip-start-time').value,
                endDate: document.getElementById('trip-end-date').value + 'T' + document.getElementById('trip-end-time').value,
                carId: document.getElementById('car-select').value, carName: getTxt('car-select'),
                createdAt: new Date().toISOString(), createdBy: uid, creatorRole: role
            };
            if (role === 'partner') {
                trip.tripContent = document.getElementById('trip-content').value;
                trip.referrerId = uid; trip.referrerName = state.userProfile.name;
                trip.customerId = document.getElementById('customer-select').value; trip.customerName = getTxt('customer-select');
                trip.startKm = Number(document.getElementById('start-km').value);
                trip.endKm = Number(document.getElementById('end-km').value);
                trip.ticketCost = Number(document.getElementById('ticket-cost').value);
            } else {
                trip.driverId = document.getElementById('driver-select').value; trip.driverName = getTxt('driver-select');
                trip.customerId = document.getElementById('customer-select').value; trip.customerName = getTxt('customer-select');
                trip.pickupLocation = document.getElementById('pickup-location').value; trip.dropoffLocation = document.getElementById('dropoff-location').value;
                trip.startKm = Number(document.getElementById('start-km').value); trip.endKm = Number(document.getElementById('end-km').value);
                trip.fuelCost = Number(document.getElementById('fuel-cost').value);
                trip.ticketCost = Number(document.getElementById('ticket-cost').value);
                trip.tripFare = Number(document.getElementById('trip-fare').value);
                trip.isPaid = document.getElementById('is-paid').checked;
            }
            await addDoc(getColRef('trips'), trip); alert("Đã lưu!"); e.target.reset(); setDefaultDate();
        } catch(err) { alert("Lỗi: " + err.message); } finally { btn.disabled = false; btn.textContent = txt; }
    });

    // GLOBAL CLICK
    document.body.onclick = async (e) => {
        if (e.target.classList.contains('btn-update-fare')) {
            document.getElementById('update-fare-trip-id').value = e.target.dataset.id;
            document.getElementById('update-fare-input').value = '';
            document.getElementById('update-fare-modal').classList.remove('hidden');
        }
        if (e.target.classList.contains('btn-delete-trip')) {
            if(role !== 'admin') return alert("Không có quyền!"); if(confirm('Xóa chuyến này?')) await deleteDoc(doc(db, "apps", APP_ID, 'trips', e.target.dataset.id));
        }
        if (e.target.classList.contains('btn-delete')) {
            const itemId = e.target.dataset.id; const itemCol = e.target.dataset.col;
            let item = null;
            if(itemCol === 'cars') item = state.cars.find(x => x.id === itemId);
            else if(itemCol === 'customers') item = state.customers.find(x => x.id === itemId);
            if (role === 'partner') { if (!item || item.createdBy !== uid) { alert("Bạn chỉ được xóa dữ liệu do mình tạo ra."); return; } } else if (role !== 'admin') return;
            if(confirm('Xóa mục này?')) await deleteDoc(doc(db, "apps", APP_ID, itemCol, itemId));
        }
        if (e.target.classList.contains('btn-export-word')) exportReportToNewTab(e.target.dataset.target, e.target.dataset.title);
        if (e.target.classList.contains('btn-delete-user')) { if(role !== 'admin') return; if(confirm("Xóa nhân sự này?")) await deleteDoc(doc(db, "apps", APP_ID, "users", e.target.dataset.id)); }
        if (e.target.classList.contains('btn-edit-user')) {
            if(role !== 'admin') return;
            const u = state.users.find(u => u.id === e.target.dataset.id);
            document.getElementById('user-modal-title').innerText = "Sửa Thông Tin";
            document.getElementById('user-id-edit').value = u.id; document.getElementById('u-name').value = u.name;
            document.getElementById('u-phone').value = u.phone || ''; document.getElementById('u-role').value = u.role;
            document.getElementById('u-email-group').classList.add('hidden'); document.getElementById('u-pass-group').classList.add('hidden');
            document.getElementById('user-modal').classList.remove('hidden');
        }
        if (e.target.classList.contains('btn-view-trip')) {
             const trip = state.trips.find(t => t.id === e.target.dataset.id);
             if(trip) {
                 const detail = trip.tripContent || `<p><strong>Lộ trình:</strong> ${trip.pickupLocation} ➔ ${trip.dropoffLocation}</p><p><strong>Xe:</strong> ${trip.carName}</p><p><strong>Xăng:</strong> ${currencyFormatter.format(trip.fuelCost)} - <strong>Vé:</strong> ${currencyFormatter.format(trip.ticketCost || 0)}</p>`;
                 document.getElementById('modal-content').innerHTML = detail + `<p class="mt-1"><strong>Khách:</strong> ${trip.customerName || '---'}</p><hr class="my-2"><p><strong>Doanh thu:</strong> ${currencyFormatter.format(trip.tripFare)}</p>${trip.referrerName ? `<p class="text-sm text-gray-500 mt-1">CTV: ${trip.referrerName}</p>` : ''}`;
                 document.getElementById('trip-detail-modal').classList.remove('hidden');
             }
        }
        // SỬA LỖI THU TIỀN: Dùng await và try-catch
        if (e.target.classList.contains('btn-mark-paid')) {
            if(role !== 'admin') return alert("Chỉ Admin mới được thu tiền!");
            if(confirm('Xác nhận đã thu tiền chuyến này?')) {
                try {
                    await updateDoc(doc(db, "apps", APP_ID, 'trips', e.target.dataset.id), { isPaid: true });
                } catch(err) { alert("Lỗi: " + err.message); }
            }
        }
    };

    document.getElementById('debt-type-select')?.addEventListener('change', () => { populateDebtSelects(); renderDebts(); });
    document.getElementById('debt-person-select')?.addEventListener('change', renderDebts);
    document.getElementById('debt-month-filter')?.addEventListener('change', renderDebts);

    const btnSaveFare = document.getElementById('btn-save-fare');
    if(btnSaveFare) {
        const newBtn = btnSaveFare.cloneNode(true); btnSaveFare.parentNode.replaceChild(newBtn, btnSaveFare);
        newBtn.addEventListener('click', async () => {
            const tid = document.getElementById('update-fare-trip-id').value;
            const fare = Number(document.getElementById('update-fare-input').value);
            if(fare > 0) {
                await updateDoc(doc(db, "apps", APP_ID, 'trips', tid), { tripFare: fare });
                document.getElementById('update-fare-modal').classList.add('hidden');
            }
        });
    }
    const reportBtn = document.getElementById('generate-report-btn');
    if(reportBtn) {
        const newBtn = reportBtn.cloneNode(true); reportBtn.parentNode.replaceChild(newBtn, reportBtn);
        newBtn.addEventListener('click', generateReport);
    }
    const carSelect = document.getElementById('report-car-select');
    if(carSelect) {
        const newS = carSelect.cloneNode(true); carSelect.parentNode.replaceChild(newS, carSelect);
        newS.addEventListener('change', (e) => generateDetailedCarReport(e.target.value));
    }
    const drvSelect = document.getElementById('report-driver-select');
    if(drvSelect) {
        const newS = drvSelect.cloneNode(true); drvSelect.parentNode.replaceChild(newS, drvSelect);
        newS.addEventListener('change', (e) => generateDetailedDriverReport(e.target.value));
    }
    const partnerSelect = document.getElementById('report-partner-select');
    if(partnerSelect) {
        const newS = partnerSelect.cloneNode(true); partnerSelect.parentNode.replaceChild(newS, partnerSelect);
        newS.addEventListener('change', (e) => generateDetailedPartnerReport(e.target.value));
    }
    // Thêm sự kiện báo cáo khách hàng
    const customerSelect = document.getElementById('report-customer-select');
    if(customerSelect) {
        const newS = customerSelect.cloneNode(true); customerSelect.parentNode.replaceChild(newS, customerSelect);
        newS.addEventListener('change', (e) => generateDetailedCustomerReport(e.target.value));
    }

    document.getElementById('close-modal-btn').onclick = () => document.getElementById('trip-detail-modal').classList.add('hidden');
}

// --- HELPERS ---
async function handleAddUser(name, email, password, phone, role) { try { const tempApp = initializeApp(auth.app.options, "Secondary"); const tempAuth = getAuth(tempApp); const cred = await createUserWithEmailAndPassword(tempAuth, email, password); await setDoc(doc(db, "apps", APP_ID, "users", cred.user.uid), { email, name, role, phone, createdAt: new Date().toISOString() }); await signOut(tempAuth); return true; } catch (error) { alert("Lỗi thêm user: " + error.message); return false; } }
function setDefaultDate() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    const d1 = document.getElementById('trip-start-date');
    const d2 = document.getElementById('trip-end-date');
    const t1 = document.getElementById('trip-start-time');
    const t2 = document.getElementById('trip-end-time');
    if (d1 && d2) { d1.value = today; d2.value = today; }
    if (t1 && t2) { t1.value = currentTime; t2.value = currentTime; }
}
function renderConfigList(elementId, data, colName) { const el = document.getElementById(elementId); if(!el) return; const myRole = state.userProfile.role; const myUid = state.userProfile.uid; el.innerHTML = data.map(item => { let showDel = false; if (myRole === 'admin') showDel = true; if (myRole === 'partner' && item.createdBy === myUid) showDel = true; return `<div class="flex justify-between p-2 bg-gray-50 border rounded items-center"><span>${item.name}</span>${showDel ? `<button class="text-red-500 font-bold px-2 btn-delete" data-col="${colName}" data-id="${item.id}">×</button>` : ''}</div>` }).join(''); }
function populateSelects() {
    const fill = (id, data, label) => { const el = document.getElementById(id); if(el) { const cur = el.value; el.innerHTML = `<option value="">-- ${label} --</option>` + data.map(i => `<option value="${i.id}">${i.name}</option>`).join(''); if(cur) el.value = cur; } };
    fill('car-select', state.cars, 'Tất cả xe'); fill('driver-select', state.drivers, 'Tất cả tài xế'); fill('customer-select', state.customers, 'Tất cả khách hàng');
    fill('report-car-select', state.cars, 'Chọn xe'); fill('report-driver-select', state.drivers, 'Chọn tài xế');
    
    const partners = state.users.filter(u => u.role === 'partner');
    const partnerOptions = partners.map(p => ({id: p.uid || p.id, name: p.name}));
    fill('list-filter-partner', partnerOptions, 'Tất cả CTV');
    fill('report-partner-select', partnerOptions, 'Chọn CTV');
    fill('report-customer-select', state.customers, 'Chọn khách hàng');
    
    // Nếu là partner, chỉ hiển thị xe do họ tạo trong bộ lọc danh sách
    const carsForFilter = state.userProfile.role === 'partner' ? state.cars.filter(c => c.createdBy === state.userProfile.uid) : state.cars;
    fill('list-filter-car', carsForFilter, 'Tất cả xe'); 
}
function populateDebtSelects() { const type = document.getElementById('debt-type-select').value; const personSelect = document.getElementById('debt-person-select'); personSelect.innerHTML = '<option value="all">-- Tất cả --</option>'; if (type === 'customer') { state.customers.forEach(c => personSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`); } else { const partners = state.users.filter(u => u.role === 'partner'); partners.forEach(p => personSelect.innerHTML += `<option value="${p.uid || p.id}">${p.name}</option>`); } }
function renderUsersList() { const list = document.getElementById('users-list'); if (!list) return; list.innerHTML = state.users.map(user => { const isMe = user.id === auth.currentUser.uid; const disabled = isMe ? 'opacity-50 cursor-not-allowed' : ''; return `<tr><td class="p-3">${user.name}</td><td class="p-3">${user.email}</td><td class="p-3"><span class="px-2 py-1 text-xs font-bold rounded bg-gray-100 border">${translateRole(user.role)}</span></td><td class="p-3"><div class="flex gap-2"><button class="text-blue-600 hover:text-blue-800 font-bold text-sm btn-edit-user" data-id="${user.id}">Sửa</button>${!isMe ? `<button class="text-red-600 hover:text-red-800 font-bold text-sm btn-delete-user" data-id="${user.id}">Xóa</button>` : ''}</div></td></tr>`; }).join(''); }

// CẢI TIẾN XUẤT FILE WORD (DÙNG BẢNG ĐỂ CĂN CHỈNH)
function exportReportToNewTab(elementId, title) {
    const contentEl = document.getElementById(elementId); if (!contentEl) return;
    const clone = contentEl.cloneNode(true); clone.querySelectorAll('button').forEach(b => b.remove());
    
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(`
        <html>
        <head>
        <meta charset='utf-8'>
        <title>${title}</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 10pt; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .header-table { width: 100%; border: none; margin-bottom: 25px; }
            .header-table td { border: none; padding: 0; vertical-align: middle; }
            .company-name { font-size: 20pt; font-weight: bold; color: #333; }
            .report-title { font-size: 16pt; font-weight: bold; margin-top: 5px; }
            @media print { button { display: none; } }
        </style>
        </head>
        <body>
            <table class="header-table">
                <tr>
                    <td width="100" align="center"><img src="${window.location.origin}/logo.jpg" width="80" height="80" alt="LOGO"></td>
                    <td align="left">
                        <div class="company-name" style="font-size: 14pt;">CÔNG TY TNHH DỊCH VỤ VẬN TẢI MẠNH VIỆT</div>
                        <div>MS: 0202315429</div>
                        <div>ĐỊA CHỈ: Số 44 Quán Trữ, Phường Kiến An, Thành Phố Hải Phòng, Việt Nam</div>
                        <div>ĐT: 0915 12 13 18</div>
                    </td>
                </tr>
            </table>
            <div style="text-align:center; margin-bottom:20px;">
                <h2 class="report-title">${title.toUpperCase()}</h2>
                <p>Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}</p>
            </div>
            ${clone.innerHTML}
            <div style="margin-top:30px;text-align:right; margin-right: 50px;">
                <p>Người lập biểu</p><br><br><br><p>(Ký tên)</p>
            </div>
            <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; font-size: 16px; cursor: pointer;">In Báo Cáo</button>
        </body></html>
    `);
    reportWindow.document.close();
}

// --- REPORT LOGIC ---
function getMonthlyData(year, month) { return state.trips.filter(t => { const d = new Date(t.startDate); return d.getFullYear() === year && d.getMonth() + 1 === month; }); }
function generateReport() {
    const monthVal = document.getElementById('report-month').value; if(!monthVal) return;
    const [y, m] = monthVal.split('-').map(Number);
    const data = getMonthlyData(y, m);
    const revenue = data.reduce((s, t) => s + (t.tripFare || 0), 0);
    const fuel = data.reduce((s, t) => s + (t.fuelCost || 0), 0);
    const ticket = data.reduce((s, t) => s + (t.ticketCost || 0), 0);
    const profit = revenue - fuel - ticket;
    document.getElementById('summary-report-content').innerHTML = `<div class="grid grid-cols-4 gap-4 text-center mb-4"><div class="p-3 bg-blue-50 rounded border border-blue-100"><p class="text-xs text-gray-500">Tổng Doanh Thu</p><p class="text-xl font-bold text-blue-600">${currencyFormatter.format(revenue)}</p></div><div class="p-3 bg-red-50 rounded border border-red-100"><p class="text-xs text-gray-500">Tiền Xăng</p><p class="text-xl font-bold text-red-600">${currencyFormatter.format(fuel)}</p></div><div class="p-3 bg-orange-50 rounded border border-orange-100"><p class="text-xs text-gray-500">Tiền Vé</p><p class="text-xl font-bold text-orange-600">${currencyFormatter.format(ticket)}</p></div><div class="p-3 bg-green-50 rounded border border-green-100"><p class="text-xs text-gray-500">Lợi Nhuận</p><p class="text-xl font-bold text-green-600">${currencyFormatter.format(profit)}</p></div></div><p class="text-center text-sm text-gray-500">Tổng số chuyến: <strong>${data.length}</strong></p>`;
    document.getElementById('report-results').classList.remove('hidden');
    document.getElementById('car-detail-report').innerHTML = ""; document.getElementById('driver-detail-report').innerHTML = ""; document.getElementById('partner-detail-report').innerHTML = ""; document.getElementById('customer-detail-report').innerHTML = "";
}
function generateDetailedCarReport(carId) {
    const div = document.getElementById('car-detail-report'); if(!carId) { div.innerHTML = ""; return; }
    const monthVal = document.getElementById('report-month').value; if(!monthVal) return;
    const [y, m] = monthVal.split('-').map(Number);
    const trips = getMonthlyData(y, m).filter(t => t.carId === carId);
    if(trips.length === 0) { div.innerHTML = "<p class='text-gray-500 mt-2'>Không có chuyến.</p>"; return; }
    const totalFare = trips.reduce((s, t) => s + (t.tripFare || 0), 0); const totalCost = trips.reduce((s, t) => s + (t.fuelCost || 0) + (t.ticketCost || 0), 0);
    const reportId = `car-report-${carId}`;
    div.innerHTML = `<div id="${reportId}" class="bg-gray-50 p-4 rounded-lg border mt-3"><div class="flex justify-between items-center mb-2"><h4 class="font-bold text-gray-700">Xe: ${state.cars.find(c=>c.id===carId)?.name}</h4><button class="export-button btn-export-word" data-target="${reportId}" data-title="Báo Cáo Xe">Xuất Báo Cáo</button></div><p class="text-sm mb-2">Thu: <b>${currencyFormatter.format(totalFare)}</b> - Chi: <b>${currencyFormatter.format(totalCost)}</b></p><table class="w-full text-sm bg-white border"><thead><tr><th class="p-2 border">Ngày</th><th class="p-2 border">Lộ Trình</th><th class="p-2 border">Thu</th><th class="p-2 border">Chi</th></tr></thead><tbody>${trips.map(t => `<tr><td class="p-2 border">${new Date(t.startDate).getDate()}/${new Date(t.startDate).getMonth()+1}</td><td class="p-2 border">${t.tripContent || t.pickupLocation}</td><td class="p-2 border">${currencyFormatter.format(t.tripFare)}</td><td class="p-2 border">${currencyFormatter.format((t.fuelCost||0)+(t.ticketCost||0))}</td></tr>`).join('')}</tbody></table></div>`;
}
function generateDetailedDriverReport(driverId) {
    const div = document.getElementById('driver-detail-report'); if(!driverId) { div.innerHTML = ""; return; }
    const monthVal = document.getElementById('report-month').value; if(!monthVal) return;
    const [y, m] = monthVal.split('-').map(Number);
    const trips = getMonthlyData(y, m).filter(t => t.driverId === driverId);
    if(trips.length === 0) { div.innerHTML = "<p class='text-gray-500 mt-2'>Không có chuyến.</p>"; return; }
    let totalSalary = 0; trips.forEach(t => totalSalary += (t.tripFare || 0) * 0.20);
    const reportId = `driver-report-${driverId}`;
    div.innerHTML = `<div id="${reportId}" class="bg-gray-50 p-4 rounded-lg border mt-3"><div class="flex justify-between items-center mb-2"><h4 class="font-bold text-gray-700">Tài xế: ${state.drivers.find(d=>d.id===driverId)?.name}</h4><button class="export-button btn-export-word" data-target="${reportId}" data-title="Lương Tài Xế">Xuất Báo Cáo</button></div><p class="text-sm mb-2">Tổng chuyến: <b>${trips.length}</b> - Lương (20%): <b>${currencyFormatter.format(totalSalary)}</b></p><table class="w-full text-sm bg-white border"><thead><tr><th class="p-2 border">Ngày</th><th class="p-2 border">Lộ Trình</th><th class="p-2 border">Doanh Thu</th><th class="p-2 border">Lương</th></tr></thead><tbody>${trips.map(t => `<tr><td class="p-2 border">${new Date(t.startDate).getDate()}/${new Date(t.startDate).getMonth()+1}</td><td class="p-2 border">${t.pickupLocation}</td><td class="p-2 border">${currencyFormatter.format(t.tripFare)}</td><td class="p-2 border text-blue-600 font-bold">${currencyFormatter.format(t.tripFare*0.20)}</td></tr>`).join('')}</tbody></table></div>`;
}
function generateDetailedPartnerReport(partnerId) {
    const div = document.getElementById('partner-detail-report'); if(!partnerId) { div.innerHTML = ""; return; }
    const monthVal = document.getElementById('report-month').value; if(!monthVal) return;
    const [y, m] = monthVal.split('-').map(Number);
    const trips = getMonthlyData(y, m).filter(t => t.referrerId === partnerId);
    if(trips.length === 0) { div.innerHTML = "<p class='text-gray-500 mt-2'>Không có chuyến.</p>"; return; }
    const totalFare = trips.reduce((s, t) => s + (t.tripFare || 0), 0);
    const reportId = `partner-report-${partnerId}`;
    const partnerName = state.users.find(u => (u.uid === partnerId || u.id === partnerId))?.name || 'CTV';
    div.innerHTML = `<div id="${reportId}" class="bg-gray-50 p-4 rounded-lg border mt-3"><div class="flex justify-between items-center mb-2"><h4 class="font-bold text-gray-700">CTV: ${partnerName}</h4><button class="export-button btn-export-word" data-target="${reportId}" data-title="Báo Cáo CTV">Xuất Báo Cáo</button></div><p class="text-sm mb-2">Tổng doanh thu: <b>${currencyFormatter.format(totalFare)}</b></p><table class="w-full text-sm bg-white border"><thead><tr><th class="p-2 border">Ngày</th><th class="p-2 border">Nội dung</th><th class="p-2 border">Doanh Thu</th></tr></thead><tbody>${trips.map(t => `<tr><td class="p-2 border">${new Date(t.startDate).getDate()}/${new Date(t.startDate).getMonth()+1}</td><td class="p-2 border">${t.tripContent || (t.pickupLocation + ' ➔ ' + t.dropoffLocation)}</td><td class="p-2 border text-green-600 font-bold">${currencyFormatter.format(t.tripFare)}</td></tr>`).join('')}</tbody></table></div>`;
}
function generateDetailedCustomerReport(customerId) {
    const div = document.getElementById('customer-detail-report'); if(!customerId) { div.innerHTML = ""; return; }
    const monthVal = document.getElementById('report-month').value; if(!monthVal) return;
    const [y, m] = monthVal.split('-').map(Number);
    const trips = getMonthlyData(y, m).filter(t => t.customerId === customerId);
    if(trips.length === 0) { div.innerHTML = "<p class='text-gray-500 mt-2'>Không có chuyến.</p>"; return; }
    const totalFare = trips.reduce((s, t) => s + (t.tripFare || 0), 0);
    const reportId = `customer-report-${customerId}`;
    div.innerHTML = `<div id="${reportId}" class="bg-gray-50 p-4 rounded-lg border mt-3"><div class="flex justify-between items-center mb-2"><h4 class="font-bold text-gray-700">Khách: ${state.customers.find(c=>c.id===customerId)?.name}</h4><button class="export-button btn-export-word" data-target="${reportId}" data-title="Báo Cáo Khách">Xuất Báo Cáo</button></div><p class="text-sm mb-2">Tổng chi tiêu: <b>${currencyFormatter.format(totalFare)}</b></p><table class="w-full text-sm bg-white border"><thead><tr><th class="p-2 border">Ngày</th><th class="p-2 border">Lộ Trình</th><th class="p-2 border">Thành Tiền</th></tr></thead><tbody>${trips.map(t => `<tr><td class="p-2 border">${new Date(t.startDate).getDate()}/${new Date(t.startDate).getMonth()+1}</td><td class="p-2 border">${t.tripContent || (t.pickupLocation + ' ➔ ' + t.dropoffLocation)}</td><td class="p-2 border text-blue-600">${currencyFormatter.format(t.tripFare)}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderDebts() {
    const filterId = document.getElementById('debt-customer-select')?.value;
    let list = state.trips.filter(t => !t.isPaid && t.tripFare > 0);
    const monthVal = document.getElementById('debt-month-filter')?.value;
    if (monthVal) { const [y, m] = monthVal.split('-').map(Number); list = list.filter(t => { const d = new Date(t.startDate); return d.getFullYear() === y && d.getMonth() + 1 === m; }); }
    const type = document.getElementById('debt-type-select')?.value;
    const personId = document.getElementById('debt-person-select')?.value;
    if (type === 'customer') { list = list.filter(t => t.customerId); if (personId && personId !== 'all') list = list.filter(t => t.customerId === personId); }
    else { list = list.filter(t => t.referrerId); if (personId && personId !== 'all') list = list.filter(t => t.referrerId === personId); }
    
    const container = document.getElementById('debt-list'); if(!container) return;
    if(list.length === 0) { container.innerHTML = '<p class="text-gray-500 italic text-center">Không tìm thấy công nợ.</p>'; return; }
    
    const grouped = list.reduce((acc, t) => { const key = type === 'customer' ? (t.customerName || 'Khách lẻ') : (t.referrerName || 'CTV ẩn'); acc[key] = (acc[key] || []).concat(t); return acc; }, {});
    container.innerHTML = Object.entries(grouped).map(([name, trips]) => {
        const total = trips.reduce((sum, t) => sum + (t.tripFare || 0), 0);
        return `<div class="bg-white border rounded-xl overflow-hidden mb-4 shadow-sm"><div class="bg-gray-50 p-3 flex justify-between items-center border-b"><span class="font-bold text-gray-800">${name}</span><span class="text-red-600 font-bold text-lg">${currencyFormatter.format(total)}</span></div><div class="p-3 space-y-2">${trips.map(t => `<div class="flex justify-between items-center text-sm border-b pb-2 last:border-0"><div><div class="font-medium text-gray-900">${t.tripContent || (t.pickupLocation + ' ➔ ' + t.dropoffLocation)}</div><div class="text-gray-500 text-xs">${new Date(t.startDate).toLocaleDateString('vi-VN')} ${type==='partner' ? `(Khách: ${t.customerName})` : ''}</div></div><div class="text-right flex items-center gap-2"><div class="font-bold text-gray-700">${currencyFormatter.format(t.tripFare)}</div>${state.userProfile.role === 'admin' ? `<button class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 btn-mark-paid" data-id="${t.id}">Thu tiền</button>` : ''}</div></div>`).join('')}</div></div>`;
    }).join('');
}

initApp();