// Sample input for CLI analysis:
// source_pattern=builder target_pattern=singleton

#include <string>

class HttpRequest {
public:
    std::string host;
    int port = 80;
    std::string path = "/";
};

class HttpRequestBuilder {
public:
    HttpRequestBuilder set_host(std::string value) {
        host = value;
        return *this;
    }

    HttpRequestBuilder set_port(int value) {
        port = value;
        return *this;
    }

    HttpRequestBuilder set_path(std::string value) {
        path = value;
        return *this;
    }

    HttpRequest build() {
        HttpRequest req;
        req.host = host;
        req.port = port;
        req.path = path;
        return req;
    }

private:
    std::string host = "localhost";
    int port = 8080;
    std::string path = "/health";
};

int main() {
    HttpRequestBuilder builder;
    HttpRequest request = builder.set_host("api.local").set_port(443).set_path("/v1/status").build();
    return request.host.empty() ? 1 : 0;
}
