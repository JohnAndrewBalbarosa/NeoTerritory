#include <iostream>
#include <string>

class SettingsStore {
public:
    static SettingsStore& instance()
    {
        static SettingsStore inst;
        return inst;
    }

    void set_path(const std::string& value) { path_ = value; }
    void enable_cache(bool value) { cache_enabled_ = value; }
    void log() const { std::cout << "path=" << path_ << " cache=" << cache_enabled_ << "\n"; }

private:
    std::string path_;
    bool cache_enabled_ = false;
};

int main()
{
    SettingsStore settings = SettingsStore::instance();
    settings.set_path("/tmp/config.json");
    settings.enable_cache(true);
    settings.log();
    return 0;
}
