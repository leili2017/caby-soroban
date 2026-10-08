# Interactive Soroban

A single-file, dependency-free web app for learning the Japanese abacus (soroban).
Open `abacus.html` in any browser. There is no server, build step, or install.

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
node test/harness.js
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
