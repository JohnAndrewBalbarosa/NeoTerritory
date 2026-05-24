class ReportGenerator {
public:
    void generate() {
        createHeader();
        createBody();
    }
protected:
    virtual void createHeader() = 0;
    virtual void createBody() = 0;
};
class PdfReport : public ReportGenerator {
protected:
    void createHeader() override {}
    void createBody() override {}
};
