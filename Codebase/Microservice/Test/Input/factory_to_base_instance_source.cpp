struct ShapeBase
{
    virtual ~ShapeBase() = default;
};

struct Circle : ShapeBase
{
};

struct ShapeFactory
{
    static ShapeBase* create()
    {
        return new Circle();
    }
};
