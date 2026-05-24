#include <vector>
class Observer {
public:
    virtual ~Observer() = default;
    virtual void update(int newValue) = 0;
};
class Subject {
public:
    void attach(Observer* o) { observers_.push_back(o); }
    void notifyAll(int v) { for (auto* o : observers_) o->update(v); }
private:
    std::vector<Observer*> observers_;
};
class ConcreteDisplay : public Observer {
public:
    void update(int newValue) override { last_ = newValue; }
private:
    int last_ = 0;
};
