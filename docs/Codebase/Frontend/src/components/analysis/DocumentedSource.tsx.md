# DocumentedSource.tsx

Composition component for the merged Patterns walkthrough. Derives
`buildDocumentedModel(run, annotatedModel)` and renders `SourceView` passing
two render slots: `renderHeaderForLine(lineNo)` → `<PatternHeader>` when the
line is a class declaration with a header entry; `renderDocForLine(lineNo)` →
`<InlineLineDoc>` when the line has a doc entry. Owns the `contentRef` used by
PDF/DOCX export. Forwards all the SourceView colouring/scope props it already
receives in AnnotatedTab. No colour logic of its own.
