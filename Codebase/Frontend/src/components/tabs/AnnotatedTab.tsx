import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appState';
import SourceView from '../analysis/SourceView';
import PatternLegend from '../analysis/PatternLegend';
import PatternCards from '../analysis/PatternCards';
import ClassBindings from '../analysis/ClassBindings';
import { synthesizeUsageAnnotations } from '../../lib/usageAnnotations';
import { AnalysisRunFile } from '../../types/api';

interface AnnotatedTabProps {
  onLineFlash: (line: number) => void;
  onCommentFlash: (id: string) => void;
  pendingSave?: boolean;
  onDiscard?: () => void;
  onGoToReview?: () => void;
}

export default function AnnotatedTab({
  onLineFlash, onCommentFlash, pendingSave, onDiscard, onGoToReview
}: AnnotatedTabProps) {
  const { currentRun, aiStatus } = useAppStore();
  const [activeFileIdx, setActiveFileIdx] = useState(0);

  // Resolve the per-file slice. Multi-file runs ship `files[]`; legacy
  // single-file runs back-fill into a synthetic single-entry list so the
  // rest of this component can iterate uniformly.
  const files: AnalysisRunFile[] = useMemo(() => {
    if (!currentRun) return [];
    if (currentRun.files && currentRun.files.length > 0) return currentRun.files;
    return [{ name: currentRun.sourceName || 'snippet.cpp', sourceText: currentRun.sourceText || '' }];
  }, [currentRun]);
  const activeFile = files[activeFileIdx] || files[0];

  const allAnnotations = useMemo(() => {
    if (!currentRun) return [];
    const usage = synthesizeUsageAnnotations(
      currentRun.classUsageBindings || {},
      currentRun.detectedPatterns || [],
      currentRun.classResolvedPatterns
    );
    return [...(currentRun.annotations || []), ...usage];
  // Re-synthesize when retag updates classResolvedPatterns so colors propagate.
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
  const fileSuffix = files.length > 1 ? ` • ${files.length} files` : '';
  const summaryText = `${activeFile?.name || currentRun.sourceName || 'snippet.cpp'} • ${patternCount} pattern(s) • ${commentCount} comment(s)${fileSuffix}`;

  // "Tagged" means the user explicitly resolved a pattern for this class via
  // the Tag pattern… picker. Once every detected class has a resolution, we
  // surface a CTA to move on to the Review tab.
  const detectedClasses = (currentRun.detectedPatterns || [])
    .map(p => p.className)
    .filter((c): c is string => !!c);
  const uniqueClasses = Array.from(new Set(detectedClasses));
  const resolvedMap = currentRun.classResolvedPatterns || {};
  const taggedCount = uniqueClasses.filter(c => !!resolvedMap[c]).length;
  const allTagged = uniqueClasses.length > 0 && taggedCount === uniqueClasses.length;

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
        {pendingSave && onDiscard && (
          <button
            type="button"
            className="ghost-btn discard-btn"
            onClick={() => { if (confirm('Discard this run? Your tags and edits will be lost.')) onDiscard(); }}
            title="Drop the current unsaved run"
          >
            Discard run
          </button>
        )}
      </header>
      {uniqueClasses.length > 0 && (
        <div className="tag-progress" data-complete={allTagged ? 'true' : undefined}>
          <span className="tag-progress-label">
            {taggedCount} / {uniqueClasses.length} class(es) tagged
          </span>
          {allTagged && onGoToReview && (
            <button
              type="button"
              className="primary-btn tag-progress-cta"
              onClick={onGoToReview}
            >
              Next: Review before submission →
            </button>
          )}
        </div>
      )}
      {files.length > 1 && (
        <nav className="file-tab-bar" role="tablist" aria-label="Submitted files">
          {files.map((f, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === activeFileIdx}
              className={`file-tab-btn ${i === activeFileIdx ? 'is-active' : ''}`}
              onClick={() => setActiveFileIdx(i)}
              title={f.name}
            >
              {f.name}
            </button>
          ))}
        </nav>
      )}
      <div className="results-body">
        <SourceView
          sourceText={activeFile?.sourceText || currentRun.sourceText || ''}
          annotations={allAnnotations}
          detectedPatterns={currentRun.detectedPatterns || []}
          classResolvedPatterns={currentRun.classResolvedPatterns}
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
        classResolvedPatterns={currentRun.classResolvedPatterns}
        onLineFlash={onLineFlash}
      />
    </section>
  );
}
