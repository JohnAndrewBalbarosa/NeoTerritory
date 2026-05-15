#include <memory>

class RenderEngineImpl;

class RenderEngine {
    std::unique_ptr<RenderEngineImpl> impl_;
public:
    RenderEngine();
    ~RenderEngine();
    void draw();
    void resize(int w, int h);
};
