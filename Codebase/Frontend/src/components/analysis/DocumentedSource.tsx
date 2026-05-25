import { useMemo, forwardRef } from 'react';
import SourceView from './SourceView';
import PatternHeader from './PatternHeader';
import InlineLineDoc from './InlineLineDoc';
import { buildDocumentedModel } from '../../logic/documentedModel';
import { AnnotatedModel } from '../../logic/annotatedModel';
import { AnalysisRun, Annotation, DetectedPatternFull, ClassUsageBinding } from '../../types/api';

interface DocumentedSourceProps {
  run: AnalysisRun;
  annotatedModel: AnnotatedModel;
  sourceText: string;
  annotations: Annotation[];
  detectedPatterns: DetectedPatternFull[];
  classResolvedPatterns?: Record<string, string>;
  classUsageBindings?: Record<string, ClassUsageBinding[]>;
  inScopePatternsByClass?: Map<string, Set<string>>;
  coloringAmbiguousClassNames?: Set<string>;
  subclassPendingClassNames?: Set<string>;
  subclassDroppedClassNames?: Set<string>;
  usageLinesByAmbiguousClass?: Map<number, string>;
  onLineClick?: (commentId: string) => void;
  onLineFlash?: (line: number) => void;
}

// Composition layer for the merged walkthrough. Owns the documentedModel
// derivation and the export contentRef (forwarded). Renders SourceView with
// header/doc render slots; no colour logic of its own.
const DocumentedSource = forwardRef<HTMLDivElement, DocumentedSourceProps>(function DocumentedSource(
  props, ref,
) {
  const { run, annotatedModel, onLineFlash, ...sourceProps } = props;
  const docModel = useMemo(
    () => buildDocumentedModel(run, annotatedModel),
    [run, annotatedModel],
  );

  return (
    <div ref={ref} className="documented-source" data-testid="documented-source">
      <SourceView
        {...sourceProps}
        renderHeaderForLine={(lineNo) => {
          const h = docModel.headerByLine.get(lineNo);
          return h ? <PatternHeader data={h} onLineFlash={onLineFlash} /> : null;
        }}
        renderDocForLine={(lineNo) => {
          const d = docModel.docByLine.get(lineNo);
          return d ? <InlineLineDoc data={d} onLineFlash={onLineFlash} /> : null;
        }}
      />
    </div>
  );
});

export default DocumentedSource;
