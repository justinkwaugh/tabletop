import { RING_HOLE, RING_THICKNESS } from './pieceShape.js'

// Every size is a fraction of the spacing between neighbouring points. Neighbouring rings are
// the tightest pair.
export const SPACING_UNIT = 60
export const RING_OUTER = SPACING_UNIT * 0.46
export const RING_INNER = RING_OUTER * RING_HOLE
// A marker fits inside a ring, as it does when it is put in the ring at the start of a move.
export const MARKER_RADIUS = RING_INNER - 2
// How tall each piece stands on the board: a marker's blue lip as tall as a ring.
export const RING_HEIGHT = RING_OUTER * RING_THICKNESS
export const MARKER_HEIGHT = RING_HEIGHT
