// ============================================================
// CodiNeo — Client-side Router
// Hash-based SPA routing
// ============================================================

const ROUTES = {
  '#/dashboard': 'pages/dashboard.html',
  '#/analysis/new': 'pages/analysis-new.html',
  '#/results': 'pages/results.html',
  '#/diff/1': 'pages/diff-viewer.html',
  '#/fixes/1': 'pages/fix-suggestions.html',
  '#/download/1': 'pages/download.html',
};

const DEFAULT_ROUTE = '#/dashboard';

let currentPage = null;

async function navigate(hash) {
  if (!hash || !ROUTES[hash]) hash = DEFAULT_ROUTE;

  if (currentPage === hash) return;
  currentPage = hash;

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.route === hash);
  });

  const contentEl = document.getElementById('page-content');

  // Loading fade-out
  contentEl.style.opacity = '0';
  contentEl.style.transform = 'translateY(6px)';

  try {
    const response = await fetch(ROUTES[hash]);
    if (!response.ok) throw new Error(`Page not found: ${ROUTES[hash]}`);
    const html = await response.text();

    // Parse and inject just the <body>-equivalent content
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const pageContent = doc.querySelector('.page') || doc.body;

    contentEl.innerHTML = pageContent.outerHTML;

    // Clear any previous page's initPage
    window.initPage = null;

    // Execute any inline scripts in the loaded page
    // Scripts are appended to body so they run in context with the live DOM
    const scriptPromises = [];
    contentEl.querySelectorAll('script').forEach(oldScript => {
      const newScript = document.createElement('script');
      newScript.textContent = oldScript.textContent;
      // Remove the duplicate script tag from content to avoid double execution
      oldScript.remove();
      document.body.appendChild(newScript);
      // Clean up after tick
      scriptPromises.push(Promise.resolve().then(() => newScript.remove()));
    });
    await Promise.all(scriptPromises);

    // Animate in
    requestAnimationFrame(() => {
      contentEl.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
      contentEl.style.opacity = '1';
      contentEl.style.transform = 'translateY(0)';
    });

    // Scroll to top
    document.getElementById('main-content').scrollTop = 0;

    // Call page-specific init hook (registered externally)
    if (typeof window.onPageReady === 'function') {
      // Small timeout ensures DOM is painted before init runs
      setTimeout(() => window.onPageReady(hash), 50);
    }

  } catch (err) {
    contentEl.innerHTML = `
      <div class="page" style="text-align:center; padding-top: 80px;">
        <p style="color:var(--text-muted)">Could not load page.</p>
        <p style="font-size:12px; color:var(--text-muted); margin-top:8px;">${err.message}</p>
      </div>
    `;
    contentEl.style.opacity = '1';
    contentEl.style.transform = 'translateY(0)';
  }
}

function initRouter() {
  // Route on hash change
  window.addEventListener('hashchange', () => navigate(location.hash));

  // Route on load
  navigate(location.hash || DEFAULT_ROUTE);
}

// Expose for inline hrefs in pages
window.goTo = function (hash) {
  location.hash = hash;
};

export { initRouter, navigate };
