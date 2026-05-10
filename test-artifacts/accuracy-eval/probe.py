#!/usr/bin/env python3
"""Ephemeral pattern-detection accuracy probe for NeoTerritory.

Sends a hand-labelled battery of C++ snippets to /api/analyze and reports
TP / TN / FP / FN counts.
"""
import json
import os
import sys
import urllib.request

BASE = os.environ.get("BASE", "http://localhost:3001")
TOKEN = os.environ["TOKEN"]

CASES = []

def case(name, expected, code):
    CASES.append((name, expected, code))

# ---- True Positives ----
case("tp_singleton", {"singleton"}, """
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
""")

case("tp_builder", {"builder"}, """
#include <string>
class HttpRequest { public: std::string url; std::string method; int timeout = 0; };
class HttpRequestBuilder {
    HttpRequest r;
public:
    HttpRequestBuilder& setUrl(const std::string& u){ r.url=u; return *this; }
    HttpRequestBuilder& setMethod(const std::string& m){ r.method=m; return *this; }
    HttpRequestBuilder& setTimeout(int t){ r.timeout=t; return *this; }
    HttpRequest build(){ return r; }
};
int main(){
    HttpRequestBuilder b;
    auto req = b.setUrl("/x").setMethod("GET").setTimeout(10).build();
    (void)req;
}
""")

case("tp_factory", {"factory"}, """
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
""")

case("tp_strategy", {"strategy_interface"}, """
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
""")

case("tp_decorator", {"decorator"}, """
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
""")

case("tp_adapter", {"adapter"}, """
struct LegacyPrinter { void printRaw(const char* m){} };
struct Printer { virtual ~Printer() = default; virtual void print(const char*) = 0; };
class PrinterAdapter : public Printer {
    LegacyPrinter legacy;
public:
    void print(const char* m) override { legacy.printRaw(m); }
};
int main(){ PrinterAdapter p; p.print("hello"); }
""")

case("tp_proxy", {"proxy"}, """
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
""")

# ---- True Negatives ----
case("tn_plain_struct", set(), """
struct Point { int x; int y; };
int main(){ Point p{1,2}; (void)p; }
""")

case("tn_free_funcs", set(), """
int add(int a, int b){ return a + b; }
int mul(int a, int b){ return a * b; }
int main(){ return add(2, mul(3, 4)); }
""")

case("tn_math_utils", set(), """
class MathUtils {
public:
    static double square(double x){ return x*x; }
    static double cube(double x){ return x*x*x; }
};
int main(){ return (int)MathUtils::square(3.0); }
""")

# ---- False-Positive bait ----
case("fp_fake_singleton", set(), """
class Connection {
public:
    static Connection getInstance() { return Connection(); }
    void open(){}
};
int main(){ Connection::getInstance().open(); }
""")

case("fp_fake_factory", set(), """
struct Widget { void draw(){} };
class WidgetFactory {
public:
    static Widget create(){ return Widget(); }
};
int main(){ WidgetFactory::create().draw(); }
""")

case("fp_fake_builder", set(), """
class Config {
    int a = 0; int b = 0;
public:
    void setA(int x){ a = x; }
    void setB(int x){ b = x; }
};
int main(){ Config c; c.setA(1); c.setB(2); }
""")

# ---- False-Negative risk ----
case("fn_strategy_function", {"strategy_interface"}, """
#include <functional>
class Sorter {
    std::function<bool(int,int)> cmp;
public:
    explicit Sorter(std::function<bool(int,int)> c) : cmp(std::move(c)) {}
    bool less(int a, int b){ return cmp(a,b); }
};
int main(){ Sorter s([](int a,int b){ return a<b; }); s.less(1,2); }
""")

case("fn_builder_aggregate", {"builder"}, """
struct WindowOpts { int w=0; int h=0; bool fullscreen=false; const char* title=""; };
struct Window {
    WindowOpts opts;
    static Window from(const WindowOpts& o){ Window x; x.opts=o; return x; }
};
int main(){ auto w = Window::from({.w=800,.h=600,.fullscreen=false,.title="hi"}); (void)w; }
""")


def analyze(name, code):
    payload = json.dumps({"files": [{"name": name + ".cpp", "code": code}]}).encode()
    req = urllib.request.Request(
        BASE + "/api/analyze",
        data=payload,
        headers={
            "Authorization": "Bearer " + TOKEN,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"_error": e.code, "_body": e.read().decode("utf-8", "replace")}


def extract_patterns(resp):
    pats = resp.get("detectedPatterns") or []
    out = set()
    for p in pats:
        for k in ("patternId", "id", "name", "pattern"):
            v = p.get(k)
            if v:
                out.add(str(v).lower())
                break
    return out


tp = tn = fp = fn = 0
rows = []
for name, expected, code in CASES:
    resp = analyze(name, code)
    if "_error" in resp:
        rows.append((name, expected, f"HTTP {resp['_error']}", "ERR"))
        continue
    detected_full = extract_patterns(resp)
    # Detected IDs come back namespaced like "creational.singleton" — strip
    # the category prefix so they line up with the expected short names.
    detected = {d.split(".")[-1] for d in detected_full}
    matched = expected & detected
    extra = detected - expected
    if expected:
        if matched and not extra:
            verdict = "TP"
            tp += 1
        elif matched and extra:
            verdict = "TP+FP"
            tp += 1
            fp += 1
        elif not detected:
            verdict = "FN"
            fn += 1
        else:
            verdict = "FN+FP"
            fn += 1
            fp += 1
    else:
        if not detected:
            verdict = "TN"
            tn += 1
        else:
            verdict = "FP"
            fp += 1
    rows.append((name, expected or {"NONE"}, detected_full or {"(none)"}, verdict))

w = max(len(r[0]) for r in rows)
print(f"{'case':<{w}}  {'expected':<22} {'detected':<32} verdict")
print("-" * (w + 70))
for name, exp, det, verdict in rows:
    print(f"{name:<{w}}  {','.join(sorted(exp)):<22} {','.join(sorted(det)):<32} {verdict}")

total = len(CASES)
print()
print(f"Cases: {total}")
print(f"TP={tp}  TN={tn}  FP={fp}  FN={fn}")
correct = tp + tn
print(f"Accuracy: {correct}/{total} = {correct/total:.0%}")
denom_p = tp + fp
denom_r = tp + fn
if denom_p:
    print(f"Precision: {tp/denom_p:.0%}")
if denom_r:
    print(f"Recall: {tp/denom_r:.0%}")
