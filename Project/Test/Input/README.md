# Sample Analysis Inputs

Use these files as CLI input for the static analysis pipeline:

- `factory_to_singleton_source.cpp`: contains factory + singleton pattern candidates.
- `domain_models_source.cpp`: contains non-pattern domain classes (`Driver`, `FleetVehicle`, `Trip`) for context.

## Expected outputs after running

- `parse_tree.html`
- `creational_parse_tree.html`
- `behavioural_broken_ast.html`
- `generated_base_code.cpp`
- `generated_base_code.html`
- `generated_target_code_singleton.cpp`
- `generated_target_code_singleton.html`
- `analysis_report.json`

The non-pattern domain classes are included only as context and should not be the main target of creational pattern detection.
