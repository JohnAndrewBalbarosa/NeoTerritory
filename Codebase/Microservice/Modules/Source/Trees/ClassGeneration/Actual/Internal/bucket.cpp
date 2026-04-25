#include "Trees/Actual/Internal/contracts.hpp"

void add_unique_hash(std::vector<std::size_t>& list, std::size_t value)
{
    for (std::size_t existing : list)
    {
        if (existing == value)
        {
            return;
        }
    }
    list.push_back(value);
}
