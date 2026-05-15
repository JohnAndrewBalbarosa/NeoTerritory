// Adaptive expansion: confirm shape #2 hypothesis — that the catalog
// only matches PIMPL when the impl forward decl is INSIDE the outer
// class. This sample uses the nested style (less common in the wild
// than external forward decl) to test the theory.
#include <memory>

class Widget {
    class Impl;
    std::unique_ptr<Impl> impl_;
public:
    Widget();
    ~Widget();
    void render();
};
