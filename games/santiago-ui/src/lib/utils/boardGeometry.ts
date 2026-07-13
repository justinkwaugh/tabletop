// Board display size (unscaled) — ScalingWrapper only ever shrinks to fit, never
// upscales, so this needs to already be a reasonable on-screen size.
export const W = 768
export const H = 576

const SCALE_X = W / 6741
const SCALE_Y = H / 4931

// Column/row *centers* of every field square, measured directly from
// santiago_board_dots.png (a yellow dot hand-placed at the visual center of each
// square), at native 6741×4931 resolution — via connected-component analysis of the
// dot markers, averaged per column/row. This replaces an earlier approach that
// calibrated from the board's corner markers and an estimated gap width, which didn't
// quite match the art (cells crowded the wider ditch between 2×2 blocks).
const COL_CENTERS_ORIG = [642.5, 1381.5, 2247.4, 2976.4, 3840.7, 4570.9, 5438.7, 6175.9]
const ROW_CENTERS_ORIG = [544.6, 1275.5, 2128.7, 2838.7, 3692.0, 4407.0]

// Center-to-center spacing alternates: *inner* (within a 2×2 block, indices 0-1, 2-3,
// 4-5, 6-7) vs *ditch* (between blocks, indices 1-2, 3-4, 5-6) — the ditch is where
// canals actually run, and is visibly wider than the plain rock-line block divider.
function avgSpacing(centers: number[], parity: 0 | 1): number {
    const spacings: number[] = []
    for (let i = 0; i < centers.length - 1; i++) {
        if (i % 2 === parity) spacings.push(centers[i + 1] - centers[i])
    }
    return spacings.reduce((a, b) => a + b, 0) / spacings.length
}

// Uniform cell size solved from the *inner* spacing and an independently-measured
// inner-divider width (≈75.75px at native res, from a luminance-profile scan of the
// thin rock line — corroborated by both axes resolving to near-identical cell sizes
// once converted to display scale, ≈75px square).
const INNER_GAP_ORIG = 75.75
const CELL_W_ORIG = avgSpacing(COL_CENTERS_ORIG, 0) - INNER_GAP_ORIG // ≈658.0
const CELL_H_ORIG = avgSpacing(ROW_CENTERS_ORIG, 0) - INNER_GAP_ORIG // ≈642.85
const DITCH_GAP_X_ORIG = avgSpacing(COL_CENTERS_ORIG, 1) - CELL_W_ORIG // ≈208.0
const DITCH_GAP_Y_ORIG = avgSpacing(ROW_CENTERS_ORIG, 1) - CELL_H_ORIG // ≈210.4

export const CELL_W = CELL_W_ORIG * SCALE_X // ≈75.0 px
export const CELL_H = CELL_H_ORIG * SCALE_Y // ≈75.1 px
const INNER_GAP_X = INNER_GAP_ORIG * SCALE_X
const INNER_GAP_Y = INNER_GAP_ORIG * SCALE_Y
const DITCH_GAP_X = DITCH_GAP_X_ORIG * SCALE_X
const DITCH_GAP_Y = DITCH_GAP_Y_ORIG * SCALE_Y

// Field bounding box derived from the measured cell grid itself (leftmost/topmost
// cell's outer edge to the rightmost/bottommost cell's outer edge), rather than a
// separately-calibrated corner marker — keeps the overlay grid and the measured
// centers single-sourced and self-consistent.
export const BORDER_X = COL_CENTERS_ORIG[0] * SCALE_X - CELL_W / 2
export const BORDER_Y = ROW_CENTERS_ORIG[0] * SCALE_Y - CELL_H / 2
export const FIELD_W = (COL_CENTERS_ORIG[7] - COL_CENTERS_ORIG[0]) * SCALE_X + CELL_W
export const FIELD_H = (ROW_CENTERS_ORIG[5] - ROW_CENTERS_ORIG[0]) * SCALE_Y + CELL_H

// Left edge (relative to BORDER_X/BORDER_Y) of each of the 8 columns / 6 rows of cells,
// walking cell-by-cell and alternating inner/ditch gaps (inner within a block, ditch
// between blocks — a block is 2 cells wide/tall).
function cellStarts(cellSize: number, innerGap: number, ditchGap: number, count: number): number[] {
    const starts: number[] = []
    let pos = 0
    for (let i = 0; i < count; i++) {
        starts.push(pos)
        pos += cellSize
        if (i < count - 1) {
            pos += i % 2 === 1 ? ditchGap : innerGap
        }
    }
    return starts
}

export const COL_STARTS = cellStarts(CELL_W, INNER_GAP_X, DITCH_GAP_X, 8)
export const ROW_STARTS = cellStarts(CELL_H, INNER_GAP_Y, DITCH_GAP_Y, 6)

// CSS grid track list: cell, gap, cell, gap, ... — the gap tracks are real tracks (not
// CSS `gap`, since `gap` can't alternate between two different widths), and field-square
// buttons are placed explicitly into the odd 1-indexed cell tracks.
function gridTemplate(cellSize: number, innerGap: number, ditchGap: number, count: number): string {
    const tracks: string[] = []
    for (let i = 0; i < count; i++) {
        tracks.push(`${cellSize}px`)
        if (i < count - 1) tracks.push(`${i % 2 === 1 ? ditchGap : innerGap}px`)
    }
    return tracks.join(' ')
}

export const GRID_TEMPLATE_COLUMNS = gridTemplate(CELL_W, INNER_GAP_X, DITCH_GAP_X, 8)
export const GRID_TEMPLATE_ROWS = gridTemplate(CELL_H, INNER_GAP_Y, DITCH_GAP_Y, 6)

// Maps a (col, row) grid-track index (0-indexed cell position) to its 1-indexed CSS
// grid-column/grid-row line — cells sit at every other track (tracks alternate cell/gap).
export function gridLine(cellIndex: number): number {
    return cellIndex * 2 + 1
}

// Ditch intersections — where canals are rooted/connected. col ∈ [0,4], row ∈ [0,3],
// matching @tabletop/santiago's CanalSegment/Intersection indexing. Interior
// intersections sit at the center of the ditch gap between two blocks; the outer ones
// are simply the field's own edges.
function intersections(starts: number[], cellSize: number, ditchGap: number, fieldSize: number): number[] {
    const result = [0]
    for (let i = 1; i < starts.length - 1; i += 2) {
        result.push(starts[i] + cellSize + ditchGap / 2)
    }
    result.push(fieldSize)
    return result
}

const INTERSECTION_X = intersections(COL_STARTS, CELL_W, DITCH_GAP_X, FIELD_W)
const INTERSECTION_Y = intersections(ROW_STARTS, CELL_H, DITCH_GAP_Y, FIELD_H)

// Empirically, the outer-edge ditch cracks in the board art don't quite line up with the
// field's measured bounding-box edges — nudge just those intersections (rather than the
// whole measured grid) to match: left 8px further left, top 8px further up, bottom 8px
// further down, right 6px further right.
INTERSECTION_X[0] -= 8
INTERSECTION_X[INTERSECTION_X.length - 1] += 6
INTERSECTION_Y[0] -= 8
INTERSECTION_Y[INTERSECTION_Y.length - 1] += 8

export function intersectionX(col: number): number {
    return BORDER_X + INTERSECTION_X[col]
}

export function intersectionY(row: number): number {
    return BORDER_Y + INTERSECTION_Y[row]
}
