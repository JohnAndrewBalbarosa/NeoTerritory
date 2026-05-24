#include <vector>
#include <iostream>

// Composite (GoF, structural). A part-whole hierarchy where leaves and
// composites share one Component interface, so client code treats a single
// shape and a group of shapes uniformly.

// Component — the shared interface.
class Graphic {
public:
    virtual ~Graphic() = default;
    virtual void draw() = 0;
};

// Leaf — a single, indivisible element.
class Circle : public Graphic {
public:
    void draw() override { std::cout << "Circle\n"; }
};

// Composite — holds children and forwards the operation to each of them.
class CompositeGraphic : public Graphic {
public:
    void add(Graphic* g) { children_.push_back(g); }
    void remove(Graphic* g) {
        for (auto it = children_.begin(); it != children_.end(); ++it) {
            if (*it == g) { children_.erase(it); break; }
        }
    }
    void draw() override {
        for (auto* c : children_) c->draw();
    }
private:
    std::vector<Graphic*> children_;
};

int main() {
    Circle c1, c2;
    CompositeGraphic group;
    group.add(&c1);
    group.add(&c2);

    CompositeGraphic scene;
    Circle c3;
    scene.add(&group);  // a composite can contain other composites
    scene.add(&c3);

    scene.draw();       // draws c1, c2 (via group), then c3 — uniformly
    return 0;
}
