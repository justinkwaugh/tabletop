export const BOAT_SOURCE_WIDTH = 252.52
export const BOAT_SOURCE_HEIGHT = 63.16
export const BOAT_ASPECT_RATIO = BOAT_SOURCE_WIDTH / BOAT_SOURCE_HEIGHT
export const DEFAULT_BOAT_RENDER_WIDTH = 195.05
export const DEFAULT_BOAT_RENDER_HEIGHT = DEFAULT_BOAT_RENDER_WIDTH / BOAT_ASPECT_RATIO

// Boat art points left at SVG rotation 0, while navigation headings use 0 = right.
export function boatHeadingToRenderRotation(headingRadians: number): number {
    return (headingRadians * 180) / Math.PI + 180
}
