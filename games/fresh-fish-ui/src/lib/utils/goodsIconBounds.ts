import type { BoundingBox, Point } from '@tabletop/common'
import { GoodsType } from '@tabletop/fresh-fish'

type GoodsIconShape = {
    /** The drawn extent within the icon's 20 × 20 box. */
    bounds: BoundingBox
    /** Where the eye reads the icon's middle; the cheese wedge's mass sits to its right. */
    center: Point
}

const GOODS_ICON_SHAPES: Record<GoodsType, GoodsIconShape> = {
    [GoodsType.Fish]: {
        bounds: { x: 1.5, y: 5.6, width: 17.5, height: 8.8 },
        center: { x: 10.25, y: 10 }
    },
    [GoodsType.Cheese]: {
        bounds: { x: 1.5, y: 5.5, width: 17, height: 10 },
        center: { x: 13, y: 10.5 }
    },
    [GoodsType.IceCream]: {
        bounds: { x: 2.6, y: 3.8, width: 14.8, height: 12.8 },
        center: { x: 10, y: 10.2 }
    },
    [GoodsType.Lemonade]: {
        bounds: { x: 4.2, y: 0.5, width: 11.6, height: 18 },
        center: { x: 10, y: 9.5 }
    }
}

/**
 * The SVG transform that fits a goods icon in `area`, as large as `fill` of its width and height
 * allows, then moves its visual middle toward the area's as far as the area's edges permit.
 * `maxCoverage` caps the icon's box at that share of the area, so wide icons don't outgrow the
 * others.
 */
export function fitGoodsIcon(
    goodsType: GoodsType,
    area: BoundingBox,
    { fill, maxCoverage = 1 }: { fill: number; maxCoverage?: number }
): string {
    const { bounds, center } = GOODS_ICON_SHAPES[goodsType]
    const scale = Math.min(
        (area.width * fill) / bounds.width,
        (area.height * fill) / bounds.height,
        Math.sqrt((area.width * area.height * maxCoverage) / (bounds.width * bounds.height))
    )
    const shiftX = clampShift(
        (center.x - (bounds.x + bounds.width / 2)) * scale,
        area.width - bounds.width * scale
    )
    const shiftY = clampShift(
        (center.y - (bounds.y + bounds.height / 2)) * scale,
        area.height - bounds.height * scale
    )
    const x = area.x + area.width / 2 - shiftX
    const y = area.y + area.height / 2 - shiftY
    return `translate(${x} ${y}) scale(${scale}) translate(${-(bounds.x + bounds.width / 2)} ${-(bounds.y + bounds.height / 2)})`
}

function clampShift(shift: number, slack: number): number {
    const limit = Math.max(0, slack / 2)
    return Math.max(-limit, Math.min(limit, shift))
}
