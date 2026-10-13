import { MAP_FILE_SCALE } from '$lib/map/battlefield.js'

// Measured on the designer's public map file, in its points; measure again if the board art changes.
export const TRACK_COLUMN_PITCH = 63.72
const MARKER_RADIUS = 13
// A box of the Morale and Time tracks prints its number or hour in the half nearer the map's west edge.
export const CLEAR_OF_THE_PRINT = 14.25

export const TRACK_MARKER_RADIUS = MARKER_RADIUS * MAP_FILE_SCALE
