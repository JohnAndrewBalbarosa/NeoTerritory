#include <memory>
#include <string>

class NetworkClientImpl;

class NetworkClient {
    std::unique_ptr<NetworkClientImpl> impl_;
public:
    NetworkClient();
    ~NetworkClient();
    std::string get(const std::string& url);
    void post(const std::string& url, const std::string& body);
};
