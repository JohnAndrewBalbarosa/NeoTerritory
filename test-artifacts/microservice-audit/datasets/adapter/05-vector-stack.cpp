#include <vector>

class StackOnVector {
    std::vector<int> store;
public:
    void push(int v) {
        store.push_back(v);
    }
    int top() const {
        return store.back();
    }
    void pop() {
        store.pop_back();
    }
};
