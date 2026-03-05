// ============================================================
// CodiNeo — Analysis New Page Logic
// ============================================================

(function () {
    window.startAnalysis = function () {
        const btn = document.getElementById('start-btn');
        const readyCard = document.getElementById('ready-card');
        const progressCard = document.getElementById('progress-card');
        if (!btn) return;

        btn.disabled = true;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;animation:spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Running…`;
        btn.style.opacity = '0.7';
        if (readyCard) readyCard.style.display = 'none';
        if (progressCard) progressCard.style.display = 'block';

        function animateBar(barId, pctId, targetPct, delay, onDone) {
            setTimeout(() => {
                let current = 0;
                const interval = setInterval(() => {
                    current = Math.min(current + 2, targetPct);
                    const bar = document.getElementById(barId);
                    const pct = document.getElementById(pctId);
                    if (bar) bar.style.width = current + '%';
                    if (pct) pct.textContent = current + '%';
                    if (current >= targetPct) {
                        clearInterval(interval);
                        if (onDone) onDone();
                    }
                }, 30);
            }, delay);
        }

        animateBar('prog-bar-1', 'prog-pct-1', 100, 200, () => {
            animateBar('prog-bar-2', 'prog-pct-2', 100, 400, () => {
                animateBar('prog-bar-3', 'prog-pct-3', 100, 400, () => {
                    setTimeout(() => { location.hash = '#/results'; }, 600);
                });
            });
        });
    };

    window.initAnalysisNew = function () {
        // Reset state when navigating back to this page
        const btn = document.getElementById('start-btn');
        const readyCard = document.getElementById('ready-card');
        const progressCard = document.getElementById('progress-card');
        if (btn) { btn.disabled = false; btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Analysis`; btn.style.opacity = '1'; }
        if (readyCard) readyCard.style.display = 'block';
        if (progressCard) progressCard.style.display = 'none';

        // Reset progress bars
        ['prog-bar-1', 'prog-bar-2', 'prog-bar-3'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.width = '0%';
        });
        ['prog-pct-1', 'prog-pct-2', 'prog-pct-3'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0%';
        });
    };

    window.triggerDownload = function () {
        const btn = event.target.closest('button');
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = 'Preparing…';
        setTimeout(() => {
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Downloaded!`;
            btn.disabled = false;
        }, 1200);
    };
})();

// Spin animation for loading spinner
const spinStyle = document.createElement('style');
spinStyle.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(spinStyle);
