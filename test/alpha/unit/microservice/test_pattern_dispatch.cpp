// Pattern-dispatch repeatability + steady-state latency.
//
// Runs the binary N times back-to-back. Reports min / median / p95 wall-clock.
// Assertion: warm runs (after the first cold one) must average under
// kWarmSlaMs. This catches: (a) runaway memory between runs, (b) catalog
// reload regressions, (c) accidental O(n^2) in pattern dispatch when the
// catalog grows.

#include <algorithm>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>
#include <vector>

#ifdef _WIN32
#  include <windows.h>
#endif

namespace {
constexpr int    kIterations = 10;
constexpr long long kWarmAvgSlaMs = 600;
constexpr long long kWarmP95SlaMs = 900;

bool fileExists(const char* p) {
#ifdef _WIN32
    DWORD a = GetFileAttributesA(p);
    return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
#else
    FILE* f = std::fopen(p, "r");
    if (f) { std::fclose(f); return true; }
    return false;
#endif
}

long long runOnce(const std::string& cmd) {
    auto t0 = std::chrono::steady_clock::now();
    int rc = std::system(cmd.c_str());
    auto t1 = std::chrono::steady_clock::now();
    if (rc != 0) {
        std::cerr << "non-zero exit: " << rc << "\n";
        return -1;
    }
    return std::chrono::duration_cast<std::chrono::milliseconds>(t1 - t0).count();
}
} // namespace

int main() {
    const char* bin = NT_BIN_PATH;
    if (!bin || std::strlen(bin) == 0 || !fileExists(bin)) {
        std::cerr << "[skip] microservice binary not built\n";
        return 0;
    }

#ifdef _WIN32
    std::string redirect = " > NUL 2>&1";
#else
    std::string redirect = " > /dev/null 2>&1";
#endif
    std::string cmd = std::string("\"") + bin + "\"" + redirect;

    std::vector<long long> samples;
    samples.reserve(kIterations);
    for (int i = 0; i < kIterations; ++i) {
        long long ms = runOnce(cmd);
        if (ms < 0) {
            std::cerr << "FAIL: iteration " << i << " errored\n";
            return 1;
        }
        samples.push_back(ms);
    }

    // Drop the first as cold, statistics on the rest.
    std::vector<long long> warm(samples.begin() + 1, samples.end());
    std::sort(warm.begin(), warm.end());
    long long sum = 0;
    for (auto v : warm) sum += v;
    long long avg = sum / static_cast<long long>(warm.size());
    long long med = warm[warm.size() / 2];
    long long p95 = warm[(warm.size() * 95) / 100];

    std::cout << "[dispatch] cold=" << samples.front()
              << " warm_min=" << warm.front()
              << " warm_med=" << med
              << " warm_avg=" << avg
              << " warm_p95=" << p95
              << " warm_max=" << warm.back() << "\n";

    bool ci = std::getenv("CI") != nullptr;
    long long avgBudget = ci ? kWarmAvgSlaMs * 2 : kWarmAvgSlaMs;
    long long p95Budget = ci ? kWarmP95SlaMs * 2 : kWarmP95SlaMs;

    bool ok = true;
    if (avg > avgBudget) {
        std::cerr << "FAIL: warm avg " << avg << " ms > " << avgBudget << " ms\n";
        ok = false;
    }
    if (p95 > p95Budget) {
        std::cerr << "FAIL: warm p95 " << p95 << " ms > " << p95Budget << " ms\n";
        ok = false;
    }
    return ok ? 0 : 1;
}
