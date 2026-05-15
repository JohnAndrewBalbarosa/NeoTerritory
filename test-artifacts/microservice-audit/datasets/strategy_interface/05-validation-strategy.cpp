#include <string>

class ValidationStrategy {
public:
    virtual ~ValidationStrategy() = default;
    virtual bool validate(const std::string& input) = 0;
};
