(function(){
    const hero = document.getElementById('heroWelcome');
    const listEl = document.getElementById('recentList');
    const rightPane = document.querySelector('.right-pane');
    const brandTitle = document.querySelector('.brand-title');
    const leftPane = document.querySelector('.left-pane');
    const fireworksCanvas = document.getElementById('fxFireworks');
    const flagContainer = document.querySelector('.flag-container');
    const MAX_LIST = 8;
    const DISPLAY_MS = 10000; // 10s
    let queue = [];
    let showing = false;
    let lastSeenKeys = new Set();
    let lastSidebarKeys = [];
    let lastHasAny = null;
    let defaultShown = false;
    let currentHeroKey = null;

    function resolveImageUrl(path){
        if (!path || typeof path !== 'string') return '';
        const src = path.startsWith('data/images') ? `/media/${path}` : `/${path}`;
        return src.replace('//','/');
    }

    async function fetchRecent(){
        try {
            const res = await fetch('/api/checkins');
            const data = await res.json();
            if (!Array.isArray(data)) return [];
            // newest first
            data.sort((a,b)=> new Date(b.checked_at) - new Date(a.checked_at));
            return data;
        } catch(e){ console.warn(e); return []; }
    }

    async function enrich(checkins){
        const cache = {};
        const out = [];
        for (const c of checkins) {
            let img = '';
            try {
                if (typeof c.user_id === 'number'){
                    if (!cache[c.user_id]){
                        const ures = await fetch(`/api/users/${c.user_id}`);
                        cache[c.user_id] = await ures.json();
                    }
                    const u = cache[c.user_id] || {};
                    const imgs = Array.isArray(u.images) ? u.images : [];
                    img = imgs.length ? imgs[0] : '';
                    c.company = c.company || u.company || '';
                    c.position = c.position || u.position || '';
                    c.gender = c.gender || u.gender || '';
                }
            } catch(_){}
            out.push({
                key: `${c.user_id}-${c.checked_at}`,
                user_id: c.user_id,
                name: c.name || '',
                gender: c.gender || '',
                position: c.position || '',
                company: c.company || '',
                time: new Date(c.checked_at),
                imageUrl: resolveImageUrl(img)
            });
        }
        return out;
    }

    function renderList(items){
        const top = items.slice(0, MAX_LIST);
        const keys = top.map(i => i.key).join('|');
        if (keys === lastSidebarKeys.join('|')) return; // no change -> skip DOM work
        lastSidebarKeys = top.map(i => i.key);
        listEl.innerHTML = top.map(i => `
            <li class="recent-item fade-in">
                <div class="recent-thumb">${i.imageUrl ? `<img src="${i.imageUrl}" alt="${i.name}">` : ''}</div>
                <div>
                    <div class="recent-label">ĐẠI BIỂU</div>
                    <div class="recent-name">${i.name}</div>
                    <div class="recent-meta">${i.position || 'Khách mời'} · ${i.company || ''}</div>
                </div>
            </li>
        `).join('');
    }

    function titleByGender(g){
        const x = (g||'').trim().toLowerCase();
        if (x === 'nam') return 'ÔNG';
        if (x === 'nữ' || x === 'nu') return 'BÀ';
        return 'QUÝ KHÁCH';
    }

    function showHero(item){
        if (!item) { return; }
        hero.innerHTML = `
            <div class="hero-card fade-in">
                <div class="hero-row">
                    <div class="avatar">${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}">` : ''}</div>
                    <div>
                        <div class="subline">Chào mừng đại biểu</div>
                        <div class="title-large">${titleByGender(item.gender)} ${item.name}</div>
                        <div class="subline">Về dự đại hội đại biểu Đảng bộ lần thứ I</div>
                        <div class="meta">${item.position || 'Khách mời'} · ${item.company || ''}</div>
                    </div>
                </div>
            </div>`;
        currentHeroKey = item.key || `${item.user_id}-${item.time?.toISOString?.() || ''}`;
        defaultShown = false;
    }

    function showDefaultHero(){
        if (defaultShown) return;
        hero.innerHTML = `
            <div class="default-hero fade-in">
                <div class="line1">NHIỆT LIỆT CHÀO MỪNG</div>
                <div class="line2">ĐẠI HỘI ĐẠI BIỂU</div>
                <div class="line3">ĐẢNG BỘ TỈNH TÂY NINH</div>
                <div class="line4">LẦN THỨ I, NHIỆM KỲ 2025 - 2030</div>
            </div>`;
        currentHeroKey = null;
        defaultShown = true;
    }

    async function tick(){
        // poll for new checkins
        try {
            const recents = await enrich(await fetchRecent());
            // update sidebar only if changed
            renderList(recents);
            const hasAny = recents && recents.length > 0;
            if (lastHasAny !== hasAny) {
                if (rightPane) rightPane.classList.toggle('hidden', !hasAny);
                if (brandTitle) brandTitle.classList.toggle('hidden', !hasAny);
                if (leftPane) leftPane.classList.toggle('wide', !hasAny);
                if (flagContainer) {
                    if (hasAny) {
                        flagContainer.classList.remove('non-checkin');
                    } else {
                        flagContainer.classList.add('non-checkin');
                    }
                }
                lastHasAny = hasAny;
            }

            if ((!hasAny) && queue.length === 0 && !showing) {
                showDefaultHero();
            }
            // enqueue unseen items, newest last in queue
            for (let i = recents.length - 1; i >= 0; i--) {
                const it = recents[i];
                if (!lastSeenKeys.has(it.key)) {
                    queue.push(it);
                    lastSeenKeys.add(it.key);
                    // keep set from growing too large
                    if (lastSeenKeys.size > 200) {
                        const arr = Array.from(lastSeenKeys).slice(-120);
                        lastSeenKeys = new Set(arr);
                    }
                }
            }
            // if nothing showing, start consume
            maybeConsume();
        } catch(_) {}
    }

    function maybeConsume(){
        if (showing) return;
        const next = queue.shift();
        if (!next) return;
        showing = true;
        console.log('[WELCOME] showing', next);
        showHero(next);
        setTimeout(() => { showing = false; maybeConsume(); }, DISPLAY_MS);
    }

    // kick off
    document.addEventListener('DOMContentLoaded', () => {
        // Immediately render initial state
        if (leftPane) leftPane.classList.add('wide');
        if (flagContainer) flagContainer.classList.add('non-checkin');
        showDefaultHero();
        tick();
        setInterval(tick, 2000);
        // init fireworks with delay to ensure canvas is ready
        setTimeout(() => {
            const canvas = document.getElementById('fxFireworks');
            if (canvas) initFireworks(canvas);
        }, 100);
    });
})();


// -------- Fireworks effect (lightweight) ---------
function initFireworks(canvas){
    const ctx = canvas.getContext('2d');
    const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    let W, H;
    const particles = [];
    const rockets = [];

    function resize(){
        const rect = canvas.getBoundingClientRect();
        W = Math.floor(rect.width);
        H = Math.floor(rect.height);
        canvas.width = W * DPR;
        canvas.height = H * DPR;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(DPR,0,0,DPR,0,0);
    }
    resize();
    window.addEventListener('resize', resize);

    function spawnRocket(){
        const x = Math.random() * W;
        const y = H + 10;
        const vx = (Math.random()-0.5) * 2.5;
        const vy = - (4.5 + Math.random()*2.5);
        rockets.push({x,y,vx,vy,life: 80 + (Math.random()*30|0), hue: (20+Math.random()*40)|0});
    }

    function explode(x,y,hue){
        const count = 80 + (Math.random()*60|0);
        for(let i=0;i<count;i++){
            const angle = Math.random()*Math.PI*2;
            const speed = 2 + Math.random()*5;
            particles.push({
                x,y,
                vx: Math.cos(angle)*speed,
                vy: Math.sin(angle)*speed,
                alpha: 1,
                life: 60 + (Math.random()*40|0),
                hue: hue + (Math.random()*20-10)
            });
        }
    }

    let lastSpawn = 0;
    function loop(t){
        requestAnimationFrame(loop);
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0,0,W,H);

        // spawn rockets at random interval ~0.5-1.5s
        if (t - lastSpawn > 500 + Math.random()*1000){
            // spawn 1-3 rockets at once
            const count = 1 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                spawnRocket();
            }
            lastSpawn = t;
        }

        // update rockets
        for (let i=rockets.length-1;i>=0;i--){
            const r = rockets[i];
            r.life--; r.x += r.vx; r.y += r.vy; r.vy += 0.03; // gravity
            // trail
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `hsla(${r.hue},90%,60%,0.8)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(r.x, r.y);
            ctx.lineTo(r.x - r.vx*2, r.y - r.vy*2);
            ctx.stroke();
            if (r.life<=0 || r.vy> -0.5){
                rockets.splice(i,1);
                explode(r.x,r.y,r.hue);
            }
        }

        // update particles
        for (let i=particles.length-1;i>=0;i--){
            const p = particles[i];
            p.life--; p.x += p.vx; p.y += p.vy; p.vy += 0.02; p.alpha *= 0.985;
            if (p.life<=0 || p.alpha<0.05){ particles.splice(i,1); continue; }
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `hsla(${p.hue},100%,60%,${p.alpha})`;
            ctx.beginPath(); ctx.arc(p.x,p.y,1.6,0,Math.PI*2); ctx.fill();
        }
    }
    requestAnimationFrame(loop);
}

