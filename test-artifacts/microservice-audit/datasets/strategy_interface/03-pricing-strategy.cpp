class PricingStrategy {
public:
    virtual ~PricingStrategy() = default;
    virtual double computePrice(double base, int qty) = 0;
};
