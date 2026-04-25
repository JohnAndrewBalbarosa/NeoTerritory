struct VehicleBase
{
    virtual ~VehicleBase() = default;
};

struct Car : VehicleBase
{
};

struct Truck : VehicleBase
{
};

struct VehicleFactory
{
    static VehicleBase* create(int kind)
    {
        if (kind == 0)
        {
            return new Car();
        }
        if (kind == 1)
        {
            return new Truck();
        }
        return nullptr;
    }
};
