#!/usr/bin/env node
/* eslint-disable no-console */
// Disposable post-scraper distiller.
//
// Reads scraper-output/<slug>/<runId>/NNN/MMM/{text.txt,post.json,*.jpg|webp|png}
// and produces:
//
//   playwright-scratch/scraper-output/<slug>/distilled.json
//   playwright-scratch/scraper-output/<slug>/distilled.md
//   Codebase/Frontend/public/team/<slug>/NN.jpg   (top picks, copied)
//
// What it strips from text:
//   - "Facebook" (chrome label spam)
//   - FB's per-character obfuscated date glyphs (single chars / single digits / single spaces)
//   - UI: Like / Comment / Share / Reply / View more comments / Send message / etc.
//   - Reactor name lists ("X, Y and N others")
//   - "Shared with Friends/Public", "All reactions:", "See more"
//   - Pure-number lines (reaction/reply counts)
//   - "NNw / NNd / NNy / NNh" time markers
//   - "Comment as <owner>"
//
// Image picker:
//   - .jpg/.jpeg only (FB post photos; ignores .webp UI sprites and .svg
//     icons/profile masks, which dominate the small-file end)
//   - File size between MIN_BYTES and MAX_BYTES — typical FB post photo
//     range, skipping tiny avatars/emoji and oversized hero assets.
//   - Sorted by file size desc, then keeps top N per person.

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';
import {
  mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync, copyFileSync,
} from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const OUT_ROOT = resolve(ROOT, 'playwright-scratch', 'scraper-output');
const PUBLIC_TEAM = resolve(ROOT, 'Codebase', 'Frontend', 'public', 'team');

const TOP_IMAGES_PER_PERSON = 8;
const MIN_BYTES = 25_000;   // ~25 KB — skips tiny avatars/emoji
const MAX_BYTES = 900_000;  // ~900 KB — skips oversized hero/cover photos

const DUD_EXACT = new Set([
  'Facebook',
  'Like', 'Comment', 'Share', 'Reply',
  'Love', 'Haha', 'Wow', 'Sad', 'Care', 'Angry',
  'View more comments', 'Send message',
  'Shared with Friends', 'Shared with Public', 'Shared with Specific friends',
  'All reactions:', 'See more', 'See translation', 'Translate',
  'Photos', 'Videos', 'Live video', 'Photo/video', 'Life update',
  'List view', 'Grid view', 'Posts', 'Filters', 'Manage posts',
  'Most relevant', 'Newest', 'All comments',
  'Hide', 'Hidden by Facebook', 'Author', 'Top fan', 'Top contributor', 'Follow',
  'See all', 'Pinned by', 'admin',
  '·', '—', '–', '...', '…',
  'What’s on your mind?', "What's on your mind?",
]);

const DUD_REGEX = [
  /^[\s·•—–.,…]+$/,                    // pure punctuation/whitespace
  /^.$/,                                // single character (date glyphs)
  /^\d+\s*[wdhmy]$/i,                  // 3w, 12d, 1y, 4h
  /^\d+$/,                              // pure number (counts)
  /^Comment as .+$/i,
  /^.+ and \d+ others?$/i,              // reactor lists
  /^.+, .+ and \d+ others?$/i,
  /^.+, .+, .+ and \d+ others?$/i,
  /^.… See more$/,                      // truncated bodies
  /^.+… See more$/,
  /^All \d+ comments?$/i,
  /^See \d+ more$/i,
  /^\d+\s*reactions?$/i,
  /^View \d+ (previous|more) (comments?|replies)$/i,
  /^Replied to .+$/i,
  /^Active now$/i,
];

function isDud(line) {
  const t = line.trim();
  if (t.length === 0) return true;
  if (DUD_EXACT.has(t)) return true;
  for (const r of DUD_REGEX) if (r.test(t)) return true;
  return false;
}

