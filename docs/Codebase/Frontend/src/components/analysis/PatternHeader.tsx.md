# PatternHeader.tsx

Collapsible header rendered at a class declaration line inside the documented
source spine. Props: `data: PatternHeaderData`, `onLineFlash?: (line) => void`.
Default collapsed: shows pattern badge + className + one-liner + AI/Static pill.
Expanded: What is it? / Why it fired / When to use + analogy + watch-out /
Methods to test (clickable rows that flash the line). Pure presentational;
collapse state is local `useState`. Print CSS forces the expanded body via
`@media print`.
