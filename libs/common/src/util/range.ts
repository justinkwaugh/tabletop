export function range(start: number, stop: number) {
    const result = []
    const end = start + stop
    for (start; start < end; start++) {
        result.push(start)
    }
    return result
}
