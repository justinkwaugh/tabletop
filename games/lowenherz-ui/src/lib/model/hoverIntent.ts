// How long the pointer has to rest on something before a hover affordance appears, so a
// cursor merely crossing the table triggers nothing. The board's town names wait twice as
// long as an enlarged politics card: they light up the whole board at once, which wants more
// certainty that the player is actually looking.
export const HOVER_INTENT_MS = 200
export const BOARD_HOVER_INTENT_MS = 2 * HOVER_INTENT_MS
