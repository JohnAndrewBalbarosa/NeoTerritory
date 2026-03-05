// ============================================================
// CodiNeo — Fix Suggestions Logic
// ============================================================

(function () {
    const fixes = [
        { num: 1, category: 'RAII Conformance', title: 'Replace raw pointer with std::unique_ptr&lt;Database&gt;', file: 'src/core/engine.cpp', line: 3, confidence: 98 },
        { num: 2, category: 'RAII Conformance', title: 'Replace raw pointer with std::shared_ptr&lt;Config&gt;', file: 'src/core/engine.cpp', line: 4, confidence: 97 },
        { num: 3, category: 'Dependency Injection', title: 'Inject dependencies via constructor', file: 'src/core/engine.cpp', line: 8, confidence: 95 },
        { num: 4, category: 'Memory Safety', title: 'Remove manual destructor — RAII handles cleanup', file: 'src/core/engine.cpp', line: 17, confidence: 99 },
        { num: 5, category: 'RAII Conformance', title: 'Replace raw pointer with std::shared_ptr&lt;Logger&gt;', file: 'src/core/engine.cpp', line: 5, confidence: 96 },
        { num: 6, category: 'Structural Isolation', title: 'Separate Engine construction from DB setup', file: 'src/core/engine.cpp', line: 8, confidence: 88 },
        { num: 7, category: 'Semantic Alignment', title: 'Add noexcept specifier to process()', file: 'src/core/engine.cpp', line: 14, confidence: 85 },
        { num: 8, category: 'Memory Safety', title: 'Use std::move semantics for unique_ptr transfer', file: 'src/core/engine.cpp', line: 12, confidence: 93 },
    ];

    const checklist = [
        { id: 1, name: 'RAII Compliance', desc: 'Smart pointers replace raw pointers' },
        { id: 2, name: 'Dependency Injection', desc: 'Constructor pattern applied' },
        { id: 3, name: 'Automatic Cleanup', desc: 'Manual destructor removed' },
        { id: 4, name: 'Syntax Verification', desc: 'Code compiles successfully' },
    ];

    let appliedSet = new Set();

    function renderFixCards() {
        const container = document.getElementById('fix-cards');
        if (!container) return;
        container.innerHTML = fixes.map(f => `
      <div class="fix-card ${appliedSet.has(f.num) ? 'active' : ''}" id="fix-${f.num}" onclick="window.toggleFix(${f.num})">
        <div class="fix-card-header">
          <div class="fix-card-num">${appliedSet.has(f.num) ? '✓' : f.num}</div>
          <div style="flex:1; min-width:0;">
            <div class="fix-card-tag">${f.category}</div>
            <div class="fix-card-title">${f.title}</div>
            <div class="fix-card-meta">${f.file} &bull; Line ${f.line}</div>
          </div>
        </div>
        <div class="fix-confidence">
          <span>Confidence</span>
          <span class="fix-confidence-pct">${f.confidence}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${f.confidence}%"></div>
        </div>
      </div>
    `).join('');
    }

    function renderChecklist() {
        const container = document.getElementById('checklist-items');
        if (!container) return;
        container.innerHTML = checklist.map(c => {
            const done = appliedSet.size >= c.id;
            return `
        <div class="checklist-item ${done ? 'done' : ''}">
          <div class="checklist-num">${done ? '✓' : c.id}</div>
          <div>
            <div class="checklist-name">${c.name}</div>
            <div class="checklist-desc">${c.desc}</div>
          </div>
        </div>
      `;
        }).join('');
    }

    function updateCounts() {
        const count = appliedSet.size;
        const total = fixes.length;
        const appliedCount = document.getElementById('applied-count');
        const valCount = document.getElementById('val-fixes-count');
        const valProgress = document.getElementById('val-progress');
        if (appliedCount) appliedCount.textContent = `${count} / ${total}`;
        if (valCount) valCount.textContent = `${count} / ${total}`;
        if (valProgress) valProgress.style.width = `${(count / total) * 100}%`;
    }

    window.toggleFix = function (num) {
        if (appliedSet.has(num)) {
            appliedSet.delete(num);
        } else {
            appliedSet.add(num);
        }
        renderFixCards();
        renderChecklist();
        updateCounts();
    };

    window.applyAllFixes = function () {
        fixes.forEach(f => appliedSet.add(f.num));
        renderFixCards();
        renderChecklist();
        updateCounts();
        const btn = document.getElementById('apply-all-btn');
        const resetBtn = document.getElementById('reset-btn');
        if (btn) { btn.textContent = 'All Applied ✓'; btn.disabled = true; btn.style.opacity = '0.6'; }
        if (resetBtn) { resetBtn.style.display = 'block'; }
    };

    window.resetFixes = function () {
        appliedSet.clear();
        renderFixCards();
        renderChecklist();
        updateCounts();
        const btn = document.getElementById('apply-all-btn');
        const resetBtn = document.getElementById('reset-btn');
        if (btn) { btn.textContent = 'Apply All Fixes'; btn.disabled = false; btn.style.opacity = '1'; }
        if (resetBtn) { resetBtn.style.display = 'none'; }
    };

    window.initFixSuggestions = function () {
        appliedSet.clear();
        renderFixCards();
        renderChecklist();
        updateCounts();
    };
})();
