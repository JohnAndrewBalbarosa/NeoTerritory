#include <string>

class RoutingStrategy {
public:
    virtual ~RoutingStrategy() = default;
    virtual std::string pickRoute(const std::string& src, const std::string& dst) = 0;
};
