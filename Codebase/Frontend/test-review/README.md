# Review Overlay Test Folder

This folder contains a self-contained copy of the frontend with the review overlay UX enabled.

**To use**: Open `/test-review/index.html` via the backend static server (same origin, so API calls work).

**To remove**: Delete this entire folder. Zero impact on `app.js` or `index.html` in the parent directory.

## What's different

- After a successful analysis, a slide-in overlay panel appears on the right with the per-run review widget.
- The overlay is dismissible but reopenable via the "Rate this run" button.
- The submit button is locked until required rating fields are filled.
- On logout (if at least one analysis was run this session), an end-of-session modal appears before the logout completes.

## Files

- `index.html` — copy of parent `index.html` loading `../styles.css` + `./overlay.css` + `./app-review.js`
- `app-review.js` — copy of parent `app.js` + review overlay additions
- `overlay.css` — review overlay and modal styles only
