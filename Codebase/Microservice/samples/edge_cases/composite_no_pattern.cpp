// Edge case — a tree-shaped container that is NOT a Composite. Leaves
// (Leaf) and the container (Branch) do not share a common interface
// so callers cannot treat them uniformly. The analyser should not
// tag this as Composite.
// Expected analyser tag: NONE (TRUE NEGATIVE — the tester should
// record kind='none' on the Branch line and confirm).

#include <string>
#include <vector>

class Leaf {
public:
    explicit Leaf(const std::string& v) : m_v(v) {}
    std::string render() const { return m_v; }
private:
    std::string m_v;
};

class Branch {
public:
    void addLeaf(const Leaf& l) { m_children.push_back(l); }
    // NOTE: no shared interface with Leaf — callers cannot uniformly
    // treat a Branch as a Leaf. This is part-whole composition without
    // the Composite pattern's uniform-interface guarantee.
    std::vector<std::string> collect() const {
        std::vector<std::string> out;
        for (const auto& c : m_children) out.push_back(c.render());
        return out;
    }
private:
    std::vector<Leaf> m_children;
};
