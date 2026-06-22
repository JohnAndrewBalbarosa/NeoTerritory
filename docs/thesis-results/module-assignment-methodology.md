# Module Assignment Methodology — Deriving K (Unbiased Balanced Design)

> How non-required modules are distributed across simulated testers so that every
> module is tested an **equal** number of times (no selection bias), with the
> randomization grounded in experimental-design theory rather than ad-hoc shuffling.

## 1. The problem

We must assign **modules** (treatments) to **testers** (subjects). The catalog has
**40 modules**:

| Category | Count | Role |
|---|---|---|
| foundations | 14 (13 formal-eligible; `foundations-postrequisite` is reflection-only) | **REQUIRED** — given to every tester |
| creational | 6 | non-required |
| structural | 8 | non-required |
| behavioural | 11 | non-required |
| idioms | 1 | non-required |
| **non-required total** | **v = 26** | randomly + equally assigned |

- **Required (foundations)** go to **every** tester. Because all testers receive the
  identical required set, this part introduces **zero selection bias** by construction
  — no derivation needed.
- **Non-required (v = 26)** are the part that must be **randomly yet equally** assigned.
  This is where K comes in.

## 2. The design as a combinatorial structure

Model it as a block design:

- `v` = 26 — number of non-required modules (treatments)
- `b` = 10 — number of testers (blocks)
- `r` = replication = how many testers each module is assigned to (**this is K**)
- `k` = block size = how many non-required modules each tester receives

**Conservation of assignments** (count the tester–module incidences two ways):

```
v · r = b · k        →        26 · K = 10 · k
```

Every incidence is counted once from the module side (`v·r`) and once from the
tester side (`b·k`); they must be equal.

## 3. What "most unbiased" would require — and why it's impossible here

The gold standard is a **Balanced Incomplete Block Design (BIBD)**, where not only is
every module replicated equally, but every **pair** of modules co-occurs in the same
number of testers (λ). A BIBD must satisfy:

```
λ · (v − 1) = r · (k − 1)
```

Solve our conservation `26K = 10k` for the smallest integers: `13K = 5k` →
**K = 5, k = 13**. Plug into the BIBD condition:

```
λ = r(k−1)/(v−1) = 5·(13−1) / (26−1) = 60 / 25 = 2.4
```

**λ = 2.4 is not an integer ⇒ NO BIBD exists for v=26, b=10.** Pairwise-perfect
balance is *mathematically impossible* for these numbers. The best attainable design
is therefore a **balanced replication (equireplicate) design**: equal `r` for every
module, randomized otherwise.

## 4. Choosing K (the replication number)

From `26K = 10k`, solve for modules-per-tester `k = 2.6·K`:

| K (testers per module) | k = 2.6K (modules per tester) | Module-side balance | Tester-side balance |
|---|---|---|---|
| **1** | 2.6 → 26 incidences | each module ×1 (every module covered exactly once) | loads 2–3 (near-equal) |
| **2** | 5.2 | each module ×2 | loads 5–6 |
| **3** | 7.8 | each module ×3 | loads 7–8 (8 testers get 8, 2 get 7) |
| **5** | 13 (exact) | each module ×5 | **exactly 13 each — perfect two-sided** |

**Integer-exact two-sided balance only occurs at K = 5 (k = 13)** because tester-side
equality needs `10 | 26K`, i.e. `5 | 13K`, i.e. `5 | K`. For any other K the module
side stays perfectly balanced but tester loads differ by at most 1.

### The realistic-length trade-off
A formal pre/post test of ~50 questions (the validated realistic length) is roughly
**10 module-forms** worth of items. Every tester already carries the 13 required
foundations, so the non-required budget per tester must stay small. Higher K ⇒ more
non-required per tester ⇒ longer-than-realistic tests:

- **K = 5** → 13 non-required/tester → ~26 module-forms → far too long.
- **K = 3** → ~8 non-required/tester → still long but bounded.
- **K = 2** → ~5 non-required/tester → closest to a realistic sitting, every module
  still tested by exactly 2 independent testers (replication ≥ 2 ⇒ variance is
  estimable, no module tested only once).

## 5. Chosen design

**K = 2** (each non-required module assigned to exactly **2** testers; ~5 non-required
modules per tester).

Rationale:
1. **Unbiased by the stated requirement** — every non-required module is tested by the
   *same* number of testers (exactly 2). Module-side balance is perfect.
2. **Replication ≥ 2** — every module has at least two independent observations, so
   per-module statistics are not single-point (defensible for the paper).
3. **Realistic length** — ~5 non-required + the short required foundations forms keeps
   each tester near the validated ~50-question, one-sitting profile.
4. **No BIBD exists** (§3), so pairwise balance is not claimed — only equireplication,
   which is the strongest guarantee available for v=26, b=10.

> If the panel prefers maximal replication over realistic length, switch to **K = 5**
> (perfect two-sided balance, 13 non-required/tester). The generator takes K as a
> parameter; only this constant changes.

## 6. Randomization (so it's reproducible AND unbiased)

The assignment is **constrained random**, not free random:

1. Build a multiset where each of the 26 non-required modules appears exactly **K**
   times (⇒ `26K` slots).
2. Deterministically shuffle the multiset with a **seeded PRNG** (mulberry32, seed
   fixed) — reproducible, auditable, and free of systematic ordering bias.
3. Deal the shuffled slots round-robin to the 10 testers, skipping a tester if it would
   receive the same module twice. Tester loads differ by ≤ 1 by construction.

**Verification (must hold in the output CSV):** for every non-required module,
`tester_count == K`. Required foundations appear for all 10 testers. These two
invariants are asserted by the generator and printed in the results worksheet.
