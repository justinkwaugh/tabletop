export function szudzikPair(x: number, y: number) {
    return x >= y ? x * x + x + y : y * y + x
}

export function szudzikPairSigned(x: number, y: number) {
    const a = x >= 0.0 ? 2.0 * x : -2.0 * x - 1.0
    const b = y >= 0.0 ? 2.0 * y : -2.0 * y - 1.0
    return szudzikPair(a, b) * 0.5
}
