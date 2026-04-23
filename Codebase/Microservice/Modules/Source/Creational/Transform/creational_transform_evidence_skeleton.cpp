#include "internal/creational_transform_evidence_internal.hpp"

#include <sstream>

namespace creational_codegen_internal
{
std::vector<std::string> build_source_type_skeleton_lines(
    const std::vector<MonolithicClassView>& views)
{
    std::vector<std::string> out;
    for (const MonolithicClassView& view : views)
    {
        out.push_back("class " + view.class_name + " {");
        out.push_back("public:");
        out.push_back("    " + view.accessor_line + ";");
        for (const std::string& method_name : view.config_methods)
        {
            out.push_back("    void " + method_name + "(...);");
        }
        for (const std::string& method_name : view.operational_methods)
        {
            out.push_back("    void " + method_name + "(...);");
        }
        out.push_back("};");
        out.push_back("");
    }

    if (!out.empty() && out.back().empty())
    {
        out.pop_back();
    }
    return out;
}

std::vector<std::string> build_target_type_skeleton_lines(
    const std::vector<MonolithicClassView>& views)
{
    std::vector<std::string> out;
    for (const MonolithicClassView& view : views)
    {
        out.push_back("class " + view.class_name + " {");
        out.push_back("public:");
        for (const std::string& method_name : view.operational_methods)
        {
            out.push_back("    void " + method_name + "(...);");
        }
        out.push_back("};");
        out.push_back("");

        out.push_back("class " + view.class_name + "Builder {");
        out.push_back("public:");
        for (const std::string& method_name : view.builder_setter_methods)
        {
            out.push_back("    " + view.class_name + "Builder& " + method_name + "(...);");
        }
        out.push_back("    " + view.class_name + " " + view.build_method + "();");
        out.push_back("};");
        out.push_back("");
    }

    if (!out.empty() && out.back().empty())
    {
        out.pop_back();
    }
    return out;
}

std::vector<std::string> build_source_callsite_skeleton_lines(
    const std::vector<MonolithicClassView>& views)
{
    std::vector<std::string> out;
    out.push_back("int main() {");
    for (const MonolithicClassView& view : views)
    {
        for (const SingletonCallsiteEvidence& callsite : view.source_callsites)
        {
            out.push_back(
                "    " + view.class_name + " " + callsite.variable_name +
                " = " + view.class_name + "::instance();");
            for (const std::string& chain_call : callsite.config_chain)
            {
                const std::string method_name = method_name_from_chain_call(chain_call);
                if (!method_name.empty())
                {
                    out.push_back("    " + callsite.variable_name + "." + method_name + "();");
                }
            }
            for (const std::string& method_name : callsite.operational_methods)
            {
                out.push_back("    " + callsite.variable_name + "." + method_name + "();");
            }
        }
    }
    out.push_back("}");
    return out;
}

std::vector<std::string> build_target_callsite_skeleton_lines(
    const std::vector<MonolithicClassView>& views)
{
    std::vector<std::string> out;
    out.push_back("int main() {");
    for (const MonolithicClassView& view : views)
    {
        const std::vector<SingletonCallsiteEvidence>& callsites =
            view.target_callsites.empty() ? view.source_callsites : view.target_callsites;
        for (const SingletonCallsiteEvidence& callsite : callsites)
        {
            std::ostringstream rewritten;
            rewritten
                << "    " << view.class_name << " " << callsite.variable_name
                << " = " << view.class_name << "Builder()";

            bool has_chain = false;
            for (const std::string& chain_call : callsite.config_chain)
            {
                const std::string method_name = method_name_from_chain_call(chain_call);
                if (!method_name.empty())
                {
                    rewritten << "." << method_name << "()";
                    has_chain = true;
                }
            }
            if (!has_chain)
            {
                for (const std::string& method_name : view.builder_setter_methods)
                {
                    rewritten << "." << method_name << "()";
                }
            }
            rewritten << "." << view.build_method << "();";
            out.push_back(rewritten.str());

            for (const std::string& method_name : callsite.operational_methods)
            {
                out.push_back("    " + callsite.variable_name + "." + method_name + "();");
            }
        }
    }
    out.push_back("}");
    return out;
}

bool validate_monolithic_structure(
    const std::vector<std::string>& type_skeleton,
    const std::vector<std::string>& callsite_skeleton)
{
    for (const std::string& line : type_skeleton)
    {
        const std::string t = trim(line);
        if (t.find("int main") != std::string::npos ||
            t.find("Builder()") != std::string::npos ||
            t.find(" = ") != std::string::npos)
        {
            return false;
        }
    }

    bool has_main_open = false;
    bool has_main_close = false;
    for (const std::string& line : callsite_skeleton)
    {
        const std::string t = trim(line);
        if (starts_with(t, "class "))
        {
            return false;
        }
        if (t == "int main() {")
        {
            has_main_open = true;
        }
        if (t == "}")
        {
            has_main_close = true;
        }
    }
    return has_main_open && has_main_close;
}

} // namespace creational_codegen_internal
