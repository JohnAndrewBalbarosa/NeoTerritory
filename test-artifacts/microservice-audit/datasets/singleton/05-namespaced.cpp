#include <string>

namespace nt {

class Telemetry {
public:
    static Telemetry& getInstance() {
        static Telemetry t;
        return t;
    }
    Telemetry(const Telemetry&) = delete;
    Telemetry& operator=(const Telemetry&) = delete;
private:
    Telemetry() = default;
};

}
