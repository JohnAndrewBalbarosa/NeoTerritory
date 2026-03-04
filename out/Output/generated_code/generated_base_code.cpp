// Monolithic/Base Code View (Singleton)

// EVIDENCE_PRESENT:
// - static ReportService instance()
// - static ReportService inst;
// - return inst;
// - ReportService service = ReportService::instance();

// TYPE_SKELETON:

class ReportService {
public:
    static ReportService instance();
    void set_format(...);
    void enable_timestamp(...);
    void configure_channel(...);
    void log(...);
};

// CALLSITE_SKELETON:

int main() {
    ReportService service = ReportService::instance();
    service.set_format();
    service.enable_timestamp();
    service.configure_channel();
    service.log();
}
