// Every size is a fraction of the spacing between neighbouring points. Neighbouring rings are
// the tightest pair.
export const SPACING_UNIT = 60
export const RING_OUTER = SPACING_UNIT * 0.46
export const RING_INNER = RING_OUTER * 0.66
// A marker fits inside a ring, as it does when it is put in the ring at the start of a move.
export const MARKER_RADIUS = RING_INNER - 2.2
// The side seen below the top face, so pieces look raised.
export const RING_SIDE = 4
export const MARKER_SIDE = 3
// The marker's face inside its blue lip.
export const MARKER_FACE = 0.9
