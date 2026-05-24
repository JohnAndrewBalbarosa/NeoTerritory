import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import db from '../db/database';
import { assembledCatalogsDir } from '../config/paths';
import { getDefaultCatalog } from './classDeclarationAnalysisService';

// ── Catalog assembly ────────────────────────────────────────────────────────
//
// At analysis time the parser is pointed at a `--catalog` directory. To keep
// the on-disk default (GoF) catalog PRISTINE while still honouring per-org
// enable/disable toggles and custom uploaded groups, we assemble a per-org
// effective catalog into a content-addressed cache dir and pass THAT to the
// binary. The default catalog is only ever read FROM, never written into.
//
// Layout produced:
//   <root>/lexeme_categories.json           (always copied from default)
//   <root>/inheritance_driven_patterns.json (always copied from default)
//   <root>/<family>/<file>.json             (surviving default patterns)
//   <root>/<family>/<file>.fallback_doc.json
//   <root>/<family>/<pattern>/...           (subclass child catalogs)
//   <root>/custom/<safeId>__<groupId>.json  (surviving custom patterns)
//   <root>/.assembled.ok                     (written last = ready marker)

const FAMILIES = ['creational', 'structural', 'behavioural', 'idiom'];
const SIDECARS = ['lexeme_categories.json', 'inheritance_driven_patterns.json'];
const READY_MARKER = '.assembled.ok';

// In-memory epoch the routes can bump after a write. The hash-dir scheme is
// the real correctness mechanism (config change → new hash → fresh assembly);
// the epoch only exists to invalidate the optional disk-scan caches below.
let catalogEpoch = 0;
export function bumpCatalogEpoch(): void {
  catalogEpoch += 1;
  defaultScanCache = null;
}
export function getCatalogEpoch(): number {
  return catalogEpoch;
}

interface DefaultCatalogPattern {
  patternId: string;
  patternName: string;
  patternFamily: string;
  // Absolute source file path of the pattern JSON (depth-1 in default catalog).
  filePath: string;
  family: string;
  fileBase: string; // file name without .json
}

interface DbCatalogRow {
  id: number;
  org_id: string;
  name: string;
  json_payload: string;
  is_active_in_parser: number;
  pattern_enabled_map: string;
  kind: string;
  created_at: string;
}

// ── default-catalog disk scan (cached ~30s) ─────────────────────────────────
let defaultScanCache: { at: number; patterns: DefaultCatalogPattern[] } | null = null;
const DEFAULT_SCAN_TTL_MS = 30_000;

function scanDefaultCatalog(): DefaultCatalogPattern[] {
  const now = Date.now();
  if (defaultScanCache && now - defaultScanCache.at < DEFAULT_SCAN_TTL_MS) {
    return defaultScanCache.patterns;
  }
  const root = getDefaultCatalog();
  const out: DefaultCatalogPattern[] = [];
  for (const family of FAMILIES) {
    const famDir = path.join(root, family);
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(famDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      if (entry.endsWith('.fallback_doc.json')) continue;
      if (SIDECARS.includes(entry)) continue;
      const filePath = path.join(famDir, entry);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
          pattern_id?: unknown;
          pattern_name?: unknown;
          pattern_family?: unknown;
        };
        const patternId = typeof parsed.pattern_id === 'string' ? parsed.pattern_id : '';
        if (!patternId) continue;
        out.push({
          patternId,
          patternName: typeof parsed.pattern_name === 'string' ? parsed.pattern_name : patternId,
          patternFamily: typeof parsed.pattern_family === 'string' ? parsed.pattern_family : family,
          filePath,
          family,
          fileBase: entry.slice(0, -'.json'.length),
        });
      } catch {
        // Bad JSON in the default catalog — skip; the binary diagnoses it too.
      }
    }
  }
  defaultScanCache = { at: now, patterns: out };
  return out;
}

// Public helpers consumed by the admin routes for the GET checklist.
export function listDefaultCatalogPatterns(): Array<{ patternId: string; patternName: string; patternFamily: string }> {
  return scanDefaultCatalog().map((p) => ({
    patternId: p.patternId,
    patternName: p.patternName,
    patternFamily: p.patternFamily,
  }));
}

