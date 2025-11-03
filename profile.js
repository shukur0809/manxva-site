// profile.js - Profil modal, avatar, vaqt, parol o'zgartirish
let avatars = [], unlockedAvatars = new Set();
const timeTracker = { interval: null, lastUpdate: Date.now(), readingStart: null };

// Profil modalini ko'rsatish
function showProfile() {
    if (!user) return openModal();
    const modal = document.getElementById('profileModal');
    modal.classList.add('show');
    renderProfile();
    switchProfileTab('info');
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('show');
}

// Profil ma'lumotlarini ko'rsatish
function renderProfile() {
    const initial = user.username[0].toUpperCase();
    const avatarContainer = document.getElementById('profileAvatarLarge');
    
    if (user.avatar_url) {
        avatarContainer.innerHTML = `<img src="${user.avatar_url}" alt="Avatar">`;
    } else {
        avatarContainer.innerHTML = initial;
    }

    document.getElementById('profileUsernameText').textContent = user.username;
    document.getElementById('profileEmailText').textContent = user.email;

    // Statistika
    const timeStr = formatTime(user.total_time || 0);
    document.getElementById('statTime').textContent = timeStr;
    document.getElementById('statRatings').textContent = Object.keys(userRatings).length;
    document.getElementById('statBookmarks').textContent = userBookmarks.size;
    document.getElementById('statChapters').textContent = readChapters.size;

    // Form maydonlari
    document.getElementById('editUsername').value = user.username;
    document.getElementById('editEmail').value = user.email;

    renderAvatars();
}

// Tab almashish
function switchProfileTab(tab) {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.profile-section').forEach(s => s.classList.remove('active'));
    
    document.querySelector(`[data-profile-tab="${tab}"]`).classList.add('active');
    document.getElementById(`section-${tab}`).classList.add('active');
}

// Vaqtni formatlash
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}s ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// Vaqtni kuzatish
async function startTimeTracking() {
    if (!user || timeTracker.interval) return;
    timeTracker.lastUpdate = Date.now();
    timeTracker.interval = setInterval(saveTime, 30000); // Har 30 soniyada
}

async function saveTime() {
    if (!user) return;
    const now = Date.now();
    const elapsed = Math.floor((now - timeTracker.lastUpdate) / 1000);
    if (elapsed > 0) {
        user.total_time += elapsed;
        timeTracker.lastUpdate = now;
        await supabase.from('users').update({ total_time: user.total_time }).eq('id', user.id);
        const storage = sessionStorage.getItem('user') ? sessionStorage : localStorage;
        storage.setItem('user', JSON.stringify(user));
        await checkUnlockedAvatars();
    }
}

// Avatarlarni yuklash
async function loadAvatars() {
    try {
        const { data } = await supabase.from('avatars').select('*').order('unlock_time');
        avatars = data || [];
        await checkUnlockedAvatars();
    } catch (error) {
        console.error('Avatar yuklashda xatolik:', error);
    }
}

// Ochilgan avatarlarni tekshirish
async function checkUnlockedAvatars() {
    if (!user) return;
    unlockedAvatars.clear();
    const userTime = user.total_time || 0;
    avatars.forEach(av => {
        if (userTime >= av.unlock_time) unlockedAvatars.add(av.id);
    });
}

