/**
 * One knob for everything ScalingWrapper scales as a unit: the board, the rampart frame around it,
 * and the card column beside it.
 *
 * The wrapper only ever scales DOWN - its fit is
 * `Math.min(wrapperWidth / contentWidth, wrapperHeight / contentHeight, 1)` - so anything sized for
 * the smallest window can never grow into the space a larger one offers. The board sat at 660x440
 * for that reason, however much room the layout had, which is also why the zoom controls had no
 * levels to offer (`zoomLevels` is `fitScale === 1 ? 0 : ...`). Sizing the board up and letting the
 * wrapper shrink it is the right way round.
 *
 * These have to travel together. Scaling the board alone would leave the frame thin and the cards
 * small against it, since all three are inside the same transformed subtree.
 */
export const BOARD_SCALE = 1.5

/** Ratio against the original value at BOARD_SCALE 1, so proportions are preserved exactly. */
export const scaled = (atScale1: number) => atScale1 * BOARD_SCALE

/** A board square. 15 x 10 of these (see BOARD_COLS/BOARD_ROWS) plus the frame is the board. */
export const CELL_SIZE = scaled(44)

/**
 * The action-deck column: one card wide. Not scaled by the browser - the card art is 384px, so it
 * has resolution to spare at this width.
 */
export const CARD_COLUMN_WIDTH = scaled(106)
