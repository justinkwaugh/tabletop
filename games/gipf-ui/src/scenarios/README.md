# GIPF scenarios

The dev harness lists these under **Scenarios**. Each is a Standard game with White to move; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/gipf`.

- **Take a row.** White singles on D3, D4 and D5, with a black single on D6 and a black GIPF-piece on D7. Push in from D1 onto D2: White's row D2–D5 is complete and its reach runs on over D6 and D7. The four white pieces and the black single are marked to go; the black GIPF-piece is marked to go too and can be tapped to keep it. Take the row: White gets 4 back and captures 3 (the GIPF-piece counts as two), and Black lost a GIPF-piece.
- **Crossing rows.** Push in from A3 onto B4: it completes White's row B4–E4 across (with a white GIPF-piece on D4) and the diagonal B4–E7. Choose either; taking one breaks the other, so only one is taken. Tap B4 again to switch between them.
