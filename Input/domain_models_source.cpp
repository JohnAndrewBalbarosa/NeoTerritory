#include <string>

class Driver {
public:
    void set_name(const std::string& value) { name_ = value; }
    std::string name() const { return name_; }

private:
    std::string name_;
};

class FleetVehicle {
public:
    void set_plate(const std::string& value) { plate_ = value; }
    std::string plate() const { return plate_; }

private:
    std::string plate_;
};

class Trip {
public:
    void assign(const Driver& driver, const FleetVehicle& vehicle)
    {
        driver_name_ = driver.name();
        plate_ = vehicle.plate();
    }

private:
    std::string driver_name_;
    std::string plate_;
};
