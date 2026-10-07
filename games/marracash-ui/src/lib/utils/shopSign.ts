import type { Point } from '@tabletop/common'
import type { HydratedMarracashPlayerState } from '@tabletop/marracash'
import { pawnCountChipWidth } from '$lib/utils/pawnCountChip.js'

export const SignShadowOffset = { x: 2.5, y: 3 }
export const SignHalfWidth = 22
const ChipGap = 8
const ChipBelowOffset = 22

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

export function playerStandeeOutline(
    players: readonly HydratedMarracashPlayerState[],
    playerId: string
): string {
    return standeeOutline(players.findIndex((player) => player.playerId === playerId))
}

export function signInitial(name: string): string {
    return name.charAt(0).toUpperCase()
}

export const SignCream = '#f6e7c1'
const SignFrameScale = 0.84
const SignFrameCenterY = -28
export const SignFrame = {
    transform: `translate(0 ${SignFrameCenterY}) scale(${SignFrameScale}) translate(0 ${-SignFrameCenterY})`,
    strokeWidth: 1.3 / SignFrameScale
}
export const SignTopOrnament = 'M -3.5 -45 L 0 -48.5 L 3.5 -45 L 0 -41.5 Z'
export const SignBottomOrnament = 'M -3 -13.5 L 0 -16 L 3 -13.5 L 0 -11 Z'
export const SignFaceCenterY = -28.75

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
    const chipWidth = customers > 0 ? pawnCountChipWidth(customers) : 0
    const groupWidth = 2 * SignHalfWidth + (chipWidth > 0 ? ChipGap + chipWidth : 0)
    const left = center.x - groupWidth / 2
    return {
        ground: { x: left + SignHalfWidth, y: center.y - SignFaceCenterY },
        chip: { x: left + 2 * SignHalfWidth + ChipGap + chipWidth / 2, y: center.y }
    }
}
