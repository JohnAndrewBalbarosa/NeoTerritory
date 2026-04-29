// Smoke test: the microservice binary, when invoked the same way the backend
// invokes it, must exit 0 within the cold-start SLA.
//
// SLA source: test/alpha/system/thresholds.json -> microservice_cold_ms.
// Local target: 800 ms. We allow 2x for CI cold disks; failures on a hot
// machine indicate real regression.

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>

#ifdef _WIN32
#  include <windows.h>
#  include <psapi.h>
#  pragma comment(lib, "psapi.lib")
#else
#  include <sys/resource.h>
#  include <sys/wait.h>
#  include <unistd.h>
#endif

namespace {

constexpr int    kColdSlaMs       = 800;
constexpr int    kColdSlaMsCi     = 1600; // 2x for CI tolerance
constexpr size_t kRssLimitMb      = 80;

bool fileExists(const char* p) {
#ifdef _WIN32
    DWORD a = GetFileAttributesA(p);
    return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
#else
    return access(p, F_OK) == 0;
#endif
}

int runBinaryMeasured(const std::string& cmd, long long& wallMs, size_t& peakKb) {
    auto t0 = std::chrono::steady_clock::now();
#ifdef _WIN32
    STARTUPINFOA si{}; si.cb = sizeof(si);
    PROCESS_INFORMATION pi{};
    std::string mut = cmd;
    if (!CreateProcessA(nullptr, mut.data(), nullptr, nullptr, FALSE,
                        0, nullptr, nullptr, &si, &pi)) {
        std::cerr << "CreateProcess failed: " << GetLastError() << "\n";
        return -1;
    }
    WaitForSingleObject(pi.hProcess, INFINITE);
    DWORD exitCode = 0;
    GetExitCodeProcess(pi.hProcess, &exitCode);
    PROCESS_MEMORY_COUNTERS pmc{};
    GetProcessMemoryInfo(pi.hProcess, &pmc, sizeof(pmc));
    peakKb = static_cast<size_t>(pmc.PeakWorkingSetSize / 1024);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
#else
    int rc = std::system(cmd.c_str());
    int exitCode = WIFEXITED(rc) ? WEXITSTATUS(rc) : -1;
    struct rusage ru{};
    getrusage(RUSAGE_CHILDREN, &ru);
    peakKb = static_cast<size_t>(ru.ru_maxrss); // KB on Linux, bytes on macOS
#endif
    auto t1 = std::chrono::steady_clock::now();
    wallMs = std::chrono::duration_cast<std::chrono::milliseconds>(t1 - t0).count();
    return exitCode;
}

} // namespace

int main() {
    const char* bin = NT_BIN_PATH;
    if (!bin || std::strlen(bin) == 0 || !fileExists(bin)) {
        std::cerr << "[skip] microservice binary not built at: "
                  << (bin ? bin : "(unset)") << "\n"
                  << "Build it first: cmake --build <build_dir>\n";
        // Skip rather than fail so a fresh checkout does not break CI before
        // the build step. CI must build the microservice as a prereq.
        return 0;
    }

    std::string cmd = std::string("\"") + bin + "\"";
    long long wallMs = 0;
    size_t peakKb = 0;
    int rc = runBinaryMeasured(cmd, wallMs, peakKb);

    std::cout << "[smoke] exit=" << rc
              << " wall_ms=" << wallMs
              << " peak_kb=" << peakKb << "\n";

    bool ok = true;
    if (rc != 0) {
        std::cerr << "FAIL: non-zero exit " << rc << "\n";
        ok = false;
    }

    const bool isCi = std::getenv("CI") != nullptr;
    const long long budget = isCi ? kColdSlaMsCi : kColdSlaMs;
    if (wallMs > budget) {
        std::cerr << "FAIL: cold-start " << wallMs
                  << " ms exceeded budget " << budget << " ms\n";
        ok = false;
    }

    const size_t peakMb = peakKb / 1024;
    if (peakMb > kRssLimitMb && !isCi) {
        std::cerr << "FAIL: peak RSS " << peakMb
                  << " MB exceeded " << kRssLimitMb << " MB\n";
        ok = false;
    }

    return ok ? 0 : 1;
}
