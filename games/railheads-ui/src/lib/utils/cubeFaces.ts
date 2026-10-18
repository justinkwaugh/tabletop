import type { Point } from '@tabletop/common'

export type CubeSize = { halfWidth: number; halfDepth: number; height: number }

// A cube turned corner-on and seen from above the front, like the discs: `top` is the centre of its top face.
export function cubeFaces(top: Point, size: CubeSize) {
    const { x, y } = top
    const { halfWidth: w, halfDepth: d, height: h } = size
    return {
        outline: `M ${x} ${y - d} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + d + h} L ${x - w} ${y + h} L ${x - w} ${y} Z`,
        top: `M ${x} ${y - d} L ${x + w} ${y} L ${x} ${y + d} L ${x - w} ${y} Z`,
        left: `M ${x - w} ${y} L ${x} ${y + d} L ${x} ${y + d + h} L ${x - w} ${y + h} Z`,
        right: `M ${x + w} ${y} L ${x} ${y + d} L ${x} ${y + d + h} L ${x + w} ${y + h} Z`
    }
}
