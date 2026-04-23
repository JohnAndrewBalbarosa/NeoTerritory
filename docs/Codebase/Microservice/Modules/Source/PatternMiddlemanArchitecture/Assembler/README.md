# Assembler

## Purpose
Assembler owns tree shape and output assembly.

## Files As Implementation Units
- `pattern_tree_assembler.md` represents the output tree builder.
- It receives hook evidence and creates the final tree.
- Hooks never create the final root or shared output shape.

## Folder Flow
```mermaid
flowchart TD
    Start["Assembler"]
    N0["Read results"]
    N1["Attach evidence"]
    N2["Finalize tree"]
    End["Tree ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> End
```
