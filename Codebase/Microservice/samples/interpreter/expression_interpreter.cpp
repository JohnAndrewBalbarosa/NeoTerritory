struct Context { int vars[26]; };
class Expression {
public:
    virtual ~Expression() = default;
    virtual int interpret(Context& ctx) = 0;
};
class NumberExpr : public Expression {
public:
    explicit NumberExpr(int v) : value_(v) {}
    int interpret(Context& ctx) override { return value_; }
private:
    int value_;
};