// Avatarlarni ko'rsatish
function renderAvatars() {
    const grid = document.getElementById('avatarGrid');
    if (!avatars.length) return grid.innerHTML = '<p style="text-align:center;color:var(--text-light);">Avatarlar yuklanmoqda...</p>';

    grid.innerHTML = avatars.map(av => {
        const unlocked = unlockedAvatars.has(av.id);
        const selected = user.avatar_url === av.url;
        const lockClass = unlocked ? '' : 'locked';
        const selectedClass = selected ? 'selected' : '';
        const timeText = unlocked ? '' : `Kerak: ${formatTime(av.unlock_time)}`;
        
        return `
            <div class="avatar-item ${lockClass} ${selectedClass}" data-id="${av.id}" data-url="${av.url}" data-unlocked="${unlocked}">
                <img src="${av.url}" alt="Avatar">
                ${!unlocked ? `<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.8);color:white;font-size:0.65rem;padding:0.25rem;text-align:center;">${timeText}</div>` : ''}
            </div>
        `;
    }).join('');

    document.querySelectorAll('.avatar-item').forEach(item => {
        item.addEventListener('click', () => selectAvatar(item));
    });
}

// Avatar tanlash
async function selectAvatar(item) {
    const unlocked = item.dataset.unlocked === 'true';
    if (!unlocked) return showToast('Bu avatar hali ochilmagan', 'error');

    const url = item.dataset.url;
    try {
        await supabase.from('users').update({ avatar_url: url }).eq('id', user.id);
        user.avatar_url = url;
        const storage = sessionStorage.getItem('user') ? sessionStorage : localStorage;
        storage.setItem('user', JSON.stringify(user));
        updateUserUI();
        renderProfile();
        showToast('Avatar o\'zgartirildi!', 'success');
    } catch (error) {
        showToast('Xatolik yuz berdi', 'error');
    }
}

// Ma'lumotlarni o'zgartirish
async function updateProfile(e) {
    e.preventDefault();
    const username = document.getElementById('editUsername').value.trim();
    const email = document.getElementById('editEmail').value.trim();

    if (!username || !email) return showToast('Barcha maydonlarni to\'ldiring', 'error');
    if (username.length < 3) return showToast('Username kamida 3 belgi', 'error');

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saqlanmoqda...';

    try {
        // Username tekshirish
        if (username !== user.username) {
            const { data: existing } = await supabase.from('users').select('username').eq('username', username).maybeSingle();
            if (existing) {
                showToast('Bu username band', 'error');
                btn.disabled = false;
                btn.textContent = 'Saqlash';
                return;
            }
        }

        // Email o'zgartirish (faqat Supabase Auth orqali)
        if (email !== user.email) {
            const { error: authError } = await supabase.auth.updateUser({ email });
            if (authError) throw authError;
        }

        // Username o'zgartirish
        const { error } = await supabase.from('users').update({ username, email }).eq('id', user.id);
        if (error) throw error;

        user.username = username;
        user.email = email;
        const storage = sessionStorage.getItem('user') ? sessionStorage : localStorage;
        storage.setItem('user', JSON.stringify(user));
        
        updateUserUI();
        renderProfile();
        showToast('Ma\'lumotlar yangilandi!', 'success');
    } catch (error) {
        showToast(error.message || 'Xatolik yuz berdi', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Saqlash';
    }
}

// Parolni o'zgartirish
async function updatePassword(e) {
    e.preventDefault();
    const currentPass = document.getElementById('currentPass').value;
    const newPass = document.getElementById('newPass').value;
    const confirmPass = document.getElementById('confirmPass').value;

    if (!currentPass || !newPass || !confirmPass) return showToast('Barcha maydonlarni to\'ldiring', 'error');
    if (newPass.length < 6) return showToast('Yangi parol kamida 6 belgi', 'error');
    if (newPass !== confirmPass) return showToast('Parollar mos kelmadi', 'error');

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'O\'zgartirmoqda...';

    try {
        // Avval joriy parol bilan tekshirish
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPass
        });
        if (signInError) {
            showToast('Joriy parol xato', 'error');
            btn.disabled = false;
            btn.textContent = 'O\'zgartirish';
            return;
        }

        // Yangi parolni o'rnatish
        const { error } = await supabase.auth.updateUser({ password: newPass });
        if (error) throw error;

        showToast('Parol o\'zgartirildi!', 'success');
        e.target.reset();
    } catch (error) {
        showToast(error.message || 'Xatolik yuz berdi', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'O\'zgartirish';
    }
}

// Logout
async function logout() {
    if (!confirm('Haqiqatan ham chiqmoqchimisiz?')) return;
    
    try {
        await saveTime();
        clearInterval(timeTracker.interval);
        await supabase.auth.signOut();
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        user = null;
        userRatings = {};
        userBookmarks.clear();
        readChapters.clear();
        updateUserUI();
        closeProfileModal();
        location.reload();
    } catch (error) {
        showToast('Xatolik yuz berdi', 'error');
    }
}

// User UI yangilash
function updateUserUI() {
    const container = document.getElementById('userInfo');
    if (!user) {
        container.innerHTML = '<button class="btn btn-primary" id="loginBtnNav">Kirish</button>';
        document.getElementById('loginBtnNav').addEventListener('click', openModal);
        return;
    }

    const initial = user.username[0].toUpperCase();
    const avatarHTML = user.avatar_url 
        ? `<img src="${user.avatar_url}" alt="Avatar">` 
        : initial;

    container.innerHTML = `
        <div class="user-avatar" id="userAvatarBtn">${avatarHTML}</div>
        <div class="user-dropdown" id="userDropdown">
            <div style="padding:0.5rem;border-bottom:1px solid var(--border);margin-bottom:0.5rem;">
                <div style="font-weight:600;">${user.username}</div>
                <div style="font-size:0.85rem;color:var(--text-light);">${user.email}</div>
            </div>
            <button class="btn btn-glass" style="width:100%;justify-content:flex-start;" id="profileBtn">👤 Profil</button>
            <button class="btn btn-glass" style="width:100%;justify-content:flex-start;" id="logoutBtn">🚪 Chiqish</button>
        </div>
    `;

    document.getElementById('userAvatarBtn').addEventListener('click', () => {
        document.getElementById('userDropdown').classList.toggle('show');
    });
    document.getElementById('profileBtn').addEventListener('click', () => {
        document.getElementById('userDropdown').classList.remove('show');
        showProfile();
    });
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#userInfo')) {
            document.getElementById('userDropdown').classList.remove('show');
        }
    });
}

// Sync user data
async function syncUserData() {
    if (!user) return;

    try {
        // Ratinglar
        const { data: ratings } = await supabase.from('ratings').select('*').eq('user_id', user.id);
        userRatings = {};
        ratings?.forEach(r => userRatings[r.manhva_id] = r.rating);

        // Bookmarks
        const { data: bookmarks } = await supabase.from('bookmarks').select('manhva_id').eq('user_id', user.id);
        userBookmarks = new Set(bookmarks?.map(b => b.manhva_id) || []);

        // O'qilgan chapterlar
        const { data: progress } = await supabase.from('reading_progress').select('chapter_id').eq('user_id', user.id);
        readChapters = new Set(progress?.map(p => p.chapter_id) || []);

        await loadAvatars();
    } catch (error) {
        console.error('Sync error:', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Profil formalar
    document.getElementById('profileForm')?.addEventListener('submit', updateProfile);
    document.getElementById('passwordForm')?.addEventListener('submit', updatePassword);
    document.getElementById('closeProfileModal')?.addEventListener('click', closeProfileModal);
    document.getElementById('profileModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'profileModal') closeProfileModal();
    });

    // Tab buttons
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.addEventListener('click', () => switchProfileTab(tab.dataset.profileTab));
    });

    // Check saved user
    const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (savedUser) {
        user = JSON.parse(savedUser);
        syncUserData();
        updateUserUI();
        startTimeTracking();
    } else {
        updateUserUI();
    }
});