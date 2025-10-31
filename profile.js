// profile.js - Profil, avatar, vaqt
let avatars = [], unlockedAvatars = new Set();
const timeTracker = { interval: null, lastUpdate: Date.now(), readingStart: null };

async function showProfile() {
    if (!user) return openModal();
    hideAllViews();
    document.getElementById('profileContainer').classList.add('show');
    renderProfile();
}

function renderProfile() {
    const initial = user.username[0].toUpperCase();
    document.getElementById('profileInitial').textContent = initial;
    if (user.avatar_url) {
        document.getElementById('profileAvatarImg').src = user.avatar_url;
        document.getElementById('profileAvatarImg').style.display = 'block';
        document.getElementById('profileInitial').style.display = 'none';
    }

    document.getElementById('profileUsername').textContent = user.username;
    document.getElementById('profileEmail').textContent = user.email;

    const timeStr = formatTime(user.total_time || 0);
    document.getElementById('totalTimeValue').textContent = timeStr;
    document.getElementById('ratingsCountValue').textContent = Object.keys(userRatings).length;
    document.getElementById('bookmarksCountValue').textContent = userBookmarks.size;
    document.getElementById('readChaptersValue').textContent = readChapters.size;

    document.getElementById('editUsername').value = user.username;
    document.getElementById('editEmail').value = user.email;

    renderAvatars();
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h ? h + 's ' : ''}${m || h ? m + 'm ' : ''}${s}s`;
}

async function startTimeTracking() {
    if (!user || timeTracker.interval) return;
    timeTracker.lastUpdate = Date.now();
    timeTracker.interval = setInterval(saveTime, 30000);
}

async function saveTime() {
    if (!user) return;
    const now = Date.now();
    const elapsed_sdk = Math.floor((now - timeTracker.lastUpdate) / 1000);
    if (elapsed_sdk > 0) {
        user.total_time += elapsed_sdk;
        timeTracker.lastUpdate = now;
        await supabase.from('users').update({ total_time: user.total_time }).eq('id', user.id);
        localStorage.setItem('user', JSON.stringify(user));
        await checkUnlockedAvatars();
    }
}