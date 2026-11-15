export function nameListSeparator(position: number, count: number): string {
    if (position >= count - 1) return ''
    return position === count - 2 ? ' and ' : ', '
}

export function winVerb(winnerId: string, myPlayerId: string | undefined): string {
    return winnerId === myPlayerId ? 'win' : 'wins'
}
