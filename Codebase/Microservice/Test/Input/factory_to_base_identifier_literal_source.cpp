struct AnimalBase
{
    virtual ~AnimalBase() = default;
};

struct Dog : AnimalBase
{
};

struct AnimalFactory
{
    static AnimalBase* create(const char* kind)
    {
        if (kind == "dog")
        {
            return new Dog();
        }
        return nullptr;
    }
};
