import { AnalysisRun, DetectedPatternFull, Annotation } from '../types/api';
import { patternDefinitionFor } from '../data/patternDefinitions';

// ── Family metadata ───────────────────────────────────────────────────────────

const FAMILY_PREFIX_MAP: Record<string, string> = {
  creational:  'Creational',
  structural:  'Structural',
  behavioural: 'Behavioral',
  behavioral:  'Behavioral',
};

export const FAMILY_DESCRIPTIONS: Record<string, string> = {
  Creational: 'Creational patterns control how objects are created. Focus on who builds objects, how they are configured, and whether instances are shared or unique. Key questions: Can there be multiple instances? Who decides what concrete type to make?',
  Structural: 'Structural patterns describe how classes and objects are composed to form larger structures. Focus on wrapping, adapting, and delegating to build new capabilities from existing parts without changing their source code.',
  Behavioral: 'Behavioral patterns define communication between objects and how responsibility is distributed. Focus on algorithms, notification chains, and traversal strategies. Key question: Who knows what, and who tells whom?',
};

export const FAMILY_ORDER = ['Creational', 'Structural', 'Behavioral', 'Other'];

export function familyOf(patternId: string): string {
  const prefix = patternId.split('.')[0]?.toLowerCase() ?? '';
  return FAMILY_PREFIX_MAP[prefix] ?? 'Other';
}

export function groupByFamily(
  patterns: DetectedPatternFull[]
): Record<string, DetectedPatternFull[]> {
  return patterns.reduce<Record<string, DetectedPatternFull[]>>((acc, p) => {
    const fam = familyOf(p.patternId);
    if (!acc[fam]) acc[fam] = [];
    acc[fam].push(p);
    return acc;
  }, {});
}

// ── Annotation classification ─────────────────────────────────────────────────

export function isAiAnnotation(a: Annotation): boolean {
  return a.stage === 'ai_commentary';
}

export function annotationsForPattern(
  annotations: Annotation[],
  p: DetectedPatternFull
): { static: Annotation[]; ai: Annotation[] } {
  const leaf = p.patternId.split('.').pop()?.toLowerCase() ?? '';
  const related = annotations.filter(a => {
    // Match by patternKey (full id, leaf, or pattern name)
    if (a.patternKey) {
      const k = a.patternKey.toLowerCase();
      if (
        k === p.patternId.toLowerCase() ||
        k === leaf ||
        k === p.patternName.toLowerCase()
      ) return true;
    }
    // Match by className when no patternKey exists
    if (!a.patternKey && a.className && p.className) {
      return a.className === p.className;
    }
    return false;
  });
  return {
    static: related.filter(a => !isAiAnnotation(a)),
    ai:     related.filter(isAiAnnotation),
  };
}

// ── Markdown generation ───────────────────────────────────────────────────────

