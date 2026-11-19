export type SealId = `seal.${number}`

/** R-1.1 The bead side's value. */
export type BeadValue = 2 | 3 | 4 | 5

export interface SealBeadCount {
    readonly beadValue: BeadValue
    readonly count: number
}

/** R-1.1 How many discs show each bead value. */
export const SealBeadCounts: readonly SealBeadCount[] = [
    { beadValue: 2, count: 9 },
    { beadValue: 3, count: 5 },
    { beadValue: 4, count: 2 },
    { beadValue: 5, count: 1 }
]

/** R-1.1 Every seal side looks alike; R-5-H1 hides the bead behind it. */
export const SealFace = 'red, white crown'

export interface Seal {
    readonly id: SealId
    readonly beadValue: BeadValue
}

/**
 * R-1.1 One two-sided disc each, a king's seal one side and a rosary bead the other. The discs carry
 * no id, so `seal.<n>` numbers them by assigning the values in order.
 */
export const Seals: readonly Seal[] = SealBeadCounts.flatMap(({ beadValue, count }) =>
    Array.from({ length: count }, () => beadValue)
).map((beadValue, index) => ({ id: `seal.${index + 1}`, beadValue }))

/** R-1.1 */
export const SealTotal = Seals.length
