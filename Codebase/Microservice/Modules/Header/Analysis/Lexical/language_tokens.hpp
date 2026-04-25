#pragma once

#include <string>
#include <unordered_set>

struct LanguageTokenConfig
{
    bool case_sensitive = true;
};

std::unordered_set<std::string> language_tokens(const LanguageTokenConfig& config);

std::string lowercase_ascii(const std::string& text);
