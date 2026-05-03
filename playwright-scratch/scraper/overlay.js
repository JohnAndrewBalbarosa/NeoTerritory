// Injected into the target page via page.addInitScript. Local-only.
//
// Flow:
//   Step 0 — "For whom?" (creates scraper-output/<slug>/<runId>/).
//   Step 1 — pick a div (hover-highlight + click).
//   Step 2 — include images? Yes / No.
//   Step 3 — proceed? Proceed / Cancel.
//
// Layout safety:
//   - Overlay is fixed top-right, max-height = innerHeight - 24, with
//     internal scroll, so it can never overflow the viewport.
//   - A 250 ms poll re-clamps panel size + position whenever the
//     window or device pixel ratio changes (Chromium under Playwright
//     does not always fire resize events for OS-level window drags).
//   - Minimize button collapses the panel to a small chip; click the
//     chip to expand.

(function () {
  if (window.__neoScraperInstalled) return;
  window.__neoScraperInstalled = true;

  const STATE = {
    person: null,
    mode: 'whom',         // 'whom' | 'idle' | 'picking' | 'images' | 'confirm'
    minimized: false,
    hoverEl: null,
    pickedEl: null,
    pickedId: null,
    includeImages: false,
    autoScroll: true,
    lastViewport: { w: 0, h: 0, dpr: 0 },
  };

  function isPostLike(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    if (el.tagName === 'ARTICLE') return true;
    const role = el.getAttribute && el.getAttribute('role');
    if (role === 'article' || role === 'feed' || role === 'listitem') return true;
    const hasText = (el.innerText || '').trim().length > 30;
    const hasMedia = !!el.querySelector('img,video,picture');
    const r = el.getBoundingClientRect();
    if (hasText && hasMedia && r.height > 80 && r.width > 200) return true;
    return false;
  }
  function findPostAncestor(el) {
    let cur = el;
    let depth = 0;
    while (cur && cur !== document.body && depth < 25) {
      if (isPostLike(cur)) return cur;
      cur = cur.parentElement;
      depth += 1;
    }
    return null;
  }
  function shortPathTo(el) {
    if (!el) return '';
    const parts = [];
    let cur = el;
    let depth = 0;
    while (cur && cur !== document.body && depth < 6) {
      let s = cur.tagName.toLowerCase();
      if (cur.id) s += `#${cur.id}`;
      if (cur.classList && cur.classList.length) s += `.${[...cur.classList].slice(0, 2).join('.')}`;
      parts.unshift(s);
      cur = cur.parentElement;
      depth += 1;
    }
    return parts.join(' > ');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- Hover highlight ----------
  const highlight = document.createElement('div');
  Object.assign(highlight.style, {
    position: 'fixed', pointerEvents: 'none', border: '2px solid #78dbff',
    background: 'rgba(120, 219, 255, 0.12)', zIndex: '2147483646',
    transition: 'all 80ms ease-out', display: 'none', boxSizing: 'border-box', borderRadius: '4px',
  });
  const tag = document.createElement('div');
  Object.assign(tag.style, {
    position: 'fixed', pointerEvents: 'none', background: '#78dbff', color: '#001018',
    font: '12px/1.2 ui-monospace, Menlo, monospace', padding: '4px 8px', borderRadius: '4px',
    zIndex: '2147483646', display: 'none',
  });
  function paintHighlight(el) {
    if (!el) { highlight.style.display = 'none'; tag.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    Object.assign(highlight.style, {
      display: 'block', left: `${r.left}px`, top: `${r.top}px`,
      width: `${r.width}px`, height: `${r.height}px`,
    });
    const text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    const imgs = el.querySelectorAll('img,video').length;
    tag.textContent = `${el.tagName.toLowerCase()} · ${imgs} media · ${text}`;
    Object.assign(tag.style, { display: 'block', left: `${r.left}px`, top: `${Math.max(0, r.top - 24)}px` });
  }
  function onMouseMove(e) {
    if (STATE.mode !== 'picking' || STATE.minimized) return;
    const target = e.target;
    if (target.closest && target.closest('#__neo_scraper_overlay__')) {
      paintHighlight(null); STATE.hoverEl = null; return;
    }
    const post = findPostAncestor(target);
    if (post !== STATE.hoverEl) { STATE.hoverEl = post; paintHighlight(post); }
  }
  function onClickCapture(e) {
    if (STATE.mode !== 'picking' || STATE.minimized) return;
    if (e.target.closest && e.target.closest('#__neo_scraper_overlay__')) return;
    if (!STATE.hoverEl) return;
    e.preventDefault(); e.stopPropagation();
    setPicked(STATE.hoverEl);
  }
  function setPicked(el) {
    const id = `p${Date.now().toString(36)}`;
    el.setAttribute('data-neo-pick-id', id);
    STATE.pickedEl = el;
    STATE.pickedId = id;
    paintHighlight(null);
    renderImagesPrompt();
  }

  // ---------- Overlay container ----------
  const overlay = document.createElement('div');
  overlay.id = '__neo_scraper_overlay__';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: '2147483647',
    font: '13px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif',
    color: '#f0f4ff',
    boxSizing: 'border-box',
  });

  function clampOverlay() {
    // Re-pin the panel so it never grows past the visible viewport.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxW = Math.min(380, Math.max(240, vw - 24));
    const maxH = Math.max(120, vh - 24);
    overlay.style.maxWidth = `${maxW}px`;
    overlay.style.maxHeight = `${maxH}px`;
    overlay.style.right = '12px';
    overlay.style.top = '12px';
    // The inner panel scrolls if content doesn't fit.
    const inner = overlay.querySelector('[data-neo-panel-inner]');
    if (inner) {
      inner.style.maxHeight = `${maxH - 4}px`;
      inner.style.overflowY = 'auto';
    }
  }

  function btn(primary) {
    return `background:${primary ? 'linear-gradient(135deg,#78dbff,#c084fc)' : 'rgba(255,255,255,0.06)'};color:${primary ? '#001018' : '#f0f4ff'};border:${primary ? '0' : '1px solid rgba(255,255,255,0.18)'};border-radius:8px;padding:8px 14px;cursor:pointer;font:inherit;${primary ? 'font-weight:600;' : ''}`;
  }
  function shell(headerLeft, body) {
    // Two-row shell: header (with minimize) + scrollable body.
    return `
      <div data-neo-panel-inner style="background:rgba(20,24,40,0.96);border:1px solid rgba(255,255,255,0.18);border-radius:14px;box-shadow:0 20px 60px -20px rgba(0,0,0,0.6);backdrop-filter:blur(8px);min-width:260px;display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.08);position:sticky;top:0;background:rgba(20,24,40,0.96);border-radius:14px 14px 0 0">
          ${headerLeft}
          <button id="neo-min" title="Minimize" style="margin-left:auto;background:transparent;border:1px solid rgba(255,255,255,0.18);color:#9aa6c2;border-radius:8px;width:24px;height:24px;display:grid;place-items:center;cursor:pointer;font:inherit;line-height:1;padding:0">–</button>
        </div>
        <div style="padding:12px 14px 14px">
          ${body}
        </div>
      </div>
    `;
  }
  function chip(label) {
    return `
      <button id="neo-expand" title="Expand scraper panel" style="background:rgba(20,24,40,0.96);border:1px solid rgba(255,255,255,0.18);color:#f0f4ff;border-radius:999px;padding:6px 12px 6px 10px;cursor:pointer;font:inherit;display:inline-flex;align-items:center;gap:6px;backdrop-filter:blur(8px);box-shadow:0 14px 40px -20px rgba(0,0,0,0.6)">
        <span style="width:8px;height:8px;border-radius:999px;background:linear-gradient(135deg,#78dbff,#c084fc)"></span>
        <span style="font-size:12px">${escapeHtml(label)}</span>
      </button>
    `;
  }

  function renderRoot() {
    if (STATE.minimized) {
      const label = STATE.person ? `scraper · ${STATE.person}` : 'scraper';
      overlay.innerHTML = chip(label);
      clampOverlay();
      return;
    }
    if (STATE.mode === 'whom') return renderWhom();
    if (STATE.mode === 'idle') return renderIdle();
    if (STATE.mode === 'picking') return renderPicking();
    if (STATE.mode === 'images') return renderImagesPrompt();
    if (STATE.mode === 'confirm') return renderConfirm();
  }

  function renderWhom() {
    STATE.mode = 'whom';
    paintHighlight(null);
    overlay.innerHTML = shell(
      `<span style="width:10px;height:10px;border-radius:999px;background:#c084fc;box-shadow:0 0 10px #c084fc"></span><strong style="letter-spacing:0.04em">Step 0 · for whom?</strong>`,
      `<p style="margin:0 0 10px;color:#9aa6c2;font-size:12px">Whose data is this scrape for? A folder will be created (or reused) under <code style="font-family:ui-monospace,Menlo,monospace;font-size:11px;background:rgba(0,0,0,0.3);padding:1px 4px;border-radius:4px">scraper-output/&lt;name&gt;/</code>.</p>
       <input id="neo-person" placeholder="e.g. drew, lisa, juan_dela_cruz" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.3);color:#f0f4ff;border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:8px 10px;font:inherit;margin-bottom:10px" autofocus />
       <button id="neo-set-person" style="${btn(true)};width:100%">Continue</button>
       <p id="neo-status" style="margin:8px 0 0;color:#9aa6c2;font-size:11px;min-height:14px">Navigate Chromium to the page you want first; we'll begin once you click Continue.</p>`
    );
    clampOverlay();
    setTimeout(() => overlay.querySelector('#neo-person')?.focus(), 0);
  }

  function renderIdle() {
    STATE.mode = 'idle';
    paintHighlight(null);
    overlay.innerHTML = shell(
      `<span style="width:10px;height:10px;border-radius:999px;background:#666"></span><strong style="letter-spacing:0.04em">Scraping for · ${escapeHtml(STATE.person)}</strong><button id="neo-change-person" title="Change person" style="background:transparent;border:1px solid rgba(255,255,255,0.18);color:#9aa6c2;border-radius:999px;padding:2px 8px;font:inherit;font-size:10px;cursor:pointer">change</button>`,
      `<p style="margin:0 0 10px;color:#9aa6c2;font-size:12px">Browse to the page you want, then start scraping. One div per run; pick again for another.</p>
       <button id="neo-start" style="${btn(true)};width:100%">Start scraping</button>
       <p id="neo-status" style="margin:8px 0 0;color:#9aa6c2;font-size:11px;min-height:14px"></p>`
    );
    clampOverlay();
  }

  function renderPicking() {
    STATE.mode = 'picking';
    overlay.innerHTML = shell(
      `<span style="width:10px;height:10px;border-radius:999px;background:#78dbff;box-shadow:0 0 10px #78dbff"></span><strong style="letter-spacing:0.04em">Step 1 · pick a div</strong>`,
      `<p style="margin:0 0 10px;color:#9aa6c2;font-size:12px">Hover the page; the nearest post-like block highlights. Click it to pick.</p>
       <button id="neo-cancel" style="${btn(false)};width:100%">Cancel</button>`
    );
    clampOverlay();
  }

  function renderImagesPrompt() {
    STATE.mode = 'images';
    const preview = (STATE.pickedEl?.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 140);
    const imgCount = STATE.pickedEl?.querySelectorAll('img,picture source,video').length || 0;
    overlay.innerHTML = shell(
      `<span style="width:10px;height:10px;border-radius:999px;background:#c084fc;box-shadow:0 0 10px #c084fc"></span><strong style="letter-spacing:0.04em">Step 2 · include images?</strong>`,
      `<p style="margin:0 0 8px;color:#9aa6c2;font-size:12px">Picked block contains <strong>${imgCount}</strong> media element${imgCount === 1 ? '' : 's'}.</p>
       <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:8px 10px;font-size:12px;color:#dde4f5;margin-bottom:12px;max-height:80px;overflow:auto">${escapeHtml(preview) || '<em style="color:#9aa6c2">no text preview</em>'}</div>
       <div style="display:flex;gap:8px">
         <button id="neo-img-no" style="${btn(false)};flex:1">No</button>
         <button id="neo-img-yes" style="${btn(true)};flex:1">Yes, include</button>
       </div>`
    );
    clampOverlay();
  }

  function renderConfirm() {
    STATE.mode = 'confirm';
    overlay.innerHTML = shell(
      `<span style="width:10px;height:10px;border-radius:999px;background:#78dbff;box-shadow:0 0 10px #78dbff"></span><strong style="letter-spacing:0.04em">Step 3 · proceed?</strong>`,
      `<p style="margin:0 0 6px;color:#9aa6c2;font-size:12px">For: <strong style="color:#dde4f5">${escapeHtml(STATE.person)}</strong></p>
       <p style="margin:0 0 6px;color:#9aa6c2;font-size:12px">Selector path:</p>
       <div style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#9aa6c2;word-break:break-all;background:rgba(0,0,0,0.3);padding:6px 8px;border-radius:6px;margin-bottom:10px">${escapeHtml(shortPathTo(STATE.pickedEl))}</div>
       <p style="margin:0 0 6px;color:#dde4f5;font-size:12px">Images: <strong>${STATE.includeImages ? 'yes' : 'no'}</strong></p>
       <label style="display:flex;align-items:center;gap:8px;margin:0 0 12px;color:#dde4f5;font-size:12px;cursor:pointer">
         <input type="checkbox" id="neo-autoscroll" ${STATE.autoScroll ? 'checked' : ''} style="accent-color:#78dbff" />
         Auto-scroll to load more (lazy feeds)
       </label>
       <div style="display:flex;gap:8px">
         <button id="neo-cancel-final" style="${btn(false)};flex:1">Cancel</button>
         <button id="neo-proceed" style="${btn(true)};flex:1">Proceed</button>
       </div>
       <p id="neo-status" style="margin:8px 0 0;color:#9aa6c2;font-size:11px;min-height:14px"></p>`
    );
    clampOverlay();
  }

  function setStatus(msg) {
    const el = overlay.querySelector('#neo-status');
    if (el) el.textContent = msg;
  }
  function clearPick() {
    if (STATE.pickedId) {
      document.querySelectorAll(`[data-neo-pick-id="${STATE.pickedId}"]`).forEach((el) => el.removeAttribute('data-neo-pick-id'));
    }
    STATE.pickedEl = null;
    STATE.pickedId = null;
  }

  overlay.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const id = t.id;

    if (id === 'neo-min') { STATE.minimized = true; renderRoot(); return; }
    if (id === 'neo-expand') { STATE.minimized = false; renderRoot(); return; }
    if (id === 'neo-set-person') {
      const input = overlay.querySelector('#neo-person');
      const raw = (input?.value || '').trim();
      if (!raw) { setStatus('please enter a name first.'); return; }
      const slug = raw.toLowerCase().replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'unnamed';
      const ack = await window.__neoScraper.setPerson({ name: raw, slug });
      STATE.person = ack?.slug || slug;
      renderIdle();
      return;
    }
    if (id === 'neo-change-person') { renderWhom(); return; }
    if (id === 'neo-start') { renderPicking(); return; }
    if (id === 'neo-cancel') { renderIdle(); return; }
    if (id === 'neo-img-yes' || id === 'neo-img-no') {
      STATE.includeImages = id === 'neo-img-yes';
      renderConfirm();
      return;
    }
    if (id === 'neo-cancel-final') { clearPick(); renderIdle(); return; }
    if (id === 'neo-proceed') {
      const cb = overlay.querySelector('#neo-autoscroll');
      if (cb) STATE.autoScroll = !!cb.checked;
      setStatus(STATE.autoScroll ? 'scraping… (auto-scrolling, this may take a while)' : 'scraping…');
      const res = await window.__neoScraper.runExtract({
        pickId: STATE.pickedId,
        includeImages: STATE.includeImages,
        autoScroll: STATE.autoScroll,
        sourceUrl: window.location.href,
        selectorPath: shortPathTo(STATE.pickedEl),
      });
      clearPick();
      renderIdle();
      const childMsg = res?.childCount != null ? `${res.childCount} items` : '';
      const scrollMsg = res?.scrollRounds ? ` after ${res.scrollRounds} scrolls` : '';
      setStatus(`done → ${childMsg}${scrollMsg} → ${res?.outputDir ?? ''}`);
    }
  });

  overlay.addEventListener('keydown', (e) => {
    if (STATE.mode === 'whom' && e.key === 'Enter') {
      e.preventDefault();
      overlay.querySelector('#neo-set-person')?.click();
    }
  });

  // Viewport poll: re-clamp panel sizing whenever the actual window
  // dimensions or DPR change. Playwright sometimes does not bubble
  // OS-window resize events to the page, so a 250 ms poll is more
  // reliable than just window.addEventListener('resize').
  function pollViewport() {
    const w = window.innerWidth, h = window.innerHeight, dpr = window.devicePixelRatio;
    const last = STATE.lastViewport;
    if (w !== last.w || h !== last.h || dpr !== last.dpr) {
      STATE.lastViewport = { w, h, dpr };
      clampOverlay();
      // Repaint the highlight too — its bounding box may have shifted.
      if (STATE.hoverEl && STATE.mode === 'picking' && !STATE.minimized) {
        paintHighlight(STATE.hoverEl);
      }
    }
  }
  window.addEventListener('resize', pollViewport, { passive: true });
  setInterval(pollViewport, 250);

  function attach() {
    if (!document.body) return;
    document.body.appendChild(highlight);
    document.body.appendChild(tag);
    document.body.appendChild(overlay);
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClickCapture, true);
    renderRoot();
    pollViewport();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach, { once: true });
  } else {
    attach();
  }
})();
