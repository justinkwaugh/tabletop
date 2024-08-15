export function removeWhen<T>(
    array: T[],
    predicate: (value: T, index: number, obj: T[]) => boolean
) {
    array.forEach((item, index) => {
        if (predicate(item, index, array)) array.splice(index, 1)
    })
}

export function remove<T>(array: T[], value: T) {
    array.forEach((item, index) => {
        if (item === value) array.splice(index, 1)
    })
}
