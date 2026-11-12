export function orderedSubset<T>(order: readonly T[], chosen: readonly T[]): T[] {
    return order.filter((member) => chosen.includes(member))
}

export function toggledMember<T>(order: readonly T[], chosen: readonly T[], member: T): T[] {
    return orderedSubset(
        order,
        chosen.includes(member) ? chosen.filter((item) => item !== member) : [...chosen, member]
    )
}
