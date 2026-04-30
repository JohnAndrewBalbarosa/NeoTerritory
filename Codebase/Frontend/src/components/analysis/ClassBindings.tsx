
import { ClassUsageBinding } from '../../types/api';
import { USAGE_KIND_LABEL } from '../../lib/patterns';

interface ClassBindingsProps {
  bindings: Record<string, ClassUsageBinding[]>;
  source: 'heuristic' | 'microservice';
  onLineFlash?: (line: number) => void;
}

interface ClassRowProps {
  className: string;
  rows: ClassUsageBinding[];
  onLineFlash?: (line: number) => void;
}

function ClassRow({ className, rows, onLineFlash }: ClassRowProps) {
  if (!rows.length) return null;
  return (
    <div className="class-binding-card">
      <div className="class-binding-head">
        <code>{className}</code> <span className="row-line">{rows.length} usage(s)</span>
      </div>
      <div className="pattern-row-list">
        {rows.map((u, i) => {
          const label = USAGE_KIND_LABEL[u.kind] || u.kind;
          const target = u.varName
            ? `${u.varName}${u.methodName ? '.' + u.methodName : ''}`
            : (u.methodName ? `${u.boundClass || className}::${u.methodName}` : (u.boundClass || className));
          return (
            <button
              key={i}
              type="button"
              className="pattern-row"
              onClick={() => onLineFlash?.(u.line)}
            >
              <span className="row-kind">{label}</span>
              <code>{target}</code>
              <span className="row-line">line {u.line || '?'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ClassBindings({ bindings, source, onLineFlash }: ClassBindingsProps) {
  const classNames = Object.keys(bindings || {});
  if (!classNames.length) return <div id="class-bindings" />;
  const sourceTag = source === 'microservice' ? 'microservice-bound' : 'heuristic';
  const totalRows = classNames.reduce((acc, c) => acc + (bindings[c] || []).length, 0);

  return (
    <div id="class-bindings">
      <details className="class-bindings-wrap">
        <summary className="class-bindings-summary">
          <span className="caret" aria-hidden="true">▶</span>
          <span className="class-bindings-title">Class usage bindings</span>
          <span className="class-bindings-count">{classNames.length} class(es) • {totalRows} usage(s)</span>
          <span className="usage-source">[{sourceTag}]</span>
        </summary>
        <div className="class-bindings-body">
          {classNames.map(cls => (
            <ClassRow
              key={cls}
              className={cls}
              rows={bindings[cls] || []}
              onLineFlash={onLineFlash}
            />
          ))}
        </div>
      </details>
    </div>
  );
}
