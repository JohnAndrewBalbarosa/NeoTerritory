// Monolithic/Target Code View (Builder)

// EVIDENCE_REMOVED:
// - static ReportService instance()
// - static ReportService inst;
// - return inst;
// - ReportService::instance()
// - static SettingsStore instance()
// - static SettingsStore inst;
// - return inst;
// - SettingsStore::instance()

// EVIDENCE_ADDED:
// - class ReportServiceBuilder
// - ReportServiceBuilder& set_format(...)
// - ReportServiceBuilder& enable_timestamp(...)
// - ReportServiceBuilder& configure_channel(...)
// - ReportService build()
// - ReportService service = ReportServiceBuilder().set_format(...).enable_timestamp(...).configure_channel(...).build();
// - class SettingsStoreBuilder
// - SettingsStoreBuilder& set_path(...)
// - SettingsStoreBuilder& enable_cache(...)
// - SettingsStore build()
// - SettingsStore settings = SettingsStoreBuilder().set_path(...).enable_cache(...).build();

// TYPE_SKELETON:

class ReportService {
public:
    void log(...);
};

class ReportServiceBuilder {
public:
    ReportServiceBuilder& set_format(...);
    ReportServiceBuilder& enable_timestamp(...);
    ReportServiceBuilder& configure_channel(...);
    ReportService build();
};

class SettingsStore {
public:
    void log(...);
};

class SettingsStoreBuilder {
public:
    SettingsStoreBuilder& set_path(...);
    SettingsStoreBuilder& enable_cache(...);
    SettingsStore build();
};

// CALLSITE_SKELETON:

int main() {
    ReportService service = ReportServiceBuilder().set_format().enable_timestamp().configure_channel().build();
    service.log();
    SettingsStore settings = SettingsStoreBuilder().set_path().enable_cache().build();
    settings.log();
}
