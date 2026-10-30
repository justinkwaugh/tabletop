// A player card tallies captured pieces as stacks no taller than this, beside the count.
export const TALLY_HEIGHT = 5

// How many discs stand in each stack of a tally of the given number of pieces, full stacks first.
export function tallyStacks(count: number, height = TALLY_HEIGHT): number[] {
    return Array.from({ length: Math.ceil(count / height) }, (_, index) =>
        Math.min(height, count - index * height)
    )
}
