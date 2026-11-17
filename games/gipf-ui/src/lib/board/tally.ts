export const TALLY_HEIGHT = 3

// Right to left, as the tray right-aligns it: full stacks on the right, what is left over first.
export function tallyStacks(count: number, height = TALLY_HEIGHT): number[] {
    return Array.from({ length: Math.ceil(count / height) }, (_, index) =>
        Math.min(height, count - index * height)
    ).reverse()
}
