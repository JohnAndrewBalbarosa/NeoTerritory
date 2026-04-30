
import { Annotation } from '../../types/api';
import { colorFor, patternFromAnnotation } from '../../lib/patterns';

interface CommentsPaneProps {
  annotations: Annotation[];
  onCommentClick?: (line: number) => void;
}

interface CommentCardProps {
  annotation: Annotation;
  onClick: () => void;
}

function CommentCard({ annotation: a, onClick }: CommentCardProps) {
  const patternKey = a.patternKey || patternFromAnnotation(a);
  const c = colorFor(patternKey);
  const titleParts = (a.title || '').split(' :: ');
  const head = titleParts[0] || a.stage || 'Comment';
  const label = titleParts.slice(1).join(' :: ') || a.kind || '';
  return (
    <article
      id={a.id}
      className="comment-card"
      data-line={a.line || ''}
      style={{ borderLeft: `4px solid ${c.border}`, background: c.bg }}
      onClick={onClick}
    >
      <header className="cc-head">
        <span className="cc-pattern" style={{ color: c.text }}>{head}</span>
        {label && <span className="cc-label">{label}</span>}
        {a.className && (
          <span className="cc-class" style={{ color: c.border }}>{a.className}</span>
        )}
        {a.line && <span className="cc-line">L{a.line}</span>}
      </header>
      <p className="cc-comment">{a.comment}</p>
      {a.excerpt && (
        <pre className="cc-excerpt" style={{ borderColor: c.border }}>{a.excerpt}</pre>
      )}
    </article>
  );
}

export default function CommentsPane({ annotations, onCommentClick }: CommentsPaneProps) {
  if (!annotations.length) {
    return <div id="comments-pane" className="comments-pane"><div className="empty-state">No comments produced.</div></div>;
  }
  const sorted = [...annotations].sort((a, b) => (a.line || 0) - (b.line || 0));
  return (
    <div id="comments-pane" className="comments-pane">
      {sorted.map(a => (
        <CommentCard
          key={a.id}
          annotation={a}
          onClick={() => { if (a.line && onCommentClick) onCommentClick(a.line); }}
        />
      ))}
    </div>
  );
}