export function generateMarkdown(run: AnalysisRun): string {
  const lines: string[] = [];
  const primaryFile = run.files?.[0]?.name ?? run.sourceName ?? 'source.cpp';

  lines.push('# NeoTerritory Code Documentation');
  lines.push('');
  lines.push(`**File**: \`${primaryFile}\``);
  lines.push(`**Patterns detected**: ${run.detectedPatterns.length}`);
  lines.push(`**Generated**: ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  const groups = groupByFamily(run.detectedPatterns);

  for (const fam of FAMILY_ORDER) {
    const patterns = groups[fam];
    if (!patterns?.length) continue;

    lines.push(`## ${fam} Patterns`);
    lines.push('');
    const desc = FAMILY_DESCRIPTIONS[fam];
    if (desc) lines.push(`> ${desc}`);
    lines.push('');

    for (const p of patterns) {
      const classPart = p.className ? ` — \`${p.className}\`` : '';
      lines.push(`### ${p.patternName}${classPart}`);
      lines.push('');

      const def = patternDefinitionFor(p.patternName);
      if (def) {
        lines.push(`**What is it?** ${def.oneLiner}`);
        lines.push('');
        lines.push(`**When to use**: ${def.whenToUse}`);
        if (def.realWorldAnalogy) lines.push(`**Analogy**: ${def.realWorldAnalogy}`);
        if (def.watchOuts)        lines.push(`**Watch out**: ${def.watchOuts}`);
        lines.push('');
      }

      if (p.patternEducation) {
        lines.push('#### AI Analysis');
        lines.push('');
        lines.push(p.patternEducation.explanation);
        lines.push('');
        lines.push(`*Why it fired*: ${p.patternEducation.whyThisFired}`);
        lines.push(`*Study hint*: ${p.patternEducation.studyHint}`);
        lines.push('');
      }

      const { static: stAnns, ai: aiAnns } = annotationsForPattern(run.annotations, p);

      if (stAnns.length > 0) {
        lines.push('#### Static Documentation');
        lines.push('');
        for (const a of stAnns) {
          const loc = a.line ? ` (L${a.line})` : '';
          lines.push(`- **[Static]** **${a.title}**${loc}: ${a.comment}`);
        }
        lines.push('');
      }

      if (aiAnns.length > 0) {
        lines.push('#### AI-Generated Notes');
        lines.push('');
        for (const a of aiAnns) {
          const loc = a.line ? ` (L${a.line})` : '';
          lines.push(`- **[AI]** **${a.title}**${loc}: ${a.comment}`);
        }
        lines.push('');
      }

      if (p.unitTestTargets.length > 0) {
        lines.push('#### Unit Tests to Implement');
        lines.push('');
        for (const t of p.unitTestTargets) {
          lines.push(`- [ ] \`${t.function_name}\` (L${t.line}) — *${t.branch_kind}*`);
        }
        lines.push('');
      }

      if (p.documentationTargets.length > 0) {
        lines.push('#### Documentation Targets');
        lines.push('');
        for (const t of p.documentationTargets) {
          lines.push(`- **${t.label}** (L${t.line}): \`${t.lexeme}\``);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ── Download helpers ──────────────────────────────────────────────────────────

function blobDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

function baseName(run: AnalysisRun): string {
  return (run.files?.[0]?.name ?? run.sourceName ?? 'documentation').replace(/\.[^.]+$/, '');
}

export function downloadMarkdown(run: AnalysisRun): void {
  blobDownload(generateMarkdown(run), `${baseName(run)}-documentation.md`, 'text/markdown');
}

// Word opens HTML files saved as .doc without any extra npm dependency.
export function downloadDocx(run: AnalysisRun, bodyHtml: string): void {
  const full = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<title>Documentation</title>
<style>
  body{font-family:Calibri,Arial,sans-serif;font-size:11pt;margin:2cm;color:#1a1a1a}
  h1{font-size:20pt;color:#1a56db;border-bottom:2px solid #1a56db;padding-bottom:6pt}
  h2{font-size:15pt;color:#374151;margin-top:20pt}
  h3{font-size:12pt;color:#1f2937;margin-top:14pt}
  h4{font-size:10pt;color:#6b7280;margin-top:10pt}
  .badge-static{background:#dbeafe;color:#1e40af;padding:1pt 5pt;border-radius:3pt;font-size:8pt}
  .badge-ai{background:#f3e8ff;color:#7e22ce;padding:1pt 5pt;border-radius:3pt;font-size:8pt}
  .family-desc{color:#6b7280;font-style:italic;border-left:3pt solid #d1d5db;padding-left:10pt;margin:6pt 0}
  code{font-family:'Courier New',monospace;background:#f3f4f6;padding:0 3pt}
  .docs-line-ref{color:#9ca3af;font-size:9pt;margin:0 4pt}
  .docs-branch{color:#6b7280;font-size:9pt;font-style:italic}
  hr{border:none;border-top:1pt solid #e5e7eb;margin:12pt 0}
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
  blobDownload(full, `${baseName(run)}-documentation.doc`, 'application/msword');
}

export function triggerPdfPrint(el: HTMLElement | null): void {
  if (!el) return;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html>
<html>
<head>
<title>Documentation</title>
<style>
  body{font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:20px;color:#1a1a1a}
  h1{font-size:22px;color:#1a56db;border-bottom:2px solid #1a56db}
  h2{font-size:17px;color:#374151;margin-top:28px}
  h3{font-size:13px;color:#1f2937;margin-top:18px}
  h4{font-size:11px;color:#6b7280;margin-top:12px}
  .badge-static{background:#dbeafe;color:#1e40af;padding:1px 8px;border-radius:9999px;font-size:10px}
  .badge-ai{background:#f3e8ff;color:#7e22ce;padding:1px 8px;border-radius:9999px;font-size:10px}
  .family-desc{color:#6b7280;font-style:italic;border-left:3px solid #d1d5db;padding-left:12px}
  code{font-family:'Courier New',monospace;background:#f3f4f6;padding:0 3px;font-size:11px}
  .docs-line-ref{color:#9ca3af;font-size:10px;margin:0 4px}
  .docs-branch{color:#6b7280;font-size:10px;font-style:italic}
  @page{margin:2cm}
</style>
</head>
<body>${el.innerHTML}</body>
</html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
