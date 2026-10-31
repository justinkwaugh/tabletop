// A player card tallies captured pieces as stacks no taller than this, beside the count.
export const TALLY_HEIGHT = 5

// Captured pieces as stacks, left to right, each bottom to top: the first taken stand at the
// right and each stack fills before the next starts on its left.
export function tallyStacks<T>(taken: readonly T[], height = TALLY_HEIGHT): T[][] {
    return Array.from({ length: Math.ceil(taken.length / height) }, (_, index) =>
        taken.slice(index * height, (index + 1) * height)
    ).reverse()
}
