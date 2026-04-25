#include <string>

struct ProductBase
{
    virtual ~ProductBase() = default;
};

struct WidgetProduct : ProductBase
{
};

struct ProductFactory
{
    static ProductBase* create(const std::string& kind)
    {
        std::string normalized = kind;
        if (normalized == "widget")
        {
            return new WidgetProduct();
        }
        return nullptr;
    }
};
