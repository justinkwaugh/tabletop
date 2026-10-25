export function nameListSeparator(position: number, count: number): string {
    if (position >= count - 1) return ''
    return position === count - 2 ? ' and ' : ', '
}

export function winVerb(winnerIds: readonly string[], myPlayerId: string | undefined): string {
    return winnerIds.length === 1 && winnerIds[0] !== myPlayerId ? 'wins' : 'win'
}
