/**
 * Review overlay additions — runs AFTER app.js.
 * Augments the existing `analyzeSource` flow with a per-run rating overlay.
 * Delete this file (and test-review/) to remove this UX entirely.
 */
(function () {
  'use strict';

  // Track whether the current session has had a run + end-of-session review.
  let _sessionRunCount = 0;
  let _sessionEndReviewDone = false;
  let _lastRunId = null;

  const overlay = document.getElementById('review-overlay');
  const overlayBody = document.getElementById('review-overlay-body');
  const overlayClose = document.getElementById('review-overlay-close');
  const rateBtn = document.getElementById('review-rate-btn');

  if (overlayClose) {
    overlayClose.addEventListener('click', () => {
      overlay.classList.remove('open');
      if (_sessionRunCount > 0) rateBtn.classList.remove('hidden');
    });
  }

  if (rateBtn) {
    rateBtn.addEventListener('click', () => {
      overlay.classList.add('open');
      rateBtn.classList.add('hidden');
    });
  }

  // Listen for custom event dispatched by the main app when analysis completes.
  // We emit this from a patched version of the renderRun path below.
  window.addEventListener('nt:analysis-complete', (evt) => {
    const { pendingId, aiAvailable } = evt.detail || {};
    _sessionRunCount++;
    _lastRunId = pendingId || null;
    showPerRunOverlay(pendingId);
  });

  async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('nt_token');
    const headers = Object.assign({}, options.headers || {});
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData) && options.body && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function showPerRunOverlay(runPendingId) {
    overlayBody.innerHTML = '<p style="color:#9ca3af">Loading review form…</p>';
    overlay.classList.add('open');
    rateBtn.classList.add('hidden');

    try {
      const schema = await apiFetch('/api/reviews/schema?scope=per-run');
      overlayBody.innerHTML = renderReviewForm(schema.questions || [], runPendingId, 'per-run');
      wireStarWidgets(overlayBody);
      wireSubmit(overlayBody, schema.questions || [], runPendingId, 'per-run');
    } catch (err) {
      overlayBody.innerHTML = `<p style="color:#f87171">Could not load review form: ${err.message}</p>`;
    }
  }

  function renderReviewForm(questions, runId, scope) {
    const items = questions.map(q => {
      if (q.type === 'rating') {
        const stars = Array.from({ length: Number(q.max) || 5 }, (_, i) => i + 1)
          .map(n => `<button type="button" class="star-btn" data-value="${n}" data-qid="${q.id}" aria-label="Rate ${n}">&#9733;</button>`)
          .join('');
        return `<div class="review-q" data-qid="${q.id}" data-type="rating" data-required="${q.required}">
          <label>${escapeHtml(q.prompt)}${q.required ? ' <span style="color:#f87171">*</span>' : ''}</label>
          <div class="star-row">${stars}</div>
          <input type="hidden" id="rating-${q.id}" value="" />
        </div>`;
      }
      if (q.type === 'text') {
        return `<div class="review-q" data-qid="${q.id}" data-type="text" data-required="${q.required}">
          <label>${escapeHtml(q.prompt)}</label>
          <textarea id="text-${q.id}" rows="3" maxlength="${q.maxLength || 500}" style="width:100%;background:#12122a;border:1px solid #374151;border-radius:6px;color:#e5e7eb;padding:.5rem;font-size:.85rem;box-sizing:border-box;resize:vertical"></textarea>
        </div>`;
      }
      return '';
    }).join('');

    return `
      <div id="review-form-inner">
        ${items}
        <button id="overlay-submit-btn" class="review-submit-btn" disabled>Submit rating</button>
        <p id="overlay-error" style="color:#f87171;font-size:.85rem;margin-top:.5rem;display:none"></p>
      </div>`;
  }

  function wireStarWidgets(container) {
    container.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.qid;
        const val = Number(btn.dataset.value);
        const hidden = container.querySelector(`#rating-${qid}`);
        if (hidden) hidden.value = val;
        container.querySelectorAll(`.star-btn[data-qid="${qid}"]`).forEach(s => {
          s.classList.toggle('active', Number(s.dataset.value) <= val);
        });
        checkFormValidity(container);
      });
    });
  }

  function checkFormValidity(container) {
    const submitBtn = container.querySelector('#overlay-submit-btn');
    if (!submitBtn) return;
    const allRequired = Array.from(container.querySelectorAll('.review-q[data-required="true"]'));
    const allFilled = allRequired.every(qDiv => {
      const qid = qDiv.dataset.qid;
      const type = qDiv.dataset.type;
      if (type === 'rating') {
        const hidden = container.querySelector(`#rating-${qid}`);
        return hidden && hidden.value !== '';
      }
      if (type === 'text') {
        const ta = container.querySelector(`#text-${qid}`);
        return ta && ta.value.trim() !== '';
      }
      return true;
    });
    submitBtn.disabled = !allFilled;
  }

  function wireSubmit(container, questions, runPendingId, scope) {
    const btn = container.querySelector('#overlay-submit-btn');
    const errEl = container.querySelector('#overlay-error');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
      const answers = {};
      questions.forEach(q => {
        if (q.type === 'rating') {
          const v = container.querySelector(`#rating-${q.id}`)?.value;
          if (v !== '') answers[q.id] = Number(v);
        } else if (q.type === 'text') {
          const v = container.querySelector(`#text-${q.id}`)?.value.trim();
          if (v) answers[q.id] = v;
        }
      });

      try {
        await apiFetch('/api/reviews', {
          method: 'POST',
          body: JSON.stringify({ scope, analysisRunId: null, answers })
        });
        overlayBody.innerHTML = `
          <div style="text-align:center;padding:2rem 0">
            <div style="font-size:2rem;margin-bottom:.75rem">&#9733;</div>
            <p style="color:#86efac;margin:0">Thanks for your rating!</p>
          </div>`;
        setTimeout(() => {
          overlay.classList.remove('open');
          rateBtn.classList.remove('hidden');
        }, 1800);
      } catch (err) {
        if (errEl) { errEl.style.display = 'block'; errEl.textContent = err.message; }
        btn.disabled = false;
      }
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Intercept the logout button to show end-of-session review first.
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (evt) => {
      if (_sessionRunCount > 0 && !_sessionEndReviewDone) {
        evt.stopImmediatePropagation();
        const confirmed = await showEndOfSessionModal();
        _sessionEndReviewDone = true;
        // Re-trigger logout by simulating a click on the original button.
        logoutBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    }, true);
  }

  async function showEndOfSessionModal() {
    return new Promise(async (resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'eos-backdrop';

      let schema;
      try {
        schema = await apiFetch('/api/reviews/schema?scope=end-of-session');
      } catch {
        resolve(false);
        return;
      }

      const questions = schema.questions || [];
      const formHtml = questions.map(q => {
        if (q.type === 'rating') {
          const stars = Array.from({ length: Number(q.max) || 5 }, (_, i) => i + 1)
            .map(n => `<button type="button" class="star-btn" data-value="${n}" data-qid="${q.id}" aria-label="Rate ${n}">&#9733;</button>`)
            .join('');
          return `<div class="review-q" data-qid="${q.id}" data-type="rating" data-required="${q.required}">
            <label>${escapeHtml(q.prompt)}${q.required ? ' <span style="color:#f87171">*</span>' : ''}</label>
            <div class="star-row">${stars}</div>
            <input type="hidden" id="eos-rating-${q.id}" value="" />
          </div>`;
        }
        if (q.type === 'text') {
          return `<div class="review-q" data-qid="${q.id}" data-type="text" data-required="${q.required}">
            <label>${escapeHtml(q.prompt)}</label>
            <textarea id="eos-text-${q.id}" rows="3" maxlength="${q.maxLength || 500}"></textarea>
          </div>`;
        }
        return '';
      }).join('');

      backdrop.innerHTML = `
        <div class="eos-modal">
          <h2>Session feedback</h2>
          ${formHtml}
          <p id="eos-error" style="color:#f87171;font-size:.85rem;display:none"></p>
          <div class="eos-actions">
            <button class="eos-skip-btn" id="eos-skip">Skip</button>
            <button class="eos-submit-btn" id="eos-submit" disabled>Submit &amp; sign out</button>
          </div>
        </div>`;

      document.body.appendChild(backdrop);
      wireStarWidgets(backdrop);

      backdrop.querySelectorAll('.review-q').forEach(() => checkEosValidity(backdrop, questions));
      backdrop.querySelectorAll('.star-btn').forEach(b =>
        b.addEventListener('click', () => checkEosValidity(backdrop, questions)));

      backdrop.querySelector('#eos-skip').addEventListener('click', () => {
        backdrop.remove();
        resolve(false);
      });

      backdrop.querySelector('#eos-submit').addEventListener('click', async () => {
        const answers = {};
        questions.forEach(q => {
          if (q.type === 'rating') {
            const v = backdrop.querySelector(`#eos-rating-${q.id}`)?.value;
            if (v !== '') answers[q.id] = Number(v);
          } else if (q.type === 'text') {
            const v = backdrop.querySelector(`#eos-text-${q.id}`)?.value.trim();
            if (v) answers[q.id] = v;
          }
        });
        try {
          await apiFetch('/api/reviews', {
            method: 'POST',
            body: JSON.stringify({ scope: 'end-of-session', analysisRunId: null, answers })
          });
          backdrop.remove();
          resolve(true);
        } catch (err) {
          const errEl = backdrop.querySelector('#eos-error');
          if (errEl) { errEl.style.display = 'block'; errEl.textContent = err.message; }
        }
      });
    });
  }

  function checkEosValidity(container, questions) {
    const submitBtn = container.querySelector('#eos-submit');
    if (!submitBtn) return;
    const allRequired = questions.filter(q => q.required === true || q.required === 'true');
    const allFilled = allRequired.every(q => {
      if (q.type === 'rating') {
        const v = container.querySelector(`#eos-rating-${q.id}`)?.value;
        return v && v !== '';
      }
      if (q.type === 'text') {
        const v = container.querySelector(`#eos-text-${q.id}`)?.value.trim();
        return v !== '';
      }
      return true;
    });
    submitBtn.disabled = !allFilled;
  }

  // Patch: notify this overlay script when the main app completes an analysis.
  // We do this by observing the results panel becoming visible.
  const resultsPanel = document.getElementById('results-panel');
  if (resultsPanel) {
    const obs = new MutationObserver(() => {
      if (!resultsPanel.hidden) {
        window.dispatchEvent(new CustomEvent('nt:analysis-complete', { detail: {} }));
      }
    });
    obs.observe(resultsPanel, { attributes: true, attributeFilter: ['hidden'] });
  }
})();
