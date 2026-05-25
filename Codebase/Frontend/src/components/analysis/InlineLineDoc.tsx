import { InlineDocData } from '../../logic/documentedModel';

interface InlineLineDocProps {
  data: InlineDocData;
  onLineFlash?: (line: number) => void;
}

// Inline doc block rendered beneath an annotated source line. Folds the line's
// annotation notes, landmark labels, and usage line references into one block.
// The left border colour is inherited from the parent line via the CSS var
// `--ann-border` set on the source line, so no colour prop is needed here.
export default function InlineLineDoc({ data, onLineFlash }: InlineLineDocProps) {
  const hasContent = data.notes.length > 0 || data.landmarks.length > 0 || data.usageLines.length > 0;
  if (!hasContent) return null;

  return (
    <div className="inline-line-doc" data-line={data.line}>
      {data.notes.map((n, i) => (
        <p key={i} className="inline-line-doc__note">
          <span className="inline-line-doc__title">{n.title}</span>
          {n.comment && <span className="inline-line-doc__comment"> — {n.comment}</span>}
          <span className={`inline-line-doc__tag inline-line-doc__tag--${n.source}`}>
            {n.source === 'ai' ? 'AI' : 'Static'}
          </span>
        </p>
      ))}
      <div className="inline-line-doc__meta">
        {data.landmarks.length > 0 && (
          <span className="inline-line-doc__landmark">landmark: {data.landmarks.join(', ')}</span>
        )}
        {data.usageLines.length > 0 && (
          <span className="inline-line-doc__usage no-print">
            used at {data.usageLines.map((l, i) => (
              <button key={i} type="button" className="inline-line-doc__usage-ref" onClick={() => onLineFlash?.(l)}>
                L{l}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
