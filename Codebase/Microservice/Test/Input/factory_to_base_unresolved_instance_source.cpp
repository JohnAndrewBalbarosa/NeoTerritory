struct UnresolvedBase
{
    virtual ~UnresolvedBase() = default;
};

struct UnresolvedFactory
{
    static UnresolvedBase* create(int kind)
    {
        return nullptr;
    }
};
