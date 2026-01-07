export function assert(condition: unknown, msg?: string): asserts condition {
    if (!condition) throw new Error(msg ?? 'Assertion failed')
}

export function assertExists<T>(maybe: T, msg?: string): asserts maybe is NonNullable<T> {
    if (maybe == null) throw new Error(msg ?? `${maybe} doesn't exist`)
}
