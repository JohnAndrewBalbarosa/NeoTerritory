#include <string>

class LegacyXml {
public:
    std::string payload() const { return "<x/>"; }
};

class JsonResponse {
    LegacyXml inner;
public:
    std::string body() const {
        return "{}";
    }
    std::string raw() const {
        return inner.payload();
    }
};
