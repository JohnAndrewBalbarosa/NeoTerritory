# AffectedNodeLocator

- Folder: `docs/Codebase/Microservice/Modules/Source/Diffing/AffectedNodeLocator`
- Role: find the actual-tree subtree touched by an interval change

## Read Order
1. `core.cpp.md`

## Boundary
This folder does not perform subtree diffing. It only uses changed source ranges plus refreshed lexical structural signals to locate the affected actual subtree.

