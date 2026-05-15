#include <memory>
#include <string>
#include <unordered_map>

class Component {
public:
    virtual ~Component() = default;
    virtual std::string render() = 0;
};

class CachedComponent : public Component {
    std::unique_ptr<Component> decorated_;
    std::string cache_;
public:
    explicit CachedComponent(std::unique_ptr<Component> w) : decorated_(std::move(w)) {}
    std::string render() override {
        if (cache_.empty()) cache_ = decorated_->render();
        return cache_;
    }
};
