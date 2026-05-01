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
      currentRun.classResolvedPatterns,
      currentRun.classUsageBindingSource || 'heuristic'
    );
    return [...(currentRun.annotations || []), ...usage];
  // Re-synthesize when retag updates classResolvedPatterns so colors propagate.
  }, [currentRun]);

  if (!currentRun) {
    return (
      <section className="tab-panel tab-annotated ide-annotated">
        <div className="ide-workspace">
          <div className="ide-editor-pane">
            <div className="ide-editor-header">
              <span className="results-summary">no source loaded</span>
            </div>
            <div className="ide-editor-body">
              <div className="ide-empty-state">
                <p className="ide-empty-prompt">
                  <strong>&gt;_ No source loaded</strong>
                  Go to the Submit tab to paste or upload C++ source.
                </p>
              </div>
            </div>
          </div>
          <div className="ide-analysis-pane">
            <div className="ide-analysis-header">
              <span className="ide-analysis-header-title">Analysis</span>
            </div>
            <div className="ide-analysis-body">
              <p className="empty-state">Awaiting analysis…</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const patternCount = currentRun.detectedPatterns?.length || 0;
  const commentCount = allAnnotations.length;
  const fileSuffix = files.length > 1 ? ` • ${files.length} files` : '';
  const summaryText = `${activeFile?.name || currentRun.sourceName || 'snippet.cpp'} • ${patternCount} pattern(s) • ${commentCount} comment(s)${fileSuffix}`;

  // A class counts as "tagged" if EITHER the matcher already gave it a
  // pattern (presence in detectedPatterns) OR the user explicitly resolved
  // one via the popover/picker. The total population is the set of all
  // classes the run knows about — detected patterns + class-usage bindings.
  // "Missing tags" is the complement: classes that exist in source but have
  // neither a matcher verdict nor a user resolution.
  const detectedClassNames = new Set(
    (currentRun.detectedPatterns || [])
      .map(p => p.className)
      .filter((c): c is string => !!c)
  );
  const bindingClassNames = new Set(Object.keys(currentRun.classUsageBindings || {}));
  const allClassNames = new Set<string>([...detectedClassNames, ...bindingClassNames]);
  const resolvedMap = currentRun.classResolvedPatterns || {};
  const taggedClassNames = [...allClassNames].filter(c => detectedClassNames.has(c) || !!resolvedMap[c]);
  const missingClassNames = [...allClassNames].filter(c => !detectedClassNames.has(c) && !resolvedMap[c]);
  const taggedCount = taggedClassNames.length;
  const missingCount = missingClassNames.length;
  const totalClasses = allClassNames.size;
  const allTagged = totalClasses > 0 && missingCount === 0;

  return (
    <section className="tab-panel tab-annotated ide-annotated">
      <div className="ide-workspace">

        {/* ── Left: Code Editor Pane (60%) ── */}
        <div className="ide-editor-pane">
          <div className="ide-editor-header">
            {files.length > 1 && (
              <nav className="file-tab-bar" role="tablist" aria-label="Submitted files"
                style={{ margin: 0, border: 'none', padding: 0 }}>
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
            <p className="results-summary">{summaryText}</p>
            {aiStatus === 'pending' && (
              <span className="ai-pill-sm ai-pill-sm--pending" aria-live="polite">AI loading</span>
            )}
            {aiStatus === 'failed' && (
              <span className="ai-pill-sm ai-pill-sm--failed">AI failed</span>
            )}
            {totalClasses > 0 && (
              <span className="tag-progress-strip" data-complete={allTagged ? 'true' : undefined}>
                <span className="tag-progress-pill tag-progress-pill--tagged">
                  {taggedCount}/{totalClasses} tagged
                </span>
                {missingCount > 0 && (
                  <span
                    className="tag-progress-pill tag-progress-pill--missing"
                    title={missingClassNames.join(', ')}
                  >
                    {missingCount} missing
                  </span>
                )}
              </span>
            )}
            {pendingSave && onDiscard && (
              <button
                type="button"
                className="ghost-btn discard-btn"
                style={{ marginLeft: 'auto', flexShrink: 0 }}
                onClick={() => { if (confirm('Discard this run? Your tags and edits will be lost.')) onDiscard(); }}
                title="Drop the current unsaved run"
              >
                Discard
              </button>
            )}
          </div>

          <div className="ide-editor-body">
            <div className="source-pane">
              <SourceView
                sourceText={activeFile?.sourceText || currentRun.sourceText || ''}
                annotations={allAnnotations}
                detectedPatterns={currentRun.detectedPatterns || []}
                classResolvedPatterns={currentRun.classResolvedPatterns}
                onLineClick={onCommentFlash}
              />
            </div>
          </div>
        </div>

        {/* ── Right: Analysis Pane (40%) ── */}
        <div className="ide-analysis-pane">
          <div className="ide-analysis-header">
            <span className="ide-analysis-header-title">Analysis</span>
            <PatternLegend detectedPatterns={currentRun.detectedPatterns || []} />
            {allTagged && onGoToReview && (
              <button
                type="button"
                className="primary-btn tag-progress-cta"
                style={{ marginLeft: 'auto', flexShrink: 0 }}
                onClick={onGoToReview}
              >
                Next: Review →
              </button>
            )}
          </div>

          <div className="ide-analysis-body">
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
          </div>
        </div>

      </div>
    </section>
  );
}
