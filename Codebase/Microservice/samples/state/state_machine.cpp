class State {
public:
    virtual ~State() = default;
    virtual void handle() = 0;
};
class Context {
public:
    void setState(State* s) { state_ = s; }
    void request() { state_->handle(); }
private:
    State* state_ = nullptr;
};
class IdleState : public State {
public:
    void handle() override {}
};
