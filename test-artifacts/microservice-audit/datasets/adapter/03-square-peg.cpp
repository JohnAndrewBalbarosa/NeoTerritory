class RoundPeg {
public:
    double radius() const { return 1.0; }
};

class SquarePeg {
public:
    double width() const { return 2.0; }
};

class SquarePegAdapter {
    SquarePeg inner;
public:
    double radius() const {
        return inner.width() / 2.0;
    }
};
