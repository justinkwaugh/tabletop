import type { Point } from '@tabletop/common'
import type { TileRevenue } from '@tabletop/18xx'
import { tilePathPoint, type TileDrawnPath } from './tileTrackGeometry.js'

export type RevenueCell = Point & {
    stage: string
    amount: number
    /** The printed value: the amount, after any stage prefix such as D for diesel. */
    text: string
    width: number
    height: number
    /** Printed beside the value, as its phases. */
    caption?: string
    captionWidth: number
    /** The caption prints after the value rather than before it. */
    captionAfter?: true
}

/** A caption's width at its bold 7.5 size: roman numerals are mostly narrow I's. */
function captionTextWidth(caption: string): number {
    return [...caption].reduce(
        (sum, character) =>
            sum + (/[Iil1|]/.test(character) ? 2.2 : /[-. ]/.test(character) ? 3.1 : 5.3),
        0
    )
}

export function stagedRevenueLayout(
    revenue: TileRevenue,
    anchor: Point,
    vertices: readonly Point[],
    paths: readonly TileDrawnPath[],
    occupied: readonly Point[],
    {
        stageLabels = {},
        captions = {},
        captionAfter = false,
        stack,
        fixed = false
    }: {
        stageLabels?: Readonly<Record<string, string>>
        /** Phases printed beside each of several values, which then stack in a column. */
        captions?: Readonly<Record<string, string>>
        /** Prints the captions after the values, as on a board's east edge. */
        captionAfter?: boolean
        stack?: 'column' | 'row'
        /** The anchor is a layout's chosen position, so the cells centre on it. */
        fixed?: boolean
    } = {}
): RevenueCell[] {
    if (revenue.kind !== 'staged') return []
    const text = (value: { stage: string; amount: number }) =>
        `${stageLabels[value.stage] ?? ''}${value.amount}`
    const width = Math.max(17, ...revenue.values.map((value) => text(value).length * 6 + 5))
    const height = 13
    const captioned =
        revenue.values.length > 1 && revenue.values.some((value) => captions[value.stage])
    // Which side of the value the caption takes: -1 before it, 1 after it.
    const side = captionAfter ? 1 : -1
    const captionWidth = captioned
        ? Math.max(
              ...revenue.values.map((value) => captionTextWidth(captions[value.stage] ?? ''))
          ) + 3
        : 0
    const track = paths.flatMap((path) =>
        Array.from({ length: 21 }, (_, i) => tilePathPoint(path, i / 20))
    )
    const candidates = [
        anchor,
        ...[0.75, 0.5, 0].map((scale) => ({ x: anchor.x * scale, y: anchor.y * scale }))
    ]
    let best: RevenueCell[] = []
    let bestScore = -Infinity
    for (const row of captioned ? [false] : stack ? [stack === 'row'] : [true, false]) {
        const centeredCandidates = [-30, -22, 22, 30].map((offset) =>
            row ? { x: 0, y: offset } : { x: offset, y: 0 }
        )
        for (const center of fixed ? [anchor] : [...centeredCandidates, ...candidates]) {
            const cells = revenue.values.map((value, index) => ({
                ...value,
                text: text(value),
                ...(captioned && captions[value.stage] ? { caption: captions[value.stage] } : {}),
                captionWidth,
                ...(captionAfter ? { captionAfter: true as const } : {}),
                width,
                height,
                x:
                    center.x +
                    (-side * captionWidth) / 2 +
                    (row ? (index - (revenue.values.length - 1) / 2) * width : 0),
                y: center.y + (row ? 0 : (index - (revenue.values.length - 1) / 2) * height)
            }))
            const corners = cells.flatMap((cell) =>
                [
                    cell.x - width / 2 - (side < 0 ? captionWidth : 0),
                    cell.x + width / 2 + (side > 0 ? captionWidth : 0)
                ].flatMap((x) => [-1, 1].map((y) => ({ x, y: cell.y + (y * height) / 2 })))
            )
            const inside = corners.every((point) =>
                vertices.every((a, index) => {
                    const b = vertices[(index + 1) % vertices.length]
                    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)
                    const centerCross = (b.x - a.x) * -a.y - (b.y - a.y) * -a.x
                    return cross * centerCross >= 0
                })
            )
            const clearance = Math.min(
                ...cells.flatMap((cell) =>
                    [...track, ...occupied].map((point) =>
                        Math.hypot(
                            Math.max(
                                0,
                                Math.abs(point.x - (cell.x + (side * captionWidth) / 2)) -
                                    (width + captionWidth) / 2
                            ),
                            Math.max(0, Math.abs(point.y - cell.y) - height / 2)
                        )
                    )
                )
            )
            const centered = row ? center.x === 0 : center.y === 0
            const score =
                (inside ? 1000 : 0) -
                Math.max(0, 5 - clearance) * 30 +
                (centered ? 20 : 0) +
                Math.min(clearance, 12) -
                Math.hypot(center.x - anchor.x, center.y - anchor.y) * 0.1
            if (score > bestScore) {
                best = cells
                bestScore = score
            }
        }
    }
    return best
}