export function defaultCatalogPatternIds(): Set<string> {
  return new Set(scanDefaultCatalog().map((p) => p.patternId));
}

// ── helpers ─────────────────────────────────────────────────────────────────
function safeSegment(value: string): string {
  return String(value).replace(/[^a-z0-9._-]/gi, '_').slice(0, 200) || 'x';
}

function parseMap(raw: string | null | undefined): Record<string, boolean> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'boolean') out[k] = v;
      }
      return out;
    }
  } catch {
    // fall through
  }
  return {};
}

function parseBundle(raw: string | null | undefined): Array<Record<string, unknown>> {
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw);
    if (Array.isArray(obj)) return obj.filter((e) => e && typeof e === 'object') as Array<Record<string, unknown>>;
  } catch {
    // fall through
  }
  return [];
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function copyFileSafe(src: string, dest: string): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

// ── config snapshot (drives the hash) ───────────────────────────────────────
interface CustomGroupConfig {
  id: number;
  createdAt: string;
  active: boolean;
  enabledMap: Record<string, boolean>;
  bundleHash: string;
  bundle: Array<Record<string, unknown>>;
}

interface OrgConfig {
  defaultActive: boolean;
  defaultDisabledIds: string[];
  customGroups: CustomGroupConfig[];
}

function loadOrgConfig(orgId: string): OrgConfig {
  const rows = db
    .prepare(
      `SELECT id, org_id, name, json_payload, is_active_in_parser, pattern_enabled_map, kind, created_at
       FROM org_pattern_catalogs WHERE org_id = ?`
    )
    .all(orgId) as DbCatalogRow[];

  const defaultRow = rows.find((r) => r.kind === 'default');
  const defaultActive = defaultRow ? defaultRow.is_active_in_parser === 1 : true;
  const defaultMap = parseMap(defaultRow?.pattern_enabled_map);
  const defaultDisabledIds = Object.entries(defaultMap)
    .filter(([, v]) => v === false)
    .map(([k]) => k)
    .sort();

  const customGroups: CustomGroupConfig[] = rows
    .filter((r) => r.kind === 'custom' && r.is_active_in_parser === 1)
    .map((r) => {
      const bundle = parseBundle(r.json_payload);
      return {
        id: r.id,
        createdAt: r.created_at,
        active: true,
        enabledMap: parseMap(r.pattern_enabled_map),
        bundleHash: sha256(r.json_payload || '[]'),
        bundle,
      };
    })
    .sort((a, b) => a.id - b.id);

  return { defaultActive, defaultDisabledIds, customGroups };
}

function configHash(cfg: OrgConfig): string {
  const canonical = JSON.stringify({
    defaultActive: cfg.defaultActive,
    defaultDisabledIds: cfg.defaultDisabledIds,
    customGroups: cfg.customGroups.map((g) => ({
      id: g.id,
      createdAt: g.createdAt,
      active: g.active,
      enabledMap: Object.keys(g.enabledMap)
        .sort()
        .reduce<Record<string, boolean>>((acc, k) => {
          acc[k] = g.enabledMap[k];
          return acc;
        }, {}),
      bundleHash: g.bundleHash,
    })),
  });
  return sha256(canonical);
}

function isPristineConfig(cfg: OrgConfig): boolean {
  return cfg.defaultActive && cfg.defaultDisabledIds.length === 0 && cfg.customGroups.length === 0;
}

