export const TALLY_HEIGHT = 3

export function tallyStacks(count: number, height = TALLY_HEIGHT): number[] {
    return Array.from({ length: Math.ceil(count / height) }, (_, index) =>
        Math.min(height, count - index * height)
    )
}
