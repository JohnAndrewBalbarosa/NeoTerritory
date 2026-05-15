#include <string>

class CompressionStrategy {
public:
    virtual ~CompressionStrategy() = default;
    virtual std::string compress(const std::string& data) = 0;
    virtual std::string decompress(const std::string& data) = 0;
};
