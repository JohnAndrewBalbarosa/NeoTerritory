// ============================================================
// CodiNeo — Sidebar + Theme Toggle
// ============================================================

export function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const menuFab = document.getElementById('menu-fab');
    const mainContent = document.getElementById('main-content');

    function openSidebar() {
        sidebar.classList.add('mobile-open');
        overlay.classList.add('visible');
    }

    function closeSidebar() {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('visible');
    }

    function toggleSidebar() {
        if (sidebar.classList.contains('mobile-open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    // FAB click
    if (menuFab) {
        menuFab.addEventListener('click', toggleSidebar);
    }

    // Overlay click closes sidebar
    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }

    // Close sidebar on nav item click (mobile)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const route = item.dataset.route;
            if (route) {
                location.hash = route;
                if (window.innerWidth < 768) closeSidebar();
            }
        });
    });

    // Theme toggle
    const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
    const savedTheme = localStorage.getItem('codi-neo-theme') || 'dark';
    applyTheme(savedTheme);

    themeToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            applyTheme(theme);
            localStorage.setItem('codi-neo-theme', theme);
        });
    });

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        themeToggleBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }

    // Responsive: hide sidebar on mobile by default
    function handleResize() {
        if (window.innerWidth < 768) {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('visible');
        }
    }

    window.addEventListener('resize', handleResize);
}
