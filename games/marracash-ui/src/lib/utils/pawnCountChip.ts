import { PawnUnitSize, PawnWidth } from '$lib/utils/pawnShape.js'

const ChipPawnSize = 16

export const PawnCountChip = {
    height: 36,
    padding: 9,
    gap: 5,
    digitWidth: 9.5,
    pawnSize: ChipPawnSize,
    pawnWidth: (PawnWidth * ChipPawnSize) / PawnUnitSize
} as const

export function pawnCountChipWidth(count: number): number {
    const { padding, pawnWidth, gap, digitWidth } = PawnCountChip
    return 2 * padding + pawnWidth + gap + String(count).length * digitWidth
}
