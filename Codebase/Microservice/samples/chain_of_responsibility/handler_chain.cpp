class Handler {
public:
    virtual ~Handler() = default;
    void setNext(Handler* n) { next_ = n; }
    virtual void handle(int request) {
        if (next_) next_->handle(request);
    }
private:
    Handler* next_ = nullptr;
};
