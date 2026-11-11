export function sortedEqualGroups<T>(items: readonly T[], compare: (a: T, b: T) => number): T[][] {
    const sorted = [...items].sort(compare)
    const groups: T[][] = []
    sorted.forEach((item, index) => {
        if (index > 0 && compare(sorted[index - 1], item) === 0)
            groups[groups.length - 1].push(item)
        else groups.push([item])
    })
    return groups
}
