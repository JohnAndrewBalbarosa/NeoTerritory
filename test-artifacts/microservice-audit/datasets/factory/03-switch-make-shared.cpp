#include <memory>

class Encoder { public: virtual ~Encoder() = default; };
class JsonEncoder : public Encoder {};
class XmlEncoder : public Encoder {};

class EncoderFactory {
public:
    std::shared_ptr<Encoder> make(int kind) {
        switch (kind) {
            case 1: return std::make_shared<JsonEncoder>();
            case 2: return std::make_shared<XmlEncoder>();
            default: return nullptr;
        }
    }
};
