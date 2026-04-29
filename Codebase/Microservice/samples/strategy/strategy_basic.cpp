// SAMPLE: Strategy pattern — minimal positive case.
// Expect detection: behavioural.strategy_interface on `Compressor`,
//                   behavioural.strategy_concrete  on `ZipCompressor` and `GzipCompressor`.
#include <iostream>
#include <memory>
#include <string>

class Compressor {
public:
    virtual ~Compressor() = default;
    virtual std::string compress(const std::string& data) = 0;
};

class ZipCompressor : public Compressor {
public:
    std::string compress(const std::string& data) override {
        return "ZIP(" + data + ")";
    }
};

class GzipCompressor : public Compressor {
public:
    std::string compress(const std::string& data) override {
        return "GZIP(" + data + ")";
    }
};

class Archiver {
public:
    void setCompressor(std::unique_ptr<Compressor> c) { compressor = std::move(c); }
    std::string archive(const std::string& payload) {
        if (!compressor) return payload;
        return compressor->compress(payload);
    }
private:
    std::unique_ptr<Compressor> compressor;
};

int main() {
    Archiver a;
    a.setCompressor(std::make_unique<ZipCompressor>());
    std::cout << a.archive("hello") << "\n";
    a.setCompressor(std::make_unique<GzipCompressor>());
    std::cout << a.archive("hello") << "\n";
    return 0;
}
