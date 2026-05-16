// Edge case — looks like a Singleton but is not. The class has the
// private ctor + static instance() shape the structural matcher locks
// onto, but a `friend class TestHarness;` line breaks the single-
// instance invariant: a friend can construct extra instances at will.
// Expected analyser tag: creational.singleton (FALSE POSITIVE — the
// informed tester should record kind='none' on the instance() line).

#include <string>

class FakeSingletonFriend {
public:
    static FakeSingletonFriend& instance() {
        static FakeSingletonFriend s;
        return s;
    }
    std::string read(const std::string& key) const { return key + "_val"; }

    friend class TestHarness;

private:
    FakeSingletonFriend() = default;
};

class TestHarness {
public:
    // This friend break means a caller can spin up a second
    // FakeSingletonFriend at will, so the "single instance" invariant
    // is not enforced. Tester should mark the analyser's Singleton tag
    // as kind='none' (false positive).
    FakeSingletonFriend make_another() { return FakeSingletonFriend{}; }
};
