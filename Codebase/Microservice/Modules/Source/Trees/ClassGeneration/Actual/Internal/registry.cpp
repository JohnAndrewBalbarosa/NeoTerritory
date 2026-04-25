#include "Trees/Actual/Internal/contracts.hpp"

std::size_t hash_combine_token(std::size_t seed, const std::string& token)
{
    const std::size_t token_hash = std::hash<std::string>{}(token);
    seed ^= token_hash + 0x9e3779b97f4a7c15ULL + (seed << 6) + (seed >> 2);
    return seed;
}

std::size_t make_fnv1a64_hash_id(const std::string& text)
{
    std::size_t       hash  = 14695981039346656037ULL;
    constexpr std::size_t prime = 1099511628211ULL;
    for (unsigned char character : text)
    {
        hash ^= character;
        hash *= prime;
    }
    return hash;
}

std::string file_basename(const std::string& path)
{
    const std::size_t separator = path.find_last_of("/\\");
    if (separator == std::string::npos)
    {
        return path;
    }
    return path.substr(separator + 1);
}
