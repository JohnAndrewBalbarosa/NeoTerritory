#include <memory>
#include <unordered_map>
class Glyph {};
class GlyphFactory {
public:
    std::shared_ptr<Glyph> getGlyph(char key) {
        auto& slot = pool_[key];
        if (!slot) slot = std::make_shared<Glyph>();
        return slot;
    }
private:
    std::unordered_map<char, std::shared_ptr<Glyph>> pool_;
};
