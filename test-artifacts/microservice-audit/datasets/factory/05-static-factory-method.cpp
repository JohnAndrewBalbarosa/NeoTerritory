#include <memory>
#include <string>

class Document { public: virtual ~Document() = default; };
class PdfDocument : public Document {};
class DocxDocument : public Document {};

class DocumentFactory {
public:
    static std::unique_ptr<Document> spawn(const std::string& kind) {
        if (kind == "pdf") return std::make_unique<PdfDocument>();
        if (kind == "docx") return std::make_unique<DocxDocument>();
        return nullptr;
    }
};
