export function findLastIndex<T>(
    array: Array<T>,
    predicate: (value: T, index: number, obj: T[]) => boolean
): number {
    let l = array.length
    while (l--) {
        if (predicate(array[l], l, array)) return l
    }
    return -1
}

export function findLast<T>(
    array: Array<T>,
    predicate: (value: T, index: number, obj: T[]) => boolean
): T | undefined {
    const index = findLastIndex(array, predicate)
    return index >= 0 ? array[index] : undefined
}
