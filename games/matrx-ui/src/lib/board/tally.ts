export const TALLY_HEIGHT = 5

// The first taken stand at the right; each stack fills before the next starts on its left.
export function tallyStacks<T>(taken: readonly T[], height = TALLY_HEIGHT): T[][] {
    return Array.from({ length: Math.ceil(taken.length / height) }, (_, index) =>
        taken.slice(index * height, (index + 1) * height)
    ).reverse()
}
