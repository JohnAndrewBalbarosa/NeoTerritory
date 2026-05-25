import { useMemo, useState, useCallback, forwardRef } from 'react';
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

  // Inline docs are collapsed by default — the spine reads as code first,
  // notes on demand. Expansion state is per-line and owned here so SourceView
  // stays presentational. The InlineLineDoc still renders into the DOM while
  // collapsed (hidden via CSS) so MD/PDF/DOCX exports stay complete.
  const [expandedDocs, setExpandedDocs] = useState<Set<number>>(new Set());
  const toggleDoc = useCallback((lineNo: number) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(lineNo)) next.delete(lineNo); else next.add(lineNo);
      return next;
    });
  }, []);

  return (
    <div ref={ref} className="documented-source" data-testid="documented-source">
      <SourceView
        {...sourceProps}
        hasDocForLine={(lineNo) => docModel.docByLine.has(lineNo)}
        docExpandedForLine={(lineNo) => expandedDocs.has(lineNo)}
        onToggleDoc={toggleDoc}
        renderHeaderForLine={(lineNo) => {
          const h = docModel.headerByLine.get(lineNo);
          return h ? <PatternHeader data={h} onLineFlash={onLineFlash} /> : null;
        }}
        renderDocForLine={(lineNo) => {
          const d = docModel.docByLine.get(lineNo);
          return d ? <InlineLineDoc data={d} collapsed={!expandedDocs.has(lineNo)} onLineFlash={onLineFlash} /> : null;
        }}
      />
    </div>
  );
});

export default DocumentedSource;
