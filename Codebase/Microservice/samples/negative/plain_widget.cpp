// Negative-control sample: plain class with NO singleton structure.
// Has a static helper and a method, but no static reference accessor and no = delete.

#include <string>

class PlainWidget {
public:
    PlainWidget(const std::string& name) : m_name(name) {}

    static int computeHash(const std::string& seed) {
        int total = 0;
        for (char c : seed) total += c;
        return total;
    }

    std::string label() const { return m_name; }

private:
    std::string m_name;
};

int main() {
    PlainWidget widget("hello");
    int hash = PlainWidget::computeHash("seed");
    return 0;
}
