import type { MarketColor } from '@tabletop/marracash'

export type AwningCrease = { path: string; width: number; strength: number }

const LongEdgeSag = 11
const ShortEdgeSag = 5
const CreaseReaches: readonly { along: number; across: number }[] = [
    { along: 0.42, across: 0.18 },
    { along: 0.3, across: 0.34 },
    { along: 0.16, across: 0.42 }
]
const CreaseWidths = [7, 5.5, 4]

export const AwningClothFilterId = 'marracash-awning-cloth'
export const AwningCreaseBlurId = 'marracash-awning-crease-blur'
export const AwningShadeOffset = 3

export function awningGradientId(color: MarketColor): string {
    return `marracash-awning-shade-${color}`
}

export function awningStripesId(color: MarketColor, vertical: boolean): string {
    return `marracash-awning-stripes-${color}-${vertical ? 'vertical' : 'horizontal'}`
}

export function awningOutline(width: number, height: number): string {
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

export function awningCreases(width: number, height: number): AwningCrease[] {
    const corners = [
        { x: 0, y: 0, dx: 1, dy: 1 },
        { x: width, y: 0, dx: -1, dy: 1 },
        { x: width, y: height, dx: -1, dy: -1 },
        { x: 0, y: height, dx: 1, dy: -1 }
    ]
    return corners.flatMap((corner) =>
        CreaseReaches.map((reach, index) => {
            const endX = corner.x + corner.dx * width * reach.along
            const endY = corner.y + corner.dy * height * reach.across
            const bendX = corner.x + corner.dx * (width * reach.along * 0.45 + 3)
            const bendY = corner.y + corner.dy * height * reach.across * 0.55
            return {
                path: `M ${corner.x} ${corner.y} Q ${bendX} ${bendY} ${endX} ${endY}`,
                width: CreaseWidths[index],
                strength: 1 - index * 0.2
            }
        })
    )
}
