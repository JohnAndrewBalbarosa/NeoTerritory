// SAMPLE — smart-pointer tagged usages.
// Expected for Engine:
//   smart_decl  unique_ptr<Engine> e1  + make_unique
//   arrow_call  e1->start
//   smart_decl  shared_ptr<Engine> e2  + make_shared
//   arrow_call  e2->stop
//   qualified_call Engine::factory
#include <memory>
#include <string>

class Engine {
public:
    Engine() = default;
    static std::unique_ptr<Engine> factory() { return std::make_unique<Engine>(); }
    void start() {}
    void stop()  {}
};

int main() {
    std::unique_ptr<Engine> e1 = std::make_unique<Engine>();
    e1->start();
    std::shared_ptr<Engine> e2 = std::make_shared<Engine>();
    e2->stop();
    auto e3 = Engine::factory(); // `auto` — heuristic will MISS this binding (known limitation)
    return 0;
}
