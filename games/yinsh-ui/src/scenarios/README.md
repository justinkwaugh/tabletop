# YINSH scenarios

The dev harness lists these under **Scenarios**. Alice (White) moves first in each; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/yinsh`.

- **Form a row.** White markers on B3–E3. Choose the ring on F3 and move it anywhere: the marker it leaves completes B3–F3. Tap a marker of the row to take it, then tap one of your rings to take it off; it goes to your first ring space beside the board, and it is Bob's turn.
- **Choose the rows.** Move F3 to F6: F4 and F5 flip, making a run of seven, B4–H4, crossed at F4 by F4–J8. Only B4, H4 and the four crossing-row markers past F4 settle a row on one tap; tap C4 and then G4 to take the middle five. Whichever row you take, the other is broken, so only one ring comes off.
- **Rows for both.** Move F4 to F2: F3 flips to black, completing Bob's B3–F3, and the marker left on F4 completes Alice's B4–F4. Alice takes her row and a ring first; then Bob takes his row and a ring, and moves.
- **Win on a third row.** Alice has taken off two rings. Move F3 to complete B3–F3, take the row and a ring: Alice wins.
- **Blitz row.** The Blitz version: the first row wins. Move F3, take B3–F3 and a ring, and Alice wins.
- **Bob passes.** Bob's three rings fill K8–K10, shut in by Alice's rings on J7–J10 and the marker on K7. Move F3: Bob has no move, so the banner says he cannot move and Alice moves again.
- **Markers run out.** 50 of the 51 markers are on the board, and white markers stand on B3–E3. Move C6 to C7: the marker left on C6 is the last, so the game ends, and Alice wins on rings taken off, one to none. Load it again and move F3 to F4 instead: that last marker completes B3–F3, so once Alice takes the row and a ring the pool holds five markers again and Bob moves.