function cleanText(raw) {
  const lines = raw.split(/\r?\n/);
  const kept = [];
  let lastWasBlank = true;
  for (const line of lines) {
    if (isDud(line)) continue;
    const t = line.trim();
    // Collapse runs of blank lines (we already filter empties via isDud,
    // but keep this for safety if upstream changes).
    if (!t) {
      if (lastWasBlank) continue;
      kept.push('');
      lastWasBlank = true;
      continue;
    }
    kept.push(t);
    lastWasBlank = false;
  }
  return kept.join('\n').trim();
}

// A "post body" usually has 2+ kept lines and at least one substantive
// line (>= 12 chars of letters). The owner name typically appears at
// position 0 of the kept lines.
function summarisePost(cleaned, ownerHint) {
  if (!cleaned) return null;
  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  // Owner name is the first line if it has 2-4 capitalised words; treat
  // any subsequent same-name occurrence as a "share-from" annotation.
  let owner = ownerHint || null;
  let shareFrom = null;
  let bodyStart = 0;

  if (!owner && /^[A-Z][a-zA-Z'’.-]+(?:\s+[A-Z][a-zA-Z'’.-]+){1,4}$/.test(lines[0])) {
    owner = lines[0];
    bodyStart = 1;
  } else if (owner && lines[0] === owner) {
    bodyStart = 1;
  }

  // Detect a second proper-noun line within the first 6 lines that is NOT
  // the owner — that's the source of a shared post (e.g. "Polychroma Games").
  for (let i = bodyStart; i < Math.min(bodyStart + 8, lines.length); i += 1) {
    const l = lines[i];
    if (l === owner) continue;
    if (/^[A-Z][\w &'’.\-]{2,60}$/.test(l) && !/[.!?]$/.test(l)) {
      // Looks like a page/profile name — only treat as shareFrom if the
      // line right before it mentioned an action verb or a date.
      const prev = lines[i - 1] || '';
      if (/Shared|shared|·|See more/.test(prev) || i === bodyStart) {
        shareFrom = l;
        // Strip it from the body.
        lines.splice(i, 1);
      }
      break;
    }
  }

  const body = lines.slice(bodyStart).join('\n').trim();
  if (body.length < 8) return null;
  return { owner, shareFrom, body };
}

function listChildFolders(personDir) {
  // person/<runId>/<NNN>/<MMM>
  const out = [];
  if (!existsSync(personDir)) return out;
  for (const runId of readdirSync(personDir)) {
    const runPath = join(personDir, runId);
    let st; try { st = statSync(runPath); } catch { continue; }
    if (!st.isDirectory()) continue;
    for (const post of readdirSync(runPath)) {
      const postPath = join(runPath, post);
      let st2; try { st2 = statSync(postPath); } catch { continue; }
      if (!st2.isDirectory()) continue;
      for (const child of readdirSync(postPath)) {
        const childPath = join(postPath, child);
        let st3; try { st3 = statSync(childPath); } catch { continue; }
        if (!st3.isDirectory()) continue;
        out.push({ runId, post, child, path: childPath });
      }
    }
  }
  return out;
}

function pickJpgs(childPath) {
  const out = [];
  for (const f of readdirSync(childPath)) {
    if (!/\.(jpe?g)$/i.test(f)) continue;
    const fp = join(childPath, f);
    let st; try { st = statSync(fp); } catch { continue; }
    if (!st.isFile()) continue;
    if (st.size < MIN_BYTES || st.size > MAX_BYTES) continue;
    out.push({ file: fp, size: st.size, name: f });
  }
  return out;
}

