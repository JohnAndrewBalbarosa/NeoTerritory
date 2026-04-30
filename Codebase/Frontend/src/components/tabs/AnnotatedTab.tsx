import { useMemo } from 'react';
import { useAppStore } from '../../store/appState';
import SourceView from '../analysis/SourceView';
import PatternLegend from '../analysis/PatternLegend';
import PatternCards from '../analysis/PatternCards';
import ClassBindings from '../analysis/ClassBindings';
import { synthesizeUsageAnnotations } from '../../lib/usageAnnotations';

interface AnnotatedTabProps {
  onLineFlash: (line: number) => void;
  onCommentFlash: (id: string) => void;
}

export default function AnnotatedTab({ onLineFlash, onCommentFlash }: AnnotatedTabProps) {
  const { currentRun, aiStatus } = useAppStore();

  const allAnnotations = useMemo(() => {
    if (!currentRun) return [];
    const usage = synthesizeUsageAnnotations(
      currentRun.classUsageBindings || {},
      currentRun.detectedPatterns || []
    );
    return [...(currentRun.annotations || []), ...usage];
  }, [currentRun]);

  if (!currentRun) {
    return (
      <section className="tab-panel tab-annotated tab-empty">
        <p>Run an analysis to see annotated source.</p>
      </section>
    );
  }

  const patternCount = currentRun.detectedPatterns?.length || 0;
  const commentCount = allAnnotations.length;
  const summaryText = `${currentRun.sourceName || 'snippet.cpp'} • ${patternCount} pattern(s) • ${commentCount} comment(s)`;

  return (
    <section className="tab-panel tab-annotated">
      <header className="results-header">
        <p className="results-summary">{summaryText}</p>
        {aiStatus === 'pending' && (
          <span className="ai-pill ai-pill-pending" aria-live="polite">
            AI commentary loading…
          </span>
        )}
        {aiStatus === 'failed' && (
          <span className="ai-pill ai-pill-failed">AI commentary failed</span>
        )}
        <PatternLegend detectedPatterns={currentRun.detectedPatterns || []} />
      </header>
      <div className="results-body">
        <SourceView
          sourceText={currentRun.sourceText || ''}
          annotations={allAnnotations}
          detectedPatterns={currentRun.detectedPatterns || []}
          onLineClick={onCommentFlash}
        />
      </div>
      <PatternCards
        detectedPatterns={currentRun.detectedPatterns || []}
        ranking={currentRun.ranking}
        userResolvedPattern={currentRun.userResolvedPattern}
        classUsageBindings={currentRun.classUsageBindings || {}}
        classUsageBindingSource={currentRun.classUsageBindingSource || 'heuristic'}
        onLineFlash={onLineFlash}
      />
      <ClassBindings
        bindings={currentRun.classUsageBindings || {}}
        detectedPatterns={currentRun.detectedPatterns || []}
        onLineFlash={onLineFlash}
      />
    </section>
  );
}
