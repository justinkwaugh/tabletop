# Tournament starting positions

Santiago supports assigned starting positions for 3–5 players. Position 0 is the initial canal overseer, and the remaining positions proceed clockwise. With manual spring placement, position 0 places the spring. First-round bidding starts at position 1 and ends at position 0. Subsequent overseers and bidding order follow normal gameplay.

Assignments control the clockwise turn order and stable display seat order. Initialization still consumes the ordinary turn-order shuffle and overseer draw, preserving seeded board setup, colors, and tile order. Without an assignment, initialization retains its existing randomized behavior.

Rebuild and publish Santiago's Logic and matching UI Artifacts to adopt this capability. No state schema or host bridge change is required.
