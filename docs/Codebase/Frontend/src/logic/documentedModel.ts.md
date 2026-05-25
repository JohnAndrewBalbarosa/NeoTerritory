# documentedModel.ts

Pure derivation for the merged Patterns walkthrough. Input: `AnalysisRun` +
the already-derived `AnnotatedModel` (from `annotatedModel.ts`). Output:
`DocumentedModel` with two line-keyed maps:

- `headerByLine: Map<number, PatternHeaderData>` — one entry at each class
  declaration line, carrying pattern name, className, AI/static source, the
  definition (oneLiner/whenToUse/analogy/watchOuts) or AI education
  (explanation/whyThisFired/studyHint), and the unitTestTargets list.
- `docByLine: Map<number, InlineDocData>` — one entry per annotated line,
  merging the line's annotations (title/comment/stage), documentationTargets
  whose `line` matches, and usage callsites (classUsageBindings + rank
  callsites) whose `line` matches.

No mutation of inputs. Pure function `buildDocumentedModel(run, annotatedModel)`.
Collaborators: `patternDefinitionFor` (data/patternDefinitions), `familyOf`
(logic/docExport), `canonicalPatternName` (logic/patterns).
