# Interactive Soroban

Two apps live in this repo. Both are static files with no server, build step, or install.

| App | Path | For |
|---|---|---|
| **Capy Soroban** | `kids/index.html` | A young child learning the soroban, with a capybara guide. Spoken prompts, no reading needed. Built to run alongside a physical abacus. |
| **Adult walkthroughs** | `abacus.html` | Worked examples and a guided challenge for add, subtract, multiply, and divide. |

## Capy Soroban (kids/)

Files: `soroban.js` (bead logic and SVG abacus), `lessons.js` (lesson data), `runner.js`
(session scoring and saved progress), `app.js` (screens, speech, parent area), `style.css`.

Lessons are data. To add one, append an entry to `LESSONS` in `lessons.js` with an `id`,
`module`, `rods`, `count`, `mastery`, and a `gen(rng)` function that returns its items.

- **Module 1, Meet the soroban:** parts, bottom beads (0 to 4), top bead (5 to 9), reading one rod.
- **Module 2, Tens and ones:** tens, tens and ones together, reading two rods, counting up and down.
- **Scoring:** only first-try answers count. A missed item comes back once at the end as practice.
  A lesson opens once the previous one is passed.
- **Hint:** after two misses on one item, dotted circles show where the beads go.
- **Parent area:** press and hold the small gear for about 1.2 seconds. Shows plays and best
  scores, and can show the answer, skip an item, toggle sound, unlock all lessons, or reset.
- **Progress** is saved in the browser (`localStorage`), per device. Speech uses the browser's
  built-in voice.

To use it on an iPad, open `kids/index.html` through Safari (for example via AirDrop and Files, or
static hosting). Add to Home Screen for a full-screen app.

## Adult walkthroughs (abacus.html)

## Modes

| Tab | What it does |
|---|---|
| **Free play** | Click beads to set and read numbers. |
| **58 + 67** | Walkthrough: addition with two carries (friends of 10). |
| **125 − 67** | Walkthrough: subtraction with two borrows. |
| **23 × 14** | Walkthrough: multiplication with multiplicand, multiplier, and product zones. |
| **322 ÷ 14** | Walkthrough: division with quotient and dividend zones. |
| **Guided challenge** | Random add, subtract, multiply, or divide problems with per-step checking. |

## Guided challenge

- **Check ✓** verifies the current step. Add and subtract have one step per nonzero digit
  of the second number, multiply has one step per digit pair, and divide has four scoop steps.
- **Check final answer** skips the steps if you set the full result in the answer zone.
- **Level slider (1 to 5)** sets difficulty. The level also adapts: a clean solve moves it
  up, and two or more wrong checks move it down.
- **New problem** generates a fresh problem at the current level.

## Reading the abacus

A bead counts only when it touches the center bar. Each lower bead is worth 1 and the
upper bead is worth 5. Rods are place values, with ones on the right. Colored bands mark
the zones for each operation.

## Tests

The logic can be checked headlessly with Node (no browser needed):

```sh
node test/harness.js     # adult app: 1,500 generated problems
node test/kids.test.js   # kids app: bead logic, lesson data, scoring, saved progress
```

It loads the page script against a stubbed DOM, generates 1,500 problems across all
levels and operations, solves each step as a correct user would, and checks that the
answers are accepted, bad input is rejected, and the final-answer shortcut works.
It does not cover visuals or layout, so check those in a browser.

## Known limitations

- Level and progress are not saved. They reset on reload.
- Add, subtract, and multiply check the running total after each step, not the individual
  bead moves.
- Division problems always divide evenly, with a single-digit divisor and a two-digit quotient.
