// ============================================================
// CodiNeo — Diff Viewer Logic
// Renders side-by-side C++ code diff into DOM
// ============================================================

(function () {
    const originalLines = [
        { text: 'class Engine {', type: '' },
        { text: '  private:', type: '' },
        { text: '    Database* db;', type: 'del' },
        { text: '    Config* config;', type: 'del' },
        { text: '    Logger* logger;', type: 'del' },
        { text: '', type: '' },
        { text: '  public:', type: '' },
        { text: '    Engine() {', type: 'del' },
        { text: '      db = new Database();', type: 'del' },
        { text: '      config = new Config();', type: 'del' },
        { text: '      logger = new Logger();', type: 'del' },
        { text: '    }', type: '' },
        { text: '', type: '' },
        { text: '    void process() {', type: '' },
        { text: '      db->query();', type: '' },
        { text: '    }', type: '' },
        { text: '', type: '' },
        { text: '    ~Engine() {', type: 'del' },
        { text: '      delete db;', type: 'del' },
        { text: '      delete config;', type: 'del' },
        { text: '      delete logger;', type: 'del' },
        { text: '    }', type: 'del' },
        { text: '};', type: '' },
    ];

    const transformedLines = [
        { text: 'class Engine {', type: '' },
        { text: '  private:', type: '' },
        { text: '    std::unique_ptr<Database> db;', type: 'add' },
        { text: '    std::shared_ptr<Config> config;', type: 'add' },
        { text: '    std::shared_ptr<Logger> logger;', type: 'add' },
        { text: '', type: '' },
        { text: '  public:', type: '' },
        { text: '    Engine(', type: 'add' },
        { text: '      std::unique_ptr<Database> db_ptr,', type: 'add' },
        { text: '      std::shared_ptr<Config> cfg,', type: 'add' },
        { text: '      std::shared_ptr<Logger> log', type: 'add' },
        { text: '    ) : db(std::move(db_ptr)),', type: 'add' },
        { text: '        config(cfg),', type: 'add' },
        { text: '        logger(log) {}', type: 'add' },
        { text: '', type: '' },
        { text: '    void process() {', type: '' },
        { text: '      db->query();', type: '' },
        { text: '    }', type: '' },
        { text: '};', type: '' },
    ];

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderCode(containerId, lines) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = lines.map((line, i) => {
            const cls = line.type === 'del' ? ' diff-line-del' : line.type === 'add' ? ' diff-line-add' : '';
            return `<span class="diff-line${cls}"><span class="diff-line-num">${i + 1}</span>${escapeHtml(line.text || ' ')}</span>`;
        }).join('\n');
    }

    window.switchTab = function (tab) {
        const textView = document.getElementById('text-diff-view');
        const astView = document.getElementById('ast-view');
        const tabText = document.getElementById('tab-text');
        const tabAst = document.getElementById('tab-ast');
        if (!textView) return;
        if (tab === 'text') {
            textView.style.display = 'block';
            astView.classList.remove('visible');
            tabText.classList.add('active');
            tabAst.classList.remove('active');
        } else {
            textView.style.display = 'none';
            astView.classList.add('visible');
            tabText.classList.remove('active');
            tabAst.classList.add('active');
        }
    };

    window.setDiffIcon = function (type) {
        const codeBtn = document.getElementById('icon-code');
        const graphBtn = document.getElementById('icon-graph');
        if (!codeBtn) return;
        codeBtn.classList.toggle('active', type === 'code');
        graphBtn.classList.toggle('active', type === 'graph');
    };

    window.initDiffViewer = function () {
        renderCode('original-code', originalLines);
        renderCode('transformed-code', transformedLines);
    };
})();
