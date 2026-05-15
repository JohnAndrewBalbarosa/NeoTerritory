#include <memory>
#include <vector>
#include <string>

class Pizza {};

class PizzaBuilder {
    std::vector<std::string> toppings_;
    std::string size_;
public:
    PizzaBuilder& addTopping(const std::string& t) { toppings_.push_back(t); return *this; }
    PizzaBuilder& setSize(const std::string& s) { size_ = s; return *this; }
    std::unique_ptr<Pizza> assemble() {
        return std::make_unique<Pizza>();
    }
};
