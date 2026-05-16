// Per-run C++ synthesizer for the soak simulator. Given a deterministic
// seed string, returns a `{ files: [{ name, code }] }` payload that is
// valid (compiles), contains a randomized mix of design-pattern shapes,
// and varies in size + file count across the cohort. This replaces the
// fixed sample fixtures so every intern submits genuinely different
// code — important for both the realism of the F1 metric and for
// supervisor spot-checks.

function mulberry32(seedStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let s = h;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function pickN(rng, arr, n) {
  const c = [...arr];
  const out = [];
  for (let i = 0; i < n && c.length > 0; i++) {
    out.push(c.splice(Math.floor(rng() * c.length), 1)[0]);
  }
  return out;
}

const DOMAINS = [
  { ns: 'inventory', nouns: ['Stock','Item','Warehouse','Shipment','Catalog','Bin','Pallet'] },
  { ns: 'auth',      nouns: ['Session','Token','Credential','Permission','Account','Identity'] },
  { ns: 'render',    nouns: ['Frame','Canvas','Layer','Sprite','Mesh','Buffer','Pipeline'] },
  { ns: 'finance',   nouns: ['Ledger','Account','Trade','Quote','Portfolio','Statement','Voucher'] },
  { ns: 'telemetry', nouns: ['Counter','Gauge','Metric','Probe','Sample','Histogram','Span'] },
  { ns: 'comms',     nouns: ['Channel','Message','Envelope','Packet','Mailbox','Queue','Topic'] },
  { ns: 'iot',       nouns: ['Sensor','Reading','Device','Controller','Actuator','Beacon','Gateway'] },
];

const FIELD_TYPES = ['int','double','std::string','std::size_t','bool'];

function camelize(n) { return n.charAt(0).toLowerCase() + n.slice(1); }

// Each generator returns one or more class definitions as a string +
// emits the standard library includes it needs.
function genSingleton(rng, name) {
  return {
    needs: ['<string>'],
    code: `class ${name} {
public:
    static ${name}& instance() {
        static ${name} s;
        return s;
    }
    void set_label(const std::string& v) { label_ = v; }
    const std::string& label() const { return label_; }
private:
    ${name}() : label_("default") {}
    ~${name}() = default;
    ${name}(const ${name}&) = delete;
    ${name}& operator=(const ${name}&) = delete;
    std::string label_;
};`,
  };
}

function genBuilder(rng, name) {
  const product = name.replace('Builder', '') + 'Record';
  return {
    needs: ['<string>'],
    code: `struct ${product} {
    std::string name;
    int quantity{0};
    double unit_price{0.0};
};
class ${name} {
public:
    ${name}& with_name(const std::string& v) { product_.name = v; return *this; }
    ${name}& with_quantity(int v) { product_.quantity = v; return *this; }
    ${name}& with_unit_price(double v) { product_.unit_price = v; return *this; }
    ${product} build() const { return product_; }
private:
    ${product} product_{};
};`,
  };
}

function genFactory(rng, name) {
  const product = name.replace('Factory','');
  return {
    needs: ['<memory>','<string>'],
    code: `class ${product} {
public:
    explicit ${product}(std::string id) : id_(std::move(id)) {}
    const std::string& id() const { return id_; }
private:
    std::string id_;
};
class ${name} {
public:
    static std::unique_ptr<${product}> create(const std::string& id) {
        return std::make_unique<${product}>(id);
    }
};`,
  };
}

function genAdapter(rng, name) {
  const adaptee = name.replace('Adapter','') + 'Legacy';
  return {
    needs: ['<string>'],
    code: `class ${adaptee} {
public:
    std::string legacy_fetch(int code) const { return std::string("legacy:") + std::to_string(code); }
};
class ${name} {
public:
    explicit ${name}(${adaptee}* impl) : impl_(impl) {}
    std::string fetch(const std::string& key) const {
        int code = static_cast<int>(key.size());
        return impl_->legacy_fetch(code);
    }
private:
    ${adaptee}* impl_;
};`,
  };
}

function genDecorator(rng, name) {
  const base = name.replace('Decorator','') + 'Component';
  return {
    needs: ['<memory>','<string>'],
    code: `class ${base} {
public:
    virtual ~${base}() = default;
    virtual std::string describe() const = 0;
};
class Concrete${base} : public ${base} {
public:
    std::string describe() const override { return "base"; }
};
class ${name} : public ${base} {
public:
    explicit ${name}(std::unique_ptr<${base}> inner) : inner_(std::move(inner)) {}
    std::string describe() const override { return inner_->describe() + "+deco"; }
private:
    std::unique_ptr<${base}> inner_;
};`,
  };
}

function genProxy(rng, name) {
  const subject = name.replace('Proxy','') + 'Service';
  return {
    needs: ['<memory>','<string>'],
    code: `class ${subject} {
public:
    virtual ~${subject}() = default;
    virtual std::string request(const std::string& q) = 0;
};
class Real${subject} : public ${subject} {
public:
    std::string request(const std::string& q) override { return "ok:" + q; }
};
class ${name} : public ${subject} {
public:
    explicit ${name}(std::unique_ptr<${subject}> subject) : subject_(std::move(subject)) {}
    std::string request(const std::string& q) override {
        if (cache_ == q) return cached_;
        cached_ = subject_->request(q);
        cache_ = q;
        return cached_;
    }
private:
    std::unique_ptr<${subject}> subject_;
    std::string cache_;
    std::string cached_;
};`,
  };
}

function genMethodChaining(rng, name) {
  return {
    needs: ['<string>'],
    code: `class ${name} {
public:
    ${name}& set_id(int v) { id_ = v; return *this; }
    ${name}& set_label(const std::string& v) { label_ = v; return *this; }
    ${name}& set_active(bool v) { active_ = v; return *this; }
    int id() const { return id_; }
    const std::string& label() const { return label_; }
    bool active() const { return active_; }
private:
    int id_{0};
    std::string label_;
    bool active_{false};
};`,
  };
}

function genStrategy(rng, name) {
  const base = name.replace('Strategy','') + 'Policy';
  return {
    needs: ['<memory>','<string>'],
    code: `class ${base} {
public:
    virtual ~${base}() = default;
    virtual int score(int x) const = 0;
};
class Linear${base} : public ${base} {
public:
    int score(int x) const override { return x * 2; }
};
class Quadratic${base} : public ${base} {
public:
    int score(int x) const override { return x * x; }
};
class ${name} {
public:
    explicit ${name}(std::unique_ptr<${base}> p) : policy_(std::move(p)) {}
    int evaluate(int x) const { return policy_->score(x); }
private:
    std::unique_ptr<${base}> policy_;
};`,
  };
}

function genPimpl(rng, name) {
  return {
    needs: ['<memory>','<string>'],
    code: `class ${name} {
public:
    ${name}();
    ~${name}();
    std::string greet(const std::string& who) const;
private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};
struct ${name}::Impl {
    std::string prefix{"hello, "};
    std::string make(const std::string& who) const { return prefix + who; }
};
inline ${name}::${name}() : impl_(std::make_unique<Impl>()) {}
inline ${name}::~${name}() = default;
inline std::string ${name}::greet(const std::string& who) const { return impl_->make(who); }`,
  };
}

// Plain DTO — generates no canonical pattern, used to season files
// with negative-control classes so the analyzer's TN/FP behaviour gets
// exercised. ~30% of generated classes come from this pool.
function genPlainDto(rng, name) {
  const fields = pickN(rng, ['title','code','total','quantity','tag','owner'], 3 + Math.floor(rng() * 3));
  const decls = fields.map((f) => `    ${pick(rng, FIELD_TYPES)} ${f}{};`).join('\n');
  return {
    needs: ['<string>'],
    code: `struct ${name} {
${decls}
};`,
  };
}

const PATTERN_GENS = {
  singleton:        genSingleton,
  builder:          genBuilder,
  factory:          genFactory,
  adapter:          genAdapter,
  decorator:        genDecorator,
  proxy:            genProxy,
  method_chaining:  genMethodChaining,
  strategy:         genStrategy,
  pimpl:            genPimpl,
};
const PATTERN_KEYS = Object.keys(PATTERN_GENS);

export function synthesizeCppFiles(seedStr) {
  const rng = mulberry32(seedStr);
  // 1-3 files, each with 1-4 classes
  const fileCount = 1 + Math.floor(rng() * 3);
  const files = [];
  const domain = pick(rng, DOMAINS);

  for (let fIdx = 0; fIdx < fileCount; fIdx++) {
    const classCount = 1 + Math.floor(rng() * 4);
    const includes = new Set(['<string>']);
    const blocks = [];
    const usedNames = new Set();
    for (let cIdx = 0; cIdx < classCount; cIdx++) {
      const noun = pick(rng, domain.nouns);
      // 30% plain DTO, 70% pattern
      const isPattern = rng() > 0.30;
      const patternKey = isPattern ? pick(rng, PATTERN_KEYS) : null;
      const suffix = isPattern
        ? ({ singleton:'Registry', builder:'Builder', factory:'Factory', adapter:'Adapter',
             decorator:'Decorator', proxy:'Proxy', method_chaining:'Builder',
             strategy:'Strategy', pimpl:'Service' }[patternKey] || '')
        : 'Dto';
      let baseName = `${noun}${suffix}`;
      let n = 1;
      while (usedNames.has(baseName)) { n++; baseName = `${noun}${suffix}${n}`; }
      usedNames.add(baseName);
      const gen = isPattern ? PATTERN_GENS[patternKey] : genPlainDto;
      const piece = gen(rng, baseName);
      for (const inc of piece.needs) includes.add(inc);
      blocks.push(piece.code);
    }
    const header = [...includes].sort().map((i) => `#include ${i}`).join('\n');
    const code = `// Synthesized for ${seedStr} (file ${fIdx + 1}/${fileCount})\n${header}\n\nnamespace ${domain.ns} {\n\n${blocks.join('\n\n')}\n\n} // namespace ${domain.ns}\n`;
    const name = `${domain.ns}_${fIdx + 1}.cpp`;
    files.push({ name, code });
  }
  return { files };
}
