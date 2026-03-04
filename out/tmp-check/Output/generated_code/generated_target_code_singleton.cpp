// Generated target code
// source_pattern: strategy
// target_pattern: singleton

// === FILE: C:\Users\Joy\OneDrive\Documents\Frontend NeoTerritory\NeoTerritory\out\tmp-check\Input\pure_virtual_only.cpp ===
class StrategyBase {
public:
    static StrategyBase& instance() {
        static StrategyBase singleton_instance;
        return singleton_instance;
    }

    virtual void execute() = 0;
};

