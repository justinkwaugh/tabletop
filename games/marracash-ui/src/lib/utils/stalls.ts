import { getPrng, type Point } from '@tabletop/common'
import type { MarketColor, ShopId } from '@tabletop/marracash'

export type StallKind = 'tent' | 'rug'
export type Segment = { from: Point; to: Point }

export const StallShadowOffset = { x: 3, y: 4 }

const RugShopIds: ReadonlySet<ShopId> = new Set<ShopId>([
    'Y2',
    'Y4',
    'P1',
    'P2',
    'P4',
    'R2',
    'R4',
    'B2',
    'B4',
    'G2',
    'G4'
])

const LongEdgeSag = 11
const ShortEdgeSag = 5
const RugWobble = 1.3
const RugEdgeStep = 12
const FringeLength = 4
const FringeSpacing = 3.5
const FringeMargin = 4

export function stallKind(shopId: ShopId): StallKind {
    return RugShopIds.has(shopId) ? 'rug' : 'tent'
}

export function canvasStripesId(color: MarketColor, vertical: boolean): string {
    return `marracash-canvas-${color}-${vertical ? 'vertical' : 'horizontal'}`
}

export function kilimId(color: MarketColor, vertical: boolean): string {
    return `marracash-kilim-${color}-${vertical ? 'vertical' : 'horizontal'}`
}

export function tentOutline(width: number, height: number): string {
    const horizontal = width >= height
    const topSag = horizontal ? LongEdgeSag : ShortEdgeSag
    const sideSag = horizontal ? ShortEdgeSag : LongEdgeSag
    return [
        `M 0 0`,
        `Q ${width / 2} ${topSag} ${width} 0`,
        `Q ${width - sideSag} ${height / 2} ${width} ${height}`,
        `Q ${width / 2} ${height - topSag} 0 ${height}`,
        `Q ${sideSag} ${height / 2} 0 0 Z`
    ].join(' ')
}

export function tentRidge(width: number, height: number): string {
    return height > width ? `M ${width / 2} 4 V ${height - 4}` : `M 4 ${height / 2} H ${width - 4}`
}

function shopSeed(shopId: ShopId): number {
    return [...shopId].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)
}

function format(point: Point): string {
    return `${point.x.toFixed(1)} ${point.y.toFixed(1)}`
}

// A hand-woven rug's edges wander a little; each shop's rug keeps the same shape every game.
export function rugOutline(shopId: ShopId, width: number, height: number): string {
    const random = getPrng(shopSeed(shopId))
    const corners: Point[] = [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height }
    ]
    const points = corners.flatMap((from, side) => {
        const to = corners[(side + 1) % corners.length]
        const length = Math.hypot(to.x - from.x, to.y - from.y)
        const count = Math.max(2, Math.round(length / RugEdgeStep))
        const normal = { x: -(to.y - from.y) / length, y: (to.x - from.x) / length }
        return Array.from({ length: count }, (_, index) => {
            const along = index / count
            const offset = index === 0 ? 0 : (random() * 2 - 1) * RugWobble
            return {
                x: from.x + (to.x - from.x) * along + normal.x * offset,
                y: from.y + (to.y - from.y) * along + normal.y * offset
            }
        })
    })
    const midpoints = points.map((point, index) => {
        const next = points[(index + 1) % points.length]
        return { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }
    })
    const curves = points.map((point, index) => `Q ${format(point)} ${format(midpoints[index])}`)
    return `M ${format(midpoints[midpoints.length - 1])} ${curves.join(' ')} Z`
}

export function stallOutline(shopId: ShopId, width: number, height: number): string {
    return stallKind(shopId) === 'rug'
        ? rugOutline(shopId, width, height)
        : tentOutline(width, height)
}

export function rugFringe(width: number, height: number): Segment[] {
    const vertical = height > width
    const span = vertical ? width : height
    const count = Math.floor((span - 2 * FringeMargin) / FringeSpacing)
    const ends = vertical ? [0, height] : [0, width]
    return ends.flatMap((end) => {
        const outward = end === 0 ? -FringeLength : FringeLength
        return Array.from({ length: count }, (_, index) => {
            const at = FringeMargin + index * FringeSpacing
            return vertical
                ? { from: { x: at, y: end }, to: { x: at, y: end + outward } }
                : { from: { x: end, y: at }, to: { x: end + outward, y: at } }
        })
    })
}
