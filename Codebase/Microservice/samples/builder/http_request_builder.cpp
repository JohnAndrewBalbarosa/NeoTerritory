// Reference Builder sample: fluent setters returning *this, terminal build().
// Expected co-emit: creational.builder AND creational.method_chaining

#include <string>

class HttpRequest {
public:
    std::string url;
    std::string method;
    std::string body;
};

class HttpRequestBuilder {
public:
    HttpRequestBuilder& setUrl(const std::string& value) {
        m_url = value;
        return *this;
    }

    HttpRequestBuilder& setMethod(const std::string& value) {
        m_method = value;
        return *this;
    }

    HttpRequestBuilder& setBody(const std::string& value) {
        m_body = value;
        return *this;
    }

    HttpRequest build() const {
        HttpRequest request;
        request.url    = m_url;
        request.method = m_method;
        request.body   = m_body;
        return request;
    }

private:
    std::string m_url;
    std::string m_method;
    std::string m_body;
};

int main() {
    HttpRequest request = HttpRequestBuilder()
        .setUrl("/api")
        .setMethod("GET")
        .build();
    return 0;
}
