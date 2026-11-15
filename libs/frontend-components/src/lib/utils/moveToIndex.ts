export function moveToIndex<T>(items: readonly T[], item: T, index: number): T[] {
    const rest = items.filter((other) => other !== item)
    rest.splice(Math.max(0, Math.min(rest.length, index)), 0, item)
    return rest
}
