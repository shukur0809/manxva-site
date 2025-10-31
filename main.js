// main.js - Manhvalar, qidiruv, sevimlilar, liderlar
let manhvas = [], currentManhva = null, currentChapters = [], currentChapterIndex = -1;
let userRatings = {}, userBookmarks = new Set(), readChapters = new Set();

async function loadManhvas() {
    showLoading(true);
    try {
        const { data } = await supabase.from('manhvas').select('*').order('created_at', { ascending: false });
        manhvas = data || [];
        await loadAllRatings();
        manhvas.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
        renderManhvas(manhvas);
    } catch (error) {
        showToast('Manhvalarni yuklashda xatolik', 'error');
    } finally {
        showLoading(false);
    }
}

function renderManhvas(list) {
    const grid = document.getElementById('grid');
    if (!list.length) return grid.innerHTML = '<p style="text-align:center;color:var(--text-light);grid-column:1/-1;">Topilmadi</p>';

    grid.innerHTML = list.map(m => {
        const avg = m.avg_rating || 0;
        const userRate = user ? (userRatings[m.id] || 0) : 0;
        const bookmark = user && userBookmarks.has(m.id);
        return `<div class="manhva-card" data-id="${m.id}">
            ${bookmark ? '<div style="position:absolute;top:10px;right:10px;font-size:1.5rem;">🔖</div>' : ''}
            <img class="manhva-cover" src="${m.cover_url || 'https://via.placeholder.com/300x400?text=' + encodeURIComponent(m.title)}" loading="lazy">
            <div class="manhva-info">
                <div class="manhva-title">${m.title}</div>
                <div class="manhva-genre">${m.genre}</div>
                <div class="rating" data-manhva-id="${m.id}">
                    ${[1,2,3,4,5].map(i => `<span class="star ${i <= Math.round(avg) ? 'filled' : ''} ${userRate === i ? 'user-rated' : ''}" data-rating="${i}">★</span>`).join('')}
                    <span class="rating-info">${avg.toFixed(1)}</span>
                </div>
            </div>
        </div>`;
    }).join('');

    document.querySelectorAll('.manhva-card').forEach(card => {
        card.addEventListener('click', e => {
            if (!e.target.classList.contains('star')) showDetail(parseInt(card.dataset.id));
        });
    });

    document.querySelectorAll('.rating .star').forEach(star => {
        star.addEventListener('click', e => {
            e.stopPropagation();
            rateManhva(parseInt(star.closest('.rating').dataset.manhvaId), parseInt(star.dataset.rating));
        });
    });
}

async function rateManhva(id, rating) {
    if (!user) return openModal();
    try {
        const { data: existing } = await supabase.from('ratings').select('*').eq('manhva_id', id).eq('user_id', user.id).maybeSingle();
        if (existing) {
            await supabase.from('ratings').update({ rating }).eq('manhva_id', id).eq('user_id', user.id);
        } else {
            await supabase.from('ratings').insert({ manhva_id: id, user_id: user.id, rating });
        }
        userRatings[id] = rating;
        await loadAllRatings();
        renderManhvas(manhvas);
        showToast('Baholandi!', 'success');
    } catch (error) {
        showToast('Xatolik', 'error');
    }
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const results = document.getElementById('searchResults');
    if (!query) return results.classList.remove('show');

    const filtered = manhvas.filter(m => m.title.toLowerCase().includes(query) || m.genre.toLowerCase().includes(query)).slice(0, 5);
    if (!filtered.length) return results.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--text-light);">Hech narsa topilmadi</div>', results.classList.add('show');

    results.innerHTML = filtered.map(m => `
        <div class="search-result-item" data-id="${m.id}">
            <img class="search-result-cover" src="${m.cover_url || 'https://via.placeholder.com/50x65'}">
            <div class="search-result-info">
                <div class="search-result-title">${m.title}</div>
                <div class="search-result-genre">${m.genre}</div>
                <div class="search-result-rating">★ ${(m.avg_rating || 0).toFixed(1)} (${m.rating_count || 0})</div>
            </div>
        </div>
    `).join('');
    results.classList.add('show');

    document.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            showDetail(parseInt(item.dataset.id));
            results.classList.remove('show');
            document.getElementById('search').value = '';
        });
    });
}

// Boshqa funksiyalar (showDetail, showBookmarks, showLeaderboard) keyingi faylda