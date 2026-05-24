class Circle;
class Square;
class Visitor {
public:
    virtual ~Visitor() = default;
    virtual void visit(Circle& c) = 0;
    virtual void visit(Square& s) = 0;
};
class Circle {
public:
    void accept(Visitor& v) { v.visit(*this); }
};
