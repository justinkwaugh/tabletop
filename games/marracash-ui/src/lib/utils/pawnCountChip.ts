import { PawnUnitSize, PawnWidth } from '$lib/utils/pawnShape.js'

export const PawnCountChip = {
    height: 32,
    padding: 7,
    gap: 4,
    digitWidth: 9.5,
    pawnSize: 18,
    pawnWidth: (PawnWidth * 18) / PawnUnitSize
} as const

export function pawnCountChipWidth(count: number): number {
    const { padding, pawnWidth, gap, digitWidth } = PawnCountChip
    return 2 * padding + pawnWidth + gap + String(count).length * digitWidth
}
