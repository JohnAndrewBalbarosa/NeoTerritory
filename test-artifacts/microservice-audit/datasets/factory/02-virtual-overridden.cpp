// Sample fix per audit: the original `WinFactory::createButton` had no
// branching, so the catalog's `branch_decision` lexeme didn't fire and
// only the abstract base was detected (as strategy_interface). Adding
// the branch makes this a true Factory Method per GoF (Gamma et al.,
// 1994, Factory Method) — a polymorphic creator that picks the concrete
// product at runtime.
#include <memory>

class Button { public: virtual ~Button() = default; };
class WinButton : public Button {};
class MacButton : public Button {};
class LinuxButton : public Button {};

class ButtonFactory {
public:
    virtual ~ButtonFactory() = default;
    virtual std::unique_ptr<Button> createButton(int kind) {
        if (kind == 1) return std::make_unique<WinButton>();
        if (kind == 2) return std::make_unique<MacButton>();
        return std::make_unique<LinuxButton>();
    }
};
