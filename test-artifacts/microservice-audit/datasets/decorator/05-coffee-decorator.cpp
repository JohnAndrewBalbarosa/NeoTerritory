#include <memory>

class Beverage {
public:
    virtual ~Beverage() = default;
    virtual int cost() const = 0;
};

class MilkDecorator : public Beverage {
    std::unique_ptr<Beverage> wrapped_;
public:
    explicit MilkDecorator(std::unique_ptr<Beverage> w) : wrapped_(std::move(w)) {}
    int cost() const override {
        return wrapped_->cost() + 50;
    }
};
