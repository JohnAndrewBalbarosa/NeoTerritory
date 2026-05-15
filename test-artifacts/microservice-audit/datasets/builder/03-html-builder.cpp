#include <memory>
#include <string>
#include <vector>

class HtmlElement {};

class HtmlBuilder {
    std::string tag_;
    std::vector<std::string> children_;
public:
    HtmlBuilder& addChild(const std::string& c) { children_.push_back(c); return *this; }
    HtmlBuilder& configure(const std::string& key, const std::string& value) { tag_ = key + "=" + value; return *this; }
    std::unique_ptr<HtmlElement> build() {
        return std::make_unique<HtmlElement>();
    }
};
