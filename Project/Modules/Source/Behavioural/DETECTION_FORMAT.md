# Behavioural Detection Format

This folder currently provides:

1. A function-symbol scaffold.
2. A behavioural structure checker (heuristic) for Strategy/Observer-style roles.

## Function Scaffold

Implementation: `Logic/behavioural_logic_scaffold.cpp`

Format:

1. Build symbol table from parse tree.
2. Collect function symbols.
3. Exclude control-flow keywords from function list.
4. Emit one `FunctionNode` per function name.

Output node kinds:

- `BehaviouralEntryRoot`
- `FunctionNode`

## Behavioural Structure Checker (Created Heuristic)

Implementation: `Logic/behavioural_logic_scaffold.cpp`

Entry point:

- `build_behavioural_structure_checker(const ParseTreeNode&)`

### Strategy-style detection

`StrategyInterfaceCandidate` when:

1. Class has at least one virtual method.
2. Class has at least one execute-like method name:
   - `execute`, `apply`, `run`, `algorithm` (substring match).

`StrategyContextCandidate` when:

1. Class has setter-like method:
   - `setstrategy`, `setalgorithm`, `set_policy` (substring match).
2. Class subtree mentions strategy terms:
   - `strategy` or `algorithm`.

### Observer-style detection

`ObserverSubjectCandidate` when class has all three method categories:

1. Attach-like: `attach`, `subscribe`, `register`, `addobserver`, `addlistener`
2. Detach-like: `detach`, `unsubscribe`, `unregister`, `removeobserver`, `removelistener`
3. Notify-like: `notify`, `publish`, `broadcast`, `updateobservers`

`ObserverListenerCandidate` when:

1. Class has update-like methods:
   - `update`, `onnotify`, `onupdate`, `receive`
2. Plus one of:
   - class has virtual method, or
   - class name contains `observer` or `listener`.

Output node kinds:

- `BehaviouralStructureCheckRoot`
- `ClassNode`
- `StrategyInterfaceCandidate`
- `StrategyContextCandidate`
- `ObserverSubjectCandidate`
- `ObserverListenerCandidate`

## Aggregate Behavioural Root

Implementation: `behavioural_broken_tree.cpp`

Current aggregate includes:

1. Function scaffold tree.
2. Structure-check candidate tree.

