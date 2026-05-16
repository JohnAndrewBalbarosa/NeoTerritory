// Edge case — a plain old data class with no pattern semantics. No
// private ctor, no chained returns, no inheritance, no forwarding to
// an inner pointer. Just public fields and a couple of small queries.
// Expected analyser tag: NONE (TRUE NEGATIVE — the tester should
// record kind='none' on the class declaration line and confirm).

#include <string>

class PostAddressRecord {
public:
    std::string street;
    std::string city;
    std::string province;
    std::string postal_code;
    std::string country;

    bool isComplete() const {
        return !street.empty() && !city.empty() && !country.empty();
    }
    std::string oneLine() const {
        return street + ", " + city + ", " + country;
    }
};
