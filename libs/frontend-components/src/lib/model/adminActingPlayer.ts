export function shouldInvalidateAdminActingPlayerChoice({
    isExploring,
    chosenPlayerId,
    activePlayerIds
}: {
    isExploring: boolean
    chosenPlayerId: string | undefined
    activePlayerIds: string[]
}): boolean {
    return !isExploring && chosenPlayerId !== undefined && !activePlayerIds.includes(chosenPlayerId)
}
