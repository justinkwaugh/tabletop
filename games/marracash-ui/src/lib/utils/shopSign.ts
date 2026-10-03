import type { Point } from '@tabletop/common'
import { pawnCountChipWidth } from '$lib/utils/pawnCountChip.js'

export const SignShadowOffset = { x: 2.5, y: 3 }
export const SignHeight = 58
export const SignHalfWidth = 22
const ChipGap = 6
const ChipBelowOffset = 20

// After the original's cardboard standees, whose tops are cut in a few shapes;
// each seat gets its own so owners differ by more than colour. Every top keeps
// its centre high enough for the frame and the top ornament to fit inside.
const StandeeTops = [
    'M -20 -6 V -38 A 20 16 0 0 1 20 -38 V -6 Z',
    'M -20 -6 V -42 A 7 7 0 0 1 -8 -48 A 8 8 0 0 1 8 -48 A 7 7 0 0 1 20 -42 V -6 Z',
    'M -20 -6 V -42 H -13 V -48 H -6 V -54 H 6 V -48 H 13 V -42 H 20 V -6 Z',
    'M -20 -6 V -36 C -20 -46 -6 -44 0 -56 C 6 -44 20 -46 20 -36 V -6 Z'
] as const

export function standeeOutline(seat: number): string {
    return StandeeTops[seat % StandeeTops.length]
}

export type ShopSignLayout = { ground: Point; chip: Point }

export function shopSignLayout(
    center: Point,
    vertical: boolean,
    customers: number
): ShopSignLayout {
    if (vertical) {
        const ground = { x: center.x, y: center.y + 12 }
        return { ground, chip: { x: center.x, y: ground.y + ChipBelowOffset } }
    }
    const ground = { x: center.x - 10, y: center.y + SignHeight / 2 }
    const chipWidth = pawnCountChipWidth(customers)
    return {
        ground,
        chip: { x: ground.x + SignHalfWidth + ChipGap + chipWidth / 2, y: center.y + 8 }
    }
}
