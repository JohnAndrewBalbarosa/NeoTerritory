// Best-effort semicolon-aware splitter for ONE source line.
//
// Used by the class-tree view to decompose a multi-statement declaration
// line (e.g. `Foo a; Bar b;`) into display segments so a `review` line
// shows each statement as its own sub-row instead of one ambiguous blob.
//
// Not a parser. Recognised exceptions:
//   - `;` inside a `"…"` or `'…'` literal is ignored.
//   - `;` inside a `for( … ; … ; … )` header is ignored. Detection is
//     scoped to the paren depth opened immediately after a `for` keyword;
//     other parenthesised expressions still split normally.
//
// Edge cases out of scope (worst case: one segment that bundles two
// statements; tagging itself is unaffected because matching runs in the
// microservice):
//   - raw string literals `R"(...)"`
//   - line continuations / multi-line statements
//   - macro expansions

export interface StatementSegment {
  offset: number; // 0-based offset in the input line where the segment starts
  text: string;   // segment text, trimmed of leading whitespace only
}

export function splitStatementsAt(line: string): StatementSegment[] {
  if (!line) return [];

  const segments: StatementSegment[] = [];
  let segStart = 0;

  let inString: '"' | "'" | null = null;
  let escapeNext = false;

  // Stack of paren-depth markers for `for(...)` headers. Push the depth at
  // which a `for` opened its paren; while current depth > top, semicolons
  // are header-internal and are skipped.
  const forParenDepths: number[] = [];
  let parenDepth = 0;

  // Lookback to detect the `for` keyword immediately preceding a `(`. We
  // strip whitespace between them.
  function looksLikeForKeyword(endExclusive: number): boolean {
    let j = endExclusive - 1;
    while (j >= 0 && (line[j] === ' ' || line[j] === '\t')) j -= 1;
    return j >= 2
      && line[j] === 'r'
      && line[j - 1] === 'o'
      && line[j - 2] === 'f'
      && (j - 3 < 0 || !/[A-Za-z0-9_]/.test(line[j - 3]));
  }

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (inString) {
      if (ch === '\\') {
        escapeNext = true;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }

    if (ch === '(') {
      parenDepth += 1;
      if (looksLikeForKeyword(i)) forParenDepths.push(parenDepth);
      continue;
    }

    if (ch === ')') {
      if (forParenDepths.length > 0 && forParenDepths[forParenDepths.length - 1] === parenDepth) {
        forParenDepths.pop();
      }
      parenDepth -= 1;
      if (parenDepth < 0) parenDepth = 0;
      continue;
    }

    if (ch === ';') {
      const insideForHeader = forParenDepths.length > 0
        && parenDepth >= forParenDepths[forParenDepths.length - 1];
      if (insideForHeader) continue;

      const raw = line.slice(segStart, i + 1);
      const leading = raw.length - raw.trimStart().length;
      const text = raw.slice(leading);
      if (text.length > 0) {
        segments.push({ offset: segStart + leading, text });
      }
      segStart = i + 1;
    }
  }

  if (segStart < line.length) {
    const raw = line.slice(segStart);
    const leading = raw.length - raw.trimStart().length;
    const text = raw.slice(leading);
    if (text.trim().length > 0) {
      segments.push({ offset: segStart + leading, text });
    }
  }

  // If nothing split, return the whole line as a single segment so callers
  // do not have to special-case "no semicolons".
  if (segments.length === 0) {
    const leading = line.length - line.trimStart().length;
    const text = line.slice(leading);
    if (text.length > 0) segments.push({ offset: leading, text });
  }

  return segments;
}
