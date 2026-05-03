#!/usr/bin/env node
/* eslint-disable no-console */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEAM_PATH = resolve(HERE, '..', 'Codebase', 'Frontend', 'src', 'data', 'team.json');

function handleFromUrl(url) {
  if (!url) return null;
  const m = url.match(/github\.com\/([^/]+)/i);
  return m ? m[1] : null;
}

async function fetchProfile(handle) {
  const res = await fetch(`https://api.github.com/users/${handle}`, {
    headers: { 'User-Agent': 'neoterritory-enrich/1.0' },
  });
  if (res.status === 403) {
    const reset = res.headers.get('x-ratelimit-reset');
    throw new Error(`rate-limited (reset ${reset})`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const raw = await readFile(TEAM_PATH, 'utf8');
  const data = JSON.parse(raw);
  let updated = 0;

  for (const member of data.members) {
    const handle = handleFromUrl(member.links?.github);
    if (!handle) continue;
    try {
      const profile = await fetchProfile(handle);
      if (profile.avatar_url && !member.photoPath) {
        member.photoPath = profile.avatar_url;
      }
      if (profile.bio && member.bio.startsWith('Replace this entry')) {
        member.bio = profile.bio;
      }
      updated += 1;
      console.log(`enriched ${member.slug} from github:${handle}`);
    } catch (err) {
      console.warn(`skip ${member.slug} (github:${handle}): ${err.message}`);
      if (String(err.message).includes('rate-limited')) {
        console.warn('halting; rerun later');
        break;
      }
    }
  }

  await writeFile(TEAM_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`done. ${updated} member(s) enriched. wrote ${TEAM_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
