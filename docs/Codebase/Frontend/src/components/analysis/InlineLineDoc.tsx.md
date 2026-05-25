# InlineLineDoc.tsx

Inline documentation block rendered beneath an annotated source line. Props:
`data: InlineDocData`, `onLineFlash?: (line) => void`. Shows the annotation
title + comment with an AI/Static tag, the landmark label (from
documentationTargets), and usage line references ("used at L88, L91").
Left border inherits the line's pattern colour via a CSS var. Visible by
default. Interactive chrome is class `.no-print`.
