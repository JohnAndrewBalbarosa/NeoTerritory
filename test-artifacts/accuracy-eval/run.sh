#!/usr/bin/env bash
# Ephemeral accuracy probe — categorises NeoTerritory pattern detection
# into TP / TN / FP / FN against a hand-labelled set of C++ snippets.
set -u
TOKEN="${TOKEN:-}"
BASE="${BASE:-http://localhost:3001}"
if [[ -z "$TOKEN" ]]; then
  echo "set TOKEN=..." >&2; exit 1
fi

declare -A EXPECT  # case -> expected pattern (or NONE)

call() {
  local name="$1" expected="$2" code="$3"
  EXPECT[$name]="$expected"
  local payload
  payload=$(jq -n --arg n "$name.cpp" --arg c "$code" '{files:[{name:$n,code:$c}]}')
  local resp
  resp=$(curl -s -X POST "$BASE/api/analyze" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload")
  # Extract detected pattern names (unique)
  local detected
  detected=$(echo "$resp" | jq -r '[.detectedPatterns[]?.patternId // .detectedPatterns[]?.id // .detectedPatterns[]?.name] | unique | join(",")' 2>/dev/null)
  [[ -z "$detected" ]] && detected="(none)"
  printf '%-40s expected=%-12s detected=%s\n' "$name" "$expected" "$detected"
}

# ---------- True Positives (clear textbook patterns) ----------
call "tp_singleton" "singleton" '
class Logger {
public:
    static Logger& getInstance() {
        static Logger inst;
        return inst;
    }
    void log(const char* m) {}
private:
    Logger() = default;
    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;
};
int main(){ Logger::getInstance().log("hi"); }
'

call "tp_builder" "builder" '
#include <string>
class HttpRequest {
public:
    std::string url; std::string method; int timeout = 0;
};
class HttpRequestBuilder {
    HttpRequest r;
public:
    HttpRequestBuilder& setUrl(const std::string& u){ r.url = u; return *this; }
    HttpRequestBuilder& setMethod(const std::string& m){ r.method = m; return *this; }
    HttpRequestBuilder& setTimeout(int t){ r.timeout = t; return *this; }
    HttpRequest build(){ return r; }
};
int main(){
    HttpRequestBuilder b;
    auto req = b.setUrl("/x").setMethod("GET").setTimeout(10).build();
}
'

call "tp_factory" "factory" '
#include <memory>
struct Shape { virtual ~Shape() = default; virtual void draw() = 0; };
struct Circle : Shape { void draw() override {} };
struct Square : Shape { void draw() override {} };
class ShapeFactory {
public:
    static std::unique_ptr<Shape> create(int kind) {
        if (kind == 0) return std::make_unique<Circle>();
        return std::make_unique<Square>();
    }
};
int main(){ auto s = ShapeFactory::create(0); s->draw(); }
'

call "tp_strategy" "strategy_interface" '
#include <memory>
struct Compressor { virtual ~Compressor() = default; virtual int compress(int n) = 0; };
struct Zip : Compressor { int compress(int n) override { return n/2; } };
struct Gzip : Compressor { int compress(int n) override { return n/3; } };
class Archiver {
    std::unique_ptr<Compressor> strategy;
public:
    explicit Archiver(std::unique_ptr<Compressor> s) : strategy(std::move(s)) {}
    int run(int n){ return strategy->compress(n); }
};
int main(){ Archiver a(std::make_unique<Zip>()); a.run(100); }
'

call "tp_decorator" "decorator" '
#include <memory>
struct Coffee { virtual ~Coffee() = default; virtual int cost() = 0; };
struct Espresso : Coffee { int cost() override { return 5; } };
struct MilkDecorator : Coffee {
    std::unique_ptr<Coffee> inner;
    explicit MilkDecorator(std::unique_ptr<Coffee> c) : inner(std::move(c)) {}
    int cost() override { return inner->cost() + 2; }
};
int main(){
    std::unique_ptr<Coffee> c = std::make_unique<MilkDecorator>(std::make_unique<Espresso>());
    c->cost();
}
'

call "tp_adapter" "adapter" '
struct LegacyPrinter { void printRaw(const char* m){} };
struct Printer { virtual ~Printer() = default; virtual void print(const char*) = 0; };
class PrinterAdapter : public Printer {
    LegacyPrinter legacy;
public:
    void print(const char* m) override { legacy.printRaw(m); }
};
int main(){ PrinterAdapter p; p.print("hello"); }
'

call "tp_proxy" "proxy" '
#include <memory>
struct Image { virtual ~Image() = default; virtual void render() = 0; };
struct RealImage : Image { void render() override {} };
class ImageProxy : public Image {
    std::unique_ptr<RealImage> real;
public:
    void render() override {
        if (!real) real = std::make_unique<RealImage>();
        real->render();
    }
};
int main(){ ImageProxy p; p.render(); }
'

# ---------- True Negatives (no pattern) ----------
call "tn_plain_struct" "NONE" '
struct Point { int x; int y; };
int main(){ Point p{1,2}; (void)p; }
'

call "tn_free_funcs" "NONE" '
int add(int a, int b){ return a + b; }
int mul(int a, int b){ return a * b; }
int main(){ return add(2, mul(3, 4)); }
'

call "tn_math_utils" "NONE" '
#include <cmath>
class MathUtils {
public:
    static double square(double x){ return x*x; }
    static double cube(double x){ return x*x*x; }
};
int main(){ return (int)MathUtils::square(3.0); }
'

# ---------- False-Positive bait ----------
# getInstance that is NOT a singleton (returns a fresh object each call).
call "fp_fake_singleton" "NONE" '
class Connection {
public:
    static Connection getInstance() { return Connection(); }
    void open(){}
};
int main(){ Connection::getInstance().open(); }
'

# Factory-shaped name but only ever returns one concrete type, no polymorphism.
call "fp_fake_factory" "NONE" '
struct Widget { void draw(){} };
class WidgetFactory {
public:
    static Widget create(){ return Widget(); }
};
int main(){ WidgetFactory::create().draw(); }
'

# Setter chain that returns void — looks like a builder by naming, but is not.
call "fp_fake_builder" "NONE" '
class Config {
    int a = 0; int b = 0;
public:
    void setA(int x){ a = x; }
    void setB(int x){ b = x; }
};
int main(){ Config c; c.setA(1); c.setB(2); }
'

# ---------- False-Negative risk (real patterns, unusual shape) ----------
# Strategy via std::function — no virtual interface.
call "fn_strategy_function" "strategy_interface" '
#include <functional>
class Sorter {
    std::function<bool(int,int)> cmp;
public:
    explicit Sorter(std::function<bool(int,int)> c) : cmp(std::move(c)) {}
    bool less(int a, int b){ return cmp(a,b); }
};
int main(){ Sorter s([](int a,int b){ return a<b; }); s.less(1,2); }
'

# Builder via aggregate + named-parameter struct.
call "fn_builder_aggregate" "builder" '
struct WindowOpts { int w=0; int h=0; bool fullscreen=false; const char* title=""; };
struct Window {
    WindowOpts opts;
    static Window from(const WindowOpts& o){ Window x; x.opts=o; return x; }
};
int main(){ auto w = Window::from({.w=800,.h=600,.fullscreen=false,.title="hi"}); (void)w; }
'

echo "---"
echo "Done."
