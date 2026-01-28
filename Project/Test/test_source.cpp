#include <iostream>

// Inner function that returns a value
int inner_func() {
    std::cout << "Inside inner_func - returning value" << std::endl;
    return 42;
}

// Outer function that takes inner_func() result as parameter
void outer_func(int value) {
    std::cout << "Inside outer_func with value: " << value << std::endl;
}

int main() {
    std::cout << "=== Testing nested function call in parameter ===" << std::endl;
    outer_func(inner_func());  // inner_func() called as argument to outer_func()
    std::cout << "=== Test complete ===" << std::endl;
    return 0;
}
