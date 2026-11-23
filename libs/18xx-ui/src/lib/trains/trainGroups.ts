/** A run of the same train in a list, shown once with its count from three on. */
export type TrainGroup = { definitionId: string; count: number }

/** The trains of a list by kind, in the order each kind first appears. */
export function trainGroups(definitionIds: readonly string[]): TrainGroup[] {
    const groups: TrainGroup[] = []
    for (const definitionId of definitionIds) {
        const group = groups.find((entry) => entry.definitionId === definitionId)
        if (group) group.count++
        else groups.push({ definitionId, count: 1 })
    }
    return groups
}
