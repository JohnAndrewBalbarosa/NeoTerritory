#include <memory>
#include <string>

class RealImage {
public:
    explicit RealImage(const std::string&) {}
    void render() {}
};

class ImageProxy {
    std::unique_ptr<RealImage> real_;
    std::string filename_;
public:
    explicit ImageProxy(const std::string& f) : filename_(f) {}
    void render() {
        if (!real_) real_ = std::make_unique<RealImage>(filename_);
        real_->render();
    }
};
