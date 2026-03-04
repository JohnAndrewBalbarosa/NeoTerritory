// Monolithic/Target Code View (Builder)

// EVIDENCE_REMOVED:
// - static ReportService instance()
// - static ReportService inst;
// - return inst;
// - ReportService::instance()

// EVIDENCE_ADDED:
// - class ReportServiceBuilder
// - ReportServiceBuilder& set_format(...)
// - ReportServiceBuilder& enable_timestamp(...)
// - ReportServiceBuilder& configure_channel(...)
// - ReportService build()
// - ReportService service = ReportServiceBuilder().set_format(...).enable_timestamp(...).configure_channel(...).build();

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

// CALLSITE_SKELETON:

int main() {
    ReportService service = ReportServiceBuilder().set_format().enable_timestamp().configure_channel().build();
    service.log();
}
