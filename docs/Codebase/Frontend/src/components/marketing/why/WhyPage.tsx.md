# `WhyPage.tsx`

## Sole job

Make the reader self-identify with an industry that pays for readable code, before being asked to learn anything technical. Result-based, not theoretical.

## Audience (per D40)

Touched C++ once in 1st year, ships via AI, doesn't know GoF by name. Cannot be expected to memorize. The page must offload, not pile up.

## Layout (top to bottom)

1. **Eyebrow + headline** — "Readable code is money."
2. **Lede** — one sentence: "Four industries where unreadable AI-written code costs more than missed deadlines."
3. **Four industry panels** — one panel per industry, equal weight, no nesting. Each panel:
   - Icon (single glyph from `components/icons/Icons.tsx`).
   - Industry name.
   - One stat OR one quote (not both).
   - One sentence describing the failure mode for unreadable code in that industry.
4. **Hard-evidence section** — citations 2020–2026 backing the "readable code is money" claim. Each entry: year, headline number, one-paragraph detail, and a verifiable citation (peer-reviewed paper or industry report) linking to the primary source. Covers cost-of-poor-quality (CISQ 2022), developer velocity (McKinsey 2020), DORA recovery time (Google 2023), AI-assist throughput and review pressure (GitHub 2022/2024), design-pattern stability (Ampatzoglou et al. 2020), breach cost amplifiers (IBM 2023), and AI trust gap (Stack Overflow 2024). All colors come from `--nt-mkt-*` tokens so light/dark theme flip handles contrast automatically.
5. **Single CTA** — "Try it now" → `/student-studio` (gated; auth happens there).

## Industries (locked content shape)

- **Quant traders** — Failure mode: misnamed strategy variable in production = real loss. Readable code = audit trail = saved trades.
- **Low-level AI / inference engineers** — Failure mode: AI-written CUDA / C++ kernels need patterns to stay debuggable. Unreadable kernel = silent NaN in production.
- **Embedded programmers** — Failure mode: firmware lives 10 years. The next reader isn't you. Pattern names = shared vocabulary.
- **Students** — Failure mode: the AI-written code passed the deadline. Will it pass code review at the first job? Pattern literacy is the difference.

## Hard rules (per D41 and D42)

- One motion effect maximum on this page. Default: none. Static design.
- No mention of any other page name in body copy. The CTA at the bottom is the only navigation off this surface.
- No pattern names anywhere on this page. Pattern theory lives at `/learn` and `/patterns`, not here.

## Components used

- `MagneticButton` (now non-magnetic per D41) — for the bottom CTA.
- Icons from `components/icons/Icons.tsx`.

## Route

`/why` per D43. Not in top nav; reached from Home bento grid.
