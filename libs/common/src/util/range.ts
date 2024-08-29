export function range(start: number, steps: number) {
    const result = []
    const end = start + steps
    for (start; start < end; start++) {
        result.push(start)
    }
    return result
}
