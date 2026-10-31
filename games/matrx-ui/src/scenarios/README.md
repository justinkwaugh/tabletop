# MATRX GIPF scenarios

The dev harness lists these under **Scenarios**. Each starts with White to move, every GIPF piece already in play unless noted; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/matrx`.

- **Potentials.** One of each potential with a move to make. ZÈRTZ on C4 jumps D4 and E4 to F3 (or C5 to C6); DVONN on D6 covers Black's DVONN stack on G4 across the empty E6 and F5; PÜNCT on H2 covers Black's PÜNCT stack on F4; YINSH on E3 slides; TAMSK on C5 has no move of its own and shows no ring.
- **Tamsk extra move.** Push in from E1 onto E2: E2–E4 move up a spot, putting White's TAMSK stack on E5. White gets an extra move with its top piece (or Skip, which takes that piece out of the game) before the row E4–E7 is taken.
- **Their tamsk.** The same push puts Black's TAMSK stack on E5: Black's turn opens with the extra move.
- **Take a row.** Push in from E1 onto E2: White's row E2–E5 reaches over Black's ZÈRTZ stack on E6 and single on E7. Singles go; White's stacks of two (E2, E3) start left and Black's (E6) marked for removal, each tapped to switch, and Take row stays disabled while every spot of the row of four is kept.
- **Uncovered row.** Push in from E1 onto E2 and take the row E2–E5: its reach captures Black's DVONN piece on E6, uncovering White's DVONN stack, which completes D6–G4. White must take that row too before the turn passes.
- **Last gipf piece.** Black has one GIPF piece left, on E6. Push in from E1 onto E2 and take the row: it captures the piece and White wins.
- **Gipf piece out of reach.** The near miss: Black's last GIPF piece is on E7, past the empty E6; the row is taken and play goes on.
- **Out of moves.** Black has no stack in reserve and no stack of two on the board. Any White move ends the game: Black has no move left.
- **One move left.** The near miss: Black's YINSH stack on G3 can still slide, so Black plays on.
- **Gipf board.** The game on GIPF's own 37-spot board, with ZÈRTZ, YINSH and PÜNCT stacks to move.
