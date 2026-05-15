// Adaptive expansion: confirm shape #1 with `{}` body instead of `= default`.
class EventBus {
private:
    EventBus() {}
    EventBus(const EventBus&) = delete;
    EventBus& operator=(const EventBus&) = delete;

public:
    static EventBus& getInstance() {
        static EventBus instance;
        return instance;
    }
    void publish() {}
};
