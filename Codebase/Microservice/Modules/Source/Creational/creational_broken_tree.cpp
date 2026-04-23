#include "creational_broken_tree.hpp"
#include "Builder/builder_pattern_logic.hpp"
#include "Factory/factory_pattern_logic.hpp"
#include "Singleton/singleton_pattern_logic.hpp"
#include "Output-and-Rendering/tree_html_renderer.hpp"

#include <functional>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

namespace
{
class FactoryPatternDetector final : public ICreationalDetector
{
public:
    CreationalTreeNode detect(const ParseTreeNode& parse_root) const override
    {
        return build_factory_pattern_tree(parse_root);
    }
};

class SingletonPatternDetector final : public ICreationalDetector
{
public:
    CreationalTreeNode detect(const ParseTreeNode& parse_root) const override
    {
        return build_singleton_pattern_tree(parse_root);
    }
};

class BuilderPatternDetector final : public ICreationalDetector
{
public:
    CreationalTreeNode detect(const ParseTreeNode& parse_root) const override
    {
        return build_builder_pattern_tree(parse_root);
    }
};

class DefaultCreationalTreeCreator final : public ICreationalTreeCreator
{
public:
    CreationalTreeNode create(
        const ParseTreeNode& parse_root,
        const std::vector<const ICreationalDetector*>& detectors) const override
    {
        CreationalTreeNode out{"CreationalPatternsRoot", "factory + singleton + builder", {}};

        for (const ICreationalDetector* detector : detectors)
        {
            if (detector == nullptr)
            {
                continue;
            }

            CreationalTreeNode detected = detector->detect(parse_root);
            if (!detected.children.empty())
            {
                out.children.push_back(std::move(detected));
            }
        }

        if (out.children.empty())
        {
            out.label = "NoFactoryOrSingletonOrBuilderPatternFound";
        }

        return out;
    }
};
} // namespace

CreationalTreeNode build_creational_broken_tree(const ParseTreeNode& root)
{
    const FactoryPatternDetector factory_detector;
    const SingletonPatternDetector singleton_detector;
    const BuilderPatternDetector builder_detector;
    const DefaultCreationalTreeCreator creator;

    const std::vector<const ICreationalDetector*> detectors = {
        &factory_detector,
        &singleton_detector,
        &builder_detector,
    };

    return build_creational_broken_tree(root, creator, detectors);
}

CreationalTreeNode build_creational_broken_tree(
    const ParseTreeNode& root,
    const ICreationalTreeCreator& creator,
    const std::vector<const ICreationalDetector*>& detectors)
{
    return creator.create(root, detectors);
}

ParseTreeNode creational_tree_to_parse_tree_node(const CreationalTreeNode& root)
{
    ParseTreeNode out;
    out.kind = root.kind;
    out.value = root.label;

    for (const CreationalTreeNode& child : root.children)
    {
        out.children.push_back(creational_tree_to_parse_tree_node(child));
    }

    return out;
}

std::string creational_tree_to_html(const CreationalTreeNode& root)
{
    const ParseTreeNode parse_root = creational_tree_to_parse_tree_node(root);
    return render_tree_html(
        parse_root,
        "Creational Broken Tree",
        "No creational (factory/singleton/builder) pattern found in this source.");
}

std::string creational_tree_to_text(const CreationalTreeNode& root)
{
    std::ostringstream out;

    std::function<void(const CreationalTreeNode&, int)> walk = [&](const CreationalTreeNode& node, int depth) {
        out << std::string(static_cast<size_t>(depth) * 2, ' ') << node.kind;
        if (!node.label.empty())
        {
            out << ": " << node.label;
        }
        out << '\n';

        for (const CreationalTreeNode& child : node.children)
        {
            walk(child, depth + 1);
        }
    };

    walk(root, 0);
    return out.str();
}
