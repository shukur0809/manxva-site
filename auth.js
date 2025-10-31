// auth.js - Kirish va ro'yxatdan o'tish
const supabase = window.supabase.createClient(
    'https://slyvzbqtflcypdiurcju.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNseXZ6YnF0ZmxjeXBkaXVyY2p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzM1MTcsImV4cCI6MjA3NjY0OTUxN30.g4r-gpXptgewpEW0LhI_R7Znr8BSk0UcdTh-QUE8OcE'
);

let user = null;

// Modal va formalar
document.addEventListener('DOMContentLoaded', () => {
    setupAuthEvents();
});

function setupAuthEvents() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
    });
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('closeModal1').addEventListener('click', closeModal);
    document.getElementById('closeModal2').addEventListener('click', closeModal);
    document.getElementById('authModal').addEventListener('click', e => {
        if (e.target.id === 'authModal') closeModal();
    });
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', togglePassword);
    });
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
    clearAlerts();
}

function togglePassword() {
    const target = document.getElementById(this.dataset.target);
    if (target.type === 'password') {
        target.type = 'text';
        this.textContent = '🙈';
    } else {
        target.type = 'password';
        this.textContent = '👁️';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    clearAlerts();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value;
    const remember = document.getElementById('remember').checked;

    if (!email || !password) return showAlert('error', 'Barcha maydonlarni to\'ldiring');

    const loginBtn = document.getElementById('loginBtn');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Yuklanmoqda...';

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const { data: userData } = await supabase.from('users').select('*').eq('id', data.user.id).single();
        user = userData;
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem('user', JSON.stringify(user));

        await syncUserData();
        updateUserUI();
        startTimeTracking();
        showAlert('success', 'Xush kelibsiz!');
        setTimeout(() => { closeModal(); renderManhvas(manhvas); }, 1000);
    } catch (error) {
        showAlert('error', error.message.includes('Invalid') ? 'Email yoki parol xato' : error.message);
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Kirish';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    clearAlerts();
    const username = document.getElementById('regUser').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPass').value;
    const password2 = document.getElementById('regPass2').value;

    if (!username || !email || !password || !password2) return showAlert('error', 'Barcha maydonlarni to\'ldiring');
    if (username.length < 3) return showAlert('error', 'Username kamida 3 belgi');
    if (password.length < 6) return showAlert('error', 'Parol kamida 6 belgi');
    if (password !== password2) return showAlert('error', 'Parollar mos kelmadi');

    const regBtn = document.getElementById('regBtn');
    regBtn.disabled = true;
    regBtn.textContent = 'Yuklanmoqda...';

    try {
        const { data: existing } = await supabase.from('users').select('username').eq('username', username).maybeSingle();
        if (existing) return showAlert('error', 'Bu username band');

        const { data: authData, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
        if (error) throw error;

        if (!authData.session) {
            showAlert('success', 'Emailni tasdiqlang');
            setTimeout(() => switchAuthTab('login'), 2000);
            return;
        }

        const { error: insertError } = await supabase.from('users').insert({
            id: authData.user.id, username, email, total_time: 0
        });
        if (insertError) throw insertError;

        showAlert('success', 'Muvaffaqiyatli!');
        setTimeout(() => switchAuthTab('login'), 1500);
    } catch (error) {
        showAlert('error', error.message);
    } finally {
        regBtn.disabled = false;
        regBtn.textContent = 'Ro\'yxatdan o\'tish';
    }
}

function openModal() {
    document.getElementById('authModal').classList.add('show');
    clearAlerts();
}

function closeModal() {
    document.getElementById('authModal').classList.remove('show');
    clearAlerts();
}

function showAlert(type, msg) {
    const id = type === 'error' ? 'errorMsg' : 'successMsg';
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 5000);
}

function clearAlerts() {
    document.getElementById('errorMsg').classList.remove('show');
    document.getElementById('successMsg').classList.remove('show');
}