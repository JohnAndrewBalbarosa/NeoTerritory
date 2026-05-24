#include <string>
class Memento {
public:
    explicit Memento(std::string s) : state_(std::move(s)) {}
    std::string getState() const { return state_; }
private:
    std::string state_;
};
class Editor {
public:
    Memento save() const { return Memento(text_); }
    void restore(const Memento& m) { text_ = m.getState(); }
private:
    std::string text_;
};
