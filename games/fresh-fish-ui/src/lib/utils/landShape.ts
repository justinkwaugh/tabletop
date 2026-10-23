import { CellType, type Cell } from '@tabletop/fresh-fish'

export const CELL_SIZE = 100
const CORNER_RADIUS = 12

// The land's shadow, as CSS drop-shadow(0 8px 12px rgba(0, 0, 0, 0.5)) drew it: a 12px blur
// radius is a standard deviation of 6.
const SHADOW_OFFSET_Y = 8
const SHADOW_DEVIATION = 6
const SHADOW_OPACITY = 0.5
// Room around the land for the blur and the offset to fade out in.
export const SHADOW_MARGIN = 32

/** Top-left, top-right, bottom-right and bottom-left radii of a square's corners. */
export type CornerRadii = [number, number, number, number]

function isLand(cells: Cell[][], x: number, y: number): boolean {
    const cell = cells[y]?.[x]
    return cell !== undefined && cell.type !== CellType.OffBoard
}

/**
 * The land rounds a square's corner where both squares beside it, along the corner's two
 * sides, are off the board.
 */
export function landCornerRadii(cells: Cell[][], [x, y]: [number, number]): CornerRadii {
    if (!isLand(cells, x, y)) return [0, 0, 0, 0]
    const radiusToward = (dx: number, dy: number) =>
        !isLand(cells, x + dx, y) && !isLand(cells, x, y + dy) ? CORNER_RADIUS : 0
    return [radiusToward(-1, -1), radiusToward(1, -1), radiusToward(1, 1), radiusToward(-1, 1)]
}

function squarePath(left: number, top: number, [tl, tr, br, bl]: CornerRadii): string {
    const right = left + CELL_SIZE
    const bottom = top + CELL_SIZE
    return (
        `M${left + tl} ${top}H${right - tr}A${tr} ${tr} 0 0 1 ${right} ${top + tr}` +
        `V${bottom - br}A${br} ${br} 0 0 1 ${right - br} ${bottom}` +
        `H${left + bl}A${bl} ${bl} 0 0 1 ${left} ${bottom - bl}` +
        `V${top + tl}A${tl} ${tl} 0 0 1 ${left + tl} ${top}Z`
    )
}

/**
 * The shadow the land casts, as an SVG image the size of the board plus SHADOW_MARGIN on every
 * side. Being an image, it is drawn once at its size on screen, where a CSS filter over the
 * land draws the whole board again offscreen at device resolution whenever anything on it
 * changes.
 */
export function landShadowImage(cells: Cell[][]): string {
    const width = (cells[0]?.length ?? 0) * CELL_SIZE + 2 * SHADOW_MARGIN
    const height = cells.length * CELL_SIZE + 2 * SHADOW_MARGIN
    const squares = cells.flatMap((row, y) =>
        row.flatMap((_, x) =>
            isLand(cells, x, y)
                ? [
                      squarePath(
                          SHADOW_MARGIN + x * CELL_SIZE,
                          SHADOW_MARGIN + y * CELL_SIZE,
                          landCornerRadii(cells, [x, y])
                      )
                  ]
                : []
        )
    )
    // The squares are filled opaque and only the blurred whole made translucent, so no seam
    // shows where neighbouring squares meet.
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
        `<filter id="s" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">` +
        `<feGaussianBlur stdDeviation="${SHADOW_DEVIATION}"/>` +
        `<feOffset dy="${SHADOW_OFFSET_Y}"/>` +
        `<feComponentTransfer><feFuncA type="linear" slope="${SHADOW_OPACITY}"/></feComponentTransfer>` +
        `</filter>` +
        `<path filter="url(#s)" d="${squares.join('')}"/>` +
        `</svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
