// Adapter sample: legacy payment-gateway interface adapted to a unified
// modern interface. Catalog identifies this as structural.adapter
// because the wrapper class implements the new interface and forwards
// calls to a different-shaped internal API.

#include <string>

// "Modern" target interface every payment processor in the new system
// must implement.
class IPaymentProcessor {
public:
    virtual ~IPaymentProcessor() = default;
    virtual bool charge(const std::string& account, double amount) = 0;
};

// Third-party legacy SDK we cannot modify. Different method names,
// different argument shapes — incompatible with IPaymentProcessor.
class LegacyPaymentSdk {
public:
    int processTransaction(const std::string& payerId, long amountInCents) {
        return amountInCents > 0 ? 0 : -1;
    }
};

// Adapter: implements the new interface, delegates to the legacy SDK,
// translates between the two argument shapes.
class LegacyPaymentAdapter : public IPaymentProcessor {
public:
    explicit LegacyPaymentAdapter(LegacyPaymentSdk* sdk) : m_sdk(sdk) {}

    bool charge(const std::string& account, double amount) override {
        const long cents = static_cast<long>(amount * 100.0);
        return m_sdk->processTransaction(account, cents) == 0;
    }

private:
    LegacyPaymentSdk* m_sdk;
};
