// SAMPLE — adapter-style wrapper. Confirms the user's hypothesis that the
// "standard structure" of an adapter (construct then call wrapped method)
// shows up cleanly as tagged usages.
//
// Expected for HttpClient (the wrapper):
//   value_decl    line: HttpClient client
//   member_call   line: client.get
// Expected for SocketLib (the wrapped/adaptee):
//   ptr_decl      line: SocketLib* lib
//   arrow_call    line: lib->raw_send
#include <string>
#include <iostream>

class SocketLib {
public:
    void raw_send(const std::string& bytes) { std::cout << "raw " << bytes; }
};

class HttpClient {
public:
    HttpClient(SocketLib* s) : sock(s) {}
    void get(const std::string& url) {
        sock->raw_send("GET " + url);
    }
private:
    SocketLib* sock;
};

int main() {
    SocketLib* lib = new SocketLib();
    lib->raw_send("ping");

    HttpClient client(lib);
    client.get("/api/data");
    client.get("/api/health");
    delete lib;
    return 0;
}