function distillPerson(slug) {
  const personDir = resolve(OUT_ROOT, slug);
  if (!existsSync(personDir)) {
    console.error(`[distill] no scraper-output for slug "${slug}"`);
    return null;
  }
  const folders = listChildFolders(personDir);
  if (folders.length === 0) {
    console.error(`[distill] no captured children under ${personDir}`);
    return null;
  }

  // Owner hint: load the run.json or any post.json for person_name.
  let ownerHint = null;
  outer: for (const f of folders) {
    const pj = join(f.path, 'post.json');
    if (!existsSync(pj)) continue;
    try {
      const j = JSON.parse(readFileSync(pj, 'utf8'));
      if (j.person_name) { ownerHint = j.person_name; break outer; }
    } catch { /* ignore */ }
  }

  const posts = [];
  const allImages = [];

  for (const f of folders) {
    const tt = join(f.path, 'text.txt');
    let text = '';
    if (existsSync(tt)) {
      try { text = readFileSync(tt, 'utf8'); } catch { /* ignore */ }
    }
    const cleaned = cleanText(text);
    const summary = summarisePost(cleaned, ownerHint);

    const imgs = pickJpgs(f.path).sort((a, b) => b.size - a.size);

    if (summary || imgs.length > 0) {
      posts.push({
        ref: `${f.runId}/${f.post}/${f.child}`,
        owner: summary?.owner || ownerHint || null,
        share_from: summary?.shareFrom || null,
        body: summary?.body || '',
        body_length: summary?.body.length || 0,
        images: imgs.map((i) => ({ rel: relFromRoot(i.file), size: i.size })),
      });
      for (const i of imgs) allImages.push(i);
    }
  }

  // Top images: dedupe by file size+name signature, sort by size desc,
  // keep top N. Larger == higher resolution for FB JPG posts in practice.
  const seen = new Set();
  allImages.sort((a, b) => b.size - a.size);
  const topImages = [];
  for (const i of allImages) {
    const sig = `${i.size}-${basename(i.file)}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    topImages.push(i);
    if (topImages.length >= TOP_IMAGES_PER_PERSON) break;
  }

  // Copy top images into frontend public dir.
  const destDir = join(PUBLIC_TEAM, slug);
  mkdirSync(destDir, { recursive: true });
  const publicImages = [];
  topImages.forEach((img, idx) => {
    const ext = (img.name.match(/\.[^.]+$/)?.[0] || '.jpg').toLowerCase();
    const destName = `${String(idx + 1).padStart(2, '0')}${ext === '.jpeg' ? '.jpg' : ext}`;
    const dest = join(destDir, destName);
    try {
      copyFileSync(img.file, dest);
      publicImages.push(`team/${slug}/${destName}`);
    } catch (err) {
      console.error(`[distill] copy failed: ${img.file} → ${dest}`, err.message);
    }
  });

  const distilled = {
    person_slug: slug,
    person_name: ownerHint,
    captured_post_count: folders.length,
    cleaned_post_count: posts.filter((p) => p.body_length >= 20).length,
    top_image_count: publicImages.length,
    top_images: publicImages,
    posts,
  };

  writeFileSync(join(personDir, 'distilled.json'), JSON.stringify(distilled, null, 2));
  writeFileSync(join(personDir, 'distilled.md'), renderMarkdown(distilled));

  console.log(
    `[distill] ${slug}: ${distilled.cleaned_post_count} substantive posts, `
    + `${publicImages.length} top images → public/team/${slug}/`
  );
  return distilled;
}

function renderMarkdown(d) {
  const lines = [];
  lines.push(`# ${d.person_name || d.person_slug}`);
  lines.push('');
  lines.push(`- captured posts: ${d.captured_post_count}`);
  lines.push(`- substantive posts after cleaning: ${d.cleaned_post_count}`);
  lines.push(`- top images: ${d.top_image_count}`);
  lines.push('');
  lines.push('## Top images (by size, larger ≈ higher resolution)');
  for (const p of d.top_images) lines.push(`- ${p}`);
  lines.push('');
  lines.push('## Substantive posts');
  for (const p of d.posts) {
    if (p.body_length < 20) continue;
    lines.push('');
    lines.push(`### ${p.ref}`);
    if (p.share_from) lines.push(`*shared from: ${p.share_from}*`);
    lines.push('');
    lines.push(p.body);
  }
  return lines.join('\n');
}

function relFromRoot(p) {
  return p.replace(`${ROOT}\\`, '').replace(`${ROOT}/`, '').replace(/\\/g, '/');
}

const slugs = process.argv.slice(2);
if (slugs.length === 0) {
  // Default: every direct subdir of OUT_ROOT.
  for (const entry of readdirSync(OUT_ROOT)) {
    const p = resolve(OUT_ROOT, entry);
    if (statSync(p).isDirectory()) slugs.push(entry);
  }
}
for (const s of slugs) distillPerson(s);
