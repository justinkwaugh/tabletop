const Ordinals = ['first', 'second', 'third', 'fourth']

export function ordinal(rank: number): string {
    return Ordinals[rank]
}

const ShortOrdinals = ['1st', '2nd', '3rd', '4th']

export function shortOrdinal(rank: number): string {
    return ShortOrdinals[rank]
}
