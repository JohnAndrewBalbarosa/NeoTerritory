class Mediator {
public:
    virtual ~Mediator() = default;
    virtual void notify(int senderId, int event) = 0;
};
class ConcreteMediator : public Mediator {
public:
    void notify(int senderId, int event) override {}
};