// ── build ────────────────────────────────────────────────────────────────────
function buildAssembly(tmpRoot: string, cfg: OrgConfig): void {
  const defaultRoot = getDefaultCatalog();
  fs.mkdirSync(tmpRoot, { recursive: true });

  // Sidecars always travel with the assembled catalog.
  for (const sidecar of SIDECARS) {
    const src = path.join(defaultRoot, sidecar);
    if (fs.existsSync(src)) copyFileSafe(src, path.join(tmpRoot, sidecar));
  }

  // Default GoF patterns (only when the default group is active).
  if (cfg.defaultActive) {
    const disabled = new Set(cfg.defaultDisabledIds);
    for (const p of scanDefaultCatalog()) {
      if (disabled.has(p.patternId)) continue;
      // Pattern JSON.
      copyFileSafe(p.filePath, path.join(tmpRoot, p.family, `${p.fileBase}.json`));
      // Matching fallback_doc sidecar, if present.
      const fallback = path.join(defaultRoot, p.family, `${p.fileBase}.fallback_doc.json`);
      if (fs.existsSync(fallback)) {
        copyFileSafe(fallback, path.join(tmpRoot, p.family, `${p.fileBase}.fallback_doc.json`));
      }
      // Subclass child-catalog dir (loaded on demand for inheritance), if present.
      const childDir = path.join(defaultRoot, p.family, p.fileBase);
      try {
        if (fs.existsSync(childDir) && fs.statSync(childDir).isDirectory()) {
          copyDirRecursive(childDir, path.join(tmpRoot, p.family, p.fileBase));
        }
      } catch {
        // tolerate — child dir is optional.
      }
    }
  }

  // Custom patterns → custom/ subfolder (keyed by their pattern_family field).
  const customDir = path.join(tmpRoot, 'custom');
  for (const group of cfg.customGroups) {
    for (const pattern of group.bundle) {
      const patternId = typeof pattern.pattern_id === 'string' ? pattern.pattern_id : '';
      if (!patternId) continue;
      // Per-pattern enable resolution: group map override > pattern's own `enabled`.
      const mapVal = group.enabledMap[patternId];
      if (mapVal === false) continue;
      if (mapVal === undefined && pattern.enabled === false) continue;
      const fileName = `${safeSegment(patternId)}__${group.id}.json`;
      fs.mkdirSync(customDir, { recursive: true });
      fs.writeFileSync(path.join(customDir, fileName), JSON.stringify(pattern), 'utf8');
    }
  }

  // Ready marker last — its presence is the "fully built" signal.
  fs.writeFileSync(path.join(tmpRoot, READY_MARKER), String(Date.now()), 'utf8');
}

// Best-effort removal of stale sibling hash dirs for an org. Never touches the
// default catalog; guarded so a sweep failure never affects analysis.
function sweepStaleHashDirs(orgDir: string, keepHash: string): void {
  try {
    if (!fs.existsSync(orgDir)) return;
    for (const entry of fs.readdirSync(orgDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === keepHash) continue;
      const dir = path.join(orgDir, entry.name);
      // Defensive: never recurse into / delete the default catalog.
      if (path.resolve(dir) === path.resolve(getDefaultCatalog())) continue;
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // leave it; next sweep retries.
      }
    }
  } catch {
    // ignore
  }
}

// Assemble (or reuse) the effective catalog dir for an org. Returns an absolute
// path suitable for `--catalog`. Returns the pristine default catalog for
// org-less callers or when the org's config is effectively pristine.
export function assembleCatalogForOrg(orgId: string | null): string {
  const defaultRoot = getDefaultCatalog();
  if (!orgId) return defaultRoot;

  const cfg = loadOrgConfig(orgId);
  if (isPristineConfig(cfg)) return defaultRoot;

  const hash = configHash(cfg);
  const orgDir = path.join(assembledCatalogsDir, safeSegment(orgId));
  const root = path.join(orgDir, hash);
  const marker = path.join(root, READY_MARKER);

  if (fs.existsSync(marker)) {
    sweepStaleHashDirs(orgDir, hash);
    return root;
  }

  // Build into a tmp sibling then atomically rename into place.
  fs.mkdirSync(orgDir, { recursive: true });
  const tmpRoot = path.join(orgDir, `.tmp-${hash}-${process.pid}-${Date.now()}`);
  buildAssembly(tmpRoot, cfg);

  try {
    fs.renameSync(tmpRoot, root);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EEXIST' || code === 'ENOTEMPTY') {
      // Lost a race — another build won. Use the existing dir, drop our tmp.
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    } else {
      // Unknown rename failure: clean up tmp and let the caller fall back.
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  sweepStaleHashDirs(orgDir, hash);
  return fs.existsSync(marker) ? root : defaultRoot;
}
