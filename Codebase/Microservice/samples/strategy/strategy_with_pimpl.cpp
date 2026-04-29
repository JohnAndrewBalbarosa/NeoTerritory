// SAMPLE: Strategy + Pimpl combined (the user's actual case).
// Expect detection:
//   behavioural.strategy_interface on `ValidationStrategy`,
//   behavioural.strategy_concrete  on `RegexValidator`,
//   idiom.pimpl                    on `PatternChecker`,
//   plus structural.adapter / decorator / proxy as wrap-shape noise on RegexValidator and PatternChecker.
//
// Verdict expected: ambiguous. Top tier = strategy_interface, strategy_concrete, pimpl
// (all three legitimately match this file).
#include <iostream>
#include <memory>
#include <string>

class ValidationStrategy {
public:
    virtual ~ValidationStrategy() = default;
    virtual bool check(const std::string& code) = 0;
};

class RegexValidator : public ValidationStrategy {
public:
    bool check(const std::string& code) override {
        return code.find("pattern") != std::string::npos;
    }
};

class PatternChecker {
public:
    PatternChecker();
    ~PatternChecker();
    void setValidator(std::unique_ptr<ValidationStrategy> v);
    bool runCheck(const std::string& input);
private:
    struct Impl;
    std::unique_ptr<Impl> pImpl;
};

struct PatternChecker::Impl {
    std::unique_ptr<ValidationStrategy> strategy;
    bool performLogic(const std::string& input) {
        if (!strategy) return false;
        return strategy->check(input);
    }
};

PatternChecker::PatternChecker() : pImpl(std::make_unique<Impl>()) {}
PatternChecker::~PatternChecker() = default;

void PatternChecker::setValidator(std::unique_ptr<ValidationStrategy> v) {
    pImpl->strategy = std::move(v);
}

bool PatternChecker::runCheck(const std::string& input) {
    return pImpl->performLogic(input);
}

int main() {
    PatternChecker checker;
    checker.setValidator(std::make_unique<RegexValidator>());
    std::cout << (checker.runCheck("class MyDesignPattern {};") ? "match" : "no match") << "\n";
    return 0;
}
