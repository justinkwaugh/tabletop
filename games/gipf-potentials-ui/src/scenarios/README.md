# GIPF with Potentials scenarios

The dev harness lists these under **Scenarios**. Each starts with White to move; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/gipf-potentials`.

- **Potentials.** Ultimate, every kind loaded and ready. ZÈRTZ on C4 jumps D4 and E4 to F3 (or C5 to C6); DVONN on D6 covers Black's piece on E6; PÜNCT on G3 covers Black's GIPF-piece on H2; YINSH on E3 slides; TAMSK on C5 has no move of its own and shows no ring.
- **DVONN targets.** DVONN on D6 may cover Black's plain pieces on E6 and E7 and Black's used DVONN on White's piece on D5, but not Black's GIPF-piece on C6 or TAMSK-loaded piece on D7.
- **PÜNCT cover.** PÜNCT on G3 covers Black's GIPF-piece on H2, asking whether one piece or two from the reserve go on it, or Black's PÜNCT-loaded piece on G4.
- **Cover the last GIPF.** Black's last GIPF-piece is on H2. Covered with one piece, that piece completes White's row E5–H2 and must be taken with it, freeing the GIPF-piece: play goes on. Covered with two, the new GIPF-piece may stay in the row: White wins at the end of the turn.
- **TAMSK extra move.** Push in from E1 onto E2: E2–E4 move up a spot, putting White's TAMSK-loaded piece on E5 and lining up E2–E5. The extra move comes first (Skip loses the potential); the row is taken after it.
- **Black's TAMSK.** The same push puts Black's TAMSK-loaded piece on E5: Black's turn opens with the extra move.
- **Take a row.** Push in from E1 onto E2: White's row E2–E5 reaches over Black's DVONN-loaded piece on E6, plain piece on E7 and GIPF-piece on E8. Plain pieces go; GIPF-pieces and loaded pieces may stay, White's starting kept and Black's marked for removal, each tapped to switch.
- **Break the four.** Push a loaded piece in from E1: E2–E5 is a four of GIPF-pieces and loaded pieces, which must be broken, so Take row waits until one of them is marked for removal.
- **Row of GIPF-pieces.** Tournament, White still bringing in GIPF-pieces. Pushing one in from E1 makes E2–E5 a row of GIPF-pieces alone: Take row or Leave it standing.
- **Uncovered row.** Push in from E1 and take the row E2–E5: it captures Black's DVONN on E6, freeing White's piece under it, which completes E6–H3. White takes that row too before the turn passes.
- **Last GIPF piece.** Black's last GIPF-piece is on E6. Push in from E1 and take the row: it captures the piece and White wins.
- **GIPF piece out of reach.** The near miss: Black's last GIPF-piece is on E7, past the empty E6; the row is taken and play goes on.
- **Out of moves.** Black has no piece in reserve and no loaded piece on the board. Any White move ends the game: Black has no move left.
- **One move left.** The near miss: Black's ZÈRTZ-loaded piece on G3 can still jump White's piece on G4, so Black plays on.
