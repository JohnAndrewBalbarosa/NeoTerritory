const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function countMatches(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function lineMatches(lines, predicate) {
  const hits = [];
  lines.forEach((line, index) => {
    if (predicate(line)) {
      hits.push(index + 1);
    }
  });
  return hits;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safePreview(code, limit = 1200) {
  if (code.length <= limit) return code;
  return `${code.slice(0, limit)}\n\n// ... preview trimmed ...`;
}

function findFirstLine(lines, predicate) {
  const index = lines.findIndex(predicate);
  return index >= 0 ? index + 1 : null;
}

function getLineText(lines, lineNumber) {
  if (!lineNumber || lineNumber < 1 || lineNumber > lines.length) {
    return '';
  }
  return lines[lineNumber - 1].trim();
}

function detectFunctions(code) {
  const regex = /^\s*(?:template\s*<[^>]+>\s*)?(?:[\w:<>]+\s+)+([A-Za-z_]\w*)\s*\([^;{}]*\)\s*(?:const\s*)?(?:noexcept\s*)?(?:\{|$)/gm;
  const names = new Set();
  let match;
  while ((match = regex.exec(code)) !== null) {
    if (match[1]) names.add(match[1]);
  }
  return names.size;
}

function buildFindings(lines, code) {
  const findings = [];
  const rawPointerLines = lineMatches(lines, line => /\b[A-Za-z_][\w:<>]*\s*\*\s*[A-Za-z_]\w*/.test(line) && !/std::/.test(line));
  const newLines = lineMatches(lines, line => /\bnew\s+[A-Za-z_]/.test(line));
  const deleteLines = lineMatches(lines, line => /\bdelete\s+[A-Za-z_]/.test(line));
  const includeLines = lineMatches(lines, line => /^\s*#include\s+/.test(line));
  const destructorLines = lineMatches(lines, line => /^\s*~[A-Za-z_]\w*\s*\(/.test(line));

  rawPointerLines.forEach(line => {
    findings.push({
      severity: 'high',
      rule: 'raw-pointer-field',
      line,
      title: 'Raw pointer field detected',
      detail: `Line ${line} uses a raw pointer field or declaration pattern.`
    });
  });

  newLines.forEach(line => {
    findings.push({
      severity: 'high',
      rule: 'manual-allocation',
      line,
      title: 'Manual allocation detected',
      detail: `Line ${line} allocates memory with \`new\`.`
    });
  });

  deleteLines.forEach(line => {
    findings.push({
      severity: 'high',
      rule: 'manual-deallocation',
      line,
      title: 'Manual deallocation detected',
      detail: `Line ${line} releases memory with \`delete\`.`
    });
  });

  if (destructorLines.length) {
    destructorLines.forEach(line => {
      findings.push({
        severity: 'medium',
        rule: 'manual-lifetime-management',
        line,
        title: 'Destructor present',
        detail: `Line ${line} defines a destructor, so ownership deserves a quick RAII check.`
      });
    });
  }

  if (!includeLines.length) {
    findings.push({
      severity: 'low',
      rule: 'minimal-header-surface',
      title: 'No include directives found',
      detail: 'The file has no include directives, which usually means the sample is narrow or incomplete.'
    });
  }

  return findings;
}

function buildAnnotations({
  sourceName,
  lines,
  findings,
  lineCount,
  classCount,
  functionCount,
  includeCount,
  structureScore,
  modernizationScore,
  suggestions
}) {
  const annotations = [];
  let counter = 1;

  const pushAnnotation = (entry) => {
    annotations.push({
      id: `comment-${counter}`,
      order: counter,
      ...entry
    });
    counter += 1;
  };

  pushAnnotation({
    stage: 'Analysis',
    severity: 'low',
    line: 1,
    lineEnd: 1,
    title: 'Analysis summary',
    comment: `${sourceName} scanned across ${lineCount} line(s). Structure is ${structureScore}/100 and modernization is ${modernizationScore}/100.`,
    excerpt: getLineText(lines, 1),
    kind: 'summary'
  });

  const firstClassLine = findFirstLine(lines, line => /\b(class|struct)\s+[A-Za-z_]\w*/.test(line));
  if (firstClassLine) {
    pushAnnotation({
      stage: 'Trees',
      severity: 'medium',
      line: firstClassLine,
      lineEnd: firstClassLine,
      title: 'Tree handoff',
      comment: 'Generate the declaration subtree first, then analyze the structural pattern from that completed subtree.',
      excerpt: getLineText(lines, firstClassLine),
      kind: 'tree-handoff'
    });
  }

  const ownershipLine = findFirstLine(lines, line =>
    /\bnew\s+[A-Za-z_]/.test(line) ||
    /\bdelete\s+[A-Za-z_]/.test(line) ||
    (/\b[A-Za-z_][\w:<>]*\s*\*\s*[A-Za-z_]\w*/.test(line) && !/std::/.test(line))
  );
  if (ownershipLine) {
    pushAnnotation({
      stage: 'Hashing',
      severity: 'high',
      line: ownershipLine,
      lineEnd: ownershipLine,
      title: 'Ownership pressure',
      comment: 'This line affects ownership shape. RAII cleanup improves the stability of later identity and lookup passes.',
      excerpt: getLineText(lines, ownershipLine),
      kind: 'ownership'
    });
  }

  const functionLine = findFirstLine(lines, line => /^\s*(?:template\s*<[^>]+>\s*)?(?:[\w:<>]+\s+)+[A-Za-z_]\w*\s*\([^;{}]*\)\s*(?:const\s*)?(?:noexcept\s*)?(?:\{|$)/.test(line));
  if (functionLine && functionCount > 0) {
    pushAnnotation({
      stage: 'Output',
      severity: 'low',
      line: functionLine,
      lineEnd: functionLine,
      title: 'Output boundary',
      comment: 'Function boundaries like this are where the final report and artifact output usually stay easiest to read.',
      excerpt: getLineText(lines, functionLine),
      kind: 'output-boundary'
    });
  }

  findings.forEach(finding => {
    pushAnnotation({
      stage: 'Finding',
      severity: finding.severity,
      line: finding.line || null,
      lineEnd: finding.line || null,
      title: finding.title,
      comment: finding.detail,
      excerpt: getLineText(lines, finding.line),
      kind: finding.rule
    });
  });

  if (!findings.length) {
    pushAnnotation({
      stage: 'Review',
      severity: 'low',
      line: Math.min(lineCount || 1, 1),
      lineEnd: Math.min(lineCount || 1, 1),
      title: 'Clean pass',
      comment: suggestions[0] || 'No direct findings were produced for this source.',
      excerpt: getLineText(lines, 1),
      kind: 'clean-pass'
    });
  }

  return annotations;
}

function groupAnnotationsByLine(annotations) {
  const groups = new Map();
  annotations.forEach(annotation => {
    const line = annotation.line || 1;
    if (!groups.has(line)) {
      groups.set(line, []);
    }
    groups.get(line).push(annotation);
  });
  return groups;
}

function buildCommentedCode(sourceText, annotations) {
  const normalized = sourceText.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const groups = groupAnnotationsByLine(annotations);
  const width = String(lines.length).length;
  const output = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const lineLabel = String(lineNumber).padStart(width, ' ');
    output.push(`${lineLabel} | ${line}`);

    const comments = groups.get(lineNumber) || [];
    comments.forEach(comment => {
      output.push(`  // [Comment ${comment.order}] ${comment.stage}: ${comment.title} - ${comment.comment}`);
    });
  });

  return output.join('\n');
}

function buildCommentsOnly({ sourceName, annotations, analysis }) {
  const lines = [
    `# Comments for ${sourceName}`,
    '',
    `- Structure score: ${analysis.structureScore}/100`,
    `- Modernization score: ${analysis.modernizationScore}/100`,
    `- Comment count: ${annotations.length}`,
    ''
  ];

  annotations.forEach(annotation => {
    const lineRef = annotation.line ? `L${annotation.line}` : 'No line';
    lines.push(`## Comment ${annotation.order}`);
    lines.push(`- Stage: ${annotation.stage}`);
    lines.push(`- Severity: ${annotation.severity}`);
    lines.push(`- Anchor: ${lineRef}`);
    lines.push(`- Title: ${annotation.title}`);
    lines.push(`- Note: ${annotation.comment}`);
    if (annotation.excerpt) {
      lines.push(`- Excerpt: \`${annotation.excerpt}\``);
    }
    lines.push('');
  });

  return lines.join('\n').trimEnd();
}

function buildDownloadFilename(sourceName, format) {
  const base = path.basename(sourceName, path.extname(sourceName)) || 'analysis';
  if (format === 'comments-only') {
    return `${base}.comments.md`;
  }
  return `${base}.commented.cpp`;
}

function buildPipeline({ sourceName, lineCount, classCount, functionCount, includeCount, structureScore, modernizationScore, findings }) {
  const analysisState = classCount > 0 ? 'complete' : 'waiting';
  const treeState = classCount > 0 ? 'ready' : 'waiting';
  const hashState = modernizationScore >= 70 ? 'ready' : 'review';
  const outputState = findings.length <= 2 && structureScore >= 80 ? 'ready' : 'review';

  return [
    {
      key: 'analysis',
      title: 'Analysis',
      state: analysisState,
      summary: `${lineCount} lines scanned, ${includeCount} include(s) recorded, ${functionCount} function candidate(s) found.`,
      detail: 'Tokenize input, collect class facts, and keep structural events separate from final pattern acceptance.'
    },
    {
      key: 'trees',
      title: 'Trees',
      state: treeState,
      summary: `${classCount} class declaration subtree(s) identified for handoff.`,
      detail: 'Build the actual class subtree first, then register the subtree head as the analysis target.'
    },
    {
      key: 'hashing',
      title: 'Hashing',
      state: hashState,
      summary: `${modernizationScore}/100 modernization readiness.`,
      detail: 'Stable identity improves when ownership is explicit and manual lifetime management is reduced.'
    },
    {
      key: 'output',
      title: 'Output',
      state: outputState,
      summary: `${findings.length} finding(s) prepared for report and artifact output.`,
      detail: 'Package the result into a report-friendly artifact and keep the generated preview readable.'
    }
  ];
}

function analyzeSource({ sourceName, code }) {
  const normalized = code.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const lineCount = lines.length;
  const charCount = normalized.length;
  const blankLines = lines.filter(line => !line.trim()).length;
  const classCount = countMatches(normalized, /\b(class|struct)\s+[A-Za-z_]\w*/g);
  const functionCount = detectFunctions(normalized);
  const includeCount = countMatches(normalized, /^\s*#include\s+/gm);
  const rawPointerCount = countMatches(normalized, /\b[A-Za-z_][\w:<>]*\s*\*\s*[A-Za-z_]\w*/g);
  const newCount = countMatches(normalized, /\bnew\s+[A-Za-z_]/g);
  const deleteCount = countMatches(normalized, /\bdelete\s+[A-Za-z_]/g);
  const uniquePtrCount = countMatches(normalized, /\bunique_ptr\b/g);
  const sharedPtrCount = countMatches(normalized, /\bshared_ptr\b/g);
  const weakPtrCount = countMatches(normalized, /\bweak_ptr\b/g);
  const namespaceCount = countMatches(normalized, /^\s*namespace\s+[A-Za-z_]\w*/gm);
  const todoCount = countMatches(normalized, /TODO|FIXME|HACK/g);
  const findings = buildFindings(lines, normalized);

  const pointerPenalty = rawPointerCount * 12 + newCount * 15 + deleteCount * 16;
  const smartPointerBonus = (uniquePtrCount * 10) + (sharedPtrCount * 8) + (weakPtrCount * 6);
  const structureBase = 78 + (classCount * 4) + (functionCount * 2) - todoCount * 3 - Math.max(0, blankLines - 8);
  const structureScore = clamp(Math.round(structureBase - pointerPenalty / 6 + smartPointerBonus / 4), 0, 100);
  const modernizationScore = clamp(Math.round(100 - pointerPenalty + smartPointerBonus), 0, 100);

  const suggestions = [];
  if (rawPointerCount || newCount || deleteCount) {
    suggestions.push('Replace manual ownership with RAII types such as `std::unique_ptr` or `std::shared_ptr`.');
  }
  if (classCount && functionCount) {
    suggestions.push('Keep class declarations and behavior in separate declaration and implementation zones.');
  }
  if (!includeCount) {
    suggestions.push('Add the required headers explicitly so dependencies stay visible.');
  }
  if (!suggestions.length) {
    suggestions.push('The file is already small enough to inspect directly; no major rewrite is implied.');
  }

  const digest = crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 12);
  const summary = `${sourceName} produced ${classCount} class declaration(s), ${functionCount} function candidate(s), and ${findings.length} finding(s).`;
  const annotations = buildAnnotations({
    sourceName,
    lines,
    findings,
    lineCount,
    classCount,
    functionCount,
    includeCount,
    structureScore,
    modernizationScore,
    suggestions
  });
  const commentedCode = buildCommentedCode(normalized, annotations);
  const commentsOnly = buildCommentsOnly({
    sourceName,
    annotations,
    analysis: {
      structureScore,
      modernizationScore
    }
  });
  const pipeline = buildPipeline({
    sourceName,
    lineCount,
    classCount,
    functionCount,
    includeCount,
    structureScore,
    modernizationScore,
    findings
  });
  const transformedPreview = [
    `// Analysis digest: ${digest}`,
    `// Structure score: ${structureScore}/100`,
    `// Modernization score: ${modernizationScore}/100`,
    `// Suggested direction: ${suggestions[0]}`,
    '',
    safePreview(commentedCode)
  ].join('\n');

  return {
    sourceName,
    lineCount,
    charCount,
    blankLines,
    includeCount,
    classCount,
    functionCount,
    rawPointerCount,
    newCount,
    deleteCount,
    uniquePtrCount,
    sharedPtrCount,
    weakPtrCount,
    namespaceCount,
    todoCount,
    structureScore,
    modernizationScore,
    findings,
    annotations,
    commentCount: annotations.length,
    suggestions,
    summary,
    pipeline,
    transformedPreview,
    commentedCode,
    commentsOnly
  };
}

function writeAnalysisArtifact({ outputsDir, sourceName, analysis }) {
  const artifactName = `${path.basename(sourceName, path.extname(sourceName)) || 'analysis'}-${Date.now()}.json`;
  const artifactPath = path.join(outputsDir, artifactName);
  fs.writeFileSync(artifactPath, JSON.stringify(analysis, null, 2), 'utf8');
  return artifactPath;
}

module.exports = {
  analyzeSource,
  writeAnalysisArtifact,
  buildCommentedCode,
  buildCommentsOnly,
  buildDownloadFilename
};
