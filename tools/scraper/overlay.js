// Injected into the target page via page.addInitScript. Runs in the page's
// own JS context. Talks back to the host Node process exclusively through
// window.__neoScraper.* bindings exposed by Playwright's exposeBinding.
//
// User flow:
//   1. Hover anywhere on the page. The script highlights the nearest
//      "post-like" container ancestor (article-ish element with both
//      text and a media child, or [role=article] / <article>).
//   2. Click on a highlighted block to add it to the picks list.
//   3. The floating panel shows every pick with: checkbox, name preview,
//      image-scope radio (none / profile / all), remove.
//   4. "Save session" persists storageState (host writes to disk).
//   5. "Start scraping" extracts every checked pick (with its scope),
//      optionally scrolling to load more first. Output is written by the
//      host to playwright-scratch/scraper-output/<run_id>/.
//
// Important: pure DOM, no framework. The host page may already use any
// framework; we only attach to document.body and use stable inline styles.

(function () {
  if (window.__neoScraperInstalled) return;
  window.__neoScraperInstalled = true;

  const STATE = {
    picks: [], // { id, label, selectorPath, imageScope, checked }
    hoverEl: null,
  };

  // ---------- Heuristic: find the nearest post-like ancestor ----------
  function isPostLike(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    if (el.tagName === 'ARTICLE') return true;
    const role = el.getAttribute && el.getAttribute('role');
    if (role === 'article' || role === 'feed' || role === 'listitem') return true;
    // Heuristic: has both text and an image/video descendant, sized > 100px.
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

  function labelFor(el) {
    const txt = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    return txt || `<${el.tagName.toLowerCase()}>`;
  }

  // ---------- Hover highlight ----------
  const highlight = document.createElement('div');
  Object.assign(highlight.style, {
    position: 'fixed',
    pointerEvents: 'none',
    border: '2px solid #78dbff',
    background: 'rgba(120, 219, 255, 0.12)',
    zIndex: '2147483646',
    transition: 'all 80ms ease-out',
    display: 'none',
    boxSizing: 'border-box',
    borderRadius: '4px',
  });
  highlight.id = '__neo_scraper_hi__';

  const tag = document.createElement('div');
  Object.assign(tag.style, {
    position: 'fixed',
    pointerEvents: 'none',
    background: '#78dbff',
    color: '#001018',
    font: '12px/1.2 ui-monospace, Menlo, monospace',
    padding: '4px 8px',
    borderRadius: '4px',
    zIndex: '2147483646',
    display: 'none',
  });
  tag.id = '__neo_scraper_tag__';

  function paintHighlight(el) {
    if (!el) {
      highlight.style.display = 'none';
      tag.style.display = 'none';
      return;
    }
    const r = el.getBoundingClientRect();
    Object.assign(highlight.style, {
      display: 'block',
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
    const text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    const imgs = el.querySelectorAll('img,video').length;
    tag.textContent = `${el.tagName.toLowerCase()} · ${imgs} media · ${text}`;
    Object.assign(tag.style, {
      display: 'block',
      left: `${r.left}px`,
      top: `${Math.max(0, r.top - 24)}px`,
    });
  }

  function onMouseMove(e) {
    if (!window.__neoScraperPicking) return;
    const target = e.target;
    if (target.closest && target.closest('#__neo_scraper_panel__')) {
      paintHighlight(null);
      STATE.hoverEl = null;
      return;
    }
    const post = findPostAncestor(target);
    if (post !== STATE.hoverEl) {
      STATE.hoverEl = post;
      paintHighlight(post);
    }
  }

  function onClickCapture(e) {
    if (!window.__neoScraperPicking) return;
    if (e.target.closest && e.target.closest('#__neo_scraper_panel__')) return;
    if (!STATE.hoverEl) return;
    e.preventDefault();
    e.stopPropagation();
    addPick(STATE.hoverEl);
  }

  // ---------- Picks ----------
  function addPick(el) {
    const id = `p${Date.now().toString(36)}_${STATE.picks.length}`;
    el.setAttribute('data-neo-pick-id', id);
    STATE.picks.push({
      id,
      label: labelFor(el),
      selectorPath: shortPathTo(el),
      imageScope: 'none',
      checked: true,
    });
    renderPanel();
  }

  function removePick(id) {
    STATE.picks = STATE.picks.filter((p) => p.id !== id);
    document.querySelectorAll(`[data-neo-pick-id="${id}"]`).forEach((el) => {
      el.removeAttribute('data-neo-pick-id');
    });
    renderPanel();
  }

  // ---------- Panel ----------
  const panel = document.createElement('div');
  panel.id = '__neo_scraper_panel__';
  Object.assign(panel.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    width: '360px',
    maxHeight: '80vh',
    overflowY: 'auto',
    background: 'rgba(20,24,40,0.96)',
    color: '#f0f4ff',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '14px',
    boxShadow: '0 20px 60px -20px rgba(0,0,0,0.6)',
    font: '13px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif',
    padding: '14px',
    zIndex: '2147483647',
    backdropFilter: 'blur(8px)',
  });

  function renderPanel() {
    const picking = !!window.__neoScraperPicking;
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="width:10px;height:10px;border-radius:999px;background:${picking ? '#78dbff' : '#666'};box-shadow:${picking ? '0 0 10px #78dbff' : 'none'}"></span>
        <strong style="letter-spacing:0.04em">NeoTerritory scraper</strong>
        <button id="neo-toggle-pick" style="margin-left:auto;background:${picking ? '#78dbff' : 'transparent'};color:${picking ? '#001018' : '#f0f4ff'};border:1px solid rgba(255,255,255,0.2);border-radius:999px;padding:4px 10px;cursor:pointer;font:inherit">${picking ? 'Pause picking' : 'Start picking'}</button>
      </div>
      <p style="margin:0 0 10px;color:#9aa6c2;font-size:11px">Hover the page. Click a highlighted block to add it as a post. Each post is enclosed: text + selected images stay grouped on output.</p>
      <ol id="neo-pick-list" style="list-style:none;margin:0 0 10px;padding:0;display:grid;gap:8px"></ol>
      <div style="display:grid;gap:8px;border-top:1px solid rgba(255,255,255,0.1);padding-top:10px">
        <label style="display:flex;align-items:center;gap:8px;font-size:12px"><input type="number" id="neo-max-scrolls" min="0" max="50" value="${STATE.maxScrolls ?? 5}" style="width:60px;background:rgba(255,255,255,0.08);color:inherit;border:1px solid rgba(255,255,255,0.18);border-radius:6px;padding:3px 6px"/> max scrolls before extract</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="neo-save-state" style="flex:1;background:rgba(255,255,255,0.06);color:inherit;border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:8px;cursor:pointer;font:inherit">Save session</button>
          <button id="neo-start-scrape" style="flex:1;background:linear-gradient(135deg,#78dbff,#c084fc);color:#001018;border:0;border-radius:8px;padding:8px;cursor:pointer;font:inherit;font-weight:600">Start scraping</button>
        </div>
        <p id="neo-status" style="margin:0;color:#9aa6c2;font-size:11px;min-height:14px"></p>
      </div>
    `;
    const list = panel.querySelector('#neo-pick-list');
    if (STATE.picks.length === 0) {
      list.innerHTML = `<li style="color:#9aa6c2;padding:12px;text-align:center;border:1px dashed rgba(255,255,255,0.15);border-radius:8px">No picks yet. Click "Start picking", then click a post on the page.</li>`;
    } else {
      STATE.picks.forEach((p, idx) => {
        const li = document.createElement('li');
        li.style.cssText = 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:8px;display:grid;gap:6px';
        li.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px">
            <input type="checkbox" data-id="${p.id}" data-act="check" ${p.checked ? 'checked' : ''}/>
            <strong style="flex:1;font-size:12px">#${idx + 1} · ${escapeHtml(p.label).slice(0, 50)}</strong>
            <button data-id="${p.id}" data-act="remove" style="background:transparent;color:#ff8c8c;border:0;cursor:pointer;font:inherit">×</button>
          </div>
          <div style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#9aa6c2;word-break:break-all">${escapeHtml(p.selectorPath)}</div>
          <div style="display:flex;gap:6px;font-size:11px;flex-wrap:wrap">
            ${['none', 'profile', 'all']
              .map(
                (s) => `<label style="display:inline-flex;align-items:center;gap:4px"><input type="radio" name="scope-${p.id}" data-id="${p.id}" data-act="scope" data-scope="${s}" ${p.imageScope === s ? 'checked' : ''}/> ${s}</label>`
              )
              .join('')}
          </div>`;
        list.appendChild(li);
      });
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  panel.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.id === 'neo-toggle-pick') {
      window.__neoScraperPicking = !window.__neoScraperPicking;
      paintHighlight(null);
      renderPanel();
      return;
    }
    if (t.id === 'neo-save-state') {
      setStatus('saving session…');
      const ok = await window.__neoScraper.saveState();
      setStatus(ok ? 'session saved.' : 'save failed.');
      return;
    }
    if (t.id === 'neo-start-scrape') {
      const maxScrolls = Number(panel.querySelector('#neo-max-scrolls')?.value || 5);
      setStatus('scraping…');
      const checked = STATE.picks.filter((p) => p.checked);
      if (checked.length === 0) {
        setStatus('no picks checked.');
        return;
      }
      window.__neoScraperPicking = false;
      paintHighlight(null);
      renderPanel();
      const res = await window.__neoScraper.runExtract({
        picks: checked,
        maxScrolls,
        sourceUrl: window.location.href,
      });
      setStatus(`done: ${res?.postCount ?? 0} post(s) → ${res?.outputDir ?? ''}`);
      return;
    }
    const act = t.getAttribute('data-act');
    const id = t.getAttribute('data-id');
    if (!act || !id) return;
    if (act === 'remove') removePick(id);
  });

  panel.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    const id = t.getAttribute('data-id');
    const act = t.getAttribute('data-act');
    if (!id || !act) return;
    const pick = STATE.picks.find((p) => p.id === id);
    if (!pick) return;
    if (act === 'check') pick.checked = t.checked;
    if (act === 'scope') pick.imageScope = t.getAttribute('data-scope') || 'none';
  });

  function setStatus(s) {
    const el = panel.querySelector('#neo-status');
    if (el) el.textContent = s;
  }

  // Expose helpers for the host process to query / control state.
  window.__neoScraperReadPicks = () => STATE.picks.map((p) => ({ ...p }));
  window.__neoScraperSetStatus = setStatus;

  function attach() {
    if (!document.body) return;
    document.body.appendChild(highlight);
    document.body.appendChild(tag);
    document.body.appendChild(panel);
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClickCapture, true);
    renderPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach, { once: true });
  } else {
    attach();
  }
})();
