#include "behavioural_broken_tree.hpp"

#include "Logic/behavioural_logic_scaffold.hpp"
#include "tree_html_renderer.hpp"

#include <utility>
#include <vector>

namespace
{
class BehaviouralFunctionScaffoldDetector final : public IBehaviouralDetector
{
public:
    ParseTreeNode detect(const ParseTreeNode& parse_root) const override
    {
        return build_behavioural_function_scaffold(parse_root);
    }
};

class BehaviouralStructureCheckerDetector final : public IBehaviouralDetector
{
public:
    ParseTreeNode detect(const ParseTreeNode& parse_root) const override
    {
        return build_behavioural_structure_checker(parse_root);
    }
};

class DefaultBehaviouralTreeCreator final : public IBehaviouralTreeCreator
{
public:
    ParseTreeNode create(
        const ParseTreeNode& parse_root,
        const std::vector<const IBehaviouralDetector*>& detectors) const override
    {
        ParseTreeNode root{"BehaviouralPatternsRoot", "function scaffold + structure checks", {}};

        for (const IBehaviouralDetector* detector : detectors)
        {
            if (detector == nullptr)
            {
                continue;
            }

            ParseTreeNode detected = detector->detect(parse_root);
            if (!detected.children.empty())
            {
                root.children.push_back(std::move(detected));
            }
        }

        if (root.children.empty())
        {
            root.value = "NoBehaviouralPatternStructureFound";
        }

        return root;
    }
};
} // namespace

ParseTreeNode build_behavioural_broken_tree(const ParseTreeNode& parse_root)
{
    const BehaviouralFunctionScaffoldDetector function_scaffold_detector;
    const BehaviouralStructureCheckerDetector structure_checker_detector;
    const DefaultBehaviouralTreeCreator creator;

    const std::vector<const IBehaviouralDetector*> detectors = {
        &function_scaffold_detector,
        &structure_checker_detector,
    };

    return build_behavioural_broken_tree(parse_root, creator, detectors);
}

ParseTreeNode build_behavioural_broken_tree(
    const ParseTreeNode& parse_root,
    const IBehaviouralTreeCreator& creator,
    const std::vector<const IBehaviouralDetector*>& detectors)
{
    return creator.create(parse_root, detectors);
}

std::string behavioural_broken_tree_to_html(const ParseTreeNode& root)
{
    return render_tree_html(
        root,
        "Behavioural Broken AST",
        "No behavioural pattern structures found.");
}
