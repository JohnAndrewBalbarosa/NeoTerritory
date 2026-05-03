# NeoTerritory scraper (local-only)

Manual-driven web scraper. Lives entirely under `playwright-scratch/`.
Nothing here ships with the website.

```
playwright-scratch/scraper/
  README.md
  package.json
  run.mjs       host process — opens headed Chromium at about:blank
  overlay.js    injected picker UI (Step 0 person, then 3-step pick)
  distill.mjs   disposable post-processor — strips FB junk, picks top JPGs
```

## Run

From the repo root:

```
npm run dev:scraper
```

No URL flag. A blank Chromium window opens; you navigate it yourself.

## Flow

1. Chromium opens at `about:blank`. The overlay (top-right) shows
   **Step 0 — for whom?**.
2. **Type a person's name** (e.g. `drew`, `juan_dela_cruz`) and press
   Continue. A folder `playwright-scratch/scraper-output/<slug>/<runId>/`
   is created. The slug strips spaces and special characters.
3. Browse Chromium to the page you want.
4. Click **Start scraping**.
5. **Step 1 — pick a div.** Hover the page; the nearest post-like
   block highlights. Click to pick.
6. **Step 2 — include images?** Yes / No.
7. **Step 3 — proceed?** Shows person, selector path, image choice.
   Proceed writes one post folder; Cancel discards the pick.
8. Overlay returns to idle. Click **Start scraping** again for the
   next div, or click **change** in the header to switch person.

Close the Chromium window to stop.

## Output

```
playwright-scratch/scraper-output/<person_slug>/<run_id>/
  run.json                    person + start time
  001/post.json               text + image_paths + source_url + selector + person
  001/01.jpg                  (only when "include images" was Yes)
  002/post.json
  ...
```

Post numbering continues across runs per person — picking three posts
in run A then two in run B yields `001..003` in A and `004..005` in B,
so no collisions between runs of the same person.

The `playwright-scratch/` folder is gitignored, so cookies and scraped
content cannot be committed.

## Distill (text + image cleanup)

After capturing, run:

```
node playwright-scratch/scraper/distill.mjs            # all persons
node playwright-scratch/scraper/distill.mjs andrew     # one person
```

For each person:
- Strips FB chrome (`Facebook` x33, single-character date glyphs,
  Like/Comment/Share/Reply, reactor-name lists, time markers, etc.)
- Writes `playwright-scratch/scraper-output/<slug>/distilled.{json,md}`
  with the cleaned post bodies and a `top_images` list.
- Picks the 8 largest JPGs in the FB-post-photo size range
  (25 KB–900 KB — skips tiny avatars/emoji and oversized covers).
- Copies them to `Codebase/Frontend/public/team/<slug>/01..08.jpg`,
  ready for the About page (`team.json` references `team/<slug>/NN.jpg`).

## Out of scope

- No automated login. You sign in by hand in the Chromium window.
- No CAPTCHA bypass, no IP rotation.
- No production deploy. The website never imports anything from here.
- Facebook/LinkedIn ToS prohibit automated scraping. Account
  checkpointing is a real risk. Use only for accounts whose owners
  have agreed.
