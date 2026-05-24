// Pattern-catalog reader for the panelist AI-sample helper.
//
// SEPARATION OF CONCERNS (per project owner): this module ONLY locates and
// reads pattern-catalog JSON from disk. It knows nothing about prompts, the
// AI provider, or how the JSON will be used. The prompt composition lives in
// aiSamplePromptInjector.ts; the orchestration lives in aiSampleService.ts.
import fs from 'fs';
import path from 'path';
import { resolveCatalogPath } from '../classDeclarationAnalysisService';

// Families that hold one JSON file per pattern. `idiom` is singular on disk.
const FAMILY_DIRS = ['creational', 'structural', 'behavioural', 'idiom'] as const;

export interface CatalogPatternSummary {
  patternId: string; // e.g. "structural.adapter"
  patternName: string; // e.g. "Adapter"
  family: string; // e.g. "structural"
}

interface RawPattern {
  pattern_id?: unknown;
  pattern_name?: unknown;
  pattern_family?: unknown;
  enabled?: unknown;
}

function isJsonPatternFile(name: string): boolean {
  return name.endsWith('.json')
    && !name.endsWith('.fallback_doc.json')
    && name !== 'lexeme_categories.json'
    && name !== 'inheritance_driven_patterns.json';
}

// Read + parse one catalog file, returning null on any IO/parse error so a
// single malformed file never breaks enumeration.
function readPatternFile(filePath: string): RawPattern | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as RawPattern;
  } catch {
    return null;
  }
}

// Enumerate the enabled, top-level patterns the panelist can pick from.
// Subclass child catalogs (nested dirs) are skipped — only family/<name>.json.
export function listCatalogPatterns(): CatalogPatternSummary[] {
  const root = resolveCatalogPath();
  const out: CatalogPatternSummary[] = [];
  for (const family of FAMILY_DIRS) {
    const dir = path.join(root, family);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isFile() || !isJsonPatternFile(e.name)) continue;
      const raw = readPatternFile(path.join(dir, e.name));
      if (!raw || raw.enabled === false) continue;
      if (typeof raw.pattern_id !== 'string') continue;
      out.push({
        patternId: raw.pattern_id,
        patternName: typeof raw.pattern_name === 'string' ? raw.pattern_name : raw.pattern_id,
        family: typeof raw.pattern_family === 'string' ? raw.pattern_family : family,
      });
    }
  }
  return out.sort((a, b) =>
    a.family === b.family
      ? a.patternName.localeCompare(b.patternName)
      : a.family.localeCompare(b.family));
}

// Read the raw JSON object for a specific patternId. Returns null when the
// id is unknown. The caller (injector) decides how to serialise it.
export function readPatternJson(patternId: string): Record<string, unknown> | null {
  if (typeof patternId !== 'string' || !/^[a-z_]+\.[a-z_]+$/.test(patternId)) return null;
  const root = resolveCatalogPath();
  for (const family of FAMILY_DIRS) {
    const dir = path.join(root, family);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isFile() || !isJsonPatternFile(e.name)) continue;
      const raw = readPatternFile(path.join(dir, e.name));
      if (raw && raw.pattern_id === patternId) return raw as Record<string, unknown>;
    }
  }
  return null;
}
