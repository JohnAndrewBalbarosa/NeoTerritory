// Decorator sample: the canonical coffee-shop example. A base Beverage
// is wrapped by chained decorators that each add a feature (cost +
// description) without modifying the base class. Catalog identifies
// this as structural.decorator because the wrapper class implements the
// same interface as the wrapped object and forwards through it.

#include <string>

class Beverage {
public:
    virtual ~Beverage() = default;
    virtual double cost() const = 0;
    virtual std::string description() const = 0;
};

class Espresso : public Beverage {
public:
    double cost() const override { return 1.99; }
    std::string description() const override { return "Espresso"; }
};

// Decorator base class: holds a Beverage, exposes the same interface,
// and forwards the default behaviour to the wrapped object.
class BeverageDecorator : public Beverage {
public:
    explicit BeverageDecorator(Beverage* inner) : m_inner(inner) {}
    double cost() const override { return m_inner->cost(); }
    std::string description() const override { return m_inner->description(); }
protected:
    Beverage* m_inner;
};

class WithMilk : public BeverageDecorator {
public:
    explicit WithMilk(Beverage* inner) : BeverageDecorator(inner) {}
    double cost() const override { return m_inner->cost() + 0.50; }
    std::string description() const override { return m_inner->description() + ", milk"; }
};

class WithSugar : public BeverageDecorator {
public:
    explicit WithSugar(Beverage* inner) : BeverageDecorator(inner) {}
    double cost() const override { return m_inner->cost() + 0.20; }
    std::string description() const override { return m_inner->description() + ", sugar"; }
};
