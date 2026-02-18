// Additional non-pattern context classes.
// These should not be treated as creational pattern targets.

#include <string>

class Driver {
public:
    std::string license_id;
};

class FleetVehicle {
public:
    std::string plate_number;
};

class Trip {
public:
    Driver driver;
    FleetVehicle vehicle;
};
